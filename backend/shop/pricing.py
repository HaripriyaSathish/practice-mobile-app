"""One place that decides what a buyer pays for a product.

Order of rules:
  1. An accepted, unexpired B2B quote in the cart -> the quoted price (quantity fixed to the quote).
  2. Approved business buyer + product sold wholesale -> the best price slab for that quantity.
     Business buyers must order at least the product's minimum order quantity (MOQ).
  3. Everyone else -> the normal (retail) price.
"""
from decimal import Decimal


def profile_of(user):
    if not user or not user.is_authenticated:
        return None
    from accounts.models import Profile
    profile, _ = Profile.objects.get_or_create(user=user)
    return profile


def is_b2b(user):
    p = profile_of(user)
    return bool(p and p.is_approved_business)


def tier_price(product, qty):
    """Best wholesale slab price for qty, or None."""
    best = None
    for t in product.tiers.all():
        if t.min_qty <= qty and (best is None or t.min_qty > best.min_qty):
            best = t
    if best and best.price < product.price:
        return best.price
    return None


def quote_is_usable(quote):
    return bool(quote and quote.status == "ACCEPTED" and not quote.is_expired and quote.quoted_price)


def line_price(user, product, qty, quote=None):
    """Returns (unit_price, price_type)."""
    if quote_is_usable(quote):
        return quote.quoted_price, "quote"
    if product.is_wholesale and is_b2b(user):
        price = tier_price(product, qty)
        if price is not None:
            return price, "wholesale"
    return product.price, "retail"


def moq_problem(user, product, qty, quote=None):
    """Error text when a business buyer orders below the product's minimum, else ''."""
    if quote_is_usable(quote):
        return ""
    if product.is_wholesale and is_b2b(user) and product.moq > 1 and qty < product.moq:
        return f"Minimum order for business buyers is {product.moq} pieces of {product.name}."
    return ""


def wholesale_info(user, product):
    """What to show on the product page. Only approved business buyers see slab prices."""
    if not product.is_wholesale:
        return None
    if not is_b2b(user):
        p = profile_of(user)
        return {"available": True, "visible": False,
                "message": ("Your business account is waiting for approval." if p and p.is_business
                            else "Wholesale prices are for verified business accounts.")}
    return {"available": True, "visible": True, "moq": product.moq,
            "tiers": [{"min_qty": t.min_qty, "price": t.price} for t in product.tiers.all()]}


def cart_summary(user, items):
    """Price every cart line. Returns (lines, totals) where lines are dicts with unit price etc."""
    lines = []
    total = mrp_total = Decimal("0")
    for ci in items:
        unit, kind = line_price(user, ci.product, ci.quantity, ci.quote)
        line_total = unit * ci.quantity
        total += line_total
        mrp_total += max(ci.product.mrp, unit) * ci.quantity
        lines.append({"item": ci, "unit_price": unit, "price_type": kind, "line_total": line_total,
                      "moq_problem": moq_problem(user, ci.product, ci.quantity, ci.quote)})
    return lines, {"total": total, "mrp_total": mrp_total, "savings": mrp_total - total}
