from django.conf import settings
from django.db import models
from django.utils.text import slugify


class Banner(models.Model):
    """Top slider banners on the Home screen."""
    title = models.CharField(max_length=120)
    subtitle = models.CharField(max_length=200, blank=True)
    tag = models.CharField(max_length=40, blank=True, help_text="Small text above the title, e.g. FESTIVE EDIT")
    button_text = models.CharField(max_length=40, default="Shop now")
    image = models.ImageField(upload_to="banners/")
    category = models.ForeignKey("Category", null=True, blank=True, on_delete=models.SET_NULL,
                                 help_text="Optional: open this category when the banner is tapped")
    sort_order = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["sort_order", "id"]

    def __str__(self):
        return self.title


class Category(models.Model):
    name = models.CharField(max_length=100, unique=True)
    slug = models.SlugField(max_length=120, unique=True, blank=True)
    image = models.ImageField(upload_to="categories/", blank=True)
    sort_order = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["sort_order", "name"]
        verbose_name_plural = "Categories"

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.name)
        super().save(*args, **kwargs)

    def __str__(self):
        return self.name


HOUSE_STORE_NAME = "Vetri Shopping Hall"  # products with no seller are sold by the store itself


STORE_STATE = "Tamil Nadu"  # state of Vetri Shopping Hall itself, for GST on store-owned products


class ProductQuerySet(models.QuerySet):
    def visible(self):
        """Products buyers may see: active, approved listing, in an active category, sold by the store,
        an approved seller, or a buyer reselling something they bought here."""
        return self.filter(is_active=True, category__is_active=True, review_status="approved").filter(
            models.Q(seller__isnull=True)
            | models.Q(seller__is_active=True, seller__profile__role="seller", seller__profile__is_approved=True)
            | models.Q(seller__is_active=True, seller__profile__role="buyer", resale_of__isnull=False))


class Product(models.Model):
    CONDITION_CHOICES = [("new", "New"), ("like_new", "Like new"), ("good", "Used - Good"), ("fair", "Used - Fair")]
    GST_CHOICES = [(0, "0%"), (5, "5%"), (12, "12%"), (18, "18%"), (28, "28%")]
    REVIEW_CHOICES = [("approved", "Approved"), ("pending", "Waiting for review"), ("rejected", "Rejected")]

    seller = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, related_name="products",
                               on_delete=models.SET_NULL,
                               help_text=f"Leave empty for products sold by {HOUSE_STORE_NAME} itself")
    condition = models.CharField(max_length=10, choices=CONDITION_CHOICES, default="new")
    # ---- resale: a buyer re-listing something they bought and received on Vetri ----
    resale_of = models.ForeignKey("OrderItem", null=True, blank=True, related_name="resale_listings",
                                  on_delete=models.SET_NULL, help_text="The original Vetri purchase being resold")
    review_status = models.CharField(max_length=10, choices=REVIEW_CHOICES, default="approved", db_index=True,
                                     help_text="Resale listings by buyers wait for admin review")
    review_note = models.CharField(max_length=200, blank=True)
    # ---- GST (prices are tax-inclusive; the invoice shows the breakup) ----
    gst_rate = models.PositiveSmallIntegerField("GST %", choices=GST_CHOICES, default=18)
    hsn_code = models.CharField("HSN code", max_length=10, blank=True)
    # ---- B2B wholesale ----
    is_wholesale = models.BooleanField("Sell wholesale (B2B)", default=False)
    moq = models.PositiveIntegerField("Minimum order qty (business)", default=1)
    category = models.ForeignKey(Category, related_name="products", on_delete=models.CASCADE)
    name = models.CharField(max_length=200)
    slug = models.SlugField(max_length=220, unique=True, blank=True)
    brand = models.CharField(max_length=100, blank=True)
    description = models.TextField(blank=True)
    price = models.DecimalField(max_digits=10, decimal_places=2, help_text="Selling price")
    mrp = models.DecimalField(max_digits=10, decimal_places=2, help_text="Original price (shown struck-out)")
    image = models.ImageField(upload_to="products/")
    stock = models.PositiveIntegerField(default=10)
    rating = models.DecimalField(max_digits=2, decimal_places=1, default=4.0)
    rating_count = models.PositiveIntegerField(default=0)
    is_featured = models.BooleanField(default=False, help_text="Show in 'Deals of the Day'")
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    objects = ProductQuerySet.as_manager()

    class Meta:
        ordering = ["-created_at"]

    @property
    def seller_name(self):
        if self.seller_id:
            profile = getattr(self.seller, "profile", None)
            if profile and profile.role == "buyer":
                first = (profile.full_name or self.seller.username).split(" ")[0]
                return f"{first} (resale)"
            return (profile and profile.shop_name) or self.seller.username
        return HOUSE_STORE_NAME

    @property
    def seller_state(self):
        if self.seller_id:
            profile = getattr(self.seller, "profile", None)
            return (profile and profile.state) or STORE_STATE
        return STORE_STATE

    @property
    def is_resale(self):
        return self.resale_of_id is not None

    @property
    def sold_count(self):
        """Pieces sold (not cancelled) - used to stop people reselling more than they bought."""
        return self.orderitem_set.exclude(status="CANCELLED").aggregate(n=models.Sum("quantity"))["n"] or 0

    def save(self, *args, **kwargs):
        if not self.slug:
            base = slugify(self.name)[:200] or "product"
            slug, n = base, 1
            while Product.objects.filter(slug=slug).exclude(pk=self.pk).exists():
                n += 1
                slug = f"{base}-{n}"
            self.slug = slug
        super().save(*args, **kwargs)

    @property
    def discount_percent(self):
        if self.mrp and self.mrp > self.price:
            return int(round((self.mrp - self.price) * 100 / self.mrp))
        return 0

    def __str__(self):
        return self.name


class WholesaleTier(models.Model):
    """B2B price slab: business buyers ordering at least `min_qty` pay `price` per piece."""
    product = models.ForeignKey(Product, related_name="tiers", on_delete=models.CASCADE)
    min_qty = models.PositiveIntegerField()
    price = models.DecimalField(max_digits=10, decimal_places=2)

    class Meta:
        ordering = ["min_qty"]
        unique_together = ("product", "min_qty")

    def __str__(self):
        return f"{self.product} - {self.min_qty}+ @ {self.price}"


class ProductImage(models.Model):
    """Extra gallery images for a product."""
    product = models.ForeignKey(Product, related_name="gallery", on_delete=models.CASCADE)
    image = models.ImageField(upload_to="products/gallery/")
    sort_order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["sort_order", "id"]


class HomeSection(models.Model):
    """Dynamic product rows on the Home screen (e.g. 'Festive Picks')."""
    title = models.CharField(max_length=120)
    products = models.ManyToManyField(Product, blank=True)
    sort_order = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["sort_order", "id"]

    def __str__(self):
        return self.title


class Quote(models.Model):
    """B2B 'Get a quote': a business buyer asks a seller for a special price for a large quantity."""
    STATUS_CHOICES = [
        ("REQUESTED", "Waiting for seller"),
        ("QUOTED", "Price offered"),
        ("ACCEPTED", "Accepted - in cart"),
        ("ORDERED", "Ordered"),
        ("DECLINED", "Declined by seller"),
        ("REJECTED", "Rejected by buyer"),
    ]
    VALID_DAYS = 7

    buyer = models.ForeignKey(settings.AUTH_USER_MODEL, related_name="quotes", on_delete=models.CASCADE)
    product = models.ForeignKey(Product, related_name="quotes", on_delete=models.CASCADE)
    seller = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, related_name="quotes_received",
                               on_delete=models.SET_NULL, help_text=f"Empty = {HOUSE_STORE_NAME} answers in admin")
    quantity = models.PositiveIntegerField()
    note = models.TextField(blank=True)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default="REQUESTED", db_index=True)
    quoted_price = models.DecimalField("Offered price per piece", max_digits=10, decimal_places=2,
                                       null=True, blank=True)
    seller_note = models.TextField(blank=True)
    valid_until = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    @property
    def is_expired(self):
        from django.utils import timezone
        return bool(self.valid_until and timezone.now() > self.valid_until)

    def __str__(self):
        return f"Quote #{self.id}: {self.quantity} x {self.product}"


class CartItem(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, related_name="cart_items", on_delete=models.CASCADE)
    product = models.ForeignKey(Product, on_delete=models.CASCADE)
    quantity = models.PositiveIntegerField(default=1)
    quote = models.ForeignKey(Quote, null=True, blank=True, on_delete=models.SET_NULL,
                              help_text="Accepted B2B quote: fixes the price and quantity")
    added_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("user", "product")

    def __str__(self):
        return f"{self.user} - {self.product} x {self.quantity}"


class WishlistItem(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, related_name="wishlist", on_delete=models.CASCADE)
    product = models.ForeignKey(Product, on_delete=models.CASCADE)
    added_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("user", "product")


class Address(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, related_name="addresses", on_delete=models.CASCADE)
    full_name = models.CharField(max_length=120)
    phone = models.CharField(max_length=15)
    line1 = models.CharField("House / Street", max_length=255)
    city = models.CharField(max_length=100)
    state = models.CharField(max_length=100, default="Tamil Nadu")
    pincode = models.CharField(max_length=10)
    is_default = models.BooleanField(default=False)

    class Meta:
        verbose_name_plural = "Addresses"

    def __str__(self):
        return f"{self.full_name}, {self.city} - {self.pincode}"


class Order(models.Model):
    STATUS_CHOICES = [
        ("PLACED", "Placed"),
        ("CONFIRMED", "Confirmed"),
        ("SHIPPED", "Shipped"),
        ("DELIVERED", "Delivered"),
        ("CANCELLED", "Cancelled"),
    ]
    PAYMENT_CHOICES = [("COD", "Cash on Delivery"), ("CASHFREE", "Online (Cashfree)")]
    PAYMENT_STATUS_CHOICES = [
        ("COD", "Pay on delivery"),
        ("PENDING", "Payment pending"),
        ("PAID", "Paid"),
        ("FAILED", "Payment failed"),
    ]

    user = models.ForeignKey(settings.AUTH_USER_MODEL, related_name="orders", on_delete=models.CASCADE)
    full_name = models.CharField(max_length=120)
    phone = models.CharField(max_length=15)
    address = models.TextField()
    ship_state = models.CharField(max_length=60, blank=True, help_text="Place of supply for GST")
    # B2B: filled when a business buyer orders, printed on the GST invoice
    buyer_company = models.CharField(max_length=150, blank=True)
    buyer_gstin = models.CharField("Buyer GSTIN", max_length=20, blank=True)
    total_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    payment_method = models.CharField(max_length=10, choices=PAYMENT_CHOICES, default="COD")
    payment_status = models.CharField(max_length=10, choices=PAYMENT_STATUS_CHOICES, default="COD")
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="PLACED")
    # Cashfree details (filled for online payments)
    cf_order_id = models.CharField("Cashfree order id", max_length=50, blank=True, db_index=True)
    payment_session_id = models.TextField(blank=True)
    cf_payment_id = models.CharField("Cashfree payment id", max_length=60, blank=True)
    paid_at = models.DateTimeField(null=True, blank=True)
    # Cancellation & refund
    REFUND_STATUS_CHOICES = [("", "-"), ("PENDING", "Refund initiated"), ("SUCCESS", "Refunded"),
                             ("FAILED", "Refund failed")]
    cancel_reason = models.CharField(max_length=200, blank=True)
    cancelled_at = models.DateTimeField(null=True, blank=True)
    refund_status = models.CharField(max_length=10, choices=REFUND_STATUS_CHOICES, blank=True, default="")
    refund_id = models.CharField(max_length=60, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._original_status = self.status  # used to detect status changes for emails

    @property
    def invoice_number(self):
        return f"SC-{self.created_at:%Y%m}-{self.id:05d}" if self.created_at else ""

    def __str__(self):
        return f"Order #{self.id} - {self.user}"


class OrderItem(models.Model):
    """One line of an order. In a multivendor order every line belongs to one seller, who updates its status."""
    STATUS_FLOW = ["PLACED", "CONFIRMED", "SHIPPED", "DELIVERED"]

    order = models.ForeignKey(Order, related_name="items", on_delete=models.CASCADE)
    product = models.ForeignKey(Product, null=True, on_delete=models.SET_NULL)
    seller = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, related_name="sold_items",
                               on_delete=models.SET_NULL, help_text=f"Empty = sold by {HOUSE_STORE_NAME}")
    product_name = models.CharField(max_length=200)
    price = models.DecimalField(max_digits=10, decimal_places=2)
    quantity = models.PositiveIntegerField(default=1)
    status = models.CharField(max_length=20, choices=Order.STATUS_CHOICES, default="PLACED")
    status_updated_at = models.DateTimeField(null=True, blank=True)
    # snapshot at order time
    PRICE_TYPES = [("retail", "Retail"), ("wholesale", "Wholesale"), ("quote", "Quoted price")]
    price_type = models.CharField(max_length=10, choices=PRICE_TYPES, default="retail")
    condition = models.CharField(max_length=10, choices=Product.CONDITION_CHOICES, default="new")
    gst_rate = models.PositiveSmallIntegerField(default=18)
    hsn_code = models.CharField(max_length=10, blank=True)
    seller_state = models.CharField(max_length=60, blank=True)

    @property
    def subtotal(self):
        return self.price * self.quantity

    @property
    def gst(self):
        """Tax-inclusive breakup: taxable value + CGST/SGST (same state) or IGST (other state)."""
        from decimal import ROUND_HALF_UP, Decimal
        total = self.subtotal
        rate = Decimal(self.gst_rate or 0)
        taxable = (total * 100 / (100 + rate)).quantize(Decimal("0.01"), ROUND_HALF_UP)
        tax = total - taxable
        same_state = (self.seller_state or STORE_STATE).lower() == (self.order.ship_state or STORE_STATE).lower()
        half = (tax / 2).quantize(Decimal("0.01"), ROUND_HALF_UP)
        return {"taxable": taxable, "tax": tax, "rate": self.gst_rate, "same_state": same_state,
                "cgst": half if same_state else Decimal("0"), "sgst": (tax - half) if same_state else Decimal("0"),
                "igst": Decimal("0") if same_state else tax}

    @property
    def seller_name(self):
        if self.seller_id:
            profile = getattr(self.seller, "profile", None)
            return (profile and profile.shop_name) or self.seller.username
        return HOUSE_STORE_NAME
