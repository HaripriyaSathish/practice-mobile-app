"""Keeps a multivendor order consistent.

Each OrderItem has its own status, set by the seller who owns it. The order's overall status is the
"slowest" item (e.g. one item shipped + one still placed -> order is Placed). Items sold by the store
itself (seller empty) follow the order status the admin sets in the admin panel.
"""
from django.utils import timezone

FLOW = ["PLACED", "CONFIRMED", "SHIPPED", "DELIVERED"]


def stage(status):
    return FLOW.index(status) if status in FLOW else -1


def sync_order_status(order):
    """Recalculate order.status from its items. Saves (and so emails the buyer) only when it changes."""
    if order.status == "CANCELLED":
        return
    statuses = [s for s in order.items.values_list("status", flat=True) if s in FLOW]
    if not statuses:
        return
    slowest = min(statuses, key=stage)
    if slowest != order.status:
        order.status = slowest
        order.save(update_fields=["status"])


def follow_order_status(order):
    """Admin changed the order status: move store-owned items (and, on cancel, every item) along with it."""
    from .models import OrderItem
    now = timezone.now()
    if order.status == "CANCELLED":
        order.items.exclude(status="CANCELLED").update(status="CANCELLED", status_updated_at=now)
        return
    behind = [s for s in FLOW if stage(s) < stage(order.status)]
    OrderItem.objects.filter(order=order, seller__isnull=True, status__in=behind).update(
        status=order.status, status_updated_at=now)
