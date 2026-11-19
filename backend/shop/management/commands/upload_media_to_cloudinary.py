"""One-time copy of the local media/ folder (banners, categories, product images) to Cloudinary.

    python manage.py upload_media_to_cloudinary          # uploads every image in media/
    python manage.py upload_media_to_cloudinary --only-used   # only files referenced in the database
Safe to run again: files keep the same Cloudinary public id and are overwritten.
"""
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

IMAGE_EXT = {".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif"}


class Command(BaseCommand):
    help = "Upload media/ images to Cloudinary using the same names the database stores."

    def add_arguments(self, parser):
        parser.add_argument("--only-used", action="store_true", help="Skip files no database row points to")
        parser.add_argument("--workers", type=int, default=8)

    def handle(self, *args, **opts):
        if not settings.USE_CLOUDINARY:
            raise CommandError("CLOUDINARY_URL is not set in backend/.env")
        from config.storage import upload_file

        root = Path(settings.MEDIA_ROOT)
        files = [p for p in root.rglob("*") if p.is_file() and p.suffix.lower() in IMAGE_EXT]
        if opts["only_used"]:
            used = self._used_names()
            files = [p for p in files if p.relative_to(root).as_posix() in used]
        self.stdout.write(f"Uploading {len(files)} image(s) to Cloudinary folder '{settings.CLOUDINARY_FOLDER}' ...")

        done = failed = 0
        with ThreadPoolExecutor(max_workers=opts["workers"]) as pool:
            jobs = {pool.submit(upload_file, str(p), p.relative_to(root).as_posix()): p for p in files}
            for job in as_completed(jobs):
                try:
                    job.result()
                    done += 1
                except Exception as exc:
                    failed += 1
                    self.stderr.write(f"  failed {jobs[job].relative_to(root)}: {exc}")
                if (done + failed) % 50 == 0:
                    self.stdout.write(f"  {done + failed}/{len(files)}")
        self.stdout.write(self.style.SUCCESS(f"Uploaded {done}, failed {failed}."))

    @staticmethod
    def _used_names():
        from shop.models import Banner, Category, Product, ProductImage
        names = set()
        for model in (Banner, Category, Product, ProductImage):
            names.update(n for n in model.objects.values_list("image", flat=True) if n)
        return names
