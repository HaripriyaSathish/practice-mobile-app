import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { api } from '../../api';
import { Field, FormError, passwordProblem } from '../../components/AuthUI';
import { Button, TopBar } from '../../components/common';
import Text from '../../components/Text';
import { useApp } from '../../context/AppContext';
import { colors, confirmAction, fonts, notify } from '../../theme';

/** Shop profile, password change and logout for seller accounts. */
export default function SellerAccountScreen() {
  const { user, setUser, logout } = useApp();
  const [form, setForm] = useState({
    full_name: user?.full_name || '', phone: user?.phone || '', shop_name: user?.shop_name || '',
    shop_description: user?.shop_description || '', gstin: user?.gstin || '',
  });
  const [saving, setSaving] = useState(false);
  const [pw, setPw] = useState({ old: '', next: '' });
  const [pwError, setPwError] = useState('');
  const [pwSaving, setPwSaving] = useState(false);
  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: k === 'phone' ? v.replace(/\D/g, '').slice(0, 10) : v }));

  const save = async () => {
    if (!form.shop_name.trim()) {
      notify('Shop name', 'Please enter your shop name.');
      return;
    }
    setSaving(true);
    try {
      setUser(await api('/auth/me/', { method: 'PUT', body: form }));
      notify('Saved', 'Your shop profile is updated.');
    } catch (e) {
      notify('Profile', e.message);
    } finally {
      setSaving(false);
    }
  };

  const changePassword = async () => {
    const problem = passwordProblem(pw.next);
    if (problem) {
      setPwError(problem);
      return;
    }
    setPwSaving(true);
    setPwError('');
    try {
      await api('/auth/change-password/', { method: 'POST', body: { old_password: pw.old, new_password: pw.next } });
      setPw({ old: '', next: '' });
      notify('Password changed', 'Use the new password next time you login.');
    } catch (e) {
      setPwError(e.message);
    } finally {
      setPwSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <TopBar title="My Shop" showCart={false} />
      <ScrollView contentContainerStyle={{ padding: 12, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <View style={styles.head}>
          <View style={styles.avatar}>
            <Ionicons name="storefront" size={26} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{user?.shop_name}</Text>
            <Text style={styles.meta}>@{user?.username} · {user?.email}</Text>
            <Text style={[styles.meta, { color: user?.is_approved ? colors.green : '#8a5a00', fontWeight: '600' }]}>
              {user?.is_approved ? 'Approved seller' : 'Waiting for admin approval'}
            </Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Shop profile</Text>
          <Field label="SHOP NAME" icon="storefront-outline" value={form.shop_name} onChangeText={set('shop_name')} autoCapitalize="words" style={styles.gap} />
          <Text style={[styles.label, styles.gap]}>ABOUT YOUR SHOP</Text>
          <TextInput style={styles.area} multiline value={form.shop_description} onChangeText={set('shop_description')}
            placeholder="What do you sell? Where are you based?" placeholderTextColor="#aaa" />
          <Field label="GSTIN (OPTIONAL)" icon="document-text-outline" value={form.gstin} onChangeText={(v) => set('gstin')(v.toUpperCase())} autoCapitalize="characters" style={styles.gap} />
          <Field label="YOUR NAME" icon="person-outline" value={form.full_name} onChangeText={set('full_name')} autoCapitalize="words" style={styles.gap} />
          <Field label="MOBILE" icon="call-outline" value={form.phone} onChangeText={set('phone')} keyboardType="number-pad" maxLength={10} style={styles.gap} />
          <Button title="Save shop profile" onPress={save} loading={saving} style={{ marginTop: 18 }} />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Change password</Text>
          <Field label="CURRENT PASSWORD" icon="lock-closed-outline" secure value={pw.old} onChangeText={(v) => setPw((p) => ({ ...p, old: v }))} style={styles.gap} />
          <Field label="NEW PASSWORD" icon="lock-closed-outline" secure value={pw.next} onChangeText={(v) => setPw((p) => ({ ...p, next: v }))} style={styles.gap} />
          <FormError message={pwError} />
          <Button title="Change password" variant="outline" onPress={changePassword} loading={pwSaving} disabled={!pw.old || !pw.next} style={{ marginTop: 16 }} />
        </View>

        <Button title="Logout" variant="outline" icon="log-out-outline"
          onPress={() => confirmAction('Logout', 'Logout from your seller account?', logout)} style={{ marginTop: 6 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 10 },
  avatar: { width: 54, height: 54, borderRadius: 27, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' },
  name: { fontSize: 17, fontWeight: '700', color: colors.ink },
  meta: { fontSize: 12, color: colors.muted, marginTop: 1 },
  card: { backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 10 },
  cardTitle: { fontSize: 15.5, fontWeight: '700', color: colors.ink },
  gap: { marginTop: 12 },
  label: { fontSize: 10.5, color: colors.muted, fontWeight: '600', letterSpacing: 1.4, marginBottom: 7 },
  area: {
    fontFamily: fonts.regular,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 13,
    padding: 12,
    height: 96,
    fontSize: 14.5,
    color: colors.ink,
    backgroundColor: '#FBF9F7',
    textAlignVertical: 'top',
  },
});
