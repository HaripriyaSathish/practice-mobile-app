import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import { FlatList, Image, Pressable, RefreshControl, StyleSheet, TextInput, View } from 'react-native';
import { api } from '../../api';
import { EmptyView, ErrorView, Loader, TopBar } from '../../components/common';
import Text from '../../components/Text';
import { colors, fonts, formatPrice, shadow } from '../../theme';

export default function SellerProductsScreen({ navigation }) {
  const [items, setItems] = useState(null);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setError('');
      setItems(await api('/seller/products/'));
    } catch (e) {
      setError(e.message);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const q = search.trim().toLowerCase();
  const shown = (items || []).filter((p) => !q || p.name.toLowerCase().includes(q) || (p.brand || '').toLowerCase().includes(q));

  const header = <TopBar title="My Products" showCart={false} />;
  if (error && !items) return <View style={styles.container}>{header}<ErrorView message={error} onRetry={load} /></View>;
  if (!items) return <View style={styles.container}>{header}<Loader /></View>;

  return (
    <View style={styles.container}>
      {header}
      {items.length === 0 ? (
        <EmptyView icon="pricetags-outline" title="No products yet" subtitle="Add your first product with photos, price and stock."
          action="Add product" onAction={() => navigation.navigate('SellerProductForm')} />
      ) : (
        <FlatList
          data={shown}
          keyExtractor={(p) => String(p.id)}
          contentContainerStyle={{ padding: 12, paddingBottom: 96 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}
          ListHeaderComponent={
            <View style={styles.search}>
              <Ionicons name="search-outline" size={17} color={colors.muted} />
              <TextInput style={styles.searchInput} placeholder={`Search ${items.length} products`} placeholderTextColor="#aaa" value={search} onChangeText={setSearch} />
            </View>
          }
          ListEmptyComponent={<Text style={styles.none}>No product matches "{search}".</Text>}
          renderItem={({ item: p }) => (
            <Pressable style={({ pressed }) => [styles.row, shadow, pressed && { opacity: 0.85 }]} onPress={() => navigation.navigate('SellerProductForm', { id: p.id })}>
              <Image source={{ uri: p.image }} style={styles.img} />
              <View style={{ flex: 1 }}>
                <Text style={styles.name} numberOfLines={2}>{p.name}</Text>
                <Text style={styles.meta}>{p.category_name}{p.brand ? ` · ${p.brand}` : ''}</Text>
                <View style={styles.priceRow}>
                  <Text style={styles.price}>{formatPrice(p.price)}</Text>
                  {Number(p.mrp) > Number(p.price) && <Text style={styles.mrp}>{formatPrice(p.mrp)}</Text>}
                </View>
                <View style={styles.tags}>
                  <View style={[styles.tag, { backgroundColor: p.is_active ? '#E6F4EA' : '#EEE' }]}>
                    <Text style={[styles.tagText, { color: p.is_active ? colors.green : colors.muted }]}>{p.is_active ? 'Live' : 'Hidden'}</Text>
                  </View>
                  <View style={[styles.tag, { backgroundColor: p.stock === 0 ? '#FDECEC' : p.stock <= 5 ? colors.accentSoft : '#F1EEF8' }]}>
                    <Text style={[styles.tagText, { color: p.stock === 0 ? colors.danger : p.stock <= 5 ? '#8a5a00' : '#4A3F7A' }]}>
                      {p.stock === 0 ? 'Sold out' : `${p.stock} in stock`}
                    </Text>
                  </View>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.muted} />
            </Pressable>
          )}
        />
      )}
      {items.length > 0 && (
        <Pressable style={[styles.fab, shadow]} onPress={() => navigation.navigate('SellerProductForm')} accessibilityLabel="Add product">
          <Ionicons name="add" size={22} color={colors.accentInk} />
          <Text style={styles.fabText}>Add product</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchInput: { flex: 1, fontSize: 14, fontFamily: fonts.regular, color: colors.ink, height: '100%' },
  none: { textAlign: 'center', color: colors.muted, marginTop: 30 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', borderRadius: 14, padding: 10, marginBottom: 10 },
  img: { width: 76, height: 76, borderRadius: 10, backgroundColor: colors.surface },
  name: { fontSize: 14, fontWeight: '600', color: colors.ink },
  meta: { fontSize: 11.5, color: colors.muted, marginTop: 1 },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: 3 },
  price: { fontSize: 15, fontWeight: '700', color: colors.ink },
  mrp: { fontSize: 12, color: colors.muted, textDecorationLine: 'line-through' },
  tags: { flexDirection: 'row', gap: 6, marginTop: 6 },
  tag: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  tagText: { fontSize: 11, fontWeight: '600' },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.accent,
    borderRadius: 28,
    paddingHorizontal: 18,
    height: 50,
  },
  fabText: { color: colors.accentInk, fontWeight: '700', fontSize: 14.5 },
});
