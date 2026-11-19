"""
Build the shop catalogue from DummyJSON (https://dummyjson.com) - free demo e-commerce data with clean
studio product photos. Every product's photo, name and description come from the same record, so they match.

    python manage.py import_dummyjson          # replace catalogue (categories, products, sections, banners)

Keeps users, addresses and orders (order lines keep their product name/price).
Downloaded originals are cached in media/dummyjson/ so re-running is fast.
"""
import json
import math
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from decimal import Decimal
from io import BytesIO

from django.conf import settings
from django.core.files.base import ContentFile
from django.core.management.base import BaseCommand
from django.db import transaction
from PIL import Image, ImageDraw, ImageFilter

from shop.models import Banner, Category, HomeSection, Product, ProductImage

SOURCE = "https://dummyjson.com/products?limit=0"
HEADERS = {"User-Agent": "VetriShoppingHall-Practice/1.0"}
USD_TO_INR = 85

# our category -> DummyJSON categories
CATEGORY_MAP = [
    ("Mobiles", ["smartphones", "tablets"]),
    ("Electronics", ["laptops", "mobile-accessories"]),
    ("Women", ["womens-dresses", "tops", "womens-bags", "womens-shoes"]),
    ("Men", ["mens-shirts", "mens-shoes", "sunglasses"]),
    ("Watches & Jewellery", ["mens-watches", "womens-watches", "womens-jewellery"]),
    ("Beauty", ["beauty", "fragrances", "skin-care"]),
    ("Kitchen", ["kitchen-accessories"]),
    ("Home & Furniture", ["furniture", "home-decoration"]),
    ("Groceries", ["groceries"]),
    ("Sports", ["sports-accessories"]),
]

HOME_SECTIONS = [
    ("Latest Smartphones", ["smartphones"]),
    ("Laptops & Accessories", ["laptops", "mobile-accessories"]),
    ("Trending for Women", ["womens-dresses", "womens-bags", "tops", "womens-shoes"]),
    ("Men's Style", ["mens-shirts", "mens-shoes", "sunglasses"]),
    ("Watches & Jewellery", ["mens-watches", "womens-watches", "womens-jewellery"]),
    ("Beauty & Fragrance", ["fragrances", "beauty", "skin-care"]),
    ("Kitchen Essentials", ["kitchen-accessories"]),
    ("Home Decor & Furniture", ["home-decoration", "furniture"]),
    ("Fresh Groceries", ["groceries"]),
    ("Sports & Fitness", ["sports-accessories"]),
]

# key, tag, title, subtitle, button, category, source categories for the product photos, gradient colours
BANNERS = [
    ("mobiles", "NEW LAUNCHES", "The Latest Smartphones", "Flagship cameras, all-day batteries", "Shop Mobiles",
     "Mobiles", ["smartphones"], ((40, 12, 30), (110, 30, 58))),
    ("women", "THE STYLE EDIT", "Up to 40% off Women's Fashion", "Dresses, bags & shoes you'll love", "Shop Women",
     "Women", ["womens-dresses", "womens-bags", "womens-shoes"], ((70, 20, 45), (160, 70, 95))),
    ("laptops", "WORK & PLAY", "Laptops & Accessories", "Power, speed and style for every desk", "Shop Electronics",
     "Electronics", ["laptops", "mobile-accessories"], ((18, 22, 34), (52, 62, 92))),
    ("watches", "TIMELESS", "Watches & Jewellery", "Crafted to be treasured", "Shop Now",
     "Watches & Jewellery", ["mens-watches", "womens-watches", "womens-jewellery"], ((30, 22, 14), (120, 88, 40))),
    ("beauty", "GLOW UP", "Beauty & Fragrance", "Skincare, makeup & signature scents", "Shop Beauty",
     "Beauty", ["fragrances", "beauty", "skin-care"], ((60, 24, 50), (170, 90, 120))),
    ("kitchen", "HOME SALE", "Kitchen & Home Essentials", "Upgrade your space for less", "Explore",
     "Kitchen", ["kitchen-accessories", "home-decoration"], ((16, 40, 34), (40, 110, 90))),
]


def get(url):
    req = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read()


def nice_price(value):
    """Round a rupee amount to a shop-like price: 79, 499, 1,299, 24,999 ..."""
    v = max(49, value)
    if v < 1000:
        return int(math.ceil(v / 10.0) * 10 - 1)
    step = 100 if v < 20000 else 1000
    return int(math.ceil(v / step) * step - 1)


def to_jpg(raw, size=1000):
    """Convert to JPEG on a white background (product photos)."""
    im = Image.open(BytesIO(raw))
    if im.mode in ("RGBA", "LA", "P"):
        im = im.convert("RGBA")
        bg = Image.new("RGB", im.size, (255, 255, 255))
        bg.paste(im, mask=im.split()[-1])
        im = bg
    else:
        im = im.convert("RGB")
    im.thumbnail((size, size), Image.LANCZOS)
    buf = BytesIO()
    im.save(buf, "JPEG", quality=88, optimize=True, progressive=True)
    return buf.getvalue()


def cutout(raw, size):
    """Product photo with its white background made transparent (for banners)."""
    im = Image.open(BytesIO(raw)).convert("RGBA")
    im.thumbnail((size, size), Image.LANCZOS)
    px = im.load()
    w, h = im.size
    # flood-ish: make near-white pixels transparent, with a soft edge
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            m = min(r, g, b)
            if m > 242 and max(r, g, b) - m < 12:
                px[x, y] = (r, g, b, 0)
            elif m > 228 and max(r, g, b) - m < 14:
                px[x, y] = (r, g, b, int(a * (242 - m) / 14))
    return im


def render_banner(raws, colors, w=1600, h=800):
    top, bottom = colors
    base = Image.new("RGB", (w, h), top)
    grad = Image.linear_gradient("L").rotate(-60, expand=True).resize((w, h))
    img = Image.composite(Image.new("RGB", (w, h), bottom), base, grad)
    d = ImageDraw.Draw(img, "RGBA")
    # soft gold glow + rings behind the products
    glow = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    ImageDraw.Draw(glow).ellipse([w * 0.52, h * 0.05, w * 1.02, h * 1.05], fill=(201, 163, 92, 70))
    img.paste(glow.filter(ImageFilter.GaussianBlur(70)), (0, 0), glow.filter(ImageFilter.GaussianBlur(70)))
    d.ellipse([w * 0.56, h * 0.1, w * 0.98, h * 0.95], outline=(201, 163, 92, 90), width=3)
    d.ellipse([w * 0.6, h * 0.17, w * 0.94, h * 0.88], outline=(255, 255, 255, 40), width=2)
    # sparkles
    for (sx, sy, s) in [(0.52, 0.18, 14), (0.95, 0.12, 10), (0.9, 0.86, 16), (0.47, 0.8, 9), (0.7, 0.06, 8)]:
        cx, cy = w * sx, h * sy
        d.polygon([(cx, cy - s * 2), (cx + s * 0.45, cy), (cx, cy + s * 2), (cx - s * 0.45, cy)], fill=(235, 205, 140, 230))
        d.polygon([(cx - s * 2, cy), (cx, cy + s * 0.45), (cx + s * 2, cy), (cx, cy - s * 0.45)], fill=(235, 205, 140, 230))
    # products: one hero + two smaller, with soft shadows
    slots = [(0.77, 0.52, 560), (0.6, 0.62, 360), (0.93, 0.66, 330)]
    for raw, (cx, cy, size) in reversed(list(zip(raws, slots))):
        prod = cutout(raw, size)
        pw, ph = prod.size
        x, y = int(w * cx - pw / 2), int(h * cy - ph / 2)
        shadow = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        ImageDraw.Draw(shadow).ellipse([x + pw * 0.15, y + ph * 0.86, x + pw * 0.85, y + ph * 1.0], fill=(0, 0, 0, 110))
        shadow = shadow.filter(ImageFilter.GaussianBlur(18))
        img.paste(shadow, (0, 0), shadow)
        img.paste(prod, (x, y), prod)
    buf = BytesIO()
    img.save(buf, "JPEG", quality=88, optimize=True, progressive=True)
    return buf.getvalue()


class Command(BaseCommand):
    help = "Replace the catalogue with DummyJSON products (studio photos that match names)"

    def handle(self, *args, **opts):
        cache = settings.MEDIA_ROOT / "dummyjson"
        cache.mkdir(parents=True, exist_ok=True)

        self.stdout.write("Downloading product list ...")
        data = json.loads(get(SOURCE))["products"]
        wanted = {dj for _, djs in CATEGORY_MAP for dj in djs}
        products = [p for p in data if p["category"] in wanted]
        (cache / "products.json").write_text(json.dumps(products, indent=1), "utf-8")

        # ---- download photos (main + up to 3 gallery images), cached
        jobs = []
        for p in products:
            for n, url in enumerate(p.get("images", [])[:4]):
                jobs.append((cache / f"{p['id']}_{n}.webp", url))

        def fetch(job):
            path, url = job
            if not path.exists():
                path.write_bytes(get(url))
            return path

        self.stdout.write(f"Downloading {len(jobs)} photos for {len(products)} products ...")
        with ThreadPoolExecutor(max_workers=8) as pool:
            for i, _ in enumerate(pool.map(fetch, jobs), 1):
                if i % 50 == 0:
                    self.stdout.write(f"  {i}/{len(jobs)}")

        with transaction.atomic():
            self.clear_catalogue()
            cat_of = {}
            categories = {}
            for order, (name, djs) in enumerate(CATEGORY_MAP):
                first = next(p for p in products if p["category"] in djs)
                img = to_jpg((cache / f"{first['id']}_0.webp").read_bytes(), 400)
                categories[name] = Category.objects.create(
                    name=name, sort_order=order, image=ContentFile(img, f"cat_{order}.jpg"))
                for dj in djs:
                    cat_of[dj] = categories[name]

            created = {}
            by_discount = sorted(products, key=lambda p: -p.get("discountPercentage", 0))
            featured_ids = {p["id"] for p in by_discount if p.get("stock", 0) > 0}
            featured_ids = set(list(featured_ids)[:0]) | {p["id"] for p in by_discount[:12]}
            for p in products:
                price = nice_price(p["price"] * USD_TO_INR)
                disc = p.get("discountPercentage", 0) or 0
                mrp = max(price, nice_price(p["price"] * USD_TO_INR / max(0.05, 1 - disc / 100)))
                brand = p.get("brand") or ("Vetri Fresh" if p["category"] == "groceries" else "Vetri Select")
                rating = round(3.6 + (float(p.get("rating", 4)) / 5) * 1.3, 1)
                main = to_jpg((cache / f"{p['id']}_0.webp").read_bytes())
                obj = Product.objects.create(
                    category=cat_of[p["category"]], name=p["title"][:200], brand=brand[:100],
                    description=p.get("description", ""), price=Decimal(price), mrp=Decimal(mrp),
                    rating=Decimal(str(min(rating, 4.9))), rating_count=(p["id"] * 37) % 900 + 60,
                    stock=max(0, int(p.get("stock", 10))), is_featured=p["id"] in featured_ids,
                    image=ContentFile(main, f"p{p['id']}.jpg"),
                )
                for n in range(1, min(4, len(p.get("images", [])))):
                    f = cache / f"{p['id']}_{n}.webp"
                    if f.exists():
                        ProductImage.objects.create(product=obj, sort_order=n,
                                                    image=ContentFile(to_jpg(f.read_bytes()), f"p{p['id']}_{n}.jpg"))
                created[p["id"]] = (obj, p)

            for order, (title, djs) in enumerate(HOME_SECTIONS):
                section = HomeSection.objects.create(title=title, sort_order=order)
                picks = [o for o, p in created.values() if p["category"] in djs]
                picks.sort(key=lambda o: (-float(o.rating), o.price))
                section.products.set(picks[:10])

            self.stdout.write("Designing banners ...")
            for order, (key, tag, title, sub, btn, cat, djs, colors) in enumerate(BANNERS):
                srcs = [p for p in products if p["category"] in djs]
                srcs.sort(key=lambda p: djs.index(p["category"]))
                picks, seen = [], set()
                for p in srcs:  # one product from each source category first, for variety
                    if p["category"] not in seen:
                        picks.append(p)
                        seen.add(p["category"])
                picks += [p for p in srcs if p not in picks]
                raws = [(cache / f"{p['id']}_0.webp").read_bytes() for p in picks[:3]]
                Banner.objects.create(tag=tag, title=title, subtitle=sub, button_text=btn,
                                      category=categories[cat], sort_order=order,
                                      image=ContentFile(render_banner(raws, colors), f"banner_{key}.jpg"))

        self.stdout.write(self.style.SUCCESS(
            f"Catalogue ready: {len(categories)} categories, {len(created)} products, "
            f"{ProductImage.objects.count()} gallery photos, {len(BANNERS)} banners, {len(HOME_SECTIONS)} sections."))

    def clear_catalogue(self):
        for model in (ProductImage, Banner, Product, Category):
            for obj in model.objects.all():
                if getattr(obj, "image", None):
                    obj.image.delete(save=False)
        HomeSection.objects.all().delete()
        ProductImage.objects.all().delete()
        Banner.objects.all().delete()
        Product.objects.all().delete()  # order lines keep name & price (product set to NULL)
        Category.objects.all().delete()
