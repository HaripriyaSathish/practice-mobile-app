import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '../api';
import { Field, FormError, passwordProblem, RoleTabs } from '../components/AuthUI';
import { Button } from '../components/common';
import Text from '../components/Text';
import { colors, notify } from '../theme';

/** Step 1: email -> reset code is emailed.  Step 2: code + new password. */
export default function ForgotPasswordScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const [role, setRole] = useState(route.params?.role || 'buyer');
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  const sendCode = async () => {
    setError('');
    setLoading(true);
    try {
      await api('/auth/forgot-password/', { method: 'POST', body: { role, email: email.trim().toLowerCase() } });
      setSent(true);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const reset = async () => {
    const problem = (otp.length !== 6 && 'Enter the 6-digit code.') || passwordProblem(password) ||
      (confirm !== password && 'Passwords do not match.');
    if (problem) {
      setError(problem);
      return;
    }
    setError('');
    setLoading(true);
    try {
      const res = await api('/auth/reset-password/', {
        method: 'POST',
        body: { role, email: email.trim().toLowerCase(), otp, new_password: password },
      });
      notify('Password changed', res.detail);
      navigation.navigate('Login', { role });
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: '#fff' }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={[styles.container, { paddingTop: insets.top + 10 }]} keyboardShouldPersistTaps="handled">
        <Pressable onPress={() => (sent ? setSent(false) : navigation.goBack())} hitSlop={10} style={styles.back} accessibilityLabel="Back">
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <View style={styles.iconCircle}>
          <Ionicons name="key-outline" size={30} color={colors.primary} />
        </View>
        <Text display style={styles.title}>
          {sent ? 'Set a new password' : 'Forgot password?'}
        </Text>
        <Text style={styles.sub}>
          {sent
            ? `If a ${role} account uses ${email.trim()}, we've emailed it a 6-digit code.`
            : 'Enter the email of your account. Older accounts that never had a password can set one here too.'}
        </Text>

        {!sent ? (
          <>
            <RoleTabs value={role} onChange={setRole} />
            <Field label="EMAIL" icon="mail-outline" placeholder="you@example.com" value={email}
              onChangeText={(t) => { setEmail(t); setError(''); }} keyboardType="email-address" autoComplete="email"
              onSubmitEditing={() => validEmail && sendCode()} style={{ marginTop: 18 }} />
            <FormError message={error} />
            <Button title="Send reset code" variant="accent" icon="send-outline" onPress={sendCode} loading={loading}
              disabled={!validEmail} style={{ marginTop: 18 }} />
          </>
        ) : (
          <>
            <Field label="6-DIGIT CODE" icon="keypad-outline" placeholder="Code from the email" value={otp}
              onChangeText={(t) => { setOtp(t.replace(/\D/g, '').slice(0, 6)); setError(''); }} keyboardType="number-pad"
              maxLength={6} autoComplete="one-time-code" textContentType="oneTimeCode" />
            <Field label="NEW PASSWORD" icon="lock-closed-outline" secure placeholder="At least 8 characters" value={password}
              onChangeText={(t) => { setPassword(t); setError(''); }} autoComplete="new-password" style={{ marginTop: 14 }} />
            <Field label="CONFIRM NEW PASSWORD" icon="lock-closed-outline" secure placeholder="Type it again" value={confirm}
              onChangeText={(t) => { setConfirm(t); setError(''); }} autoComplete="new-password" onSubmitEditing={reset}
              style={{ marginTop: 14 }} />
            <FormError message={error} />
            <Button title="Change password" variant="accent" icon="checkmark" onPress={reset} loading={loading} style={{ marginTop: 18 }} />
            <Pressable onPress={sendCode} hitSlop={8} style={{ alignSelf: 'center', marginTop: 16 }}>
              <Text style={styles.link}>Send the code again</Text>
            </Pressable>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 22, paddingBottom: 30, backgroundColor: '#fff', flexGrow: 1 },
  back: { alignSelf: 'flex-start', padding: 4 },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
  },
  title: { fontSize: 25, color: colors.ink, marginTop: 14 },
  sub: { fontSize: 13.5, color: colors.muted, marginTop: 4, marginBottom: 18, lineHeight: 20 },
  link: { color: colors.primary, fontWeight: '600', fontSize: 13.5 },
});
