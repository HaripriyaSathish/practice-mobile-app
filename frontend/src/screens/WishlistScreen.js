import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { api } from '../api';
import { EmptyView, ErrorView, Loader, TopBar } from '../components/common';
import ProductCard from '../components/ProductCard';
import { colors } from '../theme';

export default function WishlistScreen({ navigation }) {
  const [items, setItems] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      setError('');
      setItems(await api('/wishlist/'));
    } catch (e) {
      setError(e.message);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  return (
    <View style={styles.container}>
      <TopBar title="My Wishlist" />
      {error && !items ? <ErrorView message={error} onRetry={load} /> : null}
      {!items && !error ? <Loader /> : null}
      {items && (
        <FlatList
          data={items}
          numColumns={2}
          keyExtractor={(p) => String(p.id)}
          contentContainerStyle={{ padding: 5, paddingBottom: 20, flexGrow: 1 }}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <EmptyView
              icon="heart-outline"
              title="Your wishlist is empty"
              subtitle="Tap the heart on any product to save it here."
              action="Explore products"
              onAction={() => navigation.navigate('Home')}
            />
          }
          renderItem={({ item }) => (
            <ProductCard product={item} onPress={() => navigation.navigate('ProductDetail', { id: item.id })} />
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({ container: { flex: 1, backgroundColor: colors.bg } });
