import { useCallback, useEffect, useState } from 'react';
import { FlatList, Image, Pressable, StyleSheet, View } from 'react-native';
import Text from '../components/Text';
import { api } from '../api';
import { ErrorView, Loader, TopBar } from '../components/common';
import ProductCard from '../components/ProductCard';
import { colors } from '../theme';

/** Flipkart-style: category list on the left, products of the selected category on the right. */
export default function CategoriesScreen({ navigation }) {
  const [categories, setCategories] = useState(null);
  const [selected, setSelected] = useState(null);
  const [products, setProducts] = useState(null);
  const [error, setError] = useState('');

  const loadCategories = useCallback(async () => {
    try {
      setError('');
      const cats = await api('/categories/');
      setCategories(cats);
      if (cats.length) setSelected((s) => s || cats[0]);
    } catch (e) {
      setError(e.message);
    }
  }, []);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  useEffect(() => {
    if (!selected) return;
    setProducts(null);
    api(`/products/?category=${selected.id}`)
      .then(setProducts)
      .catch((e) => setError(e.message));
  }, [selected]);

  return (
    <View style={styles.container}>
      <TopBar title="All Categories" search />
      {error && !categories ? <ErrorView message={error} onRetry={loadCategories} /> : null}
      {!categories && !error ? <Loader /> : null}
      {categories && (
        <View style={styles.body}>
          <FlatList
            style={styles.side}
            data={categories}
            keyExtractor={(c) => String(c.id)}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => {
              const active = selected?.id === item.id;
              return (
                <Pressable onPress={() => setSelected(item)} style={[styles.sideItem, active && styles.sideActive]}>
                  {active && <View style={styles.activeBar} />}
                  <Image source={{ uri: item.image }} style={styles.sideImg} />
                  <Text style={[styles.sideText, active && { color: colors.primary, fontWeight: '800' }]} numberOfLines={2}>
                    {item.name}
                  </Text>
                </Pressable>
              );
            }}
          />
          <View style={{ flex: 1 }}>
            {!products ? (
              <Loader />
            ) : (
              <FlatList
                data={products}
                key="grid"
                numColumns={2}
                keyExtractor={(p) => String(p.id)}
                contentContainerStyle={{ padding: 5, paddingBottom: 20 }}
                showsVerticalScrollIndicator={false}
                ListHeaderComponent={<Text style={styles.heading}>{selected?.name}</Text>}
                ListEmptyComponent={<Text style={styles.empty}>No products yet. Add some from the admin panel.</Text>}
                renderItem={({ item }) => (
                  <ProductCard product={item} onPress={() => navigation.navigate('ProductDetail', { id: item.id })} />
                )}
              />
            )}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  body: { flex: 1, flexDirection: 'row' },
  side: { width: 86, flexGrow: 0, backgroundColor: '#fff' },
  sideItem: { alignItems: 'center', paddingVertical: 12, paddingHorizontal: 4 },
  sideActive: { backgroundColor: colors.bg },
  activeBar: {
    position: 'absolute',
    left: 0,
    top: 10,
    bottom: 10,
    width: 4,
    borderTopRightRadius: 4,
    borderBottomRightRadius: 4,
    backgroundColor: colors.primary,
  },
  sideImg: { width: 46, height: 46, borderRadius: 23, backgroundColor: colors.accentSoft },
  sideText: { fontSize: 11, textAlign: 'center', marginTop: 5, color: colors.text },
  heading: { fontSize: 18, fontFamily: 'display', color: colors.ink, margin: 6 },
  empty: { color: colors.muted, textAlign: 'center', marginTop: 40, paddingHorizontal: 20 },
});
