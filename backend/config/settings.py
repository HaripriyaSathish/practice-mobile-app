"""Django settings for the Vetri Shopping Hall practice e-commerce backend."""
import os
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")

SECRET_KEY = os.getenv("SECRET_KEY", "dev-only-secret-key")
DEBUG = os.getenv("DEBUG", "True") == "True"
ALLOWED_HOSTS = ["*"]  # practice project: allow phone on the same Wi-Fi to connect

INSTALLED_APPS = [
    "jazzmin",  # modern, user-friendly admin theme (must be above django.contrib.admin)
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "rest_framework",
    "rest_framework.authtoken",
    "corsheaders",
    "accounts",
    "shop",
]

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",  # serves admin CSS/JS in production
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"

# ---------- Database ----------
# DATABASE_URL (e.g. Neon PostgreSQL) wins; otherwise local MySQL from DB_* variables.
if os.getenv("DATABASE_URL"):
    import dj_database_url

    DATABASES = {"default": dj_database_url.config(conn_max_age=600, ssl_require=True)}
elif os.getenv("USE_SQLITE") == "1":  # only for quick local tests
    DATABASES = {"default": {"ENGINE": "django.db.backends.sqlite3", "NAME": BASE_DIR / "test.sqlite3"}}
else:
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.mysql",
            "NAME": os.getenv("DB_NAME", "south_cart_db"),
            "USER": os.getenv("DB_USER", "root"),
            "PASSWORD": os.getenv("DB_PASSWORD", ""),
            "HOST": os.getenv("DB_HOST", "127.0.0.1"),
            "PORT": os.getenv("DB_PORT", "3306"),
            "OPTIONS": {"charset": "utf8mb4"},
        }
    }

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
]

LANGUAGE_CODE = "en-us"
TIME_ZONE = "Asia/Kolkata"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
STORAGES = {
    "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
    "staticfiles": {"BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage"},
}

# Behind Render's HTTPS proxy
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
CSRF_TRUSTED_ORIGINS = [o for o in os.getenv("CSRF_TRUSTED_ORIGINS", "").split(",") if o]
if os.getenv("RENDER_EXTERNAL_HOSTNAME"):
    CSRF_TRUSTED_ORIGINS.append(f"https://{os.getenv('RENDER_EXTERNAL_HOSTNAME')}")

# ---------- Media files (product / banner / category images) ----------
MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# ---------- REST API ----------
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": ["rest_framework.authentication.TokenAuthentication"],
    "DEFAULT_PERMISSION_CLASSES": ["rest_framework.permissions.AllowAny"],
}
CORS_ALLOW_ALL_ORIGINS = True

# ---------- Email (OTP) ----------
EMAIL_HOST_USER = os.getenv("EMAIL_HOST_USER", "")
EMAIL_HOST_PASSWORD = os.getenv("EMAIL_HOST_PASSWORD", "")
if EMAIL_HOST_USER:
    EMAIL_BACKEND = "django.core.mail.backends.smtp.EmailBackend"
    EMAIL_HOST = os.getenv("EMAIL_HOST", "smtp.gmail.com")
    EMAIL_PORT = int(os.getenv("EMAIL_PORT", "587"))
    EMAIL_USE_TLS = True
    DEFAULT_FROM_EMAIL = f"Vetri Shopping Hall <{EMAIL_HOST_USER}>"
else:
    # No SMTP configured -> emails (with the OTP) are printed in the runserver terminal
    EMAIL_BACKEND = "django.core.mail.backends.console.EmailBackend"
    DEFAULT_FROM_EMAIL = "Vetri Shopping Hall <no-reply@southcart.local>"

OTP_EXPIRY_MINUTES = 5
OTP_MAX_ATTEMPTS = 5
OTP_RESEND_SECONDS = 30

# ---------- Admin panel look & feel (Jazzmin) ----------
JAZZMIN_SETTINGS = {
    "site_title": "Vetri Shopping Hall Admin",
    "site_header": "Vetri Shopping Hall",
    "site_brand": "Vetri Shopping Hall Admin",
    "welcome_sign": "Welcome to Vetri Shopping Hall Admin - manage your store here",
    "copyright": "Vetri Shopping Hall practice project",
    "search_model": ["shop.Product", "shop.Order", "auth.User"],
    "topmenu_links": [
        {"name": "Dashboard", "url": "admin:index"},
        {"name": "Add Product", "url": "admin:shop_product_add"},
        {"name": "Orders", "url": "admin:shop_order_changelist"},
        {"name": "Banners", "url": "admin:shop_banner_changelist"},
    ],
    "show_sidebar": True,
    "navigation_expanded": True,
    "order_with_respect_to": [
        "shop", "shop.Banner", "shop.Category", "shop.Product", "shop.HomeSection", "shop.Order",
        "accounts", "auth",
    ],
    "icons": {
        "auth.User": "fas fa-user",
        "auth.Group": "fas fa-users",
        "authtoken.TokenProxy": "fas fa-key",
        "accounts.Profile": "fas fa-id-card",
        "accounts.EmailOTP": "fas fa-envelope-open-text",
        "shop.Banner": "fas fa-images",
        "shop.Category": "fas fa-th-large",
        "shop.Product": "fas fa-box-open",
        "shop.HomeSection": "fas fa-layer-group",
        "shop.Order": "fas fa-receipt",
        "shop.Address": "fas fa-map-marker-alt",
        "shop.CartItem": "fas fa-shopping-cart",
        "shop.WishlistItem": "fas fa-heart",
    },
    "default_icon_children": "fas fa-circle",
    "related_modal_active": True,
    "changeform_format": "horizontal_tabs",
    "changeform_format_overrides": {"shop.product": "collapsible", "shop.order": "collapsible"},
}
JAZZMIN_UI_TWEAKS = {
    "theme": "flatly",
    "navbar": "navbar-dark",
    "accent": "accent-orange",
    "sidebar": "sidebar-dark-warning",
    "brand_colour": "navbar-warning",
    "navbar_small_text": False,
    "sidebar_nav_child_indent": True,
}

# ---------- Cashfree payment gateway (TEST mode) ----------
CASHFREE_APP_ID = os.getenv("CASHFREE_APP_ID", "")
CASHFREE_SECRET_KEY = os.getenv("CASHFREE_SECRET_KEY", "")
CASHFREE_ENV = os.getenv("CASHFREE_ENV", "sandbox")  # keep "sandbox" for practice
CASHFREE_API_VERSION = os.getenv("CASHFREE_API_VERSION", "2025-01-01")

# Public address of this backend, used for invoice links in emails sent from the admin panel
SITE_URL = os.getenv("SITE_URL", "http://127.0.0.1:8001/")
