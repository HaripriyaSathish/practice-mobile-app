"""Make one database an exact copy of the other (same ids, same timestamps).

    python manage.py sync_databases --from neon --to mysql     # app data from Render -> your PC
    python manage.py sync_databases --from mysql --to neon     # your PC -> Render

The target's app data is REPLACED. A backup of the target is written to backend/db_backups/ first, and the
copy runs in one transaction, so a failure leaves the target unchanged. Both databases must already have the
same migrations applied (run `migrate` on both first; the command checks).
"""
import tempfile
from datetime import datetime
from pathlib import Path

from django.conf import settings
from django.core.management import call_command
from django.core.management.base import BaseCommand, CommandError
from django.db import connections, transaction
from django.db.migrations.executor import MigrationExecutor

EXCLUDE = ["contenttypes", "auth.permission", "admin.logentry", "sessions", "authtoken.tokenproxy"]
TABLES = ["auth_user", "auth_group", "auth_user_groups", "auth_user_user_permissions", "auth_group_permissions",
          "authtoken_token", "accounts_emailotp", "accounts_profile", "shop_banner", "shop_category",
          "shop_product", "shop_wholesaletier", "shop_quote", "shop_productimage", "shop_homesection",
          "shop_homesection_products", "shop_cartitem",
          "shop_wishlistitem", "shop_address", "shop_order", "shop_shipment", "shop_orderitem", "django_admin_log", "django_session"]


def _dump(alias, path):
    # Write UTF-8 ourselves: dumpdata's output= uses the Windows code page, which breaks on letters like "é"
    with open(path, "w", encoding="utf-8") as stream:
        call_command("dumpdata", natural_foreign=True, exclude=EXCLUDE, format="xml", database=alias,
                     stdout=stream, verbosity=0)


class Command(BaseCommand):
    help = "Copy all app data from one database (mysql/neon) to the other, replacing the target's data."

    def add_arguments(self, parser):
        parser.add_argument("--from", dest="src", required=True, choices=["mysql", "neon"])
        parser.add_argument("--to", dest="dst", required=True, choices=["mysql", "neon"])
        parser.add_argument("--yes", action="store_true", help="Do not ask for confirmation")

    def handle(self, src, dst, yes, **opts):
        if src == dst:
            raise CommandError("--from and --to must be different")
        if src not in settings.DATABASES or dst not in settings.DATABASES:
            raise CommandError("Both MySQL (DB_* vars) and Neon (DATABASE_URL) must be set in backend/.env")
        for alias in (src, dst):
            plan = MigrationExecutor(connections[alias]).migration_plan(
                MigrationExecutor(connections[alias]).loader.graph.leaf_nodes())
            if plan:
                raise CommandError(f"{alias} has unapplied migrations. Run:  $env:DB_TARGET=\"{alias}\"; "
                                   "python manage.py migrate")
        if not yes:
            answer = input(f"This REPLACES all data in {dst} with the data from {src}. Type 'yes' to continue: ")
            if answer.strip().lower() != "yes":
                raise CommandError("Cancelled.")

        backups = Path(settings.BASE_DIR) / "db_backups"
        backups.mkdir(exist_ok=True)
        stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
        backup = backups / f"{dst}-before-sync-{stamp}.xml"
        _dump(dst, backup)
        self.stdout.write(f"Backup of {dst}: {backup}")

        with tempfile.TemporaryDirectory() as tmp:
            dump = Path(tmp) / "data.xml"
            _dump(src, dump)
            conn = connections[dst]
            with transaction.atomic(using=dst):
                with conn.cursor() as c:
                    if conn.vendor == "postgresql":
                        c.execute("TRUNCATE " + ", ".join(TABLES) + " RESTART IDENTITY CASCADE")
                    else:  # MySQL: TRUNCATE would auto-commit, so DELETE inside the transaction
                        c.execute("SET FOREIGN_KEY_CHECKS = 0")
                        for t in TABLES:
                            c.execute(f"DELETE FROM `{t}`")
                        c.execute("SET FOREIGN_KEY_CHECKS = 1")
                call_command("loaddata", str(dump), database=dst, verbosity=1)
        self.stdout.write(self.style.SUCCESS(f"{dst} is now an exact copy of {src}."))
