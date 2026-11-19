"""
Cashfree Payment Gateway (TEST / SANDBOX mode).

Flow:
 1. App places an order with payment_method=CASHFREE  ->  we create a Cashfree order (server-to-server)
    and get a `payment_session_id`.
 2. App opens  /pay/<cf_order_id>/  in a browser. That page loads Cashfree's JS checkout.
 3. After paying, Cashfree redirects to  /pay/return/?order_id=<cf_order_id>
    We ask Cashfree for the real order status (never trust the redirect alone) and mark the order PAID.
"""
import json
import time
import urllib.error
import urllib.request
from urllib.parse import urlencode

from django.conf import settings
from django.db import transaction
from django.shortcuts import get_object_or_404, render
from django.utils import timezone

from .emails import send_order_confirmation
from .models import Order


class CashfreeError(Exception):
    pass


def is_configured():
    return bool(settings.CASHFREE_APP_ID and settings.CASHFREE_SECRET_KEY)


def _base_url():
    return ("https://sandbox.cashfree.com/pg" if settings.CASHFREE_ENV != "production"
            else "https://api.cashfree.com/pg")


def _call(method, path, body=None):
    req = urllib.request.Request(
        _base_url() + path,
        method=method,
        data=json.dumps(body).encode() if body else None,
        headers={
            "x-client-id": settings.CASHFREE_APP_ID,
            "x-client-secret": settings.CASHFREE_SECRET_KEY,
            "x-api-version": settings.CASHFREE_API_VERSION,
            "Content-Type": "application/json",
            "Accept": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as exc:
        try:
            detail = json.loads(exc.read()).get("message", str(exc))
        except Exception:
            detail = str(exc)
        raise CashfreeError(f"Cashfree: {detail}") from exc
    except urllib.error.URLError as exc:
        raise CashfreeError(f"Cannot reach Cashfree: {exc.reason}") from exc


def create_payment_session(order, request, app_return=""):
    """Create a fresh Cashfree order for our Order and return the checkout page URL."""
    if not is_configured():
        raise CashfreeError("Cashfree keys are not set. Add CASHFREE_APP_ID and CASHFREE_SECRET_KEY in backend/.env")

    cf_order_id = f"SC{order.id}T{int(time.time())}"  # unique per attempt
    return_qs = urlencode({"order_id": cf_order_id, **({"app_return": app_return} if app_return else {})})
    phone = "".join(ch for ch in order.phone if ch.isdigit())[-10:] or "9999999999"
    data = _call("POST", "/orders", {
        "order_id": cf_order_id,
        "order_amount": float(order.total_amount),
        "order_currency": "INR",
        "customer_details": {
            "customer_id": f"user{order.user_id}",
            "customer_name": order.full_name[:100],
            "customer_email": order.user.email,
            "customer_phone": phone,
        },
        "order_meta": {"return_url": request.build_absolute_uri("/pay/return/") + "?" + return_qs},
        "order_note": f"Vetri Shopping Hall order #{order.id}",
    })
    order.cf_order_id = cf_order_id
    order.payment_session_id = data["payment_session_id"]
    order.payment_status = "PENDING"
    order.save(update_fields=["cf_order_id", "payment_session_id", "payment_status"])
    return request.build_absolute_uri(f"/pay/{cf_order_id}/")


def refresh_payment_status(order, request):
    """Ask Cashfree whether the order is paid; update our Order. Returns the Order."""
    if order.payment_status == "PAID" or not order.cf_order_id:
        return order
    data = _call("GET", f"/orders/{order.cf_order_id}")
    cf_status = data.get("order_status")
    if cf_status == "PAID":
        with transaction.atomic():
            order.payment_status = "PAID"
            order.paid_at = timezone.now()
            if order.status == "PLACED":
                order.status = "CONFIRMED"
                order._original_status = "CONFIRMED"  # confirmation email below is enough
            try:
                payments = _call("GET", f"/orders/{order.cf_order_id}/payments")
                ok = [p for p in payments if p.get("payment_status") == "SUCCESS"]
                if ok:
                    order.cf_payment_id = str(ok[0].get("cf_payment_id", ""))
            except CashfreeError:
                pass
            order.save()
        send_order_confirmation(order, request.build_absolute_uri("/"))
    elif cf_status in ("EXPIRED", "TERMINATED"):
        order.payment_status = "FAILED"
        order.save(update_fields=["payment_status"])
    return order


def refund_order(order):
    """Full refund of a PAID Cashfree order (sandbox: no real money moves). Updates refund fields."""
    if order.payment_status != "PAID" or not order.cf_order_id or order.refund_status in ("PENDING", "SUCCESS"):
        return
    refund_id = f"RF{order.id}T{int(time.time())}"
    try:
        data = _call("POST", f"/orders/{order.cf_order_id}/refunds", {
            "refund_amount": float(order.total_amount),
            "refund_id": refund_id,
            "refund_note": (order.cancel_reason or "Order cancelled")[:100],
        })
        order.refund_id = refund_id
        order.refund_status = "SUCCESS" if data.get("refund_status") == "SUCCESS" else "PENDING"
    except CashfreeError:
        order.refund_status = "FAILED"
    Order.objects.filter(pk=order.pk).update(refund_id=order.refund_id, refund_status=order.refund_status)


# ------------------------------------------------------------- browser pages
def checkout_page(request, cf_order_id):
    order = get_object_or_404(Order, cf_order_id=cf_order_id)
    return render(request, "shop/payment_page.html", {
        "order": order,
        "mode": "production" if settings.CASHFREE_ENV == "production" else "sandbox",
    })


def return_page(request):
    order = get_object_or_404(Order, cf_order_id=request.GET.get("order_id", ""))
    error = ""
    try:
        refresh_payment_status(order, request)
    except CashfreeError as exc:
        error = str(exc)
    app_return = request.GET.get("app_return", "")
    if app_return and not app_return.startswith(("exp://", "exps://", "vetrishoppinghall://", "http://", "https://")):
        app_return = ""
    sep = "&" if "?" in app_return else "?"
    return render(request, "shop/payment_result.html", {
        "order": order,
        "error": error,
        "app_return": f"{app_return}{sep}order={order.id}&status={order.payment_status}" if app_return else "",
    })
