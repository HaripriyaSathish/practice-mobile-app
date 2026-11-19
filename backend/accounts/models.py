from django.conf import settings
from django.db import models
from django.utils import timezone


class EmailOTP(models.Model):
    """One-time password sent to an email address for login."""
    email = models.EmailField(db_index=True)
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
        return f"{self.email} ({'used' if self.is_used else 'active'})"


class Profile(models.Model):
    """Extra details for a customer (user logs in with email, no password)."""
    user = models.OneToOneField(settings.AUTH_USER_MODEL, related_name="profile", on_delete=models.CASCADE)
    full_name = models.CharField(max_length=120, blank=True)
    phone = models.CharField(max_length=15, blank=True)

    def __str__(self):
        return self.full_name or self.user.email
