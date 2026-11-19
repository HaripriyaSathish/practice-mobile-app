import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import Text from '../components/Text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '../api';
import { Button, Loader, TopBar } from '../components/common';
import { useApp } from '../context/AppContext';
import { appReturnUrl, openPaymentPage } from '../payment';
import { colors, formatPrice, notify } from '../theme';
import { PriceDetails } from './CartScreen';

const EMPTY = { full_name: '', phone: '', line1: '', city: '', state: 'Tamil Nadu', pincode: '' };

function Field({ label, ...props }) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput style={styles.input} placeholderTextColor="#aaa" {...props} />
    </View>
  );
}

export default function CheckoutScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { cart, refreshCart, user, deliveryAddress, chooseDelivery, refreshAddresses } = useApp();
  const [addresses, setAddresses] = useState(null);
  const [selected, setSelected] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ...EMPTY, full_name: user?.full_name || '', phone: user?.phone || '' });
  const [payment, setPayment] = useState('COD');
  const [placing, setPlacing] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api('/addresses/')
      .then((list) => {
        setAddresses(list);
        if (list.length) setSelected(list.some((a) => a.id === deliveryAddress?.id) ? deliveryAddress.id : list.find((a) => a.is_default)?.id || list[list.length - 1].id);
        else setShowForm(true);
      })
      .catch((e) => notify('Address', e.message));
  }, []);

  const saveAddress = async () => {
    if (!form.full_name || !/^\d{10}$/.test(form.phone) || !form.line1 || !form.city || !/^\d{6}$/.test(form.pincode)) {
      notify('Check address', 'Please fill all fields. Phone must be 10 digits and pincode 6 digits.');
      return;
    }
    setSaving(true);
    try {
      const a = await api('/addresses/', { method: 'POST', body: form });
      setAddresses((list) => [...list, a]);
      setSelected(a.id);
      chooseDelivery(a.id);
      refreshAddresses();
      setShowForm(false);
    } catch (e) {
      notify('Address', e.message);
    } finally {
      setSaving(false);
    }
  };

  const placeOrder = async () => {
    if (!selected) {
      notify('Address needed', 'Please add a delivery address.');
      return;
    }
    setPlacing(true);
    try {
      const res = await api('/orders/', {
        method: 'POST',
        body: { address_id: selected, payment_method: payment, app_return: appReturnUrl() },
      });
      await refreshCart();
      const order = res.order;

      if (payment === 'COD') {
        navigation.replace('Orders', { celebrate: order.id }); // sparkle celebration on My Orders
        return;
      }
      if (!res.payment_url) {
        notify('Payment could not start', res.payment_error || 'Please retry from My Orders.');
        navigation.replace('Orders');
        return;
      }
      const result = await openPaymentPage(res.payment_url);
      if (result !== 'redirected') navigation.replace('Orders', { verifyId: order.id });
    } catch (e) {
      notify('Could not place order', e.message);
    } finally {
      setPlacing(false);
    }
  };

  if (!addresses) {
    return (
      <View style={styles.container}>
        <TopBar title="Checkout" back showCart={false} />
        <Loader />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <TopBar title="Checkout" back showCart={false} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ paddingBottom: 20 }} keyboardShouldPersistTaps="handled">
          {/* Step 1: address */}
          <View style={styles.card}>
            <Text style={styles.step}>1. DELIVERY ADDRESS</Text>
            {addresses.map((a) => (
              <Pressable key={a.id} style={[styles.address, selected === a.id && styles.addressActive]} onPress={() => { setSelected(a.id); chooseDelivery(a.id); }}>
                <Ionicons
                  name={selected === a.id ? 'radio-button-on' : 'radio-button-off'}
                  size={20}
                  color={selected === a.id ? colors.primary : colors.muted}
                />
                <View style={{ flex: 1 }}>
                  <Text style={styles.addrName}>
                    {a.full_name} <Text style={styles.addrPhone}> {a.phone}</Text>
                  </Text>
                  <Text style={styles.addrText}>
                    {a.line1}, {a.city}, {a.state} - {a.pincode}
                  </Text>
                </View>
              </Pressable>
            ))}
            {showForm ? (
              <View style={{ gap: 10, marginTop: 6 }}>
                <Field label="Full name" value={form.full_name} onChangeText={(v) => setForm({ ...form, full_name: v })} placeholder="e.g. Priya R" />
                <Field
                  label="Phone (10 digits)"
                  value={form.phone}
                  keyboardType="number-pad"
                  maxLength={10}
                  onChangeText={(v) => setForm({ ...form, phone: v.replace(/\D/g, '') })}
                  placeholder="9876543210"
                />
                <Field label="House no, Street, Area" value={form.line1} onChangeText={(v) => setForm({ ...form, line1: v })} placeholder="12, Gandhi Street, T. Nagar" />
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <Field label="City" value={form.city} onChangeText={(v) => setForm({ ...form, city: v })} placeholder="Chennai" />
                  <Field
                    label="Pincode"
                    value={form.pincode}
                    keyboardType="number-pad"
                    maxLength={6}
                    onChangeText={(v) => setForm({ ...form, pincode: v.replace(/\D/g, '') })}
                    placeholder="600017"
                  />
                </View>
                <Field label="State" value={form.state} onChangeText={(v) => setForm({ ...form, state: v })} />
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  {addresses.length > 0 && (
                    <Button title="Cancel" variant="outline" onPress={() => setShowForm(false)} style={{ flex: 1 }} />
                  )}
                  <Button title="Save address" onPress={saveAddress} loading={saving} style={{ flex: 1 }} />
                </View>
              </View>
            ) : (
              <Pressable style={styles.addBtn} onPress={() => setShowForm(true)}>
                <Ionicons name="add-circle-outline" size={18} color={colors.primary} />
                <Text style={styles.addText}>Add a new address</Text>
              </Pressable>
            )}
          </View>

          {/* Step 2: payment */}
          <View style={styles.card}>
            <Text style={styles.step}>2. PAYMENT METHOD</Text>
            {[
              ['COD', 'cash-outline', 'Cash on Delivery', 'Pay when your order arrives'],
              ['CASHFREE', 'card-outline', 'Pay Online (Cashfree)', 'UPI, cards, net banking • TEST mode'],
            ].map(([key, icon, title, sub]) => (
              <Pressable key={key} style={[styles.address, payment === key && styles.addressActive]} onPress={() => setPayment(key)}>
                <Ionicons
                  name={payment === key ? 'radio-button-on' : 'radio-button-off'}
                  size={20}
                  color={payment === key ? colors.primary : colors.muted}
                />
                <Ionicons name={icon} size={22} color={colors.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.addrName}>{title}</Text>
                  <Text style={styles.addrText}>{sub}</Text>
                </View>
              </Pressable>
            ))}
          </View>

          <PriceDetails cart={cart} />
        </ScrollView>
      </KeyboardAvoidingView>

      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 12 }]}>
        <View>
          <Text style={styles.total}>{formatPrice(cart.total)}</Text>
          <Text style={styles.totalSub}>{cart.count} item(s)</Text>
        </View>
        <Button
          title={payment === 'COD' ? 'Confirm Order' : 'Pay & Place Order'}
          variant="accent"
          onPress={placeOrder}
          loading={placing}
          disabled={!cart.count || showForm}
          style={{ flex: 1, marginLeft: 16 }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  card: { backgroundColor: '#fff', padding: 14, marginTop: 8 },
  step: { color: colors.muted, fontWeight: '600', fontSize: 11, marginBottom: 12, letterSpacing: 1.5 },
  address: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },
  addressActive: { borderColor: colors.primary, backgroundColor: '#FDF5F7' },
  addrName: { fontWeight: '700', fontSize: 14, color: colors.text },
  addrPhone: { fontWeight: '400', color: colors.muted },
  addrText: { color: colors.muted, fontSize: 13, marginTop: 2 },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8 },
  addText: { color: colors.primary, fontWeight: '700' },
  label: { fontSize: 12, color: colors.muted, marginBottom: 4, fontWeight: '600' },
  input: {
    fontFamily: 'Poppins_400Regular',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    height: 44,
    fontSize: 14,
    color: colors.text,
    backgroundColor: '#FCFAF8',
  },
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  total: { fontSize: 18, fontWeight: '900', color: colors.text },
  totalSub: { fontSize: 11, color: colors.primary, fontWeight: '600' },
});
