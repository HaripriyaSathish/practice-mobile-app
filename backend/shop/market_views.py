"""B2B quotes and buyer resale listings.

Quotes  (business buyer <-> seller)
  POST /api/quotes/                      {product_id, quantity, note}       business asks for a price
  GET  /api/quotes/                      my quote requests
  POST /api/quotes/<id>/accept/          put it in the cart at the offered price
  POST /api/quotes/<id>/reject/
  GET  /api/seller/quotes/?status=       quote requests for my products
  POST /api/seller/quotes/<id>/respond/  {price, note} or {decline: true, note}

Resale  (a buyer re-selling something they bought and received on Vetri)
  GET  /api/resale/                      my resale listings
  POST /api/resale/   (multipart)        {order_item_id, condition, price, quantity, description, photos[]}
  PATCH/DELETE /api/resale/<id>/
  Orders for resale listings are handled with the seller order screens (/api/seller/orders/).
"""
from datetime import timedelta
from decimal import Decimal, InvalidOperation

from django.db import transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.utils.html import escape
from rest_framework.decorators import api_view, parser_classes, permission_classes
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from accounts.permissions import IsApprovedSeller, IsBuyer

from . import pricing
from .emails import _send
from .models import CartItem, OrderItem, Product, ProductImage, Quote
from .serializers import ProductSerializer, QuoteSerializer

MAX_PHOTOS = 6


def _err(message, code=400):
    return Response({"detail": message}, status=code)


def _money(value):
    try:
        v = Decimal(str(value)).quantize(Decimal("0.01"))
    except (InvalidOperation, TypeError, ValueError):
        return None
    return v if v > 0 else None


def _quote_json(q, request):
    return QuoteSerializer(q, context={"request": request}).data


def _expire(qs):
    """Offers older than 7 days can no longer be accepted."""
    for q in qs:
        if q.status == "QUOTED" and q.is_expired:
            q.status = "REJECTED"
            q.seller_note = (q.seller_note + " (offer expired)").strip()
            q.save(update_fields=["status", "seller_note"])
    return qs


# ======================= B2B quotes: buyer side =======================
@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated, IsBuyer])
def quotes(request):
    if request.method == "GET":
        qs = _expire(list(Quote.objects.filter(buyer=request.user).select_related("product__seller__profile")))
        return Response([_quote_json(q, request) for q in qs])

    if not pricing.is_b2b(request.user):
        return _err("Quotes are for approved business accounts.", 403)
    product = get_object_or_404(Product.objects.visible(), pk=request.data.get("product_id"))
    if product.is_resale:
        return _err("Quotes are not available for resale items.")
    try:
        qty = int(request.data.get("quantity"))
    except (TypeError, ValueError):
        return _err("Enter the quantity you need.")
    if qty < max(product.moq, 2):
        return _err(f"Quotes are for bulk orders: at least {max(product.moq, 2)} pieces.")
    if qty > product.stock:
        return _err(f"The seller has only {product.stock} in stock.")
    if Quote.objects.filter(buyer=request.user, product=product, status__in=["REQUESTED", "QUOTED"]).exists():
        return _err("You already have an open quote for this product. See My Quotes.")
    q = Quote.objects.create(buyer=request.user, product=product, seller_id=product.seller_id, quantity=qty,
                             note=str(request.data.get("note") or "").strip()[:1000])
    if product.seller_id and product.seller.email:
        _send(f"Quote request #{q.id}: {qty} x {product.name} | Vetri Seller",
              f"<h2>New quote request</h2><p>A business buyer wants <b>{qty} x {escape(product.name)}</b>.</p>"
              f"<p>Note: {escape(q.note) or '-'}</p><p>Open the Vetri app &rarr; Seller &rarr; Quotes to reply.</p>",
              product.seller.email)
    return Response(_quote_json(q, request), status=201)


@api_view(["POST"])
@permission_classes([IsAuthenticated, IsBuyer])
def accept_quote(request, pk):
    q = get_object_or_404(Quote.objects.select_related("product"), pk=pk, buyer=request.user)
    _expire([q])
    if q.status != "QUOTED":
        return _err("This quote cannot be accepted any more.")
    if q.product.stock < q.quantity:
        return _err(f"Only {q.product.stock} left in stock - ask the seller for a new quote.")
    with transaction.atomic():
        q.status = "ACCEPTED"
        q.save(update_fields=["status"])
        item, _ = CartItem.objects.get_or_create(user=request.user, product=q.product,
                                                 defaults={"quantity": q.quantity})
        item.quantity, item.quote = q.quantity, q
        item.save(update_fields=["quantity", "quote"])
    return Response(_quote_json(q, request))


@api_view(["POST"])
@permission_classes([IsAuthenticated, IsBuyer])
def reject_quote(request, pk):
    q = get_object_or_404(Quote, pk=pk, buyer=request.user)
    if q.status not in ("REQUESTED", "QUOTED", "ACCEPTED"):
        return _err("This quote is already closed.")
    with transaction.atomic():
        CartItem.objects.filter(user=request.user, quote=q).update(quote=None)
        q.status = "REJECTED"
        q.save(update_fields=["status"])
    return Response(_quote_json(q, request))


# ======================= B2B quotes: seller side =======================
@api_view(["GET"])
@permission_classes([IsAuthenticated, IsApprovedSeller])
def seller_quotes(request):
    qs = Quote.objects.filter(seller=request.user).select_related("product", "buyer__profile")
    if status := request.GET.get("status"):
        qs = qs.filter(status=status)
    return Response([_quote_json(q, request) for q in _expire(list(qs))])


@api_view(["POST"])
@permission_classes([IsAuthenticated, IsApprovedSeller])
def respond_quote(request, pk):
    q = get_object_or_404(Quote.objects.select_related("product", "buyer"), pk=pk, seller=request.user)
    if q.status not in ("REQUESTED", "QUOTED"):
        return _err("This quote is already closed.")
    q.seller_note = str(request.data.get("note") or "").strip()[:1000]
    if request.data.get("decline"):
        q.status = "DECLINED"
        subject, line = "declined", "The seller cannot offer this quantity right now."
    else:
        price = _money(request.data.get("price"))
        if not price:
            return _err("Enter the price per piece you can offer.")
        if price >= q.product.price:
            return _err(f"Your offer should be lower than the normal price (Rs. {q.product.price}).")
        q.quoted_price, q.status = price, "QUOTED"
        q.valid_until = timezone.now() + timedelta(days=Quote.VALID_DAYS)
        subject = "price offered"
        line = (f"Offer: Rs. {price} per piece, total Rs. {price * q.quantity}. "
                f"Valid for {Quote.VALID_DAYS} days.")
    q.save()
    if q.buyer.email:
        _send(f"Quote #{q.id} {subject}: {q.product.name} | Vetri Shopping Hall",
              f"<h2>Quote #{q.id}: {escape(q.product.name)} x {q.quantity}</h2><p>{escape(line)}</p>"
              f"<p>Seller note: {escape(q.seller_note) or '-'}</p>"
              "<p>Open the Vetri app &rarr; Account &rarr; My Quotes to accept it.</p>", q.buyer.email)
    return Response(_quote_json(q, request))


# ======================= Resale: buyer re-listing a purchase =======================
def _listing_json(p, request):
    data = ProductSerializer(p, context={"request": request}).data
    data.update({"description": p.description, "is_active": p.is_active, "review_status": p.review_status,
                 "review_status_display": p.get_review_status_display(), "review_note": p.review_note,
                 "sold": p.sold_count, "resale_of": p.resale_of_id,
                 "gallery": [{"id": g.id, "image": request.build_absolute_uri(g.image.url)} for g in p.gallery.all()]})
    return data


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated, IsBuyer])
@parser_classes([MultiPartParser, FormParser, JSONParser])
def resale(request):
    if request.method == "GET":
        qs = (Product.objects.filter(seller=request.user, resale_of__isnull=False)
              .select_related("category", "seller__profile").prefetch_related("gallery"))
        return Response([_listing_json(p, request) for p in qs])

    item = get_object_or_404(OrderItem.objects.select_related("order", "product__category"),
                             pk=request.data.get("order_item_id"), order__user=request.user)
    original = item.product
    if item.status != "DELIVERED":
        return _err("You can resell an item only after it is delivered.")
    if not original:
        return _err("The original product no longer exists, so it cannot be relisted.")
    if item.seller_id == request.user.id:
        return _err("You sold this item yourself.")
    already = sum(p.stock + p.sold_count for p in item.resale_listings.all())
    try:
        qty = int(request.data.get("quantity") or 1)
    except (TypeError, ValueError):
        return _err("Invalid quantity.")
    if qty < 1 or already + qty > item.quantity:
        return _err(f"You bought {item.quantity} and have already listed {already}.")
    condition = str(request.data.get("condition") or "")
    if condition not in ("like_new", "good", "fair"):
        return _err("Choose the condition: Like new, Good or Fair.")
    price = _money(request.data.get("price"))
    if not price:
        return _err("Enter your selling price.")
    photos = request.FILES.getlist("photos")[:MAX_PHOTOS]
    for f in photos:
        if f.size > 8 * 1024 * 1024 or not (getattr(f, "content_type", "") or "").startswith("image/"):
            return _err("Photos must be images under 8 MB.")

    note = str(request.data.get("description") or "").strip()[:2000]
    with transaction.atomic():
        listing = Product.objects.create(
            seller=request.user, category=original.category, name=original.name, brand=original.brand,
            description=note or original.description, price=price, mrp=max(original.mrp, price),
            image=original.image.name,  # starts with the catalogue photo; buyer adds real photos below
            stock=qty, rating=0, rating_count=0, condition=condition, resale_of=item, review_status="pending",
            gst_rate=original.gst_rate, hsn_code=original.hsn_code, is_active=True)
        for i, f in enumerate(photos):
            ProductImage.objects.create(product=listing, image=f, sort_order=i)
    return Response(_listing_json(listing, request), status=201)


@api_view(["GET", "PATCH", "DELETE"])
@permission_classes([IsAuthenticated, IsBuyer])
def resale_detail(request, pk):
    listing = get_object_or_404(Product, pk=pk, seller=request.user, resale_of__isnull=False)
    if request.method == "GET":
        return Response(_listing_json(listing, request))
    if request.method == "DELETE":
        listing.delete()
        return Response(status=204)
    d = request.data
    if "price" in d:
        price = _money(d.get("price"))
        if not price:
            return _err("Enter a valid price.")
        listing.price, listing.mrp = price, max(listing.mrp, price)
    if "stock" in d:
        try:
            stock = int(d.get("stock"))
        except (TypeError, ValueError):
            return _err("Invalid quantity.")
        others = sum(p.stock + p.sold_count for p in listing.resale_of.resale_listings.exclude(pk=listing.pk))
        if stock < 0 or others + listing.sold_count + stock > listing.resale_of.quantity:
            return _err("You cannot list more than you bought.")
        listing.stock = stock
    if "is_active" in d:
        listing.is_active = str(d.get("is_active")).lower() in ("1", "true", "yes", "on")
    if "description" in d:
        listing.description = str(d.get("description"))[:2000]
    if listing.review_status == "rejected" and request.data.get("resubmit"):
        listing.review_status, listing.review_note = "pending", ""
    listing.save()
    return Response(_listing_json(listing, request))
