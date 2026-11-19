from rest_framework import serializers

from .models import (Address, Banner, CartItem, Category, HomeSection, Order,
                     OrderItem, Product, ProductImage)


class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ["id", "name", "slug", "image"]


class BannerSerializer(serializers.ModelSerializer):
    class Meta:
        model = Banner
        fields = ["id", "title", "subtitle", "tag", "button_text", "image", "category"]


class ProductImageSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProductImage
        fields = ["id", "image"]


class ProductSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source="category.name", read_only=True)
    discount_percent = serializers.IntegerField(read_only=True)
    seller_name = serializers.CharField(read_only=True)

    class Meta:
        model = Product
        fields = ["id", "name", "slug", "brand", "price", "mrp", "discount_percent", "image",
                  "rating", "rating_count", "stock", "category", "category_name", "is_featured",
                  "seller", "seller_name"]


class ProductDetailSerializer(ProductSerializer):
    gallery = ProductImageSerializer(many=True, read_only=True)

    class Meta(ProductSerializer.Meta):
        fields = ProductSerializer.Meta.fields + ["description", "gallery"]


class HomeSectionSerializer(serializers.ModelSerializer):
    products = serializers.SerializerMethodField()

    class Meta:
        model = HomeSection
        fields = ["id", "title", "products"]

    def get_products(self, obj):
        qs = obj.products.visible().select_related("seller__profile")
        return ProductSerializer(qs, many=True, context=self.context).data


class CartItemSerializer(serializers.ModelSerializer):
    product = ProductSerializer(read_only=True)

    class Meta:
        model = CartItem
        fields = ["id", "product", "quantity"]


class AddressSerializer(serializers.ModelSerializer):
    class Meta:
        model = Address
        fields = ["id", "full_name", "phone", "line1", "city", "state", "pincode", "is_default"]


class OrderItemSerializer(serializers.ModelSerializer):
    image = serializers.SerializerMethodField()
    seller_name = serializers.CharField(read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)

    class Meta:
        model = OrderItem
        fields = ["id", "product", "product_name", "price", "quantity", "image", "seller", "seller_name",
                  "status", "status_display"]

    def get_image(self, obj):
        if obj.product and obj.product.image:
            return self.context["request"].build_absolute_uri(obj.product.image.url)
        return None


class OrderSerializer(serializers.ModelSerializer):
    items = OrderItemSerializer(many=True, read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    payment_method_display = serializers.CharField(source="get_payment_method_display", read_only=True)
    payment_status_display = serializers.CharField(source="get_payment_status_display", read_only=True)
    invoice_url = serializers.SerializerMethodField()
    refund_status_display = serializers.CharField(source="get_refund_status_display", read_only=True)

    class Meta:
        model = Order
        fields = ["id", "invoice_number", "full_name", "phone", "address", "total_amount", "payment_method",
                  "payment_method_display", "payment_status", "payment_status_display", "status",
                  "status_display", "created_at", "items", "invoice_url", "cancel_reason", "cancelled_at",
                  "refund_status", "refund_status_display"]

    def get_invoice_url(self, obj):
        from .emails import invoice_url
        return invoice_url(obj, self.context["request"].build_absolute_uri("/"))
