from django.db import migrations


def forwards(apps, schema_editor):
    # accounts created before passwords existed had already proved their email with an OTP
    apps.get_model("accounts", "Profile").objects.update(email_verified=True)


class Migration(migrations.Migration):
    dependencies = [("accounts", "0002_emailotp_purpose_emailotp_role_and_more")]
    operations = [migrations.RunPython(forwards, migrations.RunPython.noop)]
