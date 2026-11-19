import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing, FlatList, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { api } from '../api';
import { FadeImage, FadeInUp, ScalePressable, Sparkle, SparkleField } from '../components/Animations';
import { ErrorView, Loader, TopBar } from '../components/common';
import ProductCard from '../components/ProductCard';
import Text from '../components/Text';
import { colors } from '../theme';

function BannerCarousel({ banners, onPress }) {
  const [width, setWidth] = useState(0);
  const [index, setIndex] = useState(0);
  const ref = useRef(null);
  const zoom = useRef(new Animated.Value(0)).current;

  // slow "Ken Burns" zoom on the banner photos
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(zoom, { toValue: 1, duration: 7000, easing: Easing.inOut(Easing.quad), useNativeDriver: Platform.OS !== 'web' }),
        Animated.timing(zoom, { toValue: 0, duration: 7000, easing: Easing.inOut(Easing.quad), useNativeDriver: Platform.OS !== 'web' }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [zoom]);
  const zoomStyle = { transform: [{ scale: zoom.interpolate({ inputRange: [0, 1], outputRange: [1, 1.09] }) }] };

  useEffect(() => {
    if (!width || banners.length < 2) return undefined;
    const t = setInterval(() => {
      setIndex((i) => {
        const next = (i + 1) % banners.length;
        ref.current?.scrollTo({ x: next * width, animated: true });
        return next;
      });
    }, 4500);
    return () => clearInterval(t);
  }, [width, banners.length]);

  return (
    <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)} style={styles.bannerWrap}>
      {width > 0 && (
        <ScrollView
          ref={ref}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
          scrollEventThrottle={16}
        >
          {banners.map((b) => (
            <Pressable key={b.id} onPress={() => onPress(b)} style={{ width, paddingHorizontal: 16 }}>
              <View style={styles.banner}>
                <Animated.Image source={{ uri: b.image }} style={[StyleSheet.absoluteFill, zoomStyle]} resizeMode="cover" />
                <LinearGradient
                  colors={['rgba(20,8,14,0)', 'rgba(20,8,14,0.35)', 'rgba(20,8,14,0.82)']}
                  locations={[0, 0.45, 1]}
                  style={styles.bannerShade}
                >
                  {b.tag ? (
                    <View style={styles.tagRow}>
                      <Sparkle size={11} duration={1300} />
                      <Text style={styles.bannerTag}>{b.tag}</Text>
                    </View>
                  ) : null}
                  <Text display style={styles.bannerTitle} numberOfLines={2}>
                    {b.title}
                  </Text>
                  {b.subtitle ? (
                    <Text style={styles.bannerSub} numberOfLines={1}>
                      {b.subtitle}
                    </Text>
                  ) : null}
                  <View style={styles.bannerBtn}>
                    <Text style={styles.bannerBtnText}>{b.button_text || 'Shop now'}</Text>
                    <Ionicons name="arrow-forward" size={13} color={colors.ink} />
                  </View>
                </LinearGradient>
              </View>
            </Pressable>
          ))}
        </ScrollView>
      )}
      <View style={styles.dots}>
        {banners.map((b, i) => (
          <View key={b.id} style={[styles.dot, i === index && styles.dotActive]} />
        ))}
      </View>
    </View>
  );
}

function SectionHeader({ title, subtitle, onSeeAll, light, sparkle }) {
  return (
    <View style={styles.sectionHeader}>
      <View style={{ flex: 1 }}>
        <View style={styles.tagRow}>
          <Text display style={[styles.sectionTitle, light && { color: '#fff' }]}>
            {title}
          </Text>
          {sparkle && <Sparkle size={15} duration={1500} />}
        </View>
        {subtitle ? <Text style={[styles.sectionSub, light && { color: colors.accent }]}>{subtitle}</Text> : null}
      </View>
      {onSeeAll && (
        <Pressable onPress={onSeeAll} hitSlop={8} style={styles.seeAll}>
          <Text style={[styles.seeAllText, light && { color: '#fff' }]}>View all</Text>
          <Ionicons name="arrow-forward" size={13} color={light ? '#fff' : colors.primary} />
        </Pressable>
      )}
    </View>
  );
}

function ProductRow({ products, navigation }) {
  return (
    <FlatList
      horizontal
      data={products}
      keyExtractor={(p) => String(p.id)}
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: 16, gap: 12, paddingBottom: 6 }}
      renderItem={({ item }) => (
        <ProductCard product={item} width={156} onPress={() => navigation.navigate('ProductDetail', { id: item.id })} />
      )}
    />
  );
}

export default function HomeScreen({ navigation }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setError('');
      setData(await api('/home/'));
    } catch (e) {
      setError(e.message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const openCategory = (cat) => navigation.navigate('ProductList', { categoryId: cat.id, title: cat.name });

  return (
    <View style={styles.container}>
      <TopBar search />
      {!data && !error && <Loader />}
      {error && !data ? <ErrorView message={error} onRetry={load} /> : null}
      {data && (
        <ScrollView
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />}
          contentContainerStyle={{ paddingBottom: 30 }}
        >
          {/* Categories */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.catRow} style={styles.catStrip}>
            {data.categories.map((c, i) => (
              <FadeInUp key={c.id} delay={i * 55} distance={10}>
                <ScalePressable style={styles.catItem} onPress={() => openCategory(c)} scaleTo={0.92}>
                  <View style={styles.catRing}>
                    <FadeImage source={{ uri: c.image }} style={styles.catImage} />
                  </View>
                  <Text style={styles.catName} numberOfLines={1}>
                    {c.name}
                  </Text>
                </ScalePressable>
              </FadeInUp>
            ))}
          </ScrollView>

          {data.banners.length > 0 && (
            <BannerCarousel
              banners={data.banners}
              onPress={(b) =>
                b.category
                  ? navigation.navigate('ProductList', {
                      categoryId: b.category,
                      title: data.categories.find((c) => c.id === b.category)?.name || 'Products',
                    })
                  : navigation.navigate('ProductList', { title: 'All Products' })
              }
            />
          )}

          {/* Trust strip */}
          <View style={styles.trust}>
            {[
              ['shield-checkmark-outline', 'Genuine products'],
              ['car-outline', 'Free delivery'],
              ['refresh-outline', 'Easy returns'],
            ].map(([icon, label], i) => (
              <View key={label} style={[styles.trustItem, i > 0 && styles.trustDivider]}>
                <Ionicons name={icon} size={17} color={colors.accent} />
                <Text style={styles.trustText}>{label}</Text>
              </View>
            ))}
          </View>

          {data.deals.length > 0 && (
            <FadeInUp delay={250}>
              <LinearGradient colors={[colors.primaryDark, colors.primary]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.dealsBox}>
                <SparkleField count={9} seed={5} minSize={7} maxSize={13} />
                <SectionHeader title="Deals of the Day" subtitle="Handpicked offers · refreshed daily" light sparkle />
                <ProductRow products={data.deals} navigation={navigation} />
              </LinearGradient>
            </FadeInUp>
          )}

          {data.sections.map((s, i) =>
            s.products.length ? (
              <FadeInUp key={s.id} delay={350 + i * 110} style={styles.section}>
                <SectionHeader
                  title={s.title}
                  subtitle={`${s.products.length} curated picks`}
                  onSeeAll={() =>
                    s.id === 'preloved'
                      ? navigation.navigate('ProductList', { condition: 'used', title: s.title })
                      : navigation.navigate('ProductList', {
                          categoryId: s.products[0].category,
                          title: s.products[0].category_name,
                        })
                  }
                />
                <ProductRow products={s.products} navigation={navigation} />
              </FadeInUp>
            ) : null,
          )}

          <View style={styles.footer}>
            <Text display style={styles.footerTitle}>
              Thoughtfully curated, delivered with care.
            </Text>
            <Text style={styles.footerSub}>VETRI SHOPPING HALL</Text>
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  catStrip: { backgroundColor: '#fff' },
  catRow: { paddingHorizontal: 10, paddingTop: 14, paddingBottom: 14, gap: 4 },
  catItem: { width: 74, alignItems: 'center' },
  catRing: {
    width: 62,
    height: 62,
    borderRadius: 31,
    padding: 2,
    borderWidth: 1,
    borderColor: colors.accent,
    backgroundColor: '#fff',
  },
  catImage: { width: '100%', height: '100%', borderRadius: 29, backgroundColor: colors.surface },
  catName: { fontSize: 11, marginTop: 7, color: colors.ink, fontWeight: '500' },
  bannerWrap: { marginTop: 16 },
  banner: { height: 200, borderRadius: 20, overflow: 'hidden', backgroundColor: colors.surface },
  bannerShade: { flex: 1, justifyContent: 'flex-end', padding: 18 },
  tagRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  bannerTag: { color: colors.accent, fontSize: 10, fontWeight: '600', letterSpacing: 2.2 },
  bannerTitle: { color: '#fff', fontSize: 23, lineHeight: 28, marginTop: 6, maxWidth: '88%' },
  bannerSub: { color: 'rgba(255,255,255,0.85)', fontSize: 12, marginTop: 4 },
  bannerBtn: {
    marginTop: 12,
    alignSelf: 'flex-start',
    backgroundColor: '#fff',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  bannerBtnText: { color: colors.ink, fontWeight: '600', fontSize: 12 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 10 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#DDD3CE' },
  dotActive: { width: 20, backgroundColor: colors.primary },
  trust: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 14,
    paddingVertical: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  trustItem: { flex: 1, alignItems: 'center', gap: 4 },
  trustDivider: { borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: colors.border },
  trustText: { fontSize: 10.5, color: colors.ink, fontWeight: '500' },
  dealsBox: { marginTop: 22, paddingBottom: 18 },
  section: { marginTop: 10, paddingBottom: 6 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 12,
  },
  sectionTitle: { fontSize: 20, color: colors.ink },
  sectionSub: { fontSize: 11.5, color: colors.muted, marginTop: 2 },
  seeAll: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingBottom: 2 },
  seeAllText: { color: colors.primary, fontWeight: '600', fontSize: 12.5 },
  footer: { alignItems: 'center', paddingTop: 30, paddingHorizontal: 30 },
  footerTitle: { fontSize: 17, color: colors.muted, textAlign: 'center', lineHeight: 24 },
  footerSub: { fontSize: 10, color: colors.accent, marginTop: 8, letterSpacing: 2.5, fontWeight: '600' },
});
