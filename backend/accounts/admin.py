from django.contrib import admin

from .models import EmailOTP, Profile


@admin.register(Profile)
class ProfileAdmin(admin.ModelAdmin):
    list_display = ("user", "full_name", "phone")
    search_fields = ("user__email", "full_name", "phone")


@admin.register(EmailOTP)
class EmailOTPAdmin(admin.ModelAdmin):
    """Read-only log of OTPs (handy to see codes while testing)."""
    list_display = ("email", "code", "created_at", "attempts", "is_used")
    list_filter = ("is_used", "created_at")
    search_fields = ("email",)
    readonly_fields = ("email", "code", "created_at", "attempts", "is_used")

    def has_add_permission(self, request):
        return False
