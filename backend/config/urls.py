from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path, re_path
from django.views.static import serve

from shop import payments
from shop.views import invoice_view

admin.site.site_header = "Vetri Shopping Hall Admin"
admin.site.site_title = "Vetri Shopping Hall Admin"
admin.site.index_title = "Manage banners, categories, products, orders & users"

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/auth/", include("accounts.urls")),
    path("api/", include("shop.urls")),
    path("invoice/<str:token>/", invoice_view, name="invoice"),
    path("pay/return/", payments.return_page, name="cashfree-return"),
    path("pay/<str:cf_order_id>/", payments.checkout_page, name="cashfree-checkout"),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
else:
    # static() is a no-op when DEBUG=False; serve product images directly (fine for a practice app)
    urlpatterns += [
        re_path(r"^media/(?P<path>.*)$", serve, {"document_root": settings.MEDIA_ROOT}),
    ]
