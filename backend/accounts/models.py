from django.conf import settings
from django.db import models
from django.utils import timezone


class EmailOTP(models.Model):
    """One-time password sent to an email address (sign-up, login or password reset)."""
    PURPOSE_CHOICES = [("signup", "Sign up"), ("login", "Login"), ("reset", "Password reset")]

    email = models.EmailField(db_index=True)
    purpose = models.CharField(max_length=10, choices=PURPOSE_CHOICES, default="login")
    role = models.CharField(max_length=10, default="buyer")
    code = models.CharField(max_length=6)
    created_at = models.DateTimeField(auto_now_add=True)
    attempts = models.PositiveSmallIntegerField(default=0)
    is_used = models.BooleanField(default=False)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Email OTP"
        verbose_name_plural = "Email OTPs"

    def is_expired(self):
        age = timezone.now() - self.created_at
        return age.total_seconds() > settings.OTP_EXPIRY_MINUTES * 60

    def __str__(self):
        return f"{self.email} - {self.purpose} ({'used' if self.is_used else 'active'})"


class Profile(models.Model):
    """Extra details for every account. `role` decides whether it is a buyer or a seller account."""
    ROLE_BUYER, ROLE_SELLER = "buyer", "seller"
    ROLE_CHOICES = [(ROLE_BUYER, "Buyer"), (ROLE_SELLER, "Seller")]

    BUYER_PERSONAL, BUYER_BUSINESS = "personal", "business"
    BUYER_TYPE_CHOICES = [(BUYER_PERSONAL, "Personal"), (BUYER_BUSINESS, "Business (B2B)")]

    user = models.OneToOneField(settings.AUTH_USER_MODEL, related_name="profile", on_delete=models.CASCADE)
    role = models.CharField(max_length=10, choices=ROLE_CHOICES, default=ROLE_BUYER, db_index=True)
    buyer_type = models.CharField(max_length=10, choices=BUYER_TYPE_CHOICES, default=BUYER_PERSONAL,
                                  help_text="Business buyers see wholesale prices once approved")
    full_name = models.CharField(max_length=120, blank=True)
    phone = models.CharField(max_length=15, blank=True)
    state = models.CharField(max_length=60, default="Tamil Nadu", help_text="Used for GST (CGST+SGST or IGST)")
    email_verified = models.BooleanField(default=False)
    # ---- seller / business buyer ----
    shop_name = models.CharField(max_length=120, blank=True)
    shop_description = models.TextField(blank=True)
    company_name = models.CharField(max_length=150, blank=True, help_text="Business buyers only")
    gstin = models.CharField("GSTIN", max_length=20, blank=True)
    is_approved = models.BooleanField(
        default=False,
        help_text="Sellers can list products, and business buyers get wholesale prices, only after approval")

    @property
    def is_seller(self):
        return self.role == self.ROLE_SELLER

    @property
    def is_business(self):
        return self.role == self.ROLE_BUYER and self.buyer_type == self.BUYER_BUSINESS

    @property
    def is_approved_business(self):
        return self.is_business and self.is_approved

    def __str__(self):
        if self.is_seller and self.shop_name:
            return f"{self.shop_name} (Seller)"
        if self.is_business:
            return f"{self.company_name or self.full_name} (Business buyer)"
        return f"{self.full_name or self.user.email} (Buyer)"


# Practice app: any 15 letters/digits is accepted (test numbers like 33ABCDE1234F1Z5 and real GSTINs both
# work). The admin still approves every business account by hand.
GSTIN_RE = r"^[0-9A-Z]{15}$"
INDIAN_STATES = [
    "Andaman and Nicobar Islands", "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chandigarh",
    "Chhattisgarh", "Dadra and Nagar Haveli and Daman and Diu", "Delhi", "Goa", "Gujarat", "Haryana",
    "Himachal Pradesh", "Jammu and Kashmir", "Jharkhand", "Karnataka", "Kerala", "Ladakh", "Lakshadweep",
    "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Puducherry",
    "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand",
    "West Bengal",
]
