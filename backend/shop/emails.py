"""Customer email notifications + signed invoice links."""
import logging
import threading

from django.conf import settings
from django.core import signing
from django.core.mail import EmailMultiAlternatives
from django.template.loader import render_to_string
from django.utils.html import strip_tags

log = logging.getLogger(__name__)
INVOICE_SALT = "southcart-invoice"

STATUS_MESSAGES = {
    "PLACED": ("Order placed", "We have received your order."),
    "CONFIRMED": ("Order confirmed", "Good news! Your order has been confirmed and is being packed."),
    "SHIPPED": ("Order shipped", "Your order is on the way. It will reach you soon."),
    "DELIVERED": ("Order delivered", "Your order has been delivered. Nandri for shopping with us!"),
    "CANCELLED": ("Order cancelled", "Your order has been cancelled and the items are back in stock."),
}


def invoice_token(order):
    return signing.dumps(order.id, salt=INVOICE_SALT)


def order_from_token(token):
    from .models import Order
    order_id = signing.loads(token, salt=INVOICE_SALT)
    return Order.objects.select_related("user").prefetch_related("items").get(pk=order_id)


def invoice_url(order, base_url):
    return f"{base_url.rstrip('/')}/invoice/{invoice_token(order)}/"


def invoice_context(order, base_url=""):
    items = list(order.items.all())
    mrp_total = sum((i.product.mrp if i.product else i.price) * i.quantity for i in items)
    return {
        "order": order,
        "items": items,
        "mrp_total": mrp_total,
        "savings": mrp_total - order.total_amount,
        "invoice_link": invoice_url(order, base_url) if base_url else "",
    }


def _send(subject, html, to):
    def run():
        try:
            msg = EmailMultiAlternatives(subject, strip_tags(html), settings.DEFAULT_FROM_EMAIL, [to])
            msg.attach_alternative(html, "text/html")
            msg.send()
        except Exception:  # never break checkout because of email problems
            log.exception("Could not send email to %s", to)

    threading.Thread(target=run, daemon=True).start()


def send_order_confirmation(order, base_url):
    """Sent when a COD order is placed or an online payment succeeds. Contains the full invoice."""
    if not order.user.email:
        return
    ctx = invoice_context(order, base_url)
    ctx["is_email"] = True
    html = render_to_string("shop/invoice.html", ctx)
    _send(f"Order #{order.id} confirmed - Invoice {order.invoice_number} | Vetri Shopping Hall", html, order.user.email)
    send_seller_new_order(order)


def send_seller_new_order(order):
    """Tell every seller in the order which of their products were bought."""
    from django.utils.html import escape

    by_seller = {}
    for item in order.items.select_related("seller").exclude(seller=None):
        by_seller.setdefault(item.seller, []).append(item)
    for seller, items in by_seller.items():
        if not seller.email:
            continue
        rows = "".join(f"<li>{escape(i.product_name)} &times; {i.quantity} - Rs. {i.subtotal}</li>" for i in items)
        html = (f"<h2>New order #{order.id}</h2><p>You have a new order on Vetri Shopping Hall:</p><ul>{rows}</ul>"
                f"<p>Ship to: {escape(order.full_name)}, {escape(order.address)} ({escape(order.phone)})</p>"
                "<p>Open the Vetri app &rarr; Seller &rarr; Orders to confirm and ship it.</p>")
        _send(f"New order #{order.id} | Vetri Shopping Hall Seller", html, seller.email)


def send_status_update(order, base_url=""):
    if not order.user.email:
        return
    title, message = STATUS_MESSAGES.get(order.status, ("Order update", ""))
    html = render_to_string("shop/status_email.html", {
        "order": order, "title": title, "message": message,
        "items": order.items.all(),
        "invoice_link": invoice_url(order, base_url) if base_url else "",
    })
    _send(f"{title}: Order #{order.id} | Vetri Shopping Hall", html, order.user.email)
