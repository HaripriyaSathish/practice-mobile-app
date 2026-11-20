"""Media storage on Cloudinary, so product images survive Render redeploys.

Active when CLOUDINARY_URL (cloudinary://<api_key>:<api_secret>@<cloud_name>) is set.
A file saved as "products/p194.jpg" in the database is stored on Cloudinary with the public id
"<CLOUDINARY_FOLDER>/products/p194" - the same names as the local media/ folder, so the database
rows stay identical for MySQL and Neon. Upload the existing media/ folder once with:
    python manage.py upload_media_to_cloudinary
"""
import os
import secrets
import urllib.request

import cloudinary
import cloudinary.uploader
import cloudinary.utils
from django.conf import settings
from django.core.files.base import ContentFile
from django.core.files.storage import Storage
from django.utils.deconstruct import deconstructible


def public_id_for(name):
    stem, _ext = os.path.splitext(name.replace("\\", "/"))
    return f"{settings.CLOUDINARY_FOLDER}/{stem}"


def upload_file(file_or_path, name):
    """Upload a file (path or file object) under the Cloudinary public id that matches `name`."""
    return cloudinary.uploader.upload(
        file_or_path, public_id=public_id_for(name), overwrite=True, resource_type="image",
        unique_filename=False, use_filename=False)


@deconstructible
class CloudinaryMediaStorage(Storage):
    def _save(self, name, content):
        if hasattr(content, "seek"):
            content.seek(0)
        upload_file(content, name)
        return name.replace("\\", "/")

    def get_available_name(self, name, max_length=None):
        # add a short random part so two uploads called "photo.jpg" never overwrite each other
        root, ext = os.path.splitext(name.replace("\\", "/"))
        candidate = f"{root}_{secrets.token_hex(4)}{ext.lower()}"
        if max_length and len(candidate) > max_length:
            candidate = f"{root[: max_length - len(ext) - 10]}_{secrets.token_hex(4)}{ext.lower()}"
        return candidate

    def exists(self, name):
        return False  # names are made unique in get_available_name

    def url(self, name):
        _stem, ext = os.path.splitext(name)
        url, _ = cloudinary.utils.cloudinary_url(
            public_id_for(name), secure=True, format=(ext.lstrip(".").lower() or None),
            resource_type="image")
        return url

    def delete(self, name):
        if name:
            try:
                cloudinary.uploader.destroy(public_id_for(name), resource_type="image", invalidate=True)
            except Exception:
                pass

    def _open(self, name, mode="rb"):
        with urllib.request.urlopen(self.url(name), timeout=30) as response:
            return ContentFile(response.read(), name=name)

    def size(self, name):
        return 0


from whitenoise.storage import CompressedManifestStaticFilesStorage


class LenientManifestStaticStorage(CompressedManifestStaticFilesStorage):
    """Jazzmin asks for static('vendor/bootswatch') (a folder, not a file), which a strict manifest
    turns into a 500 on every admin page when DEBUG=False. Fall back to the plain URL instead."""
    manifest_strict = False
