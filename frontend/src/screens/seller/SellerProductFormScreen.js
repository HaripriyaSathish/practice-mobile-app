import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Switch, TextInput, View } from 'react-native';
import { api, appendImage } from '../../api';
import { FormError } from '../../components/AuthUI';
import { Button, ErrorView, Loader, TopBar } from '../../components/common';
import Text from '../../components/Text';
import { colors, confirmAction, fonts, notify } from '../../theme';

const MAX_GALLERY = 8;

function Label({ children }) {
  return <Text style={styles.label}>{children}</Text>;
}

function Input({ style, ...props }) {
  return <TextInput placeholderTextColor="#aaa" style={[styles.input, style]} {...props} />;
}

/** Add (no id) or edit (route.params.id) one of my products, including its photos. */
export default function SellerProductFormScreen({ navigation, route }) {
  const id = route.params?.id;
  const [categories, setCategories] = useState([]);
  const [loaded, setLoaded] = useState(!id);
  const [loadError, setLoadError] = useState('');
  const [form, setForm] = useState({
    name: '', brand: '', description: '', price: '', mrp: '', stock: '10', category: null, is_active: true,
    condition: 'new', gst_rate: 18, hsn_code: '', is_wholesale: false, moq: '10',
  });
  const [tiers, setTiers] = useState([{ min_qty: '10', price: '' }]);
  const [mainImage, setMainImage] = useState(null); // { uri, asset? }
  const [gallery, setGallery] = useState([]); // existing: { id, uri }   new: { key, uri, asset }
  const [removeIds, setRemoveIds] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        setCategories(await api('/categories/'));
        if (id) {
          const p = await api(`/seller/products/${id}/`);
          setForm({
            name: p.name, brand: p.brand || '', description: p.description || '', price: String(Number(p.price)),
            mrp: String(Number(p.mrp)), stock: String(p.stock), category: p.category, is_active: p.is_active,
            condition: p.condition || 'new', gst_rate: p.gst_rate ?? 18, hsn_code: p.hsn_code || '',
            is_wholesale: !!p.is_wholesale, moq: String(p.moq || 10),
          });
          if (p.tiers?.length) setTiers(p.tiers.map((t) => ({ min_qty: String(t.min_qty), price: String(Number(t.price)) })));
          setMainImage({ uri: p.image });
          setGallery((p.gallery || []).map((g) => ({ id: g.id, uri: g.image })));
          setLoaded(true);
        }
      } catch (e) {
        setLoadError(e.message);
      }
    })();
  }, [id]);

  const set = (key) => (value) => {
    setError('');
    setForm((f) => ({ ...f, [key]: ['price', 'mrp'].includes(key) ? value.replace(/[^\d.]/g, '') : key === 'stock' ? value.replace(/\D/g, '') : value }));
  };

  const pickMain = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.8 });
    if (!res.canceled && res.assets?.[0]) setMainImage({ uri: res.assets[0].uri, asset: res.assets[0] });
  };

  const pickGallery = async () => {
    const room = MAX_GALLERY - gallery.length;
    if (room <= 0) {
      notify('Photos', `You can add up to ${MAX_GALLERY} extra photos.`);
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: true, selectionLimit: room, quality: 0.8 });
    if (!res.canceled && res.assets) {
      setGallery((g) => [...g, ...res.assets.slice(0, room).map((a, i) => ({ key: `${Date.now()}-${i}`, uri: a.uri, asset: a }))]);
    }
  };

  const removeGallery = (item) => {
    setGallery((g) => g.filter((x) => x !== item));
    if (item.id) setRemoveIds((r) => [...r, item.id]);
  };

  const problem =
    (form.name.trim().length < 3 && 'Enter the product name (3+ characters).') ||
    (!form.category && 'Choose a category.') ||
    (!(Number(form.price) > 0) && 'Enter the selling price.') ||
    (form.mrp && Number(form.mrp) < Number(form.price) && 'MRP cannot be lower than the selling price.') ||
    (form.stock === '' && 'Enter how many you have in stock.') ||
    (!mainImage && 'Add a main photo.');

  const save = async () => {
    if (problem) {
      setError(problem);
      return;
    }
    setSaving(true);
    setError('');
    try {
      const fd = new FormData();
      fd.append('name', form.name.trim());
      fd.append('brand', form.brand.trim());
      fd.append('description', form.description.trim());
      fd.append('price', form.price);
      fd.append('mrp', form.mrp || form.price);
      fd.append('stock', form.stock);
      fd.append('category', String(form.category));
      fd.append('is_active', form.is_active ? 'true' : 'false');
      fd.append('condition', form.condition);
      fd.append('gst_rate', String(form.gst_rate));
      fd.append('hsn_code', form.hsn_code.trim());
      fd.append('is_wholesale', form.is_wholesale ? 'true' : 'false');
      if (form.is_wholesale) {
        fd.append('moq', form.moq || '1');
        fd.append('tiers', JSON.stringify(tiers.filter((t) => t.min_qty && t.price).map((t) => ({ min_qty: Number(t.min_qty), price: Number(t.price) }))));
      }
      if (mainImage.asset) appendImage(fd, 'image', mainImage.asset);
      gallery.filter((g) => g.asset).forEach((g) => appendImage(fd, 'gallery', g.asset));
      if (removeIds.length) fd.append('remove_gallery', removeIds.join(','));
      await api(id ? `/seller/products/${id}/` : '/seller/products/', { method: id ? 'PATCH' : 'POST', form: fd });
      notify(id ? 'Product updated' : 'Product added', id ? 'Your changes are live.' : 'Buyers can now find it in the shop.');
      navigation.goBack();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const remove = () =>
    confirmAction('Delete product', `Delete "${form.name}"? Past orders keep their details.`, async () => {
      try {
        await api(`/seller/products/${id}/`, { method: 'DELETE' });
        navigation.goBack();
      } catch (e) {
        notify('Delete failed', e.message);
      }
    });

  const header = <TopBar title={id ? 'Edit product' : 'Add product'} back showCart={false} />;
  if (loadError) return <View style={styles.container}>{header}<ErrorView message={loadError} /></View>;
  if (!loaded) return <View style={styles.container}>{header}<Loader /></View>;

  const discount = Number(form.mrp) > Number(form.price) && Number(form.price) > 0
    ? Math.round(((Number(form.mrp) - Number(form.price)) * 100) / Number(form.mrp)) : 0;

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {header}
      <ScrollView contentContainerStyle={{ padding: 12, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <Label>MAIN PHOTO</Label>
          <Pressable onPress={pickMain} style={styles.mainPhoto} accessibilityLabel="Choose main photo">
            {mainImage ? (
              <Image source={{ uri: mainImage.uri }} style={styles.mainImg} />
            ) : (
              <View style={styles.photoEmpty}>
                <Ionicons name="camera-outline" size={30} color={colors.primary} />
                <Text style={styles.photoHint}>Tap to add a square photo</Text>
              </View>
            )}
            {mainImage && (
              <View style={styles.changeBadge}>
                <Ionicons name="swap-horizontal" size={13} color="#fff" />
                <Text style={styles.changeText}>Change</Text>
              </View>
            )}
          </Pressable>

          <Label>MORE PHOTOS ({gallery.length}/{MAX_GALLERY})</Label>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {gallery.map((g) => (
              <View key={g.id || g.key}>
                <Image source={{ uri: g.uri }} style={styles.thumb} />
                <Pressable onPress={() => removeGallery(g)} style={styles.thumbX} hitSlop={6} accessibilityLabel="Remove photo">
                  <Ionicons name="close" size={13} color="#fff" />
                </Pressable>
              </View>
            ))}
            {gallery.length < MAX_GALLERY && (
              <Pressable onPress={pickGallery} style={[styles.thumb, styles.addThumb]} accessibilityLabel="Add more photos">
                <Ionicons name="add" size={26} color={colors.primary} />
              </Pressable>
            )}
          </ScrollView>
        </View>

        <View style={styles.card}>
          <Label>PRODUCT NAME</Label>
          <Input value={form.name} onChangeText={set('name')} placeholder="e.g. Kanchipuram Silk Saree" />
          <Label>BRAND (OPTIONAL)</Label>
          <Input value={form.brand} onChangeText={set('brand')} placeholder="Brand name" />
          <Label>CATEGORY</Label>
          <View style={styles.chips}>
            {categories.map((c) => {
              const active = c.id === form.category;
              return (
                <Pressable key={c.id} onPress={() => set('category')(c.id)} style={[styles.chip, active && styles.chipActive]}>
                  <Text style={[styles.chipText, active && { color: '#fff' }]}>{c.name}</Text>
                </Pressable>
              );
            })}
          </View>
          <Label>DESCRIPTION</Label>
          <Input value={form.description} onChangeText={set('description')} placeholder="Material, size, care, what is in the box…"
            multiline style={{ height: 110, paddingTop: 10, textAlignVertical: 'top' }} />
        </View>

        <View style={styles.card}>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Label>SELLING PRICE (₹)</Label>
              <Input value={form.price} onChangeText={set('price')} keyboardType="decimal-pad" placeholder="0" />
            </View>
            <View style={{ flex: 1 }}>
              <Label>MRP (₹)</Label>
              <Input value={form.mrp} onChangeText={set('mrp')} keyboardType="decimal-pad" placeholder="Same as price" />
            </View>
          </View>
          {discount > 0 && <Text style={styles.discount}>Buyers will see {discount}% off</Text>}
          <Label>STOCK</Label>
          <Input value={form.stock} onChangeText={set('stock')} keyboardType="number-pad" placeholder="How many you have" />
          <Label>CONDITION</Label>
          <View style={styles.chips}>
            {[['new', 'New'], ['like_new', 'Like new'], ['good', 'Used - Good'], ['fair', 'Used - Fair']].map(([k, label]) => (
              <Pressable key={k} onPress={() => set('condition')(k)} style={[styles.chip, form.condition === k && styles.chipActive]}>
                <Text style={[styles.chipText, form.condition === k && { color: '#fff' }]}>{label}</Text>
              </Pressable>
            ))}
          </View>
          <View style={styles.switchRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.switchTitle}>Show in shop</Text>
              <Text style={styles.switchSub}>Turn off to hide it from buyers without deleting.</Text>
            </View>
            <Switch value={form.is_active} onValueChange={set('is_active')} trackColor={{ true: colors.primary }} thumbColor="#fff" />
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.switchTitle}>GST</Text>
          <Text style={styles.switchSub}>Your price includes GST. The invoice shows the tax breakup.</Text>
          <Label>GST RATE</Label>
          <View style={styles.chips}>
            {[0, 5, 12, 18, 28].map((r) => (
              <Pressable key={r} onPress={() => set('gst_rate')(r)} style={[styles.chip, form.gst_rate === r && styles.chipActive]}>
                <Text style={[styles.chipText, form.gst_rate === r && { color: '#fff' }]}>{r}%</Text>
              </Pressable>
            ))}
          </View>
          <Label>HSN CODE (OPTIONAL)</Label>
          <Input value={form.hsn_code} onChangeText={(t) => set('hsn_code')(t.replace(/\D/g, '').slice(0, 8))} keyboardType="number-pad" placeholder="e.g. 5208 for cotton fabric" />
        </View>

        <View style={styles.card}>
          <View style={styles.switchRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.switchTitle}>Sell wholesale (B2B)</Text>
              <Text style={styles.switchSub}>Verified business buyers get lower prices for bulk quantities and can ask you for quotes.</Text>
            </View>
            <Switch value={form.is_wholesale} onValueChange={set('is_wholesale')} trackColor={{ true: colors.primary }} thumbColor="#fff" />
          </View>
          {form.is_wholesale && (
            <>
              <Label>MINIMUM ORDER FOR BUSINESS (PIECES)</Label>
              <Input value={form.moq} onChangeText={(t) => set('moq')(t.replace(/\D/g, ''))} keyboardType="number-pad" />
              <Label>PRICE SLABS</Label>
              {tiers.map((t, i) => (
                <View key={i} style={styles.tierRow}>
                  <Input style={{ flex: 1 }} value={t.min_qty} keyboardType="number-pad" placeholder="Qty"
                    onChangeText={(v) => setTiers((ts) => ts.map((x, j) => (j === i ? { ...x, min_qty: v.replace(/\D/g, '') } : x)))} />
                  <Text style={styles.tierText}>+ pcs at ₹</Text>
                  <Input style={{ flex: 1.2 }} value={t.price} keyboardType="decimal-pad" placeholder="Price"
                    onChangeText={(v) => setTiers((ts) => ts.map((x, j) => (j === i ? { ...x, price: v.replace(/[^\d.]/g, '') } : x)))} />
                  {tiers.length > 1 && (
                    <Pressable onPress={() => setTiers((ts) => ts.filter((_, j) => j !== i))} hitSlop={8} accessibilityLabel="Remove slab">
                      <Ionicons name="close-circle" size={22} color={colors.muted} />
                    </Pressable>
                  )}
                </View>
              ))}
              {tiers.length < 5 && (
                <Pressable onPress={() => setTiers((ts) => [...ts, { min_qty: '', price: '' }])} style={styles.addTier}>
                  <Ionicons name="add" size={16} color={colors.primary} />
                  <Text style={styles.addTierText}>Add slab</Text>
                </Pressable>
              )}
              <Text style={styles.switchSub}>Example: 10+ pcs at ₹450, 50+ pcs at ₹400. Slab prices must be below your normal price.</Text>
            </>
          )}
        </View>

        <FormError message={error} />
        <Button title={id ? 'Save changes' : 'Add product'} variant="accent" icon="checkmark" onPress={save} loading={saving} style={{ marginTop: 14 }} />
        {id && <Button title="Delete product" variant="outline" icon="trash-outline" onPress={remove} style={{ marginTop: 10 }} />}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  card: { backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 10 },
  label: { fontSize: 10.5, color: colors.muted, fontWeight: '600', letterSpacing: 1.3, marginTop: 10, marginBottom: 7 },
  input: {
    fontFamily: fonts.regular,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 11,
    paddingHorizontal: 12,
    height: 46,
    fontSize: 15,
    color: colors.ink,
    backgroundColor: '#FCFAF8',
  },
  mainPhoto: { alignSelf: 'center', width: 180, height: 180, borderRadius: 16, overflow: 'hidden', backgroundColor: colors.surface },
  mainImg: { width: '100%', height: '100%' },
  photoEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.primary, borderRadius: 16 },
  photoHint: { fontSize: 12, color: colors.primary },
  changeBadge: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  changeText: { color: '#fff', fontSize: 11.5 },
  thumb: { width: 72, height: 72, borderRadius: 10, backgroundColor: colors.surface },
  addThumb: { alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.primary },
  thumbX: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  chip: { borderWidth: 1, borderColor: colors.border, borderRadius: 18, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: '#FCFAF8' },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 12.5, color: colors.ink },
  discount: { color: colors.green, fontSize: 12.5, marginTop: 6, fontWeight: '600' },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 16 },
  switchTitle: { fontSize: 14.5, fontWeight: '600', color: colors.ink },
  switchSub: { fontSize: 12, color: colors.muted, marginTop: 2, lineHeight: 17 },
  tierRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  tierText: { fontSize: 12.5, color: colors.muted },
  addTier: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', paddingVertical: 4, marginBottom: 6 },
  addTierText: { color: colors.primary, fontWeight: '600', fontSize: 13 },
});
