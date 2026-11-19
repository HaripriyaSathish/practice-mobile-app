import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { api } from '../api';
import { FadeInUp } from '../components/Animations';
import { Button, TopBar } from '../components/common';
import Text from '../components/Text';
import { useApp } from '../context/AppContext';
import { colors, fonts, notify, shadow } from '../theme';

const EMPTY = { full_name: '', phone: '', line1: '', city: '', state: 'Tamil Nadu', pincode: '' };

function Field({ label, ...props }) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput style={styles.input} placeholderTextColor="#B5ADB0" {...props} />
    </View>
  );
}

/** "Deliver to" picker: choose a saved address or add a new one. */
export default function AddressesScreen({ navigation }) {
  const { addresses, refreshAddresses, deliveryAddress, chooseDelivery, user } = useApp();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ...EMPTY, full_name: user?.full_name || '', phone: user?.phone || '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    refreshAddresses().then((list) => {
      if (!list.length) setShowForm(true);
    });
  }, [refreshAddresses]);

  const pick = async (id) => {
    await chooseDelivery(id);
    navigation.goBack();
  };

  const save = async () => {
    if (!form.full_name || !/^\d{10}$/.test(form.phone) || !form.line1 || !form.city || !/^\d{6}$/.test(form.pincode)) {
      notify('Check address', 'Please fill all fields. Phone must be 10 digits and pincode 6 digits.');
      return;
    }
    setSaving(true);
    try {
      const a = await api('/addresses/', { method: 'POST', body: form });
      await refreshAddresses();
      await pick(a.id);
    } catch (e) {
      notify('Address', e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <TopBar title="Deliver to" back showCart={false} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 30 }} keyboardShouldPersistTaps="handled">
          {addresses.length > 0 && <Text style={styles.section}>SAVED ADDRESSES</Text>}
          {addresses.map((a, i) => {
            const active = deliveryAddress?.id === a.id;
            return (
              <FadeInUp key={a.id} delay={i * 70}>
                <Pressable style={[styles.card, active && styles.cardActive]} onPress={() => pick(a.id)}>
                  <View style={[styles.iconWrap, active && { backgroundColor: colors.primary }]}>
                    <Ionicons name="location" size={18} color={active ? '#fff' : colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.name}>
                      {a.full_name} <Text style={styles.phone}> {a.phone}</Text>
                    </Text>
                    <Text style={styles.addr}>
                      {a.line1}, {a.city}, {a.state} - {a.pincode}
                    </Text>
                  </View>
                  <Ionicons
                    name={active ? 'checkmark-circle' : 'ellipse-outline'}
                    size={22}
                    color={active ? colors.primary : colors.border}
                  />
                </Pressable>
              </FadeInUp>
            );
          })}

          {showForm ? (
            <FadeInUp style={styles.form}>
              <Text display style={styles.formTitle}>
                Add a new address
              </Text>
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
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 6 }}>
                {addresses.length > 0 && <Button title="Cancel" variant="outline" onPress={() => setShowForm(false)} style={{ flex: 1 }} />}
                <Button title="Save & deliver here" variant="accent" onPress={save} loading={saving} style={{ flex: 1.4 }} />
              </View>
            </FadeInUp>
          ) : (
            <Pressable style={styles.addBtn} onPress={() => setShowForm(true)}>
              <Ionicons name="add" size={18} color={colors.primary} />
              <Text style={styles.addText}>Add a new address</Text>
            </Pressable>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  section: { fontSize: 11, color: colors.muted, fontWeight: '600', letterSpacing: 1.5, marginBottom: 10 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow,
  },
  cardActive: { borderColor: colors.primary },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: { fontSize: 14, fontWeight: '600', color: colors.ink },
  phone: { fontWeight: '400', color: colors.muted },
  addr: { fontSize: 12.5, color: colors.muted, marginTop: 3, lineHeight: 18 },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.primary,
    borderRadius: 14,
    paddingVertical: 14,
    marginTop: 6,
  },
  addText: { color: colors.primary, fontWeight: '600' },
  form: { backgroundColor: '#fff', borderRadius: 16, padding: 16, gap: 10, marginTop: 6, ...shadow },
  formTitle: { fontSize: 19, color: colors.ink, marginBottom: 2 },
  label: { fontSize: 11, color: colors.muted, marginBottom: 5, fontWeight: '600', letterSpacing: 0.5 },
  input: {
    fontFamily: fonts.regular,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 46,
    fontSize: 14,
    color: colors.ink,
    backgroundColor: '#FBF9F7',
  },
});
