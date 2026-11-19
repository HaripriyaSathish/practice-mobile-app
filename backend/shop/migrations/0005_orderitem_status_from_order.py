from django.db import migrations


def forwards(apps, schema_editor):
    OrderItem = apps.get_model("shop", "OrderItem")
    Order = apps.get_model("shop", "Order")
    for status in Order.objects.values_list("status", flat=True).distinct():
        OrderItem.objects.filter(order__status=status).update(status=status)


class Migration(migrations.Migration):
    dependencies = [("shop", "0004_orderitem_seller_orderitem_status_and_more")]
    operations = [migrations.RunPython(forwards, migrations.RunPython.noop)]
