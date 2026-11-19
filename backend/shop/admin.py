from django.contrib import admin, messages
from django.utils.html import format_html

from .models import (Address, Banner, CartItem, Category, HomeSection, Order,
                     OrderItem, Product, ProductImage, WishlistItem)


def thumb(image, size=60):
    if image:
        return format_html('<img src="{}" style="height:{}px;max-width:220px;object-fit:cover;'
                           'border-radius:8px;border:1px solid #ddd" />', image.url, size)
    return format_html('<span style="color:#999">No image</span>')


# ---------- reusable bulk actions ----------
@admin.action(description="Show selected in the app (activate)")
def make_active(modeladmin, request, queryset):
    n = queryset.update(is_active=True)
    modeladmin.message_user(request, f"{n} item(s) are now visible in the app.", messages.SUCCESS)


@admin.action(description="Hide selected from the app (deactivate)")
def make_inactive(modeladmin, request, queryset):
    n = queryset.update(is_active=False)
    modeladmin.message_user(request, f"{n} item(s) are now hidden from the app.", messages.WARNING)


# ---------- Banners ----------
@admin.register(Banner)
class BannerAdmin(admin.ModelAdmin):
    list_display = ("preview", "title", "tag", "category", "sort_order", "is_active")
    list_display_links = ("preview", "title")
    list_editable = ("sort_order", "is_active")
    list_filter = ("is_active",)
    actions = [make_active, make_inactive]
    readonly_fields = ("large_preview",)
    fieldsets = (
        ("Banner text", {"fields": ("tag", "title", "subtitle", "button_text")}),
        ("Image (wide image works best, e.g. 1200 x 600)", {"fields": ("image", "large_preview")}),
        ("When tapped / display", {"fields": ("category", "sort_order", "is_active")}),
    )

    @admin.display(description="Image")
    def preview(self, obj):
        return thumb(obj.image, 50)

    @admin.display(description="Current image")
    def large_preview(self, obj):
        return thumb(obj.image, 200)


# ---------- Categories ----------
@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ("preview", "name", "product_count", "sort_order", "is_active")
    list_display_links = ("preview", "name")
    list_editable = ("sort_order", "is_active")
    prepopulated_fields = {"slug": ("name",)}
    search_fields = ("name",)
    actions = [make_active, make_inactive]
    readonly_fields = ("large_preview",)
    fields = ("name", "slug", "image", "large_preview", "sort_order", "is_active")

    @admin.display(description="Image")
    def preview(self, obj):
        return thumb(obj.image, 50)

    @admin.display(description="Current image")
    def large_preview(self, obj):
        return thumb(obj.image, 160)

    @admin.display(description="Products")
    def product_count(self, obj):
        return obj.products.count()


# ---------- Products ----------
class ProductImageInline(admin.TabularInline):
    model = ProductImage
    extra = 1
    fields = ("image", "preview", "sort_order")
    readonly_fields = ("preview",)
    verbose_name = "Extra gallery image"
    verbose_name_plural = "Extra gallery images (optional)"

    def preview(self, obj):
        return thumb(obj.image, 60)


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ("preview", "name", "category", "price", "mrp", "discount", "stock_status",
                    "stock", "is_featured", "is_active")
    list_display_links = ("preview", "name")
    list_editable = ("price", "stock", "is_featured", "is_active")
    list_filter = ("category", "is_featured", "is_active")
    search_fields = ("name", "brand", "description")
    prepopulated_fields = {"slug": ("name",)}
    list_per_page = 25
    readonly_fields = ("large_preview", "created_at")
    inlines = [ProductImageInline]
    actions = [make_active, make_inactive, "mark_featured", "unmark_featured"]
    fieldsets = (
        ("Basic details", {"fields": ("name", "slug", "category", "brand", "description")}),
        ("Price (MRP is the original price shown with a strike-through)", {"fields": ("price", "mrp")}),
        ("Main image", {"fields": ("image", "large_preview")}),
        ("Stock & rating", {"fields": ("stock", "rating", "rating_count")}),
        ("Visibility", {"fields": ("is_featured", "is_active", "created_at")}),
    )

    @admin.display(description="Image")
    def preview(self, obj):
        return thumb(obj.image, 55)

    @admin.display(description="Current image")
    def large_preview(self, obj):
        return thumb(obj.image, 220)

    @admin.display(description="Off")
    def discount(self, obj):
        return f"{obj.discount_percent}%" if obj.discount_percent else "-"

    @admin.display(description="Stock status")
    def stock_status(self, obj):
        if obj.stock == 0:
            color, text = "#dc3545", "Out of stock"
        elif obj.stock <= 5:
            color, text = "#fd7e14", "Low stock"
        else:
            color, text = "#28a745", "In stock"
        return format_html('<b style="color:{}">{}</b>', color, text)

    @admin.action(description="Add to 'Deals of the Day'")
    def mark_featured(self, request, queryset):
        n = queryset.update(is_featured=True)
        self.message_user(request, f"{n} product(s) added to Deals of the Day.", messages.SUCCESS)

    @admin.action(description="Remove from 'Deals of the Day'")
    def unmark_featured(self, request, queryset):
        n = queryset.update(is_featured=False)
        self.message_user(request, f"{n} product(s) removed from Deals of the Day.", messages.SUCCESS)


# ---------- Home sections ----------
@admin.register(HomeSection)
class HomeSectionAdmin(admin.ModelAdmin):
    list_display = ("title", "product_count", "sort_order", "is_active")
    list_editable = ("sort_order", "is_active")
    filter_horizontal = ("products",)
    actions = [make_active, make_inactive]

    @admin.display(description="Products")
    def product_count(self, obj):
        return obj.products.count()


# ---------- Orders ----------
STATUS_COLORS = {"PLACED": "#6c757d", "CONFIRMED": "#17a2b8", "SHIPPED": "#007bff",
                 "DELIVERED": "#28a745", "CANCELLED": "#dc3545"}


class OrderItemInline(admin.TabularInline):
    model = OrderItem
    extra = 0
    can_delete = False
    fields = ("product_name", "price", "quantity", "line_total")
    readonly_fields = fields

    def line_total(self, obj):
        return f"Rs. {obj.subtotal}"

    def has_add_permission(self, request, obj=None):
        return False


def _status_action(new_status, label):
    @admin.action(description=f"Mark selected orders as {label}")
    def action(modeladmin, request, queryset):
        n = 0
        for order in queryset:
            if order.status != new_status:
                order.status = new_status
                order.save(update_fields=["status"])  # save() (not update) so the customer gets an email
                n += 1
        modeladmin.message_user(request, f"{n} order(s) marked as {label}. Customers were emailed.",
                                messages.SUCCESS)
    action.__name__ = f"mark_{new_status.lower()}"
    return action


@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = ("order_no", "customer", "full_name", "total_amount", "payment_method",
                    "payment_badge", "status_badge", "status", "invoice_link", "created_at")
    list_editable = ("status",)
    list_filter = ("status", "payment_method", "payment_status", "created_at")
    search_fields = ("id", "user__email", "full_name", "phone", "cf_order_id")
    readonly_fields = ("user", "total_amount", "created_at", "payment_method", "payment_status", "cf_order_id",
                       "cf_payment_id", "paid_at", "invoice_link", "cancelled_at", "refund_status", "refund_id")
    inlines = [OrderItemInline]
    actions = [_status_action("CONFIRMED", "Confirmed"), _status_action("SHIPPED", "Shipped"),
               _status_action("DELIVERED", "Delivered"), _status_action("CANCELLED", "Cancelled")]
    fieldsets = (
        ("Order (changing the status emails the customer)",
         {"fields": ("user", "status", "total_amount", "created_at", "invoice_link")}),
        ("Payment", {"fields": ("payment_method", "payment_status", "cf_order_id", "cf_payment_id", "paid_at")}),
        ("Cancellation & refund (set status to Cancelled: stock is restored and paid orders are refunded)",
         {"fields": ("cancel_reason", "cancelled_at", "refund_status", "refund_id"), "classes": ("collapse",)}),
        ("Delivery address", {"fields": ("full_name", "phone", "address")}),
    )

    @admin.display(description="Payment")
    def payment_badge(self, obj):
        color = {"PAID": "#28a745", "COD": "#f0ad4e", "PENDING": "#6c757d", "FAILED": "#dc3545"}
        return format_html('<span style="background:{};color:#fff;padding:3px 10px;border-radius:12px;'
                           'font-size:12px">{}</span>', color.get(obj.payment_status, "#999"),
                           obj.get_payment_status_display())

    @admin.display(description="Invoice")
    def invoice_link(self, obj):
        if not obj.pk:
            return "-"
        from .emails import invoice_token
        return format_html('<a href="/invoice/{}/" target="_blank">View invoice</a>', invoice_token(obj))

    @admin.display(description="Order #", ordering="id")
    def order_no(self, obj):
        return f"#{obj.id}"

    @admin.display(description="Customer email", ordering="user__email")
    def customer(self, obj):
        return obj.user.email

    @admin.display(description="Status")
    def status_badge(self, obj):
        return format_html('<span style="background:{};color:#fff;padding:3px 10px;border-radius:12px;'
                           'font-size:12px">{}</span>', STATUS_COLORS.get(obj.status, "#999"),
                           obj.get_status_display())


# ---------- Customer data ----------
@admin.register(Address)
class AddressAdmin(admin.ModelAdmin):
    list_display = ("full_name", "user", "phone", "city", "pincode", "is_default")
    search_fields = ("full_name", "user__email", "phone", "city", "pincode")


@admin.register(CartItem)
class CartItemAdmin(admin.ModelAdmin):
    list_display = ("user", "product", "quantity", "added_at")
    search_fields = ("user__email", "product__name")


@admin.register(WishlistItem)
class WishlistItemAdmin(admin.ModelAdmin):
    list_display = ("user", "product", "added_at")
    search_fields = ("user__email", "product__name")
