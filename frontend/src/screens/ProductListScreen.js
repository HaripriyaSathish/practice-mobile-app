import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import Text from '../components/Text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '../api';
import { EmptyView, ErrorView, Loader, TopBar } from '../components/common';
import ProductCard from '../components/ProductCard';
import { colors } from '../theme';

const SORTS = [
  { key: '', label: 'Relevance' },
  { key: 'price_low', label: 'Price: Low to High' },
  { key: 'price_high', label: 'Price: High to Low' },
  { key: 'rating', label: 'Top Rated' },
];

/** Used for a category list, "view all" and search (when params.search is defined). */
export default function ProductListScreen({ route, navigation }) {
  const { categoryId, title } = route.params || {};
  const isSearch = route.params?.search !== undefined;
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState(route.params?.search || '');
  const [sort, setSort] = useState('');
  const [products, setProducts] = useState(null);
  const [error, setError] = useState('');
  const timer = useRef(null);

  const load = async (q = query, s = sort) => {
    const params = new URLSearchParams();
    if (categoryId) params.append('category', categoryId);
    if (q) params.append('search', q);
    if (s) params.append('sort', s);
    try {
      setError('');
      setProducts(await api(`/products/?${params.toString()}`));
    } catch (e) {
      setError(e.message);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sort]);

  const onSearch = (t) => {
    setQuery(t);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => load(t), 350); // search while typing (debounced)
  };

  return (
    <View style={styles.container}>
      {isSearch ? (
        <View style={[styles.searchBar, { paddingTop: insets.top + 10 }]}>
          <Pressable onPress={() => navigation.goBack()} hitSlop={10}>
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </Pressable>
          <View style={styles.searchBox}>
            <Ionicons name="search" size={18} color={colors.muted} />
            <TextInput
              autoFocus
              value={query}
              onChangeText={onSearch}
              placeholder="Search for products, brands..."
              placeholderTextColor="#9e9e9e"
              style={styles.searchInput}
              returnKeyType="search"
              onSubmitEditing={() => load()}
            />
            {query ? (
              <Pressable onPress={() => onSearch('')} hitSlop={8}>
                <Ionicons name="close-circle" size={18} color={colors.muted} />
              </Pressable>
            ) : null}
          </View>
        </View>
      ) : (
        <TopBar title={title || 'Products'} back />
      )}

      <View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sortRow}>
          {SORTS.map((s) => (
            <Pressable key={s.key} onPress={() => setSort(s.key)} style={[styles.chip, sort === s.key && styles.chipActive]}>
              <Text style={[styles.chipText, sort === s.key && { color: '#fff' }]}>{s.label}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {error && !products ? <ErrorView message={error} onRetry={() => load()} /> : null}
      {!products && !error ? <Loader /> : null}
      {products && (
        <FlatList
          data={products}
          numColumns={2}
          keyExtractor={(p) => String(p.id)}
          contentContainerStyle={{ padding: 5, paddingBottom: 24, flexGrow: 1 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={
            <Text style={styles.count}>
              {products.length} item{products.length === 1 ? '' : 's'}
              {query ? ` for "${query}"` : ''}
            </Text>
          }
          ListEmptyComponent={
            <EmptyView icon="search-outline" title="No products found" subtitle="Try a different word or category." />
          }
          renderItem={({ item }) => (
            <ProductCard product={item} onPress={() => navigation.navigate('ProductDetail', { id: item.id })} />
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  searchBar: {
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingBottom: 12,
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingHorizontal: 10,
    height: 42,
    gap: 6,
  },
  searchInput: {
    fontFamily: 'Poppins_400Regular', flex: 1, fontSize: 15, color: colors.text, height: '100%' },
  sortRow: { paddingHorizontal: 10, paddingVertical: 10, gap: 8, backgroundColor: '#fff' },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#fff',
  },
  chipActive: { backgroundColor: colors.ink, borderColor: colors.ink },
  chipText: { fontSize: 12, color: colors.text, fontWeight: '600' },
  count: { color: colors.muted, fontSize: 12, margin: 6 },
});
