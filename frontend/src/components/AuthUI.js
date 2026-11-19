import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { colors, fonts } from '../theme';
import Text from './Text';

export const ROLES = [
  { key: 'buyer', label: 'Buyer', icon: 'bag-handle-outline', hint: 'Shop from every store' },
  { key: 'seller', label: 'Seller', icon: 'storefront-outline', hint: 'Sell your products' },
];

/** Buyer / Seller segmented switch used on login, sign-up and forgot-password. */
export function RoleTabs({ value, onChange }) {
  return (
    <View style={styles.tabs} accessibilityRole="tablist">
      {ROLES.map((r) => {
        const active = r.key === value;
        return (
          <Pressable
            key={r.key}
            onPress={() => onChange(r.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            style={[styles.tab, active && styles.tabActive]}
          >
            <Ionicons name={r.icon} size={18} color={active ? '#fff' : colors.primary} />
            <View>
              <Text style={[styles.tabLabel, active && { color: '#fff' }]}>{r.label}</Text>
              <Text style={[styles.tabHint, active && { color: 'rgba(255,255,255,0.8)' }]}>{r.hint}</Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Labelled input with an icon. `secure` adds a show / hide eye button. */
export function Field({ label, icon, secure, error, style, ...inputProps }) {
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(true);
  return (
    <View style={style}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.inputWrap, focused && styles.inputFocused, error && { borderColor: colors.danger }]}>
        <Ionicons name={icon} size={18} color={focused ? colors.primary : colors.muted} />
        <TextInput
          style={styles.input}
          placeholderTextColor="#B5ADB0"
          autoCapitalize="none"
          autoCorrect={false}
          secureTextEntry={secure && hidden}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          {...inputProps}
        />
        {secure && (
          <Pressable onPress={() => setHidden((h) => !h)} hitSlop={10} accessibilityLabel={hidden ? 'Show password' : 'Hide password'}>
            <Ionicons name={hidden ? 'eye-outline' : 'eye-off-outline'} size={19} color={colors.muted} />
          </Pressable>
        )}
      </View>
    </View>
  );
}

export function FormError({ message }) {
  if (!message) return null;
  return (
    <View style={styles.errorBox}>
      <Ionicons name="alert-circle" size={16} color={colors.danger} />
      <Text style={styles.errorText}>{message}</Text>
    </View>
  );
}

/** Simple password strength hint matching Django's validators (8+ chars, not all numbers). */
export function passwordProblem(pw) {
  if (pw.length < 8) return 'Use at least 8 characters.';
  if (/^\d+$/.test(pw)) return 'Password cannot be only numbers.';
  return '';
}

const styles = StyleSheet.create({
  tabs: { flexDirection: 'row', gap: 10 },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: '#FBF9F7',
  },
  tabActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  tabLabel: { fontSize: 14.5, fontWeight: '600', color: colors.ink },
  tabHint: { fontSize: 10.5, color: colors.muted, marginTop: -1 },
  label: { fontSize: 10.5, color: colors.muted, fontWeight: '600', letterSpacing: 1.4, marginBottom: 7 },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 13,
    paddingHorizontal: 13,
    height: 50,
    gap: 10,
    backgroundColor: '#FBF9F7',
  },
  inputFocused: { borderColor: colors.primary, backgroundColor: '#fff' },
  input: { flex: 1, fontSize: 15, color: colors.ink, height: '100%', fontFamily: fonts.regular },
  errorBox: {
    flexDirection: 'row',
    gap: 7,
    alignItems: 'flex-start',
    backgroundColor: '#FDECEC',
    borderRadius: 10,
    padding: 10,
    marginTop: 14,
  },
  errorText: { flex: 1, color: colors.danger, fontSize: 13, lineHeight: 18 },
});
