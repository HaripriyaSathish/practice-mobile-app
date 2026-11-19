import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { api } from '../../api';
import { Button, ErrorView, Loader, TopBar } from '../../components/common';
import Text from '../../components/Text';
import { useApp } from '../../context/AppContext';
import { colors, formatPrice, shadow } from '../../theme';

function Stat({ icon, label, value, tone = colors.primary, onPress }) {
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={({ pressed }) => [styles.stat, shadow, pressed && { opacity: 0.8 }]}>
      <View style={[styles.statIcon, { backgroundColor: `${tone}1A` }]}>
        <Ionicons name={icon} size={18} color={tone} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </Pressable>
  );
}

export default function SellerDashboardScreen({ navigation }) {
  const { user, setUser } = useApp();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setError('');
      const d = await api('/seller/dashboard/');
      setData(d);
      if (d.is_approved !== user?.is_approved) setUser({ ...user, is_approved: d.is_approved });
    } catch (e) {
      setError(e.message);
    }
  }, [user, setUser]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const refresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  if (error && !data) {
    return (
      <View style={styles.container}>
        <TopBar title="Seller Hub" showCart={false} />
        <ErrorView message={error} onRetry={load} />
      </View>
    );
  }
  if (!data) {
    return (
      <View style={styles.container}>
        <TopBar title="Seller Hub" showCart={false} />
        <Loader />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <TopBar title="Seller Hub" showCart={false} />
      <ScrollView contentContainerStyle={{ padding: 14, paddingBottom: 30 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}>
        <View style={styles.hello}>
          <View style={styles.shopIcon}>
            <Ionicons name="storefront" size={24} color={colors.accent} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.helloSmall}>Vanakkam, {user?.full_name?.split(' ')[0] || 'seller'}</Text>
            <Text display style={styles.shopName} numberOfLines={1}>
              {data.shop_name || 'My shop'}
            </Text>
          </View>
          <View style={[styles.badge, { backgroundColor: data.is_approved ? '#E6F4EA' : colors.accentSoft }]}>
            <Text style={[styles.badgeText, { color: data.is_approved ? colors.green : '#8a5a00' }]}>
              {data.is_approved ? 'Approved' : 'Pending'}
            </Text>
          </View>
        </View>

        {!data.is_approved ? (
          <View style={[styles.pending, shadow]}>
            <Ionicons name="hourglass-outline" size={34} color={colors.accent} />
            <Text display style={styles.pendingTitle}>
              Waiting for approval
            </Text>
            <Text style={styles.pendingText}>
              Thanks for joining Vetri! Our team checks every new shop. Once approved, you can add products and receive
              orders here. Pull down to refresh.
            </Text>
            <Button title="Complete shop profile" variant="outline" icon="create-outline" onPress={() => navigation.navigate('SellerAccount')} style={{ marginTop: 16, alignSelf: 'stretch' }} />
          </View>
        ) : (
          <>
            <View style={[styles.revenue, shadow]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.revLabel}>Delivered sales</Text>
                <Text display style={styles.revValue}>
                  {formatPrice(data.revenue)}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.revLabel}>In progress</Text>
                <Text display style={[styles.revValue, { color: colors.accent }]}>
                  {formatPrice(data.pending_value)}
                </Text>
              </View>
            </View>

            <Text style={styles.section}>ORDERS</Text>
            <View style={styles.grid}>
              <Stat icon="sparkles-outline" label="New" value={data.orders.new} tone={colors.danger} onPress={() => navigation.navigate('SellerOrders', { status: 'PLACED' })} />
              <Stat icon="cube-outline" label="To ship" value={data.orders.to_ship} tone="#E07B00" onPress={() => navigation.navigate('SellerOrders', { status: 'CONFIRMED' })} />
              <Stat icon="car-outline" label="Shipped" value={data.orders.shipped} tone="#1565C0" onPress={() => navigation.navigate('SellerOrders', { status: 'SHIPPED' })} />
              <Stat icon="checkmark-done-outline" label="Delivered" value={data.orders.delivered} tone={colors.green} onPress={() => navigation.navigate('SellerOrders', { status: 'DELIVERED' })} />
            </View>

            <Text style={styles.section}>PRODUCTS</Text>
            <View style={styles.grid}>
              <Stat icon="pricetags-outline" label="Total" value={data.products.total} onPress={() => navigation.navigate('SellerProducts')} />
              <Stat icon="eye-outline" label="Live" value={data.products.active} tone={colors.green} onPress={() => navigation.navigate('SellerProducts')} />
              <Stat icon="alert-circle-outline" label="Low stock" value={data.products.low_stock} tone="#E07B00" onPress={() => navigation.navigate('SellerProducts')} />
              <Stat icon="close-circle-outline" label="Sold out" value={data.products.out_of_stock} tone={colors.danger} onPress={() => navigation.navigate('SellerProducts')} />
            </View>

            <Button title="Add a new product" variant="accent" icon="add-circle-outline" onPress={() => navigation.navigate('SellerProductForm')} style={{ marginTop: 18 }} />
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  hello: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  shopIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  helloSmall: { fontSize: 12.5, color: colors.muted },
  shopName: { fontSize: 20, color: colors.ink },
  badge: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { fontSize: 11.5, fontWeight: '700' },
  pending: { backgroundColor: '#fff', borderRadius: 16, padding: 22, alignItems: 'center' },
  pendingTitle: { fontSize: 19, color: colors.ink, marginTop: 10 },
  pendingText: { fontSize: 13.5, color: colors.muted, textAlign: 'center', marginTop: 6, lineHeight: 20 },
  revenue: { flexDirection: 'row', backgroundColor: '#fff', borderRadius: 16, padding: 16, gap: 10 },
  revLabel: { fontSize: 12, color: colors.muted },
  revValue: { fontSize: 21, color: colors.green, marginTop: 2 },
  section: { fontSize: 11, color: colors.muted, fontWeight: '600', letterSpacing: 1.4, marginTop: 20, marginBottom: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  stat: { backgroundColor: '#fff', borderRadius: 14, padding: 12, width: '47.5%', flexGrow: 1 },
  statIcon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  statValue: { fontSize: 22, fontWeight: '700', color: colors.ink, marginTop: 8 },
  statLabel: { fontSize: 12, color: colors.muted },
});
