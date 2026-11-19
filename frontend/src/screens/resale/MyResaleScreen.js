import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import { FlatList, Image, RefreshControl, StyleSheet, Switch, View } from 'react-native';
import { api } from '../../api';
import { Button, EmptyView, ErrorView, Loader, TopBar } from '../../components/common';
import Text from '../../components/Text';
import { colors, confirmAction, formatPrice, notify, shadow } from '../../theme';

const REVIEW_COLOR = { approved: colors.green, pending: '#E07B00', rejected: colors.danger };

/** Buyer: things I am reselling, their review status, and a shortcut to the orders I must ship. */
export default function MyResaleScreen({ navigation }) {
  const [list, setList] = useState(null);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setError('');
      setList(await api('/resale/'));
    } catch (e) {
      setError(e.message);
    }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const patch = async (p, body) => {
    try {
      const u = await api(`/resale/${p.id}/`, { method: 'PATCH', body });
      setList((l) => l.map((x) => (x.id === p.id ? u : x)));
    } catch (e) {
      notify('Listing', e.message);
    }
  };
  const remove = (p) => confirmAction('Delete listing', `Remove "${p.name}" from resale?`, async () => {
    try {
      await api(`/resale/${p.id}/`, { method: 'DELETE' });
      setList((l) => l.filter((x) => x.id !== p.id));
    } catch (e) {
      notify('Listing', e.message);
    }
  });

  const header = <TopBar title="My Resale" back showCart={false} />;
  if (error && !list) return <View style={styles.container}>{header}<ErrorView message={error} onRetry={load} /></View>;
  if (!list) return <View style={styles.container}>{header}<Loader /></View>;

  return (
    <View style={styles.container}>
      {header}
      <View style={styles.banner}>
        <Text style={styles.bannerText}>Sold something? Ship it from Resale orders.</Text>
        <Button title="Resale orders" icon="cube-outline" onPress={() => navigation.navigate('ResaleOrders')} style={{ height: 38, paddingHorizontal: 12 }} />
      </View>
      {list.length === 0 ? (
        <EmptyView icon="leaf-outline" title="Nothing listed yet" subtitle="Open My Orders and tap 'Resell this' on a delivered item."
          action="Go to My Orders" onAction={() => navigation.navigate('Orders')} />
      ) : (
        <FlatList
          data={list}
          keyExtractor={(p) => String(p.id)}
          contentContainerStyle={{ padding: 12, paddingBottom: 30 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}
          renderItem={({ item: p }) => (
            <View style={[styles.card, shadow]}>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <Image source={{ uri: p.gallery?.[0]?.image || p.image }} style={styles.img} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.name} numberOfLines={2}>{p.name}</Text>
                  <Text style={styles.meta}>{p.condition_display} · {formatPrice(p.price)} · {p.stock} left · {p.sold} sold</Text>
                  <View style={[styles.status, { backgroundColor: `${REVIEW_COLOR[p.review_status]}1A` }]}>
                    <Text style={[styles.statusText, { color: REVIEW_COLOR[p.review_status] }]}>
                      {p.review_status === 'approved' ? (p.is_active ? 'Live in shop' : 'Hidden') : p.review_status_display}
                    </Text>
                  </View>
                </View>
              </View>
              {p.review_note ? <Text style={styles.note}>Admin: {p.review_note}</Text> : null}
              <View style={styles.row}>
                {p.review_status === 'approved' && (
                  <View style={styles.switchRow}>
                    <Text style={styles.meta}>Show in shop</Text>
                    <Switch value={p.is_active} onValueChange={(v) => patch(p, { is_active: v })} trackColor={{ true: colors.primary }} thumbColor="#fff" />
                  </View>
                )}
                {p.review_status === 'rejected' && (
                  <Button title="Send again" variant="outline" onPress={() => patch(p, { resubmit: true })} style={{ height: 38, flex: 1 }} />
                )}
                <Button title="Delete" variant="outline" icon="trash-outline" onPress={() => remove(p)} style={{ height: 38, paddingHorizontal: 12 }} />
              </View>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  banner: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#fff', padding: 12 },
  bannerText: { flex: 1, fontSize: 12.5, color: colors.muted },
  card: { backgroundColor: '#fff', borderRadius: 14, padding: 12, marginBottom: 12 },
  img: { width: 64, height: 64, borderRadius: 10, backgroundColor: colors.surface },
  name: { fontSize: 14, fontWeight: '600', color: colors.ink },
  meta: { fontSize: 12, color: colors.muted, marginTop: 1 },
  status: { alignSelf: 'flex-start', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2, marginTop: 5 },
  statusText: { fontSize: 11, fontWeight: '700' },
  note: { fontSize: 12.5, color: colors.danger, marginTop: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
  switchRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
});
