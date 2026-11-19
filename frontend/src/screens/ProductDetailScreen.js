import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Animated, FlatList, Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Sparkle, usePop } from '../components/Animations';
import Text from '../components/Text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '../api';
import { Button, ErrorView, Loader, TopBar } from '../components/common';
import ProductCard, { PriceRow, Rating } from '../components/ProductCard';
import { useApp } from '../context/AppContext';
import { colors, formatPrice, notify } from '../theme';

export default function ProductDetailScreen({ route, navigation }) {
  const { id } = route.params;
  const insets = useSafeAreaInsets();
  const { updateCart, cart } = useApp();
  const [product, setProduct] = useState(null);
  const [error, setError] = useState('');
  const [imgWidth, setImgWidth] = useState(0);
  const [imgIndex, setImgIndex] = useState(0);
  const [busy, setBusy] = useState('');
  const heartPop = usePop(product?.in_wishlist); // heart bounces when toggled

  const load = async () => {
    try {
      setError('');
      setProduct(await api(`/products/${id}/`));
    } catch (e) {
      setError(e.message);
    }
  };

  useEffect(() => {
    setProduct(null);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (error && !product) {
    return (
      <View style={styles.container}>
        <TopBar back title="Product" />
        <ErrorView message={error} onRetry={load} />
      </View>
    );
  }
  if (!product) {
    return (
      <View style={styles.container}>
        <TopBar back title="Product" />
        <Loader />
      </View>
    );
  }

  const images = [product.image, ...(product.gallery || []).map((g) => g.image)];
  const inCart = cart.items.some((i) => i.product.id === product.id);
  const outOfStock = product.stock === 0;

  const toggleWishlist = async () => {
    try {
      const res = await api('/wishlist/', { method: 'POST', body: { product_id: product.id } });
      setProduct((p) => ({ ...p, in_wishlist: res.in_wishlist }));
    } catch (e) {
      notify('Wishlist', e.message);
    }
  };

  const addToCart = async (buyNow) => {
    if (inCart && !buyNow) {
      navigation.navigate('Main', { screen: 'Cart' });
      return;
    }
    setBusy(buyNow ? 'buy' : 'cart');
    try {
      if (!inCart) await updateCart(product.id, 1, 'add');
      if (buyNow) navigation.navigate('Checkout');
    } catch (e) {
      notify('Cart', e.message);
    } finally {
      setBusy('');
    }
  };

  return (
    <View style={styles.container}>
      <TopBar back title="" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
        <View style={styles.gallery} onLayout={(e) => setImgWidth(e.nativeEvent.layout.width)}>
          {imgWidth > 0 && (
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={(e) => setImgIndex(Math.round(e.nativeEvent.contentOffset.x / imgWidth))}
            >
              {images.map((uri, i) => (
                <Image key={i} source={{ uri }} style={{ width: imgWidth, height: imgWidth }} resizeMode="cover" />
              ))}
            </ScrollView>
          )}
          <Pressable style={styles.heart} onPress={toggleWishlist} hitSlop={8}>
            <Animated.View style={heartPop}>
              <Ionicons
                name={product.in_wishlist ? 'heart' : 'heart-outline'}
                size={24}
                color={product.in_wishlist ? colors.primary : colors.muted}
              />
            </Animated.View>
            {product.in_wishlist && (
              <>
                <Sparkle size={11} duration={1200} style={{ position: 'absolute', top: -4, right: -2 }} />
                <Sparkle size={8} delay={500} duration={1200} style={{ position: 'absolute', bottom: -2, left: -3 }} />
              </>
            )}
          </Pressable>
          {images.length > 1 && (
            <View style={styles.dots}>
              {images.map((_, i) => (
                <View key={i} style={[styles.dot, i === imgIndex && styles.dotActive]} />
              ))}
            </View>
          )}
        </View>

        <View style={styles.card}>
          {product.brand ? <Text style={styles.brand}>{product.brand.toUpperCase()}</Text> : null}
          <Text display style={styles.name}>{product.name}</Text>
          <View style={{ marginTop: 8 }}>
            <Rating value={product.rating} count={`${product.rating_count} ratings`} />
          </View>
          <View style={{ marginTop: 10 }}>
            <PriceRow price={product.price} mrp={product.mrp} discount={product.discount_percent} big />
          </View>
          {Number(product.mrp) > Number(product.price) && (
            <Text style={styles.save}>You save {formatPrice(product.mrp - product.price)}</Text>
          )}
          <Text style={[styles.stock, { color: outOfStock ? colors.danger : product.stock <= 5 ? '#E65100' : colors.green }]}>
            {outOfStock ? 'Out of stock' : product.stock <= 5 ? `Hurry, only ${product.stock} left!` : 'In stock'}
          </Text>
        </View>

        <View style={styles.card}>
          {[
            ['rocket-outline', 'Free delivery in 3-5 days'],
            ['refresh-outline', '7 days easy return'],
            ['card-outline', 'Cash on Delivery & Online payment (Cashfree)'],
          ].map(([icon, label]) => (
            <View key={label} style={styles.feature}>
              <Ionicons name={icon} size={18} color={colors.primary} />
              <Text style={styles.featureText}>{label}</Text>
            </View>
          ))}
        </View>

        {product.description ? (
          <View style={styles.card}>
            <Text display style={styles.cardTitle}>Product Details</Text>
            <Text style={styles.desc}>{product.description}</Text>
          </View>
        ) : null}

        {product.similar?.length > 0 && (
          <View style={[styles.card, { paddingHorizontal: 0 }]}>
            <Text display style={[styles.cardTitle, { paddingHorizontal: 16 }]}>You may also like</Text>
            <FlatList
              horizontal
              data={product.similar}
              keyExtractor={(p) => String(p.id)}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 12, gap: 10, paddingBottom: 4 }}
              renderItem={({ item }) => (
                <ProductCard product={item} width={140} onPress={() => navigation.push('ProductDetail', { id: item.id })} />
              )}
            />
          </View>
        )}
      </ScrollView>

      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 10 }]}>
        <Button
          title={inCart ? 'Go to Cart' : 'Add to Cart'}
          icon="cart-outline"
          variant="outline"
          onPress={() => addToCart(false)}
          loading={busy === 'cart'}
          disabled={outOfStock}
          style={{ flex: 1 }}
        />
        <Button
          title="Buy Now"
          icon="flash"
          variant="accent"
          onPress={() => addToCart(true)}
          loading={busy === 'buy'}
          disabled={outOfStock}
          style={{ flex: 1 }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  gallery: { backgroundColor: '#fff' },
  heart: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: '#fff',
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 1px 4px rgba(0,0,0,0.15)',
    elevation: 3,
  },
  dots: { position: 'absolute', bottom: 10, alignSelf: 'center', flexDirection: 'row', gap: 5 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.7)' },
  dotActive: { backgroundColor: colors.primary, width: 16 },
  card: { backgroundColor: '#fff', marginTop: 10, padding: 16 },
  brand: { color: colors.accent, fontWeight: '600', fontSize: 11, letterSpacing: 1.5 },
  name: { fontSize: 23, color: colors.ink, marginTop: 4, lineHeight: 30 },
  save: { color: colors.green, fontWeight: '700', marginTop: 6, fontSize: 13 },
  stock: { marginTop: 6, fontWeight: '700', fontSize: 13 },
  feature: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  featureText: { fontSize: 13, color: colors.text },
  cardTitle: { fontSize: 18, color: colors.ink, marginBottom: 10 },
  desc: { fontSize: 14, color: '#444', lineHeight: 21 },
  bottomBar: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 12,
    paddingTop: 10,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
});
