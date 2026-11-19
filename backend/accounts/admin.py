from django.contrib import admin, messages

from .models import EmailOTP, Profile


@admin.action(description="Approve selected sellers")
def approve_sellers(modeladmin, request, queryset):
    n = queryset.filter(role=Profile.ROLE_SELLER).update(is_approved=True)
    modeladmin.message_user(request, f"{n} seller(s) approved - they can now add products.", messages.SUCCESS)


@admin.action(description="Block selected sellers (hide their products)")
def unapprove_sellers(modeladmin, request, queryset):
    n = queryset.filter(role=Profile.ROLE_SELLER).update(is_approved=False)
    modeladmin.message_user(request, f"{n} seller(s) blocked.", messages.WARNING)


@admin.register(Profile)
class ProfileAdmin(admin.ModelAdmin):
    list_display = ("user", "role", "full_name", "shop_name", "phone", "email_verified", "is_approved")
    list_filter = ("role", "is_approved", "email_verified")
    list_editable = ("is_approved",)
    search_fields = ("user__email", "user__username", "full_name", "shop_name", "phone")
    actions = [approve_sellers, unapprove_sellers]


@admin.register(EmailOTP)
class EmailOTPAdmin(admin.ModelAdmin):
    """Read-only log of OTPs (handy to see codes while testing)."""
    list_display = ("email", "purpose", "code", "created_at", "attempts", "is_used")
    list_filter = ("purpose", "is_used", "created_at")
    search_fields = ("email",)
    readonly_fields = ("email", "purpose", "code", "created_at", "attempts", "is_used")

    def has_add_permission(self, request):
        return False
