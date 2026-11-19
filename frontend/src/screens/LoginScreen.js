import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '../api';
import { FadeInUp, Pulse, SparkleField } from '../components/Animations';
import { Button } from '../components/common';
import Logo from '../components/Logo';
import Text from '../components/Text';
import { colors, fonts } from '../theme';

export default function LoginScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [focused, setFocused] = useState(false);

  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  const sendOtp = async () => {
    setError('');
    setLoading(true);
    try {
      const res = await api('/auth/send-otp/', { method: 'POST', body: { email: email.trim() } });
      navigation.navigate('Otp', { email: email.trim().toLowerCase(), resendIn: res.resend_in });
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
          style={[styles.hero, { paddingTop: insets.top + 56 }]}
        >
          <SparkleField count={14} seed={7} />
          <FadeInUp>
            <Pulse>
              <View style={styles.ringOuter}>
                <View style={styles.ringInner}>
                  <Ionicons name="bag-handle-outline" size={30} color={colors.accent} />
                </View>
              </View>
            </Pulse>
          </FadeInUp>
          <FadeInUp delay={150} style={{ marginTop: 22 }}>
            <Logo size={28} align="center" />
          </FadeInUp>
          <FadeInUp delay={300}>
            <Text style={styles.tag}>Fashion · Electronics · Home · Gifts</Text>
          </FadeInUp>
        </LinearGradient>

        <FadeInUp delay={350} style={styles.form}>
          <Text display style={styles.title}>
            Welcome
          </Text>
          <Text style={styles.sub}>Sign in or create an account with your email. We'll send a one-time code - no password needed.</Text>

          <Text style={styles.label}>EMAIL ADDRESS</Text>
          <View style={[styles.inputWrap, focused && styles.inputFocused, error && { borderColor: colors.danger }]}>
            <Ionicons name="mail-outline" size={19} color={focused ? colors.primary : colors.muted} />
            <TextInput
              style={styles.input}
              placeholder="you@example.com"
              placeholderTextColor="#B5ADB0"
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              value={email}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              onChangeText={(t) => {
                setEmail(t);
                setError('');
              }}
              onSubmitEditing={() => valid && sendOtp()}
              returnKeyType="send"
            />
          </View>
          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Button title="Continue" variant="accent" icon="arrow-forward" onPress={sendOtp} loading={loading} disabled={!valid} style={{ marginTop: 22 }} />

          <View style={styles.perks}>
            {[
              ['lock-closed-outline', 'Secure OTP login'],
              ['car-outline', 'Free delivery'],
              ['refresh-outline', 'Easy returns'],
            ].map(([icon, label]) => (
              <View key={label} style={styles.perk}>
                <Ionicons name={icon} size={16} color={colors.accent} />
                <Text style={styles.perkText}>{label}</Text>
              </View>
            ))}
          </View>

          <Text style={styles.terms}>By continuing, you agree to our Terms of Use and Privacy Policy.</Text>
        </FadeInUp>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  hero: {
    alignItems: 'center',
    paddingBottom: 48,
    borderBottomLeftRadius: 36,
    borderBottomRightRadius: 36,
  },
  ringOuter: {
    width: 84,
    height: 84,
    borderRadius: 42,
    borderWidth: 1,
    borderColor: 'rgba(201,163,92,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringInner: {
    width: 66,
    height: 66,
    borderRadius: 33,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tag: { color: 'rgba(255,255,255,0.75)', fontSize: 12, marginTop: 14, letterSpacing: 0.6 },
  form: { paddingHorizontal: 26, paddingTop: 30, paddingBottom: 24, flex: 1 },
  title: { fontSize: 30, color: colors.ink },
  sub: { fontSize: 14, color: colors.muted, marginTop: 8, lineHeight: 21 },
  label: { fontSize: 10.5, color: colors.muted, fontWeight: '600', letterSpacing: 1.5, marginTop: 28, marginBottom: 8 },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 54,
    gap: 10,
    backgroundColor: '#FBF9F7',
  },
  inputFocused: { borderColor: colors.primary, backgroundColor: '#fff' },
  input: { flex: 1, fontSize: 15.5, color: colors.ink, height: '100%', fontFamily: fonts.regular },
  error: { color: colors.danger, marginTop: 8, fontSize: 13 },
  perks: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 28 },
  perk: { alignItems: 'center', gap: 5, flex: 1 },
  perkText: { fontSize: 11, color: colors.ink, fontWeight: '500' },
  terms: { fontSize: 11.5, color: colors.muted, textAlign: 'center', marginTop: 26, lineHeight: 17 },
});
