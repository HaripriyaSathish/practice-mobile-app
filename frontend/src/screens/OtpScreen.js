import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import Text from '../components/Text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '../api';
import { Button } from '../components/common';
import { useApp } from '../context/AppContext';
import { colors } from '../theme';

const LENGTH = 6;

export default function OtpScreen({ route, navigation }) {
  const { email } = route.params;
  const insets = useSafeAreaInsets();
  const { login } = useApp();
  const inputRef = useRef(null);
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [seconds, setSeconds] = useState(route.params.resendIn || 30);

  useEffect(() => {
    if (seconds <= 0) return undefined;
    const t = setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [seconds]);

  const verify = async (value = code) => {
    if (value.length !== LENGTH) return;
    setError('');
    setLoading(true);
    try {
      const res = await api('/auth/verify-otp/', { method: 'POST', body: { email, otp: value } });
      await login(res.token, res.user); // navigator switches to the shop automatically
    } catch (e) {
      setError(e.message);
      setCode('');
      setLoading(false);
    }
  };

  const resend = async () => {
    setError('');
    setInfo('');
    try {
      const res = await api('/auth/send-otp/', { method: 'POST', body: { email } });
      setSeconds(res.resend_in || 30);
      setInfo('A new OTP has been sent.');
    } catch (e) {
      setError(e.message);
    }
  };

  const onChange = (t) => {
    const digits = t.replace(/\D/g, '').slice(0, LENGTH);
    setCode(digits);
    setError('');
    if (digits.length === LENGTH) verify(digits);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + 12 }]}>
      <Pressable onPress={() => navigation.goBack()} hitSlop={10} style={styles.back}>
        <Ionicons name="arrow-back" size={24} color={colors.text} />
      </Pressable>

      <View style={styles.iconCircle}>
        <Ionicons name="mail-open-outline" size={34} color={colors.primary} />
      </View>
      <Text style={styles.title}>Verify your email</Text>
      <Text style={styles.sub}>
        Enter the 6-digit code sent to{'\n'}
        <Text style={{ fontWeight: '700', color: colors.text }}>{email}</Text>
      </Text>

      <Pressable style={styles.boxes} onPress={() => inputRef.current?.focus()}>
        {Array.from({ length: LENGTH }).map((_, i) => {
          const active = i === code.length;
          return (
            <View key={i} style={[styles.box, active && styles.boxActive, error && styles.boxError]}>
              <Text style={styles.boxText}>{code[i] || ''}</Text>
            </View>
          );
        })}
        <TextInput
          ref={inputRef}
          value={code}
          onChangeText={onChange}
          keyboardType="number-pad"
          maxLength={LENGTH}
          autoFocus
          autoComplete="one-time-code"
          textContentType="oneTimeCode"
          style={styles.hiddenInput}
          caretHidden
        />
      </Pressable>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {info ? <Text style={styles.info}>{info}</Text> : null}

      <Button
        title="Verify & Continue"
        onPress={() => verify()}
        loading={loading}
        disabled={code.length !== LENGTH}
        style={{ marginTop: 24, alignSelf: 'stretch' }}
      />

      <View style={styles.resendRow}>
        <Text style={styles.muted}>Didn't get the code? </Text>
        {seconds > 0 ? (
          <Text style={styles.muted}>Resend in {seconds}s</Text>
        ) : (
          <Pressable onPress={resend} hitSlop={8}>
            <Text style={styles.link}>Resend OTP</Text>
          </Pressable>
        )}
      </View>

      {__DEV__ && (
        <View style={styles.devTip}>
          <Ionicons name="information-circle-outline" size={16} color="#7a5a2a" />
          <Text style={styles.devTipText}>
            Practice tip: if Gmail SMTP is not set in backend/.env, the OTP is printed in the Django terminal and
            visible in Admin → Email OTPs.
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', paddingHorizontal: 24, alignItems: 'center' },
  back: { alignSelf: 'flex-start', padding: 4 },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
  title: { fontSize: 22, fontWeight: '800', color: colors.text, marginTop: 16 },
  sub: { fontSize: 14, color: colors.muted, textAlign: 'center', marginTop: 8, lineHeight: 21 },
  boxes: { flexDirection: 'row', gap: 8, marginTop: 28 },
  box: {
    width: 46,
    height: 54,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FCFAF8',
  },
  boxActive: { borderColor: colors.primary, borderWidth: 2 },
  boxError: { borderColor: colors.danger },
  boxText: { fontSize: 22, fontWeight: '800', color: colors.text },
  hiddenInput: {
    fontFamily: 'Poppins_400Regular', position: 'absolute', width: '100%', height: '100%', opacity: 0, color: 'transparent' },
  error: { color: colors.danger, marginTop: 12, fontSize: 13, textAlign: 'center' },
  info: { color: colors.green, marginTop: 12, fontSize: 13 },
  resendRow: { flexDirection: 'row', marginTop: 18, alignItems: 'center' },
  muted: { color: colors.muted, fontSize: 14 },
  link: { color: colors.primary, fontWeight: '700', fontSize: 14 },
  devTip: {
    flexDirection: 'row',
    gap: 6,
    backgroundColor: colors.accentSoft,
    padding: 10,
    borderRadius: 10,
    marginTop: 'auto',
    marginBottom: 20,
  },
  devTipText: { flex: 1, color: '#7a5a2a', fontSize: 12, lineHeight: 17 },
});
