import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';
import { colors, formatPrice, shadow } from '../theme';
import { FadeImage, ScalePressable } from './Animations';
import Text from './Text';

export function Rating({ value, count, small }) {
  return (
    <View style={styles.ratingRow}>
      <Ionicons name="star" size={small ? 11 : 13} color={colors.accent} />
      <Text style={[styles.ratingText, small && { fontSize: 11.5 }]}>{Number(value).toFixed(1)}</Text>
      {count ? <Text style={[styles.ratingCount, small && { fontSize: 11 }]}>({count})</Text> : null}
    </View>
  );
}

export function PriceRow({ price, mrp, discount, big }) {
  return (
    <View style={styles.priceRow}>
      <Text style={[styles.price, big && { fontSize: 24 }]}>{formatPrice(price)}</Text>
      {Number(mrp) > Number(price) && <Text style={[styles.mrp, big && { fontSize: 14 }]}>{formatPrice(mrp)}</Text>}
      {discount > 0 && <Text style={[styles.off, big && { fontSize: 14 }]}>{discount}% off</Text>}
    </View>
  );
}

/** Product tile. `width` for horizontal rows; omit it in grids (fills its column). */
export default function ProductCard({ product, onPress, width }) {
  return (
    <ScalePressable onPress={onPress} containerStyle={width ? null : styles.gridCard} style={[styles.card, width ? { width } : null]}>
      <View style={styles.imageWrap}>
        <FadeImage source={{ uri: product.image }} style={styles.image} resizeMode="cover" />
        {product.discount_percent > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>-{product.discount_percent}%</Text>
          </View>
        )}
        {product.condition && product.condition !== 'new' && (
          <View style={styles.usedBadge}>
            <Text style={styles.usedText}>{product.bought_on_vetri ? '♻ ' : ''}{product.condition_display}</Text>
          </View>
        )}
        {product.stock === 0 && (
          <View style={styles.soldOut}>
            <Text style={styles.soldOutText}>SOLD OUT</Text>
          </View>
        )}
      </View>
      <View style={styles.body}>
        {product.brand ? (
          <Text style={styles.brand} numberOfLines={1}>
            {product.brand.toUpperCase()}
          </Text>
        ) : null}
        <Text style={styles.name} numberOfLines={2}>
          {product.name}
        </Text>
        <PriceRow price={product.price} mrp={product.mrp} discount={product.discount_percent} />
        <Rating value={product.rating} count={product.rating_count} small />
      </View>
    </ScalePressable>
  );
}

const styles = StyleSheet.create({
  usedBadge: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    backgroundColor: 'rgba(46,107,58,0.92)',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  usedText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  card: { backgroundColor: colors.card, borderRadius: 16, overflow: 'hidden', ...shadow },
  gridCard: { flex: 1, margin: 6 },
  imageWrap: { aspectRatio: 0.9, backgroundColor: colors.surface },
  image: { width: '100%', height: '100%' },
  badge: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: colors.primary,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '600', letterSpacing: 0.3 },
  soldOut: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  soldOutText: { color: colors.ink, fontWeight: '700', letterSpacing: 2, fontSize: 11 },
  body: { paddingHorizontal: 11, paddingTop: 10, paddingBottom: 12, gap: 4 },
  brand: { fontSize: 9.5, color: colors.muted, fontWeight: '600', letterSpacing: 1.2 },
  name: { fontSize: 13, color: colors.ink, minHeight: 34, lineHeight: 17, fontWeight: '500' },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  ratingText: { color: colors.ink, fontSize: 12, fontWeight: '600' },
  ratingCount: { color: colors.muted, fontSize: 11.5 },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' },
  price: { color: colors.ink, fontWeight: '700', fontSize: 15 },
  mrp: { color: colors.muted, textDecorationLine: 'line-through', fontSize: 11.5 },
  off: { color: colors.green, fontWeight: '600', fontSize: 11.5 },
});
