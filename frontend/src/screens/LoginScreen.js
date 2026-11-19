import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '../api';
import { FadeInUp, Pulse, SparkleField } from '../components/Animations';
import { Field, FormError, RoleTabs } from '../components/AuthUI';
import { Button } from '../components/common';
import Logo from '../components/Logo';
import Text from '../components/Text';
import { colors } from '../theme';

/** Step 1 of login: role + username/email + password. Step 2 (OtpScreen): the code emailed to them. */
export default function LoginScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const [role, setRole] = useState(route.params?.role || 'buyer');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const valid = username.trim().length >= 3 && password.length > 0;

  const submit = async () => {
    if (!valid || loading) return;
    setError('');
    setLoading(true);
    try {
      const res = await api('/auth/login/', { method: 'POST', body: { role, username: username.trim(), password } });
      // purpose is "login" normally, or "signup" when the email was never verified
      navigation.navigate('Otp', { email: res.email, role, purpose: res.purpose, resendIn: res.resend_in, note: res.message });
      setPassword('');
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: '#fff' }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
        <LinearGradient
          colors={[colors.primaryDark, colors.primary, '#8A3355']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.hero, { paddingTop: insets.top + 36 }]}
        >
          <SparkleField count={14} seed={7} />
          <FadeInUp>
            <Pulse>
              <View style={styles.ringOuter}>
                <View style={styles.ringInner}>
                  <Ionicons name={role === 'seller' ? 'storefront-outline' : 'bag-handle-outline'} size={28} color={colors.accent} />
                </View>
              </View>
            </Pulse>
          </FadeInUp>
          <FadeInUp delay={150} style={{ marginTop: 18 }}>
            <Logo size={26} align="center" />
          </FadeInUp>
          <FadeInUp delay={300}>
            <Text style={styles.tag}>Many stores · One marketplace</Text>
          </FadeInUp>
        </LinearGradient>

        <FadeInUp delay={350} style={styles.form}>
          <Text display style={styles.title}>
            Welcome back
          </Text>
          <Text style={styles.sub}>Login with your password. We'll then email you a one-time code.</Text>

          <RoleTabs value={role} onChange={(r) => { setRole(r); setError(''); }} />

          <Field
            label={role === 'seller' ? 'SELLER USERNAME OR EMAIL' : 'USERNAME OR EMAIL'}
            icon="person-outline"
            placeholder="e.g. ravi or ravi@example.com"
            value={username}
            onChangeText={(t) => { setUsername(t); setError(''); }}
            autoComplete="username"
            returnKeyType="next"
            style={{ marginTop: 20 }}
          />
          <Field
            label="PASSWORD"
            icon="lock-closed-outline"
            secure
            placeholder="Your password"
            value={password}
            onChangeText={(t) => { setPassword(t); setError(''); }}
            autoComplete="current-password"
            onSubmitEditing={submit}
            returnKeyType="go"
            style={{ marginTop: 14 }}
          />
          <Pressable onPress={() => navigation.navigate('ForgotPassword', { role })} hitSlop={8} style={styles.forgot}>
            <Text style={styles.link}>Forgot password?</Text>
          </Pressable>

          <FormError message={error} />

          <Button
            title={role === 'seller' ? 'Login as Seller' : 'Login'}
            variant="accent"
            icon="arrow-forward"
            onPress={submit}
            loading={loading}
            disabled={!valid}
            style={{ marginTop: 18 }}
          />

          <View style={styles.switchRow}>
            <Text style={styles.muted}>New to Vetri? </Text>
            <Pressable onPress={() => navigation.navigate('Signup', { role })} hitSlop={8}>
              <Text style={styles.link}>{role === 'seller' ? 'Open a seller account' : 'Create an account'}</Text>
            </Pressable>
          </View>

          <View style={styles.perks}>
            {[
              ['shield-checkmark-outline', 'Password + email OTP'],
              ['storefront-outline', 'Trusted sellers'],
              ['refresh-outline', 'Easy returns'],
            ].map(([icon, label]) => (
              <View key={label} style={styles.perk}>
                <Ionicons name={icon} size={16} color={colors.accent} />
                <Text style={styles.perkText}>{label}</Text>
              </View>
            ))}
          </View>
        </FadeInUp>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  hero: {
    alignItems: 'center',
    paddingBottom: 34,
    borderBottomLeftRadius: 36,
    borderBottomRightRadius: 36,
  },
  ringOuter: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 1,
    borderColor: 'rgba(201,163,92,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tag: { color: 'rgba(255,255,255,0.75)', fontSize: 12, marginTop: 12, letterSpacing: 0.6 },
  form: { paddingHorizontal: 22, paddingTop: 24, paddingBottom: 28, flex: 1 },
  title: { fontSize: 27, color: colors.ink },
  sub: { fontSize: 13.5, color: colors.muted, marginTop: 4, marginBottom: 18, lineHeight: 20 },
  forgot: { alignSelf: 'flex-end', marginTop: 10 },
  link: { color: colors.primary, fontWeight: '600', fontSize: 13.5 },
  muted: { color: colors.muted, fontSize: 13.5 },
  switchRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 20, flexWrap: 'wrap' },
  perks: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 26 },
  perk: { alignItems: 'center', gap: 5, flex: 1 },
  perkText: { fontSize: 10.5, color: colors.ink, fontWeight: '500', textAlign: 'center' },
});
