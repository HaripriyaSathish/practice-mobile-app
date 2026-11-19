from django.db import migrations


def forwards(apps, schema_editor):
    """Old orders: take the state from the saved address text "line, city, State - pincode"."""
    Order = apps.get_model("shop", "Order")
    for order in Order.objects.filter(ship_state=""):
        head = order.address.rsplit(" - ", 1)[0]
        state = head.rsplit(", ", 1)[-1].strip() if ", " in head else ""
        if state:
            Order.objects.filter(pk=order.pk).update(ship_state=state[:60])


class Migration(migrations.Migration):
    dependencies = [("shop", "0006_order_buyer_company_order_buyer_gstin_and_more")]
    operations = [migrations.RunPython(forwards, migrations.RunPython.noop)]
