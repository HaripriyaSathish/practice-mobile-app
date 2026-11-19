import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useState } from 'react';
import { FlatList, Image, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { api } from '../../api';
import { Button, EmptyView, ErrorView, Loader, TopBar } from '../../components/common';
import Text from '../../components/Text';
import { colors, confirmAction, formatPrice, notify, shadow } from '../../theme';

const FILTERS = [
  ['', 'All'],
  ['PLACED', 'New'],
  ['CONFIRMED', 'To ship'],
  ['SHIPPED', 'Shipped'],
  ['DELIVERED', 'Delivered'],
  ['CANCELLED', 'Cancelled'],
];
const NEXT = {
  PLACED: ['CONFIRMED', 'Confirm & pack', 'cube-outline'],
  CONFIRMED: ['SHIPPED', 'Mark as shipped', 'car-outline'],
  SHIPPED: ['DELIVERED', 'Mark as delivered', 'checkmark-done-outline'],
};
const STATUS_LABEL = { PLACED: 'New', CONFIRMED: 'Packed', SHIPPED: 'Shipped', DELIVERED: 'Delivered', CANCELLED: 'Cancelled' };
const STATUS_COLOR = { PLACED: colors.danger, CONFIRMED: '#E07B00', SHIPPED: '#1565C0', DELIVERED: colors.green, CANCELLED: colors.muted };

function slowest(items) {
  const flow = ['PLACED', 'CONFIRMED', 'SHIPPED', 'DELIVERED'];
  const open = items.map((i) => i.status).filter((s) => flow.includes(s));
  if (!open.length) return 'CANCELLED';
  return open.sort((a, b) => flow.indexOf(a) - flow.indexOf(b))[0];
}

function OrderCard({ order, onUpdated }) {
  const [busy, setBusy] = useState(false);
  const status = slowest(order.items);
  const next = NEXT[status];

  const advance = () =>
    confirmAction(next[1], `Order #${order.id}: mark your ${order.items.length} item(s) as ${next[0].toLowerCase()}? The buyer is emailed.`, async () => {
      setBusy(true);
      try {
        const updated = await api(`/seller/order-items/${order.items[0].id}/status/`, { method: 'POST', body: { status: next[0], order: true } });
        onUpdated(updated);
      } catch (e) {
        notify('Could not update', e.message);
      } finally {
        setBusy(false);
      }
    });

  return (
    <View style={[styles.card, shadow]}>
      <View style={styles.cardHead}>
        <View style={{ flex: 1 }}>
          <Text style={styles.orderNo}>Order #{order.id}</Text>
          <Text style={styles.date}>{new Date(order.created_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</Text>
        </View>
        <View style={[styles.status, { backgroundColor: `${STATUS_COLOR[status]}1A` }]}>
          <Text style={[styles.statusText, { color: STATUS_COLOR[status] }]}>{STATUS_LABEL[status]}</Text>
        </View>
      </View>

      {order.items.map((i) => (
        <View key={i.id} style={styles.item}>
          {i.image ? <Image source={{ uri: i.image }} style={styles.itemImg} /> : <View style={styles.itemImg} />}
          <View style={{ flex: 1 }}>
            <Text style={styles.itemName} numberOfLines={2}>{i.product_name}</Text>
            <Text style={styles.itemMeta}>
              {i.quantity} × {formatPrice(i.price)}
            </Text>
          </View>
        </View>
      ))}

      <View style={styles.shipTo}>
        <Ionicons name="location-outline" size={15} color={colors.primary} />
        <Text style={styles.shipText}>
          <Text style={{ fontWeight: '600', color: colors.ink }}>{order.buyer_name}</Text> · {order.phone}
          {'\n'}
          {order.address}
        </Text>
      </View>
      <View style={styles.footer}>
        <Text style={styles.pay}>
          {order.payment_method_display} · <Text style={{ color: order.payment_status === 'PAID' ? colors.green : '#8a5a00' }}>{order.payment_status_display}</Text>
        </Text>
        <Text style={styles.total}>{formatPrice(order.my_total)}</Text>
      </View>
      {next && <Button title={next[1]} icon={next[2]} variant={status === 'PLACED' ? 'accent' : 'primary'} onPress={advance} loading={busy} style={{ marginTop: 12 }} />}
    </View>
  );
}

export default function SellerOrdersScreen({ route }) {
  const [filter, setFilter] = useState(route.params?.status || '');
  const [orders, setOrders] = useState(null);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (route.params?.status !== undefined) setFilter(route.params.status);
  }, [route.params?.status]);

  const load = useCallback(async () => {
    try {
      setError('');
      setOrders(await api(`/seller/orders/${filter ? `?status=${filter}` : ''}`));
    } catch (e) {
      setError(e.message);
    }
  }, [filter]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const onUpdated = (updated) => {
    if (!updated) return load();
    setOrders((list) => list.map((o) => (o.id === updated.id ? updated : o)).filter((o) => !filter || o.items.some((i) => i.status === filter)));
    return null;
  };

  return (
    <View style={styles.container}>
      <TopBar title={route.params?.title || 'Orders'} back={!!route.params?.back} showCart={false} />
      <View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
          {FILTERS.map(([key, label]) => (
            <Pressable key={key || 'all'} onPress={() => { setOrders(null); setFilter(key); }} style={[styles.filter, filter === key && styles.filterActive]}>
              <Text style={[styles.filterText, filter === key && { color: '#fff' }]}>{label}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>
      {error && !orders ? (
        <ErrorView message={error} onRetry={load} />
      ) : !orders ? (
        <Loader />
      ) : orders.length === 0 ? (
        <EmptyView icon="receipt-outline" title="No orders here" subtitle={filter ? 'Try another filter.' : 'New orders for your products show up here.'} />
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(o) => String(o.id)}
          contentContainerStyle={{ padding: 12, paddingBottom: 30 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}
          renderItem={({ item }) => <OrderCard order={item} onUpdated={onUpdated} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  filters: { paddingHorizontal: 12, paddingVertical: 10, gap: 8 },
  filter: { borderRadius: 18, paddingHorizontal: 14, paddingVertical: 7, backgroundColor: '#fff', borderWidth: 1, borderColor: colors.border },
  filterActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  filterText: { fontSize: 12.5, color: colors.ink, fontWeight: '500' },
  card: { backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 12 },
  cardHead: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  orderNo: { fontSize: 15, fontWeight: '700', color: colors.ink },
  date: { fontSize: 11.5, color: colors.muted },
  status: { borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 },
  statusText: { fontSize: 11.5, fontWeight: '700' },
  item: { flexDirection: 'row', gap: 10, alignItems: 'center', marginTop: 8 },
  itemImg: { width: 48, height: 48, borderRadius: 8, backgroundColor: colors.surface },
  itemName: { fontSize: 13.5, color: colors.ink, fontWeight: '500' },
  itemMeta: { fontSize: 12, color: colors.muted },
  shipTo: { flexDirection: 'row', gap: 6, marginTop: 12, backgroundColor: '#FBF7F3', borderRadius: 10, padding: 10 },
  shipText: { flex: 1, fontSize: 12.5, color: colors.muted, lineHeight: 18 },
  footer: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
  pay: { flex: 1, fontSize: 12.5, color: colors.muted },
  total: { fontSize: 16, fontWeight: '700', color: colors.ink },
});
