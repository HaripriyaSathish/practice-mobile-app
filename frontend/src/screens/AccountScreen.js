import { Ionicons } from '@expo/vector-icons';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Text from '../components/Text';
import { TopBar } from '../components/common';
import { useApp } from '../context/AppContext';
import { colors, confirmAction } from '../theme';

function MenuItem({ icon, label, sub, onPress, danger }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.item, pressed && { backgroundColor: '#faf6f2' }]}>
      <View style={[styles.itemIcon, danger && { backgroundColor: '#FDECEC' }]}>
        <Ionicons name={icon} size={20} color={danger ? colors.danger : colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.itemLabel, danger && { color: colors.danger }]}>{label}</Text>
        {sub ? <Text style={styles.itemSub}>{sub}</Text> : null}
      </View>
      {!danger && <Ionicons name="chevron-forward" size={18} color={colors.muted} />}
    </Pressable>
  );
}

export default function AccountScreen({ navigation }) {
  const { user, logout } = useApp();
  const initial = (user?.full_name || user?.email || '?').charAt(0).toUpperCase();

  return (
    <View style={styles.container}>
      <TopBar title="My Account" />
      <ScrollView contentContainerStyle={{ paddingBottom: 30 }}>
        <View style={styles.profile}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initial}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{user?.full_name || 'Hello there!'}</Text>
            <Text style={styles.email}>{user?.email}</Text>
            {user?.phone ? <Text style={styles.email}>{user.phone}</Text> : null}
          </View>
          <Pressable onPress={() => navigation.navigate('Profile')} hitSlop={8}>
            <Text style={styles.edit}>Edit</Text>
          </Pressable>
        </View>

        <View style={styles.quick}>
          {[
            ['receipt-outline', 'Orders', () => navigation.navigate('Orders')],
            ['heart-outline', 'Wishlist', () => navigation.navigate('Wishlist')],
            ['cart-outline', 'Cart', () => navigation.navigate('Cart')],
            ['grid-outline', 'Categories', () => navigation.navigate('Categories')],
          ].map(([icon, label, onPress]) => (
            <Pressable key={label} style={styles.quickItem} onPress={onPress}>
              <Ionicons name={icon} size={22} color={colors.primary} />
              <Text style={styles.quickText}>{label}</Text>
            </Pressable>
          ))}
        </View>

        {user?.is_business ? (
          <View style={[styles.bizCard, { borderColor: user.is_approved_business ? colors.green : colors.accent }]}>
            <Ionicons name="business" size={22} color={user.is_approved_business ? colors.green : '#8a5a00'} />
            <View style={{ flex: 1 }}>
              <Text style={styles.itemLabel}>{user.company_name}</Text>
              <Text style={styles.itemSub}>
                GSTIN {user.gstin} · {user.is_approved_business ? 'Verified business - wholesale prices on' : 'Waiting for GSTIN check'}
              </Text>
            </View>
          </View>
        ) : null}

        <View style={styles.menu}>
          <MenuItem icon="receipt-outline" label="My Orders" sub="Track, cancel, invoices, resell delivered items" onPress={() => navigation.navigate('Orders')} />
          {user?.is_business && (
            <MenuItem icon="chatbox-ellipses-outline" label="My Quotes (B2B)" sub="Bulk price requests and offers" onPress={() => navigation.navigate('Quotes')} />
          )}
          {user?.is_approved_business && (
            <MenuItem icon="pricetags-outline" label="Wholesale products" sub="Products with business prices" onPress={() => navigation.navigate('ProductList', { wholesale: 1, title: 'Wholesale (B2B)' })} />
          )}
          <MenuItem icon="leaf-outline" label="My Resale" sub="Things you are reselling + orders to ship" onPress={() => navigation.navigate('MyResale')} />
          <MenuItem icon="sparkles-outline" label="Pre-loved items" sub="Shop used & resale products" onPress={() => navigation.navigate('ProductList', { condition: 'used', title: 'Pre-loved · Resale' })} />
          <MenuItem icon="person-outline" label="Edit Profile" sub="Name and phone number" onPress={() => navigation.navigate('Profile')} />
          <MenuItem icon="heart-outline" label="My Wishlist" sub="Your saved products" onPress={() => navigation.navigate('Wishlist')} />
        </View>

        <View style={styles.menu}>
          <MenuItem
            icon="log-out-outline"
            label="Logout"
            danger
            onPress={() => confirmAction('Logout', 'Do you want to logout from Vetri Shopping Hall?', logout)}
          />
        </View>

        <Text style={styles.footer}>Vetri Shopping Hall • Practice project • Made with ❤ in Tamil Nadu</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  profile: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: '#fff', padding: 16 },
  avatar: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 24, fontWeight: '900', color: colors.primary },
  name: { fontSize: 20, fontFamily: 'display', color: colors.ink },
  email: { fontSize: 13, color: colors.muted, marginTop: 2 },
  edit: { color: colors.primary, fontWeight: '800' },
  quick: { flexDirection: 'row', backgroundColor: '#fff', marginTop: 8, paddingVertical: 14 },
  quickItem: { flex: 1, alignItems: 'center', gap: 5 },
  quickText: { fontSize: 12, color: colors.text, fontWeight: '600' },
  menu: { backgroundColor: '#fff', marginTop: 8 },
  bizCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', marginTop: 8, padding: 14, borderLeftWidth: 4 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f3ede7',
  },
  itemIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemLabel: { fontSize: 15, fontWeight: '600', color: colors.text },
  itemSub: { fontSize: 12, color: colors.muted, marginTop: 1 },
  footer: { textAlign: 'center', color: colors.muted, fontSize: 12, marginTop: 24 },
});
