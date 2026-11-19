import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import { FlatList, Image, RefreshControl, StyleSheet, TextInput, View } from 'react-native';
import { api } from '../../api';
import { Button, EmptyView, ErrorView, Loader, TopBar } from '../../components/common';
import Text from '../../components/Text';
import { colors, fonts, formatPrice, notify, shadow } from '../../theme';
import { QuoteStatus } from '../b2b/QuotesScreen';

function QuoteCard({ q, onUpdated }) {
  const [price, setPrice] = useState(q.quoted_price ? String(Number(q.quoted_price)) : '');
  const [note, setNote] = useState(q.seller_note || '');
  const [busy, setBusy] = useState('');
  const open = q.status === 'REQUESTED' || q.status === 'QUOTED';

  const respond = async (decline) => {
    setBusy(decline ? 'decline' : 'send');
    try {
      const body = decline ? { decline: true, note } : { price, note };
      onUpdated(await api(`/seller/quotes/${q.id}/respond/`, { method: 'POST', body }));
      notify(decline ? 'Quote declined' : 'Offer sent', decline ? 'The buyer was told.' : 'The buyer was emailed your price.');
    } catch (e) {
      notify('Quote', e.message);
    } finally {
      setBusy('');
    }
  };

  const total = Number(price) > 0 ? Number(price) * q.quantity : 0;
  return (
    <View style={[styles.card, shadow]}>
      <View style={styles.head}>
        <Image source={{ uri: q.product.image }} style={styles.img} />
        <View style={{ flex: 1 }}>
          <Text style={styles.name} numberOfLines={2}>{q.product.name}</Text>
          <Text style={styles.meta}>Quote #{q.id} · {q.quantity} pieces · normal {formatPrice(q.product.price)}</Text>
        </View>
        <QuoteStatus q={q} />
      </View>
      <View style={styles.buyer}>
        <Text style={styles.buyerName}>{q.buyer_company || q.buyer_name}</Text>
        <Text style={styles.meta}>{q.buyer_name}{q.buyer_gstin ? ` · GSTIN ${q.buyer_gstin}` : ''}</Text>
        {q.note ? <Text style={styles.note}>"{q.note}"</Text> : null}
      </View>
      {open ? (
        <>
          <Text style={styles.label}>YOUR PRICE PER PIECE (₹)</Text>
          <TextInput style={styles.input} value={price} onChangeText={(t) => setPrice(t.replace(/[^\d.]/g, ''))}
            keyboardType="decimal-pad" placeholder={`Below ${Number(q.product.price)}`} placeholderTextColor="#aaa" />
          {total > 0 && <Text style={styles.total}>Total for {q.quantity} pieces: {formatPrice(total)}</Text>}
          <Text style={styles.label}>NOTE (OPTIONAL)</Text>
          <TextInput style={styles.input} value={note} onChangeText={setNote} placeholder="Delivery time, packing…" placeholderTextColor="#aaa" />
          <View style={styles.actions}>
            <Button title="Decline" variant="outline" onPress={() => respond(true)} loading={busy === 'decline'} style={{ flex: 1 }} />
            <Button title={q.status === 'QUOTED' ? 'Update offer' : 'Send offer'} variant="accent" onPress={() => respond(false)}
              loading={busy === 'send'} disabled={!(Number(price) > 0)} style={{ flex: 1.5 }} />
          </View>
        </>
      ) : q.quoted_price ? (
        <Text style={styles.total}>Offered {formatPrice(q.quoted_price)} / piece · {formatPrice(q.total)}</Text>
      ) : null}
    </View>
  );
}

/** Seller: bulk price requests from business buyers. */
export default function SellerQuotesScreen() {
  const [list, setList] = useState(null);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setError('');
      setList(await api('/seller/quotes/'));
    } catch (e) {
      setError(e.message);
    }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const header = <TopBar title="Quotes (B2B)" showCart={false} />;
  if (error && !list) return <View style={styles.container}>{header}<ErrorView message={error} onRetry={load} /></View>;
  if (!list) return <View style={styles.container}>{header}<Loader /></View>;
  return (
    <View style={styles.container}>
      {header}
      {list.length === 0 ? (
        <EmptyView icon="chatbox-ellipses-outline" title="No quote requests" subtitle="Turn on 'Sell wholesale' for a product. Business buyers can then ask you for bulk prices." />
      ) : (
        <FlatList
          data={list}
          keyExtractor={(q) => String(q.id)}
          contentContainerStyle={{ padding: 12, paddingBottom: 30 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}
          renderItem={({ item }) => <QuoteCard q={item} onUpdated={(u) => setList((l) => l.map((x) => (x.id === u.id ? u : x)))} />}
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
  buyer: { backgroundColor: '#FBF7F3', borderRadius: 10, padding: 10, marginTop: 10 },
  buyerName: { fontSize: 13.5, fontWeight: '700', color: colors.ink },
  note: { fontSize: 12.5, color: colors.ink, marginTop: 4, fontStyle: 'italic' },
  label: { fontSize: 10.5, color: colors.muted, fontWeight: '600', letterSpacing: 1.3, marginTop: 12, marginBottom: 6 },
  input: {
    fontFamily: fonts.regular,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 11,
    paddingHorizontal: 12,
    height: 44,
    fontSize: 15,
    color: colors.ink,
    backgroundColor: '#FCFAF8',
  },
  total: { fontSize: 13, color: colors.green, fontWeight: '600', marginTop: 8 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 12 },
});
