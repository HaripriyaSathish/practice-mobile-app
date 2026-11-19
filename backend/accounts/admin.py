from django.contrib import admin, messages

from .models import EmailOTP, Profile


@admin.action(description="Approve selected sellers / business buyers")
def approve_sellers(modeladmin, request, queryset):
    n = queryset.filter(role=Profile.ROLE_SELLER).update(is_approved=True)
    b = queryset.filter(role=Profile.ROLE_BUYER, buyer_type=Profile.BUYER_BUSINESS).update(is_approved=True)
    modeladmin.message_user(request, f"{n} seller(s) can now add products, {b} business buyer(s) now see "
                                     "wholesale prices.", messages.SUCCESS)


@admin.action(description="Remove approval (seller products hidden / no wholesale prices)")
def unapprove_sellers(modeladmin, request, queryset):
    n = queryset.update(is_approved=False)
    modeladmin.message_user(request, f"{n} account(s) set back to not approved.", messages.WARNING)


@admin.register(Profile)
class ProfileAdmin(admin.ModelAdmin):
    list_display = ("user", "role", "buyer_type", "full_name", "shop_name", "company_name", "gstin", "state",
                    "email_verified", "is_approved")
    list_filter = ("role", "buyer_type", "is_approved", "email_verified", "state")
    list_editable = ("is_approved",)
    search_fields = ("user__email", "user__username", "full_name", "shop_name", "company_name", "gstin", "phone")
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
