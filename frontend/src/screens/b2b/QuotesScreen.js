import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import { FlatList, Image, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { api } from '../../api';
import { Button, EmptyView, ErrorView, Loader, TopBar } from '../../components/common';
import Text from '../../components/Text';
import { useApp } from '../../context/AppContext';
import { colors, confirmAction, formatPrice, notify, shadow } from '../../theme';

export const QUOTE_COLORS = {
  REQUESTED: '#E07B00', QUOTED: '#1565C0', ACCEPTED: colors.green, ORDERED: colors.green, DECLINED: colors.muted, REJECTED: colors.muted,
};

export function QuoteStatus({ q }) {
  const c = QUOTE_COLORS[q.status] || colors.muted;
  return (
    <View style={[styles.status, { backgroundColor: `${c}1A` }]}>
      <Text style={[styles.statusText, { color: c }]}>{q.status_display}</Text>
    </View>
  );
}

/** Business buyer: my quote requests, accept or reject offers. */
export default function QuotesScreen({ navigation }) {
  const { refreshCart } = useApp();
  const [list, setList] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setError('');
      setList(await api('/quotes/'));
    } catch (e) {
      setError(e.message);
    }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const act = (q, action) => {
    const run = async () => {
      setBusy(q.id);
      try {
        const updated = await api(`/quotes/${q.id}/${action}/`, { method: 'POST' });
        setList((l) => l.map((x) => (x.id === q.id ? updated : x)));
        if (action === 'accept') {
          await refreshCart();
          notify('Added to cart', `${q.quantity} pieces at ${formatPrice(q.quoted_price)} each.`);
          navigation.navigate('Main', { screen: 'Cart' });
        }
      } catch (e) {
        notify('Quote', e.message);
      } finally {
        setBusy(null);
      }
    };
    if (action === 'reject') confirmAction('Reject offer', 'Reject this quote?', run);
    else run();
  };

  const header = <TopBar title="My Quotes" back showCart />;
  if (error && !list) return <View style={styles.container}>{header}<ErrorView message={error} onRetry={load} /></View>;
  if (!list) return <View style={styles.container}>{header}<Loader /></View>;

  return (
    <View style={styles.container}>
      {header}
      {list.length === 0 ? (
        <EmptyView icon="chatbox-ellipses-outline" title="No quotes yet" subtitle="Open a wholesale product and tap 'Get a quote' to ask for a bulk price." />
      ) : (
        <FlatList
          data={list}
          keyExtractor={(q) => String(q.id)}
          contentContainerStyle={{ padding: 12, paddingBottom: 30 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}
          renderItem={({ item: q }) => (
            <View style={[styles.card, shadow]}>
              <Pressable style={styles.head} onPress={() => navigation.navigate('ProductDetail', { id: q.product.id })}>
                <Image source={{ uri: q.product.image }} style={styles.img} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.name} numberOfLines={2}>{q.product.name}</Text>
                  <Text style={styles.meta}>Quote #{q.id} · {q.quantity} pieces · {q.product.seller_name}</Text>
                </View>
                <QuoteStatus q={q} />
              </Pressable>
              {q.quoted_price ? (
                <View style={styles.offer}>
                  <Text style={styles.offerText}>
                    Offer: <Text style={styles.offerPrice}>{formatPrice(q.quoted_price)}</Text> / piece · Total {formatPrice(q.total)}
                  </Text>
                  <Text style={styles.meta}>
                    Normal price {formatPrice(q.product.price)}
                    {q.valid_until ? ` · valid till ${new Date(q.valid_until).toLocaleDateString('en-IN')}` : ''}
                  </Text>
                </View>
              ) : null}
              {q.seller_note ? <Text style={styles.note}>Seller: {q.seller_note}</Text> : null}
              {q.note ? <Text style={styles.note}>You: {q.note}</Text> : null}
              {q.status === 'QUOTED' && (
                <View style={styles.actions}>
                  <Button title="Reject" variant="outline" onPress={() => act(q, 'reject')} style={{ flex: 1 }} disabled={busy === q.id} />
                  <Button title="Accept & add to cart" variant="accent" onPress={() => act(q, 'accept')} loading={busy === q.id} style={{ flex: 1.6 }} />
                </View>
              )}
              {q.status === 'ACCEPTED' && (
                <Button title="Go to cart" icon="cart-outline" onPress={() => navigation.navigate('Main', { screen: 'Cart' })} style={{ marginTop: 10 }} />
              )}
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  card: { backgroundColor: '#fff', borderRadius: 14, padding: 12, marginBottom: 12 },
  head: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  img: { width: 54, height: 54, borderRadius: 8, backgroundColor: colors.surface },
  name: { fontSize: 14, fontWeight: '600', color: colors.ink },
  meta: { fontSize: 11.5, color: colors.muted, marginTop: 1 },
  status: { borderRadius: 12, paddingHorizontal: 8, paddingVertical: 3 },
  statusText: { fontSize: 11, fontWeight: '700' },
  offer: { backgroundColor: '#EEF5FD', borderRadius: 10, padding: 10, marginTop: 10 },
  offerText: { fontSize: 13.5, color: colors.ink },
  offerPrice: { fontWeight: '700', color: '#1565C0' },
  note: { fontSize: 12.5, color: colors.muted, marginTop: 8 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 12 },
});
