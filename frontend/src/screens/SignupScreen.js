import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '../api';
import { Field, FormError, passwordProblem, RoleTabs } from '../components/AuthUI';
import { Button } from '../components/common';
import Text from '../components/Text';
import { colors } from '../theme';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_RE = /^[A-Za-z0-9._-]{3,}$/;

/** Create a buyer or seller account. An OTP is emailed; the account is active once it is entered. */
export default function SignupScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const [role, setRole] = useState(route.params?.role || 'buyer');
  const [form, setForm] = useState({ full_name: '', username: '', email: '', phone: '', shop_name: '', password: '', confirm: '' });
  const [touched, setTouched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const set = (key) => (value) => {
    setForm((f) => ({ ...f, [key]: key === 'phone' ? value.replace(/\D/g, '').slice(0, 10) : value }));
    setError('');
  };

  const problems = {
    full_name: !form.full_name.trim() && 'Enter your name.',
    username: !USERNAME_RE.test(form.username.trim()) && '3+ letters/numbers, . _ - allowed.',
    email: !EMAIL_RE.test(form.email.trim()) && 'Enter a valid email.',
    phone: form.phone && form.phone.length !== 10 && 'Enter a 10-digit mobile number.',
    shop_name: role === 'seller' && !form.shop_name.trim() && 'Enter your shop name.',
    password: passwordProblem(form.password),
    confirm: form.confirm !== form.password && 'Passwords do not match.',
  };
  const firstProblem = Object.values(problems).find(Boolean);

  const submit = async () => {
    setTouched(true);
    if (firstProblem || loading) return;
    setLoading(true);
    setError('');
    try {
      const body = {
        role,
        full_name: form.full_name.trim(),
        username: form.username.trim(),
        email: form.email.trim().toLowerCase(),
        phone: form.phone,
        password: form.password,
        ...(role === 'seller' ? { shop_name: form.shop_name.trim() } : {}),
      };
      const res = await api('/auth/register/', { method: 'POST', body });
      navigation.navigate('Otp', { email: res.email, role, purpose: 'signup', resendIn: res.resend_in });
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const err = (key) => (touched ? problems[key] : '');

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: '#fff' }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={[styles.container, { paddingTop: insets.top + 10 }]} keyboardShouldPersistTaps="handled">
        <Pressable onPress={() => navigation.goBack()} hitSlop={10} style={styles.back} accessibilityLabel="Back">
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </Pressable>

        <Text display style={styles.title}>
          Create account
        </Text>
        <Text style={styles.sub}>
          {role === 'seller'
            ? 'Open your shop on Vetri. After you verify your email, our team approves your shop before you can list products.'
            : 'Shop from all Vetri sellers. We will email you a code to verify your address.'}
        </Text>

        <RoleTabs value={role} onChange={setRole} />

        <Field label="FULL NAME" icon="person-outline" placeholder="Your name" value={form.full_name}
          onChangeText={set('full_name')} autoCapitalize="words" autoComplete="name" error={err('full_name')} style={styles.gap} />
        {role === 'seller' && (
          <Field label="SHOP NAME" icon="storefront-outline" placeholder="e.g. Ravi Textiles" value={form.shop_name}
            onChangeText={set('shop_name')} autoCapitalize="words" error={err('shop_name')} style={styles.gap} />
        )}
        <Field label="USERNAME" icon="at-outline" placeholder="Pick a username" value={form.username}
          onChangeText={set('username')} autoComplete="username-new" error={err('username')} style={styles.gap} />
        <Field label="EMAIL" icon="mail-outline" placeholder="you@example.com" value={form.email}
          onChangeText={set('email')} keyboardType="email-address" autoComplete="email" error={err('email')} style={styles.gap} />
        <Field label="MOBILE (OPTIONAL)" icon="call-outline" placeholder="10-digit mobile number" value={form.phone}
          onChangeText={set('phone')} keyboardType="number-pad" maxLength={10} error={err('phone')} style={styles.gap} />
        <Field label="PASSWORD" icon="lock-closed-outline" secure placeholder="At least 8 characters" value={form.password}
          onChangeText={set('password')} autoComplete="new-password" error={err('password')} style={styles.gap} />
        <Field label="CONFIRM PASSWORD" icon="lock-closed-outline" secure placeholder="Type it again" value={form.confirm}
          onChangeText={set('confirm')} autoComplete="new-password" error={err('confirm')} onSubmitEditing={submit} style={styles.gap} />

        <FormError message={error || (touched ? firstProblem : '')} />

        <Button
          title={role === 'seller' ? 'Create seller account' : 'Create account'}
          variant="accent"
          icon="mail-unread-outline"
          onPress={submit}
          loading={loading}
          style={{ marginTop: 18 }}
        />

        <View style={styles.switchRow}>
          <Text style={styles.muted}>Already have an account? </Text>
          <Pressable onPress={() => navigation.navigate('Login', { role })} hitSlop={8}>
            <Text style={styles.link}>Login</Text>
          </Pressable>
        </View>
        <Text style={styles.terms}>By continuing, you agree to our Terms of Use and Privacy Policy.</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 22, paddingBottom: 30, backgroundColor: '#fff', flexGrow: 1 },
  back: { alignSelf: 'flex-start', padding: 4, marginBottom: 8 },
  title: { fontSize: 27, color: colors.ink },
  sub: { fontSize: 13.5, color: colors.muted, marginTop: 4, marginBottom: 18, lineHeight: 20 },
  gap: { marginTop: 14 },
  link: { color: colors.primary, fontWeight: '600', fontSize: 13.5 },
  muted: { color: colors.muted, fontSize: 13.5 },
  switchRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 18 },
  terms: { fontSize: 11.5, color: colors.muted, textAlign: 'center', marginTop: 16, lineHeight: 17 },
});
