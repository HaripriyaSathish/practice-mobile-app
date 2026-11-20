"""Demo ("mock") courier with automatic tracking.

When a seller (or the admin, for store-owned items) marks items as Shipped, a Shipment is booked with a demo
courier and a tracking number (AWB). Its tracking then moves forward on its own as time passes:

    Booked -> Picked up -> In transit -> Out for delivery -> Delivered

Render's free plan has no background workers or cron, so instead of a timer we "catch up" whenever someone
looks: advance_open_shipments() runs (at most every 30 seconds) when buyers, sellers or the admin open
their orders. When a parcel is delivered its items become Delivered, which updates the order and emails the
buyer exactly like a manual status change.

SHIPPING_STEP_MINUTES (env / settings, default 2) = minutes between tracking steps.
"""
import random
from datetime import timedelta

from django.conf import settings
from django.core.cache import cache
from django.db import transaction
from django.utils import timezone

COURIERS = ["Delhivery", "Xpressbees", "Ekart", "Blue Dart", "DTDC"]
# (status, message, place) - each step happens SHIPPING_STEP_MINUTES after the previous one
STEPS = [
    ("BOOKED", "Shipment booked, waiting for courier pickup", "{origin}"),
    ("PICKED_UP", "Picked up from the seller", "{origin}"),
    ("IN_TRANSIT", "Reached the sorting hub", "{hub} hub"),
    ("OUT_FOR_DELIVERY", "Out for delivery with our delivery partner", "{dest}"),
    ("DELIVERED", "Delivered. Thank you for shopping with Vetri!", "{dest}"),
]
STATUSES = [s[0] for s in STEPS]
HUBS = ["Chennai", "Madurai", "Coimbatore", "Bengaluru", "Tiruchirappalli"]


def step_minutes():
    return float(getattr(settings, "SHIPPING_STEP_MINUTES", 2))


def _places(shipment):
    profile = getattr(shipment.seller, "profile", None) if shipment.seller_id else None
    return {"origin": (profile and profile.state) or "Tamil Nadu",
            "dest": shipment.order.ship_state or "Tamil Nadu",
            "hub": HUBS[shipment.pk % len(HUBS)]}


def _event(shipment, index, when):
    status, message, place = STEPS[index]
    return {"status": status, "message": message, "location": place.format(**_places(shipment)),
            "at": when.isoformat()}


def _new_awb():
    from .models import Shipment
    while True:
        awb = "VS" + "".join(random.choices("0123456789", k=10))
        if not Shipment.objects.filter(awb=awb).exists():
            return awb


def book_shipments(order):
    """Book a parcel for every seller's Shipped items of this order that are not in a parcel yet."""
    from .models import Shipment
    loose = order.items.filter(status="SHIPPED", shipment__isnull=True)
    for seller_id in set(loose.values_list("seller_id", flat=True)):
        with transaction.atomic():
            shipment = Shipment.objects.create(order=order, seller_id=seller_id, courier=random.choice(COURIERS),
                                               awb=_new_awb())
            shipment.events = [_event(shipment, 0, shipment.created_at)]
            shipment.save(update_fields=["events"])
            loose.filter(seller_id=seller_id).update(shipment=shipment)


def advance(shipment, now=None):
    """Move one parcel's tracking forward to where it should be by now. Returns True if it changed."""
    from .models import Order
    from .multivendor import sync_order_status
    if shipment.status not in STATUSES[:-1]:  # delivered or cancelled
        return False
    now = now or timezone.now()
    if shipment.order.status == "CANCELLED":
        shipment.status = "CANCELLED"
        shipment.events = shipment.events + [{"status": "CANCELLED", "message": "Shipment cancelled",
                                              "location": "", "at": now.isoformat()}]
        shipment.save(update_fields=["status", "events"])
        return True

    current = STATUSES.index(shipment.status)
    elapsed = (now - shipment.created_at).total_seconds() / 60
    target = min(len(STEPS) - 1, int(elapsed // step_minutes()))
    # the seller already marked everything delivered by hand -> finish the parcel too
    if not shipment.items.exclude(status__in=["DELIVERED", "CANCELLED"]).exists():
        target = len(STEPS) - 1
    if target <= current:
        return False

    step = timedelta(minutes=step_minutes())
    shipment.events = shipment.events + [_event(shipment, i, min(now, shipment.created_at + step * i))
                                         for i in range(current + 1, target + 1)]
    shipment.status = STATUSES[target]
    fields = ["events", "status"]
    if shipment.status == "DELIVERED":
        shipment.delivered_at = now
        fields.append("delivered_at")
    shipment.save(update_fields=fields)

    if shipment.status == "DELIVERED":
        shipment.items.filter(status="SHIPPED").update(status="DELIVERED", status_updated_at=now)
        sync_order_status(Order.objects.get(pk=shipment.order_id))  # fresh copy so the buyer email fires
    return True


def advance_open_shipments(force=False):
    """Catch up every parcel still on its way. Cheap, and throttled to once per 30 seconds."""
    from .models import Shipment
    if not force and not cache.add("shipping:advance-lock", 1, 30):
        return 0
    open_parcels = Shipment.objects.filter(status__in=STATUSES[:-1]).select_related("order", "seller__profile")
    return sum(advance(s) for s in open_parcels)


def tracking_json(shipment):
    if not shipment:
        return None
    return {"id": shipment.id, "courier": shipment.courier, "awb": shipment.awb, "status": shipment.status,
            "status_display": shipment.get_status_display(), "events": shipment.events,
            "delivered_at": shipment.delivered_at, "demo": True}
