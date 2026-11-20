from django.contrib import admin, messages
from django.utils.html import format_html, format_html_join

from .models import (Address, Banner, CartItem, Category, HomeSection, Order,
                     OrderItem, Product, ProductImage, Quote, Shipment, WholesaleTier, WishlistItem)


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
class WholesaleTierInline(admin.TabularInline):
    model = WholesaleTier
    extra = 1
    verbose_name = "Wholesale price slab"
    verbose_name_plural = "Wholesale price slabs (B2B - only when 'Sell wholesale' is ticked)"


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
    list_display = ("preview", "name", "seller_label", "category", "price", "mrp", "discount", "stock_status",
                    "stock", "condition", "review_badge", "is_wholesale", "is_featured", "is_active")
    list_display_links = ("preview", "name")
    list_editable = ("price", "stock", "is_featured", "is_active")
    list_filter = ("review_status", "condition", "is_wholesale", "category", "is_featured", "is_active",
                   ("seller", admin.RelatedOnlyFieldListFilter))
    search_fields = ("name", "brand", "description", "seller__profile__shop_name", "seller__username")
    autocomplete_fields = ()
    list_select_related = ("category", "seller__profile")
    prepopulated_fields = {"slug": ("name",)}
    list_per_page = 25
    readonly_fields = ("large_preview", "created_at")
    inlines = [WholesaleTierInline, ProductImageInline]
    actions = ["approve_listings", "reject_listings", make_active, make_inactive, "mark_featured",
               "unmark_featured"]
    fieldsets = (
        ("Basic details", {"fields": ("name", "slug", "seller", "category", "brand", "description", "condition")}),
        ("Resale review (buyers re-selling a Vetri purchase)",
         {"fields": ("resale_of", "review_status", "review_note"), "classes": ("collapse",)}),
        ("GST & wholesale (B2B)", {"fields": ("gst_rate", "hsn_code", "is_wholesale", "moq")}),
        ("Price (MRP is the original price shown with a strike-through)", {"fields": ("price", "mrp")}),
        ("Main image", {"fields": ("image", "large_preview")}),
        ("Stock & rating", {"fields": ("stock", "rating", "rating_count")}),
        ("Visibility", {"fields": ("is_featured", "is_active", "created_at")}),
    )

    @admin.display(description="Image")
    def preview(self, obj):
        return thumb(obj.image, 55)

    @admin.display(description="Sold by", ordering="seller__profile__shop_name")
    def seller_label(self, obj):
        return obj.seller_name

    @admin.display(description="Review", ordering="review_status")
    def review_badge(self, obj):
        color = {"approved": "#28a745", "pending": "#f0ad4e", "rejected": "#dc3545"}[obj.review_status]
        return format_html('<span style="background:{};color:#fff;padding:2px 9px;border-radius:10px;'
                           'font-size:11px">{}</span>', color, obj.get_review_status_display())

    @admin.action(description="Approve selected resale listings (show to buyers)")
    def approve_listings(self, request, queryset):
        from .emails import _send
        n = 0
        for p in queryset.exclude(review_status="approved"):
            p.review_status, p.review_note = "approved", ""
            p.save(update_fields=["review_status", "review_note"])
            n += 1
            if p.seller and p.seller.email:
                _send(f"Your resale listing is live: {p.name} | Vetri Shopping Hall",
                      f"<p>Good news! Your listing <b>{p.name}</b> is approved and buyers can see it now.</p>",
                      p.seller.email)
        self.message_user(request, f"{n} listing(s) approved and live.", messages.SUCCESS)

    @admin.action(description="Reject selected resale listings")
    def reject_listings(self, request, queryset):
        n = queryset.update(review_status="rejected",
                            review_note="Please add clear photos of the actual item and a fair price.")
        self.message_user(request, f"{n} listing(s) rejected.", messages.WARNING)

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
    fields = ("product_name", "seller_name", "price_type", "condition", "price", "quantity", "gst_rate",
              "line_total", "status")
    readonly_fields = ("product_name", "seller_name", "price_type", "condition", "price", "quantity", "gst_rate",
                       "line_total")

    def line_total(self, obj):
        return f"Rs. {obj.subtotal}"

    def has_add_permission(self, request, obj=None):
        return False


def _tracking_html(shipment):
    if not shipment.events:
        return "-"
    rows = format_html_join("", "<li><b>{}</b> <span style='color:#888'>{} &middot; {}</span></li>", (
        (e.get("message", ""), e.get("location", ""), e.get("at", "")[:16].replace("T", " "))
        for e in shipment.events))
    return format_html("<ol style='margin:0;padding-left:18px'>{}</ol>", rows)


class ShipmentInline(admin.TabularInline):
    model = Shipment
    extra = 0
    can_delete = False
    fields = ("courier", "awb", "status", "seller", "tracking")
    readonly_fields = fields
    verbose_name_plural = "Shipments (demo courier - tracking moves forward automatically)"

    @admin.display(description="Tracking")
    def tracking(self, obj):
        return _tracking_html(obj)

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
    inlines = [OrderItemInline, ShipmentInline]
    actions = [_status_action("CONFIRMED", "Confirmed"), _status_action("SHIPPED", "Shipped"),
               _status_action("DELIVERED", "Delivered"), _status_action("CANCELLED", "Cancelled")]
    fieldsets = (
        ("Order (changing the status emails the customer)",
         {"fields": ("user", "status", "total_amount", "created_at", "invoice_link")}),
        ("Payment", {"fields": ("payment_method", "payment_status", "cf_order_id", "cf_payment_id", "paid_at")}),
        ("Cancellation & refund (set status to Cancelled: stock is restored and paid orders are refunded)",
         {"fields": ("cancel_reason", "cancelled_at", "refund_status", "refund_id"), "classes": ("collapse",)}),
        ("Delivery address", {"fields": ("full_name", "phone", "address", "ship_state")}),
        ("Business buyer (B2B GST invoice)", {"fields": ("buyer_company", "buyer_gstin")}),
    )

    def changelist_view(self, request, extra_context=None):
        from .shipping import advance_open_shipments
        advance_open_shipments()
        return super().changelist_view(request, extra_context)

    def change_view(self, request, object_id, form_url="", extra_context=None):
        from .shipping import advance_open_shipments
        advance_open_shipments()
        return super().change_view(request, object_id, form_url, extra_context)

    def save_related(self, request, form, formsets, change):
        super().save_related(request, form, formsets, change)
        from .models import Order as _Order
        from .multivendor import sync_order_status
        from .shipping import book_shipments
        book_shipments(form.instance)  # items set to Shipped here get a demo courier parcel
        sync_order_status(_Order.objects.get(pk=form.instance.pk))  # item status edits update the order

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


# ---------- B2B quotes ----------
@admin.register(Quote)
class QuoteAdmin(admin.ModelAdmin):
    """Quotes for products sold by the store itself (no seller) are answered here: fill the offered price."""
    list_display = ("id", "product", "buyer", "seller_label", "quantity", "status", "quoted_price", "valid_until",
                    "created_at")
    list_filter = ("status", ("seller", admin.RelatedOnlyFieldListFilter))
    search_fields = ("product__name", "buyer__email", "buyer__profile__company_name")
    readonly_fields = ("buyer", "product", "seller", "quantity", "note", "created_at", "valid_until")
    fields = ("buyer", "product", "seller", "quantity", "note", "status", "quoted_price", "seller_note",
              "valid_until", "created_at")

    @admin.display(description="Seller")
    def seller_label(self, obj):
        return obj.product.seller_name

    def save_model(self, request, obj, form, change):
        from datetime import timedelta

        from django.utils import timezone
        if obj.quoted_price and obj.status == "REQUESTED":
            obj.status = "QUOTED"
        if obj.status == "QUOTED" and "quoted_price" in form.changed_data:
            obj.valid_until = timezone.now() + timedelta(days=Quote.VALID_DAYS)
        super().save_model(request, obj, form, change)


# ---------- Shipments (demo courier) ----------
@admin.register(Shipment)
class ShipmentAdmin(admin.ModelAdmin):
    list_display = ("awb", "courier", "order", "sold_by", "status", "created_at", "delivered_at")
    list_filter = ("status", "courier")
    search_fields = ("awb", "order__id", "order__user__email")
    readonly_fields = ("order", "seller", "courier", "awb", "status", "tracking", "created_at", "delivered_at")
    exclude = ("events",)

    @admin.display(description="Sold by")
    def sold_by(self, obj):
        return obj.items.first().seller_name if obj.items.exists() else "-"

    @admin.display(description="Tracking history")
    def tracking(self, obj):
        return _tracking_html(obj)

    def has_add_permission(self, request):
        return False

    def changelist_view(self, request, extra_context=None):
        from .shipping import advance_open_shipments
        advance_open_shipments()
        return super().changelist_view(request, extra_context)
