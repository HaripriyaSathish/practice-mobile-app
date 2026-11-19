from django.conf import settings
from django.db import transaction
from django.db.models import F
from django.db.models.signals import post_save
from django.dispatch import receiver
from django.utils import timezone

from .emails import send_status_update
from .models import Order, Product
from .multivendor import follow_order_status


@receiver(post_save, sender=Order)
def on_order_status_change(sender, instance, created, raw=False, **kwargs):
    """Runs for every status change - from the app, a seller, the admin edit page, list edit or bulk actions."""
    if raw:  # loaddata
        return
    old = instance._original_status
    instance._original_status = instance.status
    if created or instance.status == old:
        return

    follow_order_status(instance)
    if instance.status == "CANCELLED":
        _handle_cancellation(instance)

    send_status_update(instance, settings.SITE_URL)


def _handle_cancellation(order):
    from .payments import refund_order

    with transaction.atomic():
        # put the items back in stock
        for item in order.items.exclude(product=None):
            Product.objects.filter(pk=item.product_id).update(stock=F("stock") + item.quantity)
        fields = {"cancelled_at": timezone.now()}
        if not order.cancel_reason:
            fields["cancel_reason"] = "Cancelled by store"
        if order.payment_status == "PENDING":
            fields["payment_status"] = "FAILED"  # unpaid online order: nothing to refund
        Order.objects.filter(pk=order.pk).update(**fields)
        for k, v in fields.items():
            setattr(order, k, v)

    refund_order(order)  # full refund for paid Cashfree orders (sandbox)
