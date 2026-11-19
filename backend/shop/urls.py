from django.urls import path

from . import seller_views, views

urlpatterns = [
    path("home/", views.home),
    path("categories/", views.categories),
    path("products/", views.products),
    path("products/<int:pk>/", views.product_detail),
    path("cart/", views.cart),
    path("wishlist/", views.wishlist),
    path("addresses/", views.addresses),
    path("orders/", views.orders),
    path("orders/<int:pk>/cancel/", views.cancel_order),
    path("orders/<int:pk>/pay/", views.pay_order),
    path("orders/<int:pk>/verify-payment/", views.verify_payment),
    # ---- seller dashboard ----
    path("seller/dashboard/", seller_views.dashboard),
    path("seller/products/", seller_views.products),
    path("seller/products/<int:pk>/", seller_views.product_detail),
    path("seller/orders/", seller_views.orders),
    path("seller/order-items/<int:pk>/status/", seller_views.update_item_status),
]
