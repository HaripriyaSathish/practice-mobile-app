from django.urls import path

from . import views

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
]
