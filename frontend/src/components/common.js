import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { ActivityIndicator, Animated, Pressable, StyleSheet, View } from 'react-native';
import { Float, Sparkle, usePop } from './Animations';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../context/AppContext';
import { colors } from '../theme';
import Logo from './Logo';
import Text from './Text';

/** Maroon header. `search` shows a search box; `back` shows a back arrow; no title = brand logo. */
export function TopBar({ title, back, search, showCart = true }) {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { cart, deliveryAddress } = useApp();
  const badgePop = usePop(cart.count); // badge bounces whenever the cart count changes

  return (
    <View style={[styles.bar, { paddingTop: insets.top + 10 }]}>
      <View style={styles.row}>
        {back && (
          <Pressable hitSlop={10} onPress={() => navigation.goBack()} style={styles.roundBtn}>
            <Ionicons name="chevron-back" size={20} color="#fff" />
          </Pressable>
        )}
        {title ? (
          <Text display style={styles.title} numberOfLines={1}>
            {title}
          </Text>
        ) : (
          <View style={{ flex: 1, marginLeft: back ? 10 : 0 }}>
            <Logo size={20} tagline={search ? 'Vanakkam! Shop the best brands' : undefined} />
          </View>
        )}
        {showCart && (
          <Pressable hitSlop={10} onPress={() => navigation.navigate('Main', { screen: 'Cart' })} style={styles.roundBtn}>
            <Ionicons name="bag-handle-outline" size={20} color="#fff" />
            {cart.count > 0 && (
              <Animated.View style={[styles.badge, badgePop]}>
                <Text style={styles.badgeText}>{cart.count > 99 ? '99+' : cart.count}</Text>
              </Animated.View>
            )}
          </Pressable>
        )}
      </View>
      {search && (
        <>
          <Pressable style={styles.search} onPress={() => navigation.navigate('ProductList', { search: '' })}>
            <Ionicons name="search-outline" size={18} color={colors.muted} />
            <Text style={styles.searchText}>Search mobiles, fashion, beauty…</Text>
          </Pressable>
          <Pressable style={styles.deliver} onPress={() => navigation.navigate('Addresses')} hitSlop={6}>
            <Ionicons name="location" size={15} color={colors.accent} />
            <Text style={styles.deliverText} numberOfLines={1}>
              {deliveryAddress ? (
                <>
                  Deliver to <Text style={styles.deliverStrong}>{deliveryAddress.full_name.split(' ')[0]}</Text>
                  {` · ${deliveryAddress.city} ${deliveryAddress.pincode}`}
                </>
              ) : (
                <Text style={styles.deliverStrong}>Select delivery location</Text>
              )}
            </Text>
            <Ionicons name="chevron-down" size={14} color="#fff" />
          </Pressable>
        </>
      )}
    </View>
  );
}

export function Loader() {
  return (
    <View style={styles.center}>
      <ActivityIndicator size="large" color={colors.primary} />
    </View>
  );
}

export function ErrorView({ message, onRetry }) {
  return (
    <View style={styles.center}>
      <Ionicons name="cloud-offline-outline" size={46} color={colors.muted} />
      <Text style={styles.errorText}>{message}</Text>
      {onRetry && <Button title="Try again" onPress={onRetry} style={{ marginTop: 16, alignSelf: 'center' }} />}
    </View>
  );
}

export function EmptyView({ icon, title, subtitle, action, onAction }) {
  return (
    <View style={styles.center}>
      <Float>
        <View style={styles.emptyIcon}>
          <Ionicons name={icon} size={38} color={colors.accent} />
          <Sparkle size={14} style={{ position: 'absolute', top: 6, right: 4 }} />
          <Sparkle size={9} delay={800} style={{ position: 'absolute', bottom: 12, left: 6 }} />
        </View>
      </Float>
      <Text display style={styles.emptyTitle}>
        {title}
      </Text>
      {subtitle ? <Text style={styles.emptySub}>{subtitle}</Text> : null}
      {action && <Button title={action} onPress={onAction} style={{ marginTop: 20, alignSelf: 'center' }} />}
    </View>
  );
}

/** variant: 'primary' (maroon), 'accent' (marigold - main call to action), 'outline' (maroon border) */
export function Button({ title, onPress, loading, disabled, variant = 'primary', style, icon }) {
  const isOutline = variant === 'outline';
  const bg = variant === 'accent' ? colors.accent : isOutline ? '#fff' : colors.primary;
  const fg = variant === 'accent' ? colors.accentInk : isOutline ? colors.primary : '#fff';
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.btn,
        { backgroundColor: bg, borderColor: isOutline ? colors.primary : bg, borderWidth: isOutline ? 1.5 : 0 },
        (disabled || loading) && { opacity: 0.45 },
        pressed && { opacity: 0.85, transform: [{ scale: 0.99 }] },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <View style={styles.row}>
          {icon && <Ionicons name={icon} size={17} color={fg} style={{ marginRight: 7 }} />}
          <Text style={[styles.btnText, { color: fg }]}>{title}</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, color: '#fff', fontSize: 18, marginLeft: 12 },
  roundBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 6,
  },
  badge: {
    position: 'absolute',
    top: -3,
    right: -3,
    backgroundColor: colors.accent,
    borderRadius: 9,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: colors.primary,
  },
  badgeText: { color: colors.accentInk, fontSize: 9, fontWeight: '700' },
  search: {
    marginTop: 12,
    backgroundColor: '#fff',
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    height: 44,
    gap: 10,
  },
  searchText: { color: colors.muted, fontSize: 13.5 },
  deliver: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10, paddingHorizontal: 2 },
  deliverText: { flexShrink: 1, fontSize: 12.5, color: '#F5D9E1' },
  deliverStrong: { color: '#fff', fontWeight: '600' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 30 },
  errorText: { color: colors.muted, textAlign: 'center', marginTop: 10, fontSize: 14, lineHeight: 20 },
  emptyIcon: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: { fontSize: 21, color: colors.ink, marginTop: 16 },
  emptySub: { fontSize: 14, color: colors.muted, marginTop: 6, textAlign: 'center', lineHeight: 20 },
  btn: {
    height: 50,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 22,
  },
  btnText: { fontSize: 15, fontWeight: '600', letterSpacing: 0.2 },
});
