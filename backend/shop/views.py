from django.core import signing
from django.db import transaction
from django.db.models import Q
from django.http import Http404
from django.shortcuts import get_object_or_404, render
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from accounts.permissions import IsBuyer

from . import payments, pricing
from .shipping import advance_open_shipments
from .emails import invoice_context, order_from_token, send_order_confirmation
from .models import (Address, Banner, CartItem, Category, HomeSection, Order,
                     OrderItem, Product, Quote, WishlistItem)
from .serializers import (AddressSerializer, BannerSerializer, CartItemSerializer,
                          CategorySerializer, HomeSectionSerializer, OrderSerializer,
                          ProductDetailSerializer, ProductSerializer)


# ---------------- Public catalogue ----------------
@api_view(["GET"])
def home(request):
    """Everything the Home screen needs, all managed from the admin panel."""
    ctx = {"request": request}
    return Response({
        "banners": BannerSerializer(Banner.objects.filter(is_active=True), many=True, context=ctx).data,
        "categories": CategorySerializer(Category.objects.filter(is_active=True), many=True, context=ctx).data,
        "deals": ProductSerializer(Product.objects.visible().filter(is_featured=True).select_related("category", "seller__profile")[:10],
                                   many=True, context=ctx).data,
        "sections": HomeSectionSerializer(HomeSection.objects.filter(is_active=True), many=True, context=ctx).data
        + _preloved_section(ctx),
    })


def _preloved_section(ctx):
    """'Pre-loved' row on the Home screen: used / resale items."""
    qs = (Product.objects.visible().exclude(condition="new").select_related("seller__profile", "category")
          .order_by("-created_at")[:10])
    items = ProductSerializer(qs, many=True, context=ctx).data
    return [{"id": "preloved", "title": "Pre-loved \u00b7 Resale", "products": items}] if items else []


@api_view(["GET"])
def categories(request):
    qs = Category.objects.filter(is_active=True)
    return Response(CategorySerializer(qs, many=True, context={"request": request}).data)


@api_view(["GET"])
def products(request):
    """GET /api/products/?category=<id>&search=<text>&sort=price_low|price_high|rating"""
    qs = Product.objects.visible().select_related("category", "seller__profile")
    if cat := request.GET.get("category"):
        qs = qs.filter(category_id=cat)
    if seller := request.GET.get("seller"):
        qs = qs.filter(seller_id=seller)
    if (condition := request.GET.get("condition")) == "used":
        qs = qs.exclude(condition="new")
    elif condition == "new":
        qs = qs.filter(condition="new")
    if request.GET.get("wholesale") == "1":
        qs = qs.filter(is_wholesale=True)
    if q := request.GET.get("search"):
        qs = qs.filter(Q(name__icontains=q) | Q(brand__icontains=q) | Q(category__name__icontains=q))
    sort = request.GET.get("sort")
    if sort == "price_low":
        qs = qs.order_by("price")
    elif sort == "price_high":
        qs = qs.order_by("-price")
    elif sort == "rating":
        qs = qs.order_by("-rating")
    return Response(ProductSerializer(qs, many=True, context={"request": request}).data)


@api_view(["GET"])
def product_detail(request, pk):
    product = get_object_or_404(Product.objects.visible().select_related("seller__profile"), pk=pk)
    data = ProductDetailSerializer(product, context={"request": request}).data
    data["wholesale"] = pricing.wholesale_info(request.user, product)
    data["in_wishlist"] = (request.user.is_authenticated and
                           WishlistItem.objects.filter(user=request.user, product=product).exists())
    similar = Product.objects.visible().filter(category=product.category).exclude(pk=pk)[:8]
    data["similar"] = ProductSerializer(similar, many=True, context={"request": request}).data
    return Response(data)


# ---------------- Cart ----------------
def _cart_response(request):
    items = list(CartItem.objects.filter(user=request.user)
                 .select_related("product", "product__category", "product__seller__profile", "quote")
                 .prefetch_related("product__tiers"))
    lines, totals = pricing.cart_summary(request.user, items)
    data = CartItemSerializer(items, many=True, context={"request": request}).data
    for row, line in zip(data, lines):
        row.update({"unit_price": line["unit_price"], "price_type": line["price_type"],
                    "line_total": line["line_total"], "moq_problem": line["moq_problem"],
                    "quote_id": line["item"].quote_id})
    return Response({
        "items": data,
        "count": sum(i.quantity for i in items),
        "is_business": pricing.is_b2b(request.user),
        **totals,
    })


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated, IsBuyer])
def cart(request):
    """GET: view cart.
    POST {product_id, quantity, mode}: mode "add" adds to existing qty, "set" sets it. qty 0 removes."""
    if request.method == "POST":
        product = get_object_or_404(Product.objects.visible(), pk=request.data.get("product_id"))
        if product.seller_id == request.user.id:
            return Response({"detail": "This is your own resale listing."}, status=400)
        try:
            qty = int(request.data.get("quantity", 1))
        except (TypeError, ValueError):
            return Response({"detail": "Invalid quantity."}, status=400)
        mode = request.data.get("mode", "add")
        item = CartItem.objects.filter(user=request.user, product=product).select_related("quote").first()
        new_qty = (item.quantity if item and mode == "add" else 0) + qty
        if new_qty <= 0:
            if item:
                if item.quote_id:
                    Quote.objects.filter(pk=item.quote_id, status="ACCEPTED").update(status="QUOTED")
                item.delete()
        else:
            if product.stock < 1:
                return Response({"detail": "Out of stock."}, status=400)
            if not item and product.is_wholesale and pricing.is_b2b(request.user):
                new_qty = max(new_qty, product.moq)  # business buyers start at the minimum order
            new_qty = min(new_qty, product.stock)
            if item:
                if item.quote_id and new_qty != item.quantity:
                    # changing the quantity drops the special price; the quote can be accepted again
                    Quote.objects.filter(pk=item.quote_id, status="ACCEPTED").update(status="QUOTED")
                    item.quote = None
                item.quantity = new_qty
                item.save(update_fields=["quantity", "quote"])
            else:
                CartItem.objects.create(user=request.user, product=product, quantity=new_qty)
    return _cart_response(request)


# ---------------- Wishlist ----------------
@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated, IsBuyer])
def wishlist(request):
    """GET: list.  POST {product_id}: toggle."""
    if request.method == "POST":
        product = get_object_or_404(Product.objects.visible(), pk=request.data.get("product_id"))
        obj, created = WishlistItem.objects.get_or_create(user=request.user, product=product)
        if not created:
            obj.delete()
        return Response({"in_wishlist": created})
    qs = Product.objects.visible().filter(wishlistitem__user=request.user).select_related("category", "seller__profile")
    return Response(ProductSerializer(qs, many=True, context={"request": request}).data)


# ---------------- Addresses ----------------
@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated, IsBuyer])
def addresses(request):
    if request.method == "POST":
        ser = AddressSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        ser.save(user=request.user)
        return Response(ser.data, status=status.HTTP_201_CREATED)
    return Response(AddressSerializer(request.user.addresses.all(), many=True).data)


# ---------------- Orders ----------------
@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated, IsBuyer])
def orders(request):
    """GET: my orders.  POST {address_id, payment_method}: place order from cart."""
    if request.method == "GET":
        advance_open_shipments()
        qs = Order.objects.filter(user=request.user).prefetch_related("items__product", "items__seller__profile",
                                                                       "items__shipment")
        return Response(OrderSerializer(qs, many=True, context={"request": request}).data)

    payment_method = request.data.get("payment_method", "COD")
    if payment_method not in ("COD", "CASHFREE"):
        return Response({"detail": "Invalid payment method."}, status=400)
    if payment_method == "CASHFREE" and not payments.is_configured():
        return Response({"detail": "Online payment is not set up yet (Cashfree keys missing in backend .env). "
                                   "Please choose Cash on Delivery."}, status=400)

    address = get_object_or_404(Address, pk=request.data.get("address_id"), user=request.user)
    cart_items = list(CartItem.objects.filter(user=request.user)
                      .select_related("product__seller__profile", "quote").prefetch_related("product__tiers"))
    if not cart_items:
        return Response({"detail": "Your cart is empty."}, status=400)
    visible = set(Product.objects.visible().filter(pk__in=[ci.product_id for ci in cart_items])
                  .values_list("pk", flat=True))
    for ci in cart_items:
        if ci.product_id not in visible:
            return Response({"detail": f"{ci.product.name} is no longer available. Please remove it from your cart."},
                            status=400)
    lines, totals = pricing.cart_summary(request.user, cart_items)
    for line in lines:
        ci = line["item"]
        if ci.product.stock < ci.quantity:
            return Response({"detail": f"Only {ci.product.stock} left for {ci.product.name}."}, status=400)
        if line["moq_problem"]:
            return Response({"detail": line["moq_problem"]}, status=400)
    profile = pricing.profile_of(request.user)

    with transaction.atomic():
        order = Order.objects.create(
            user=request.user,
            full_name=address.full_name,
            phone=address.phone,
            address=f"{address.line1}, {address.city}, {address.state} - {address.pincode}",
            ship_state=address.state,
            buyer_company=profile.company_name if profile.is_business else "",
            buyer_gstin=profile.gstin if profile.is_business else "",
            payment_method=payment_method,
            payment_status="COD" if payment_method == "COD" else "PENDING",
            total_amount=totals["total"],
        )
        for line in lines:
            ci = line["item"]
            p = ci.product
            OrderItem.objects.create(order=order, product=p, seller_id=p.seller_id, product_name=p.name,
                                     price=line["unit_price"], quantity=ci.quantity, price_type=line["price_type"],
                                     condition=p.condition, gst_rate=p.gst_rate, hsn_code=p.hsn_code,
                                     seller_state=p.seller_state)
            p.stock -= ci.quantity
            p.save(update_fields=["stock"])
            if ci.quote_id:
                Quote.objects.filter(pk=ci.quote_id).update(status="ORDERED")
        CartItem.objects.filter(user=request.user).delete()

    data = {}
    if payment_method == "COD":
        send_order_confirmation(order, request.build_absolute_uri("/"))
    else:
        try:
            data["payment_url"] = payments.create_payment_session(order, request, request.data.get("app_return", ""))
        except payments.CashfreeError as exc:
            data["payment_error"] = str(exc)
    data["order"] = OrderSerializer(order, context={"request": request}).data
    return Response(data, status=201)


@api_view(["POST"])
@permission_classes([IsAuthenticated, IsBuyer])
def pay_order(request, pk):
    """Start (or retry) Cashfree payment for an unpaid online order."""
    order = get_object_or_404(Order, pk=pk, user=request.user)
    if order.payment_method != "CASHFREE" or order.payment_status == "PAID" or order.status == "CANCELLED":
        return Response({"detail": "This order does not need payment."}, status=400)
    try:
        url = payments.create_payment_session(order, request, request.data.get("app_return", ""))
    except payments.CashfreeError as exc:
        return Response({"detail": str(exc)}, status=400)
    return Response({"payment_url": url})


@api_view(["GET"])
@permission_classes([IsAuthenticated, IsBuyer])
def verify_payment(request, pk):
    """Ask Cashfree for the latest payment status of my order."""
    order = get_object_or_404(Order, pk=pk, user=request.user)
    try:
        payments.refresh_payment_status(order, request)
    except payments.CashfreeError as exc:
        return Response({"detail": str(exc)}, status=400)
    return Response(OrderSerializer(order, context={"request": request}).data)


def invoice_view(request, token):
    """Colored, printable invoice page (link is signed, so only people with the link can open it)."""
    try:
        order = order_from_token(token)
    except (signing.BadSignature, Order.DoesNotExist):
        raise Http404("Invoice not found")
    return render(request, "shop/invoice.html", invoice_context(order))


@api_view(["POST"])
@permission_classes([IsAuthenticated, IsBuyer])
def cancel_order(request, pk):
    """POST {reason}: cancel my order. Stock is restored, paid online orders are refunded
    and the customer is emailed (see shop/signals.py)."""
    order = get_object_or_404(Order, pk=pk, user=request.user)
    shipped = order.items.filter(status__in=("SHIPPED", "DELIVERED")).exists()
    if order.status not in ("PLACED", "CONFIRMED") or shipped:
        return Response({"detail": "This order has already been shipped and can no longer be cancelled."},
                        status=400)
    order.cancel_reason = (request.data.get("reason") or "Cancelled by customer")[:200]
    order.status = "CANCELLED"
    order.save(update_fields=["status", "cancel_reason"])
    order.refresh_from_db()
    return Response(OrderSerializer(order, context={"request": request}).data)
