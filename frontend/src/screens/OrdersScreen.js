import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import { useCallback, useEffect, useState } from 'react';
import { FlatList, Image, Platform, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import Text from '../components/Text';
import { api } from '../api';
import { FadeInUp, SparkleBurst } from '../components/Animations';
import { Button, EmptyView, ErrorView, Loader, TopBar } from '../components/common';
import TrackingCard from '../components/TrackingCard';
import { appReturnUrl, openPaymentPage } from '../payment';
import { colors, formatPrice, notify } from '../theme';

const CANCEL_REASONS = [
  'Ordered by mistake',
  'Found a better price elsewhere',
  'Delivery is taking too long',
  'Want to change address or items',
  'Other reason',
];

const STATUS_COLORS = {
  PLACED: '#6c757d',
  CONFIRMED: '#0288D1',
  SHIPPED: '#1565C0',
  DELIVERED: colors.green,
  CANCELLED: colors.danger,
};
const PAY_COLORS = { PAID: colors.green, COD: '#B7791F', PENDING: '#6c757d', FAILED: colors.danger };
const STEPS = ['PLACED', 'CONFIRMED', 'SHIPPED', 'DELIVERED'];

// one entry per parcel (a parcel can hold several items from the same seller)
function parcels(items) {
  const seen = new Map();
  items.forEach((it) => {
    if (it.tracking && !seen.has(it.tracking.id)) seen.set(it.tracking.id, { tracking: it.tracking, seller: it.seller_name });
  });
  return [...seen.values()];
}

function Progress({ status }) {
  if (status === 'CANCELLED') return null;
  const current = STEPS.indexOf(status);
  return (
    <View style={styles.progress}>
      {STEPS.map((s, i) => (
        <View key={s} style={styles.step}>
          <View style={[styles.stepDot, i <= current && { backgroundColor: colors.green }]}>
            {i <= current && <Ionicons name="checkmark" size={10} color="#fff" />}
          </View>
          {i < STEPS.length - 1 && <View style={[styles.stepLine, i < current && { backgroundColor: colors.green }]} />}
          <Text style={[styles.stepText, i <= current && { color: colors.text, fontWeight: '700' }]}>
            {s.charAt(0) + s.slice(1).toLowerCase()}
          </Text>
        </View>
      ))}
    </View>
  );
}

export default function OrdersScreen({ route, navigation }) {
  const [orders, setOrders] = useState(null);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(null);
  // gold sparkle celebration after placing an order / successful payment
  const [celebration, setCelebration] = useState(
    route.params?.celebrate
      ? { title: 'Order placed!', subtitle: `Order #${route.params.celebrate} is confirmed. Your invoice is on its way to your email.` }
      : null,
  );

  const load = useCallback(async () => {
    try {
      setError('');
      setOrders(await api('/orders/'));
    } catch (e) {
      setError(e.message);
    }
  }, []);

  // After returning from Cashfree, confirm the payment with the backend
  const verifyId = route.params?.verifyId;
  useEffect(() => {
    (async () => {
      if (verifyId) {
        try {
          const o = await api(`/orders/${verifyId}/verify-payment/`);
          if (o.payment_status === 'PAID') {
            setCelebration({ title: 'Payment successful', subtitle: `Order #${o.id} is confirmed. Your invoice is on its way to your email.` });
          }
          else notify('Payment not completed', `Order #${o.id} is unpaid. Tap "Pay now" to try again.`);
        } catch (e) {
          notify('Payment check failed', e.message);
        }
        navigation.setParams({ verifyId: undefined });
      }
      load();
    })();
  }, [verifyId, load, navigation]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const payNow = async (order) => {
    setBusy(`pay${order.id}`);
    try {
      const res = await api(`/orders/${order.id}/pay/`, { method: 'POST', body: { app_return: appReturnUrl() } });
      const result = await openPaymentPage(res.payment_url);
      if (result !== 'redirected') navigation.setParams({ verifyId: order.id });
    } catch (e) {
      notify('Payment', e.message);
    } finally {
      setBusy(null);
    }
  };

  const [cancelling, setCancelling] = useState(null); // order shown in the cancel sheet
  const [reason, setReason] = useState(CANCEL_REASONS[0]);

  const confirmCancel = async () => {
    const order = cancelling;
    setBusy(`cancel${order.id}`);
    try {
      const updated = await api(`/orders/${order.id}/cancel/`, { method: 'POST', body: { reason } });
      setCancelling(null);
      await load();
      const refundMsg =
        updated.refund_status === 'SUCCESS'
          ? `${formatPrice(updated.total_amount)} has been refunded (test mode).`
          : updated.refund_status === 'PENDING'
            ? `Refund of ${formatPrice(updated.total_amount)} initiated (test mode).`
            : updated.refund_status === 'FAILED'
              ? 'Automatic refund failed - the store will contact you.'
              : 'No payment was collected for this order.';
      notify('Order cancelled', `Order #${order.id} is cancelled. ${refundMsg} A confirmation email is on its way.`);
    } catch (e) {
      notify('Cancel', e.message);
    } finally {
      setBusy(null);
    }
  };

  const openInvoice = (order) => {
    if (Platform.OS === 'web') window.open(order.invoice_url, '_blank');
    else WebBrowser.openBrowserAsync(order.invoice_url);
  };

  return (
    <View style={styles.container}>
      <TopBar title="My Orders" back />
      {error && !orders ? <ErrorView message={error} onRetry={load} /> : null}
      {!orders && !error ? <Loader /> : null}
      {orders && (
        <FlatList
          data={orders}
          keyExtractor={(o) => String(o.id)}
          contentContainerStyle={{ paddingBottom: 20, flexGrow: 1 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />}
          ListEmptyComponent={
            <EmptyView icon="receipt-outline" title="No orders yet" subtitle="Your orders will appear here." action="Start shopping" onAction={() => navigation.navigate('Main', { screen: 'Home' })} />
          }
          renderItem={({ item: o, index }) => (
            <FadeInUp delay={Math.min(index, 6) * 80} style={styles.card}>
              <View style={styles.headRow}>
                <View>
                  <Text style={styles.orderNo}>Order #{o.id}</Text>
                  <Text style={styles.date}>{new Date(o.created_at).toLocaleString()}</Text>
                </View>
                <View style={[styles.badge, { backgroundColor: STATUS_COLORS[o.status] }]}>
                  <Text style={styles.badgeText}>{o.status_display}</Text>
                </View>
              </View>

              <Progress status={o.status} />

              {o.items.map((it) => (
                <View key={it.id} style={styles.itemRow}>
                  {it.image ? <Image source={{ uri: it.image }} style={styles.itemImg} /> : <View style={styles.itemImg} />}
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemName} numberOfLines={2}>
                      {it.product_name}
                    </Text>
                    <Text style={styles.itemMeta}>
                      Qty {it.quantity} × {formatPrice(it.price)}
                    </Text>
                    {it.seller_name ? (
                      <Text style={styles.itemMeta}>
                        Sold by {it.seller_name}
                        {it.status && it.status !== o.status ? ` · ${it.status_display}` : ''}
                        {it.price_type && it.price_type !== 'retail' ? ` · ${it.price_type_display}` : ''}
                      </Text>
                    ) : null}
                    {it.can_resell ? (
                      <Pressable onPress={() => navigation.navigate('Resell', { item: it })} style={styles.resell} hitSlop={6}>
                        <Ionicons name="leaf-outline" size={13} color="#2E6B3A" />
                        <Text style={styles.resellText}>Resell this</Text>
                      </Pressable>
                    ) : it.resold_qty > 0 ? (
                      <Text style={[styles.itemMeta, { color: '#2E6B3A' }]}>Listed for resale ({it.resold_qty})</Text>
                    ) : null}
                  </View>
                </View>
              ))}

              {parcels(o.items).map((pc, i, all) => (
                <TrackingCard key={pc.tracking.id} tracking={pc.tracking}
                  title={all.length > 1 ? `${pc.tracking.status_display} · from ${pc.seller}` : pc.tracking.status_display} />
              ))}

              <View style={styles.footRow}>
                <View>
                  <Text style={styles.total}>{formatPrice(o.total_amount)}</Text>
                  <Text style={[styles.payStatus, { color: PAY_COLORS[o.payment_status] }]}>
                    {o.payment_method_display} • {o.payment_status_display}
                  </Text>
                </View>
              </View>

              {o.status === 'CANCELLED' && (
                <View style={styles.cancelBox}>
                  <Ionicons name="information-circle-outline" size={18} color="#7a5a2a" />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cancelText}>
                      Cancelled{o.cancelled_at ? ` on ${new Date(o.cancelled_at).toLocaleDateString()}` : ''}
                      {o.cancel_reason ? ` • ${o.cancel_reason}` : ''}
                    </Text>
                    {o.refund_status ? (
                      <Text style={[styles.cancelText, { fontWeight: '800', color: o.refund_status === 'FAILED' ? colors.danger : colors.green }]}>
                        {o.refund_status_display}: {formatPrice(o.total_amount)}
                      </Text>
                    ) : null}
                  </View>
                </View>
              )}

              <View style={styles.actions}>
                <Button title="Invoice" icon="document-text-outline" variant="outline" onPress={() => openInvoice(o)} style={styles.actionBtn} />
                {o.payment_method === 'CASHFREE' && ['PENDING', 'FAILED'].includes(o.payment_status) && o.status !== 'CANCELLED' && (
                  <Button title="Pay now" icon="card-outline" variant="accent" loading={busy === `pay${o.id}`} onPress={() => payNow(o)} style={styles.actionBtn} />
                )}
                {['PLACED', 'CONFIRMED'].includes(o.status) && (
                  <Button
                    title="Cancel order"
                    icon="close-circle-outline"
                    variant="outline"
                    onPress={() => {
                      setReason(CANCEL_REASONS[0]);
                      setCancelling(o);
                    }}
                    style={styles.actionBtn}
                  />
                )}
              </View>
            </FadeInUp>
          )}
        />
      )}

      {/* Cancel sheet with reasons */}
      {!!cancelling && (
        <Pressable style={styles.overlay} onPress={() => setCancelling(null)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <Text style={styles.sheetTitle}>Cancel order #{cancelling?.id}?</Text>
            <Text style={styles.sheetSub}>
              {cancelling?.payment_status === 'PAID'
                ? `You paid ${formatPrice(cancelling?.total_amount)} online. It will be refunded automatically (test mode).`
                : 'No payment has been collected, so nothing will be charged.'}
            </Text>
            <Text style={styles.sheetLabel}>Why are you cancelling?</Text>
            {CANCEL_REASONS.map((r) => (
              <Pressable key={r} style={styles.reasonRow} onPress={() => setReason(r)}>
                <Ionicons
                  name={reason === r ? 'radio-button-on' : 'radio-button-off'}
                  size={20}
                  color={reason === r ? colors.primary : colors.muted}
                />
                <Text style={styles.reasonText}>{r}</Text>
              </Pressable>
            ))}
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
              <Button title="Keep order" variant="outline" onPress={() => setCancelling(null)} style={{ flex: 1 }} />
              <Button
                title="Cancel order"
                onPress={confirmCancel}
                loading={busy === `cancel${cancelling?.id}`}
                style={{ flex: 1, backgroundColor: colors.danger }}
              />
            </View>
          </Pressable>
        </Pressable>
      )}

      {celebration && (
        <SparkleBurst
          title={celebration.title}
          subtitle={celebration.subtitle}
          onDone={() => {
            setCelebration(null);
            navigation.setParams({ celebrate: undefined });
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  resell: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', backgroundColor: '#E6F4EA', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3, marginTop: 4 },
  resellText: { fontSize: 12, color: '#2E6B3A', fontWeight: '700' },
  container: { flex: 1, backgroundColor: colors.bg },
  card: { backgroundColor: '#fff', marginTop: 8, padding: 14 },
  headRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  orderNo: { fontFamily: 'display', fontSize: 17, color: colors.ink },
  date: { color: colors.muted, fontSize: 12, marginTop: 2 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  badgeText: { color: '#fff', fontWeight: '800', fontSize: 11 },
  progress: { flexDirection: 'row', marginVertical: 14 },
  step: { flex: 1, alignItems: 'center' },
  stepDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  stepLine: { position: 'absolute', top: 8, left: '50%', right: '-50%', height: 2, backgroundColor: colors.border },
  stepText: { fontSize: 10, color: colors.muted, marginTop: 4 },
  itemRow: { flexDirection: 'row', gap: 10, alignItems: 'center', paddingVertical: 6 },
  itemImg: { width: 50, height: 50, borderRadius: 8, backgroundColor: colors.accentSoft },
  itemName: { fontSize: 13, color: colors.text },
  itemMeta: { fontSize: 12, color: colors.muted, marginTop: 2 },
  footRow: { borderTopWidth: 1, borderTopColor: colors.border, marginTop: 8, paddingTop: 10 },
  total: { fontSize: 17, fontWeight: '900', color: colors.text },
  payStatus: { fontSize: 12, fontWeight: '700', marginTop: 2 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 12, flexWrap: 'wrap' },
  actionBtn: { height: 40, paddingHorizontal: 14, flexGrow: 1 },
  cancelBox: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: colors.accentSoft,
    borderRadius: 8,
    padding: 10,
    marginTop: 10,
  },
  cancelText: { fontSize: 12, color: '#5a4320', lineHeight: 18 },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
    zIndex: 10,
    elevation: 10,
  },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 28,
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
  },
  sheetTitle: { fontSize: 18, fontWeight: '800', color: colors.text },
  sheetSub: { fontSize: 13, color: colors.muted, marginTop: 6, lineHeight: 19 },
  sheetLabel: { fontSize: 13, fontWeight: '800', color: colors.text, marginTop: 16, marginBottom: 4 },
  reasonRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9 },
  reasonText: { fontSize: 14, color: colors.text },
});
