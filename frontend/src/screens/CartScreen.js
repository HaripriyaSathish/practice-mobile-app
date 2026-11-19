import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Image, Pressable, StyleSheet, View } from 'react-native';
import Text from '../components/Text';
import { Button, EmptyView, TopBar } from '../components/common';
import { PriceRow } from '../components/ProductCard';
import { useApp } from '../context/AppContext';
import { colors, formatPrice, notify } from '../theme';

export function PriceDetails({ cart }) {
  return (
    <View style={styles.summary}>
      <Text style={styles.summaryTitle}>PRICE DETAILS</Text>
      <Row label={`Price (${cart.count} item${cart.count === 1 ? '' : 's'})`} value={formatPrice(cart.mrp_total)} />
      <Row label="Discount" value={`- ${formatPrice(cart.savings)}`} color={colors.green} />
      <Row label="Delivery Charges" value="FREE" color={colors.green} />
      <View style={styles.divider} />
      <Row label="Total Amount" value={formatPrice(cart.total)} bold />
      {Number(cart.savings) > 0 && (
        <Text style={styles.savings}>You will save {formatPrice(cart.savings)} on this order 🎉</Text>
      )}
    </View>
  );
}

function Row({ label, value, color, bold }) {
  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, bold && styles.bold]}>{label}</Text>
      <Text style={[styles.rowValue, color && { color }, bold && styles.bold]}>{value}</Text>
    </View>
  );
}

export default function CartScreen({ navigation }) {
  const { cart, refreshCart, updateCart } = useApp();
  const [busyId, setBusyId] = useState(null);

  useFocusEffect(
    useCallback(() => {
      refreshCart();
    }, [refreshCart]),
  );

  const change = async (item, qty) => {
    setBusyId(item.product.id);
    try {
      await updateCart(item.product.id, qty, 'set');
    } catch (e) {
      notify('Cart', e.message);
    } finally {
      setBusyId(null);
    }
  };

  if (!cart.items.length) {
    return (
      <View style={styles.container}>
        <TopBar title="My Cart" showCart={false} />
        <EmptyView
          icon="cart-outline"
          title="Your cart is empty"
          subtitle="Add sarees, gadgets or murukku - we'll keep them safe here!"
          action="Shop now"
          onAction={() => navigation.navigate('Home')}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <TopBar title={`My Cart (${cart.count})`} showCart={false} />
      <FlatList
        data={cart.items}
        keyExtractor={(i) => String(i.id)}
        contentContainerStyle={{ paddingBottom: 16 }}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <View style={styles.item}>
            <Pressable onPress={() => navigation.navigate('ProductDetail', { id: item.product.id })}>
              <Image source={{ uri: item.product.image }} style={styles.image} />
            </Pressable>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={styles.name} numberOfLines={2}>
                {item.product.name}
              </Text>
              {item.product.brand ? <Text style={styles.brand}>{item.product.brand}</Text> : null}
              {item.price_type && item.price_type !== 'retail' ? (
                <View>
                  <PriceRow price={item.unit_price} mrp={item.product.price} discount={0} />
                  <View style={styles.priceTag}>
                    <Text style={styles.priceTagText}>
                      {item.price_type === 'quote' ? `Quoted price · fixed ${item.quantity} pcs` : 'Wholesale price'}
                    </Text>
                  </View>
                </View>
              ) : (
                <PriceRow price={item.product.price} mrp={item.product.mrp} discount={item.product.discount_percent} />
              )}
              {item.product.condition && item.product.condition !== 'new' ? (
                <Text style={styles.brand}>Condition: {item.product.condition_display}</Text>
              ) : null}
              {item.moq_problem ? <Text style={styles.moq}>{item.moq_problem}</Text> : null}
              <View style={styles.qtyRow}>
                <View style={styles.qtyBox}>
                  <Pressable style={styles.qtyBtn} onPress={() => change(item, item.quantity - 1)} hitSlop={6}>
                    <Ionicons name={item.quantity === 1 ? 'trash-outline' : 'remove'} size={16} color={colors.primary} />
                  </Pressable>
                  <View style={styles.qtyValue}>
                    {busyId === item.product.id ? (
                      <ActivityIndicator size="small" color={colors.primary} />
                    ) : (
                      <Text style={styles.qtyText}>{item.quantity}</Text>
                    )}
                  </View>
                  <Pressable
                    style={styles.qtyBtn}
                    onPress={() => change(item, item.quantity + 1)}
                    disabled={item.quantity >= item.product.stock}
                    hitSlop={6}
                  >
                    <Ionicons name="add" size={16} color={item.quantity >= item.product.stock ? '#ccc' : colors.primary} />
                  </Pressable>
                </View>
                <Pressable onPress={() => change(item, 0)} hitSlop={6}>
                  <Text style={styles.remove}>REMOVE</Text>
                </Pressable>
              </View>
            </View>
          </View>
        )}
        ListFooterComponent={<PriceDetails cart={cart} />}
      />
      <View style={styles.bottomBar}>
        <View>
          <Text style={styles.total}>{formatPrice(cart.total)}</Text>
          <Text style={styles.totalSub}>Total amount</Text>
        </View>
        <Button title="Place Order" variant="accent" onPress={() => navigation.navigate('Checkout')} style={{ flex: 1, marginLeft: 16 }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  priceTag: { alignSelf: 'flex-start', backgroundColor: '#EEF5FD', borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2, marginTop: 3 },
  priceTagText: { fontSize: 11, color: '#1565C0', fontWeight: '600' },
  moq: { fontSize: 12, color: colors.danger, fontWeight: '600' },
  container: { flex: 1, backgroundColor: colors.bg },
  item: { flexDirection: 'row', gap: 12, backgroundColor: '#fff', padding: 12, marginTop: 8 },
  image: { width: 90, height: 90, borderRadius: 10, backgroundColor: colors.accentSoft },
  name: { fontSize: 14, color: colors.text, lineHeight: 19 },
  brand: { fontSize: 12, color: colors.muted },
  qtyRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 },
  qtyBox: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: colors.border, borderRadius: 8 },
  qtyBtn: { width: 34, height: 32, alignItems: 'center', justifyContent: 'center' },
  qtyValue: { minWidth: 34, alignItems: 'center' },
  qtyText: { fontSize: 15, fontWeight: '700' },
  remove: { color: colors.muted, fontWeight: '700', fontSize: 12 },
  summary: { backgroundColor: '#fff', padding: 14, marginTop: 8 },
  summaryTitle: { color: colors.muted, fontWeight: '600', fontSize: 11, marginBottom: 10, letterSpacing: 1.5 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5 },
  rowLabel: { fontSize: 14, color: colors.text },
  rowValue: { fontSize: 14, color: colors.text },
  bold: { fontWeight: '800', fontSize: 16 },
  divider: { borderTopWidth: 1, borderStyle: 'dashed', borderColor: colors.border, marginVertical: 6 },
  savings: { color: colors.green, fontWeight: '700', marginTop: 8, fontSize: 13 },
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  total: { fontSize: 18, fontWeight: '900', color: colors.text },
  totalSub: { fontSize: 11, color: colors.primary, fontWeight: '600' },
});
