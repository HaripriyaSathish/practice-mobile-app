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


class Product(models.Model):
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

    class Meta:
        ordering = ["-created_at"]

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


class CartItem(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, related_name="cart_items", on_delete=models.CASCADE)
    product = models.ForeignKey(Product, on_delete=models.CASCADE)
    quantity = models.PositiveIntegerField(default=1)
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
    order = models.ForeignKey(Order, related_name="items", on_delete=models.CASCADE)
    product = models.ForeignKey(Product, null=True, on_delete=models.SET_NULL)
    product_name = models.CharField(max_length=200)
    price = models.DecimalField(max_digits=10, decimal_places=2)
    quantity = models.PositiveIntegerField(default=1)

    @property
    def subtotal(self):
        return self.price * self.quantity
