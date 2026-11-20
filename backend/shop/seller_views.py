"""Seller dashboard API (/api/seller/...). Only seller accounts; changes need admin approval first."""
from decimal import Decimal, InvalidOperation

from django.db import transaction
from django.db.models import Count, F, Q, Sum
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework.decorators import api_view, parser_classes, permission_classes
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from accounts.permissions import IsApprovedSeller, IsApprovedSellerOrReseller, IsSeller

from .models import Category, Order, OrderItem, Product, ProductImage
from .multivendor import FLOW, stage, sync_order_status
from .shipping import advance_open_shipments, book_shipments
from .serializers import OrderItemSerializer, ProductDetailSerializer

MAX_IMAGE_MB = 8
MAX_GALLERY = 8
PARSERS = [MultiPartParser, FormParser, JSONParser]


# ---------------- helpers ----------------
def _err(message, code=400):
    return Response({"detail": message}, status=code)


def _check_image(f):
    if not f:
        return None
    if f.size > MAX_IMAGE_MB * 1024 * 1024:
        return f"Each photo must be smaller than {MAX_IMAGE_MB} MB."
    if not (getattr(f, "content_type", "") or "").startswith("image/"):
        return "Only image files (JPG, PNG, WEBP) can be uploaded."
    return None


def _product_json(product, request):
    data = ProductDetailSerializer(product, context={"request": request}).data
    data.update({
        "is_active": product.is_active, "description": product.description, "gst_rate": product.gst_rate,
        "hsn_code": product.hsn_code, "moq": product.moq,
        "tiers": [{"min_qty": t.min_qty, "price": t.price} for t in product.tiers.all()],
    })
    return data


def _parse_tiers(raw, price):
    """tiers = JSON list [{"min_qty": 10, "price": 450}, ...]. Returns (tiers, error)."""
    import json
    if raw in (None, ""):
        return [], None
    try:
        items = json.loads(raw) if isinstance(raw, str) else raw
        tiers = sorted(((int(t["min_qty"]), Decimal(str(t["price"]))) for t in items), key=lambda t: t[0])
    except (ValueError, TypeError, KeyError, InvalidOperation):
        return None, "Price slabs are not valid."
    seen = set()
    for qty, p in tiers:
        if qty < 2:
            return None, "Each slab needs a minimum quantity of 2 or more."
        if qty in seen:
            return None, "Two slabs have the same quantity."
        seen.add(qty)
        if p <= 0 or p >= price:
            return None, f"Slab price for {qty}+ pieces must be lower than the normal price."
    for (_, a), (_, b) in zip(tiers, tiers[1:]):
        if b > a:
            return None, "Bigger quantities should have the same or a lower price."
    return tiers[:5], None


def _apply_fields(product, data, creating):
    """Validate and copy editable fields onto product. Returns an error message or None."""
    if creating or "name" in data:
        name = str(data.get("name") or "").strip()
        if len(name) < 3:
            return "Product name must be at least 3 characters."
        product.name = name[:200]
    if creating or "category" in data:
        cat = Category.objects.filter(pk=data.get("category"), is_active=True).first()
        if not cat:
            return "Please choose a category."
        product.category = cat
    for field, limit in (("brand", 100), ("description", 5000)):
        if field in data:
            setattr(product, field, str(data.get(field) or "").strip()[:limit])
    try:
        if creating or "price" in data:
            product.price = Decimal(str(data.get("price")))
        if creating or "mrp" in data:
            mrp = data.get("mrp")
            product.mrp = Decimal(str(mrp)) if mrp not in (None, "") else product.price
        if creating or "stock" in data:
            product.stock = int(data.get("stock") or 0)
    except (InvalidOperation, ValueError, TypeError):
        return "Price, MRP and stock must be numbers."
    if product.price <= 0:
        return "Price must be more than 0."
    if product.mrp < product.price:
        return "MRP cannot be lower than the selling price."
    if product.stock < 0:
        return "Stock cannot be negative."
    if "is_active" in data:
        product.is_active = str(data.get("is_active")).lower() in ("1", "true", "yes", "on")
    if "condition" in data:
        if data.get("condition") not in dict(Product.CONDITION_CHOICES):
            return "Choose the product condition."
        product.condition = data.get("condition")
    if "gst_rate" in data:
        try:
            rate = int(data.get("gst_rate"))
        except (TypeError, ValueError):
            rate = -1
        if rate not in dict(Product.GST_CHOICES):
            return "GST rate must be 0, 5, 12, 18 or 28%."
        product.gst_rate = rate
    if "hsn_code" in data:
        hsn = str(data.get("hsn_code") or "").strip()
        if hsn and not (hsn.isdigit() and 4 <= len(hsn) <= 8):
            return "HSN code is 4 to 8 digits."
        product.hsn_code = hsn
    if "is_wholesale" in data:
        product.is_wholesale = str(data.get("is_wholesale")).lower() in ("1", "true", "yes", "on")
    if "moq" in data:
        try:
            product.moq = max(int(data.get("moq") or 1), 1)
        except (TypeError, ValueError):
            return "Minimum order must be a number."
    if product.is_wholesale:
        tiers, err = _parse_tiers(data.get("tiers") if "tiers" in data else
                                  ([{"min_qty": t.min_qty, "price": t.price} for t in product.tiers.all()]
                                   if product.pk else []), product.price)
        if err:
            return err
        if not tiers:
            return "Add at least one wholesale price slab (e.g. 10+ pieces at a lower price)."
        if tiers[0][0] < product.moq:
            return "The first slab quantity cannot be below the minimum order."
        product._new_tiers = tiers
    else:
        product._new_tiers = []
    return None


def _save_tiers(product):
    from .models import WholesaleTier
    if hasattr(product, "_new_tiers"):
        product.tiers.all().delete()
        WholesaleTier.objects.bulk_create(
            [WholesaleTier(product=product, min_qty=q, price=p) for q, p in product._new_tiers])


# ---------------- dashboard ----------------
@api_view(["GET"])
@permission_classes([IsAuthenticated, IsSeller])
def dashboard(request):
    """Works for pending sellers too, so the app can show 'waiting for approval'."""
    me = request.user
    products = Product.objects.filter(seller=me).aggregate(
        total=Count("id"), active=Count("id", filter=Q(is_active=True)),
        out_of_stock=Count("id", filter=Q(stock=0)), low_stock=Count("id", filter=Q(stock__gt=0, stock__lte=5)))
    items = OrderItem.objects.filter(seller=me).exclude(order__payment_status="PENDING")
    revenue = items.filter(status="DELIVERED").aggregate(v=Sum(F("price") * F("quantity")))["v"] or 0
    pending_value = items.filter(status__in=["PLACED", "CONFIRMED", "SHIPPED"]).aggregate(
        v=Sum(F("price") * F("quantity")))["v"] or 0
    return Response({
        "is_approved": me.profile.is_approved,
        "shop_name": me.profile.shop_name,
        "products": products,
        "orders": {
            "new": items.filter(status="PLACED").values("order").distinct().count(),
            "to_ship": items.filter(status="CONFIRMED").values("order").distinct().count(),
            "shipped": items.filter(status="SHIPPED").values("order").distinct().count(),
            "delivered": items.filter(status="DELIVERED").values("order").distinct().count(),
        },
        "revenue": revenue,
        "pending_value": pending_value,
    })


# ---------------- products ----------------
@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated, IsApprovedSeller])
@parser_classes(PARSERS)
def products(request):
    """GET: my products (?search=).  POST (multipart): name, category, brand, description, price, mrp,
    stock, is_active, image (file, required), gallery (files, optional)."""
    if request.method == "GET":
        qs = Product.objects.filter(seller=request.user).select_related("category", "seller__profile")
        if q := request.GET.get("search"):
            qs = qs.filter(Q(name__icontains=q) | Q(brand__icontains=q))
        return Response([_product_json(p, request) for p in qs.prefetch_related("gallery")])

    image = request.FILES.get("image")
    if not image:
        return _err("Please add a main photo of the product.")
    gallery = request.FILES.getlist("gallery")[:MAX_GALLERY]
    for f in [image, *gallery]:
        if msg := _check_image(f):
            return _err(msg)
    product = Product(seller=request.user, rating=0, rating_count=0)
    if msg := _apply_fields(product, request.data, creating=True):
        return _err(msg)
    with transaction.atomic():
        product.image = image
        product.save()
        _save_tiers(product)
        for i, f in enumerate(gallery):
            ProductImage.objects.create(product=product, image=f, sort_order=i)
    return Response(_product_json(product, request), status=201)


@api_view(["GET", "PUT", "PATCH", "DELETE"])
@permission_classes([IsAuthenticated, IsApprovedSeller])
@parser_classes(PARSERS)
def product_detail(request, pk):
    """PUT/PATCH (multipart or JSON): any product field, optional new `image`, extra `gallery` files,
    `remove_gallery` (comma separated image ids).  DELETE: remove the product."""
    product = get_object_or_404(Product, pk=pk, seller=request.user)
    if request.method == "GET":
        return Response(_product_json(product, request))
    if request.method == "DELETE":
        product.delete()  # past orders keep the product name and price
        return Response(status=204)

    image = request.FILES.get("image")
    gallery = request.FILES.getlist("gallery")
    for f in [image, *gallery]:
        if f and (msg := _check_image(f)):
            return _err(msg)
    if msg := _apply_fields(product, request.data, creating=False):
        return _err(msg)
    remove = [int(x) for x in str(request.data.get("remove_gallery") or "").split(",") if x.strip().isdigit()]
    with transaction.atomic():
        if image:
            product.image = image
        product.save()
        _save_tiers(product)
        if remove:
            for img in ProductImage.objects.filter(product=product, id__in=remove):
                img.image.delete(save=False)
                img.delete()
        room = MAX_GALLERY - product.gallery.count()
        start = product.gallery.count()
        for i, f in enumerate(gallery[:max(room, 0)]):
            ProductImage.objects.create(product=product, image=f, sort_order=start + i)
    product.refresh_from_db()
    return Response(_product_json(product, request))


# ---------------- orders ----------------
def _seller_orders(request, status_filter=None):
    advance_open_shipments()
    items = (OrderItem.objects.filter(seller=request.user)
             .exclude(order__payment_status="PENDING")  # online orders appear once paid
             .select_related("order", "product", "seller__profile", "shipment").order_by("-order__created_at", "id"))
    if status_filter:
        items = items.filter(status=status_filter)
    grouped = {}
    for item in items:
        o = item.order
        if o.id not in grouped:
            grouped[o.id] = {
                "id": o.id, "invoice_number": o.invoice_number, "created_at": o.created_at,
                "buyer_name": o.full_name, "phone": o.phone, "address": o.address,
                "payment_method": o.payment_method, "payment_method_display": o.get_payment_method_display(),
                "payment_status": o.payment_status, "payment_status_display": o.get_payment_status_display(),
                "order_status": o.status, "order_status_display": o.get_status_display(),
                "items": [], "my_total": Decimal("0"),
            }
        grouped[o.id]["items"].append(OrderItemSerializer(item, context={"request": request}).data)
        if item.status != "CANCELLED":
            grouped[o.id]["my_total"] += item.subtotal
    return list(grouped.values())


@api_view(["GET"])
@permission_classes([IsAuthenticated, IsApprovedSellerOrReseller])
def orders(request):
    """GET ?status=PLACED|CONFIRMED|SHIPPED|DELIVERED|CANCELLED: orders containing my products."""
    return Response(_seller_orders(request, request.GET.get("status") or None))


@api_view(["POST"])
@permission_classes([IsAuthenticated, IsApprovedSellerOrReseller])
def update_item_status(request, pk):
    """POST {status}: move my order line forward (Placed -> Confirmed -> Shipped -> Delivered).
    Pass "order": true to update all my lines of that order at once."""
    item = get_object_or_404(OrderItem.objects.select_related("order"), pk=pk, seller=request.user)
    new = str(request.data.get("status") or "").upper()
    if new not in FLOW:
        return _err("Invalid status.")
    order = item.order
    if order.status == "CANCELLED" or item.status == "CANCELLED":
        return _err("This order was cancelled.")
    if order.payment_status in ("PENDING", "FAILED"):
        return _err("This order is not paid yet.")

    targets = OrderItem.objects.filter(order=order, seller=request.user).exclude(status="CANCELLED") \
        if request.data.get("order") else OrderItem.objects.filter(pk=item.pk)
    if any(stage(new) <= stage(t.status) for t in targets):
        return _err("Status can only move forward.")
    targets.update(status=new, status_updated_at=timezone.now())
    if new == "SHIPPED":
        book_shipments(order)  # demo courier parcel; tracking then moves forward by itself
    order = Order.objects.get(pk=order.pk)  # fresh copy so the status-change email fires correctly
    sync_order_status(order)
    return Response(next((o for o in _seller_orders(request) if o["id"] == order.id), None))
