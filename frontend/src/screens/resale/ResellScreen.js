import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { api, appendImage } from '../../api';
import { FormError } from '../../components/AuthUI';
import { Button, TopBar } from '../../components/common';
import Text from '../../components/Text';
import { colors, fonts, formatPrice, notify } from '../../theme';

export const CONDITIONS = [
  ['like_new', 'Like new', 'Used once or twice, no marks'],
  ['good', 'Good', 'Light signs of use, works perfectly'],
  ['fair', 'Fair', 'Visible wear, fully working'],
];
const MAX_PHOTOS = 6;

/** Buyer re-lists something they bought and received on Vetri. Admin reviews it before it goes live. */
export default function ResellScreen({ navigation, route }) {
  const { item } = route.params; // order item from the Orders screen
  const left = item.quantity - (item.resold_qty || 0);
  const [condition, setCondition] = useState('like_new');
  const [price, setPrice] = useState(String(Math.round(Number(item.price) * 0.6)));
  const [qty, setQty] = useState('1');
  const [description, setDescription] = useState('');
  const [photos, setPhotos] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const pick = async () => {
    const room = MAX_PHOTOS - photos.length;
    if (room <= 0) return;
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: true, selectionLimit: room, quality: 0.8 });
    if (!res.canceled && res.assets) setPhotos((p) => [...p, ...res.assets.slice(0, room)]);
  };

  const submit = async () => {
    if (!(Number(price) > 0)) {
      setError('Enter your selling price.');
      return;
    }
    if (!(Number(qty) >= 1 && Number(qty) <= left)) {
      setError(`You can list 1 to ${left} piece(s).`);
      return;
    }
    setBusy(true);
    setError('');
    try {
      const fd = new FormData();
      fd.append('order_item_id', String(item.id));
      fd.append('condition', condition);
      fd.append('price', price);
      fd.append('quantity', qty);
      fd.append('description', description.trim());
      photos.forEach((a) => appendImage(fd, 'photos', a));
      await api('/resale/', { method: 'POST', form: fd });
      notify('Listing sent for review', 'Our team checks it (usually within a day). You will get an email when it is live.');
      navigation.replace('MyResale');
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <TopBar title="Resell this item" back showCart={false} />
      <ScrollView contentContainerStyle={{ padding: 12, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <View style={[styles.card, { flexDirection: 'row', gap: 12, alignItems: 'center' }]}>
          {item.image ? <Image source={{ uri: item.image }} style={styles.img} /> : <View style={styles.img} />}
          <View style={{ flex: 1 }}>
            <Text style={styles.name} numberOfLines={2}>{item.product_name}</Text>
            <Text style={styles.meta}>You paid {formatPrice(item.price)} · bought {item.quantity}, can list {left}</Text>
            <View style={styles.verified}>
              <Ionicons name="shield-checkmark" size={12} color="#8a5a00" />
              <Text style={styles.verifiedText}>Will show "Bought on Vetri"</Text>
            </View>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>CONDITION</Text>
          {CONDITIONS.map(([key, title, hint]) => (
            <Pressable key={key} onPress={() => setCondition(key)} style={[styles.cond, condition === key && styles.condActive]}>
              <Ionicons name={condition === key ? 'radio-button-on' : 'radio-button-off'} size={18} color={condition === key ? colors.primary : colors.muted} />
              <View style={{ flex: 1 }}>
                <Text style={styles.condTitle}>{title}</Text>
                <Text style={styles.meta}>{hint}</Text>
              </View>
            </Pressable>
          ))}
        </View>

        <View style={styles.card}>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1.4 }}>
              <Text style={styles.label}>YOUR PRICE (₹)</Text>
              <TextInput style={styles.input} value={price} onChangeText={(t) => setPrice(t.replace(/[^\d.]/g, ''))} keyboardType="decimal-pad" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>QUANTITY</Text>
              <TextInput style={styles.input} value={qty} onChangeText={(t) => setQty(t.replace(/\D/g, ''))} keyboardType="number-pad" />
            </View>
          </View>
          <Text style={styles.label}>DESCRIBE IT (OPTIONAL)</Text>
          <TextInput style={[styles.input, { height: 90, paddingTop: 10, textAlignVertical: 'top' }]} multiline value={description}
            onChangeText={setDescription} placeholder="How long you used it, any marks, box/bill included…" placeholderTextColor="#aaa" />
          <Text style={styles.label}>PHOTOS OF YOUR ITEM ({photos.length}/{MAX_PHOTOS})</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {photos.map((a, i) => (
              <View key={`${a.uri}-${i}`}>
                <Image source={{ uri: a.uri }} style={styles.thumb} />
                <Pressable onPress={() => setPhotos((p) => p.filter((_, j) => j !== i))} style={styles.thumbX} hitSlop={6}>
                  <Ionicons name="close" size={13} color="#fff" />
                </Pressable>
              </View>
            ))}
            {photos.length < MAX_PHOTOS && (
              <Pressable onPress={pick} style={[styles.thumb, styles.addThumb]} accessibilityLabel="Add photos">
                <Ionicons name="camera-outline" size={24} color={colors.primary} />
              </Pressable>
            )}
          </ScrollView>
          <Text style={styles.hint}>Real photos get approved faster. The shop photo is used as the cover until you add yours.</Text>
        </View>

        <FormError message={error} />
        <Button title="Send for review" variant="accent" icon="leaf-outline" onPress={submit} loading={busy} style={{ marginTop: 12 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  card: { backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 10 },
  img: { width: 64, height: 64, borderRadius: 10, backgroundColor: colors.surface },
  name: { fontSize: 14.5, fontWeight: '600', color: colors.ink },
  meta: { fontSize: 12, color: colors.muted, marginTop: 1 },
  verified: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', backgroundColor: colors.accentSoft, borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2, marginTop: 5 },
  verifiedText: { fontSize: 11, color: '#8a5a00', fontWeight: '600' },
  label: { fontSize: 10.5, color: colors.muted, fontWeight: '600', letterSpacing: 1.3, marginTop: 8, marginBottom: 7 },
  cond: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: colors.border, borderRadius: 11, padding: 10, marginBottom: 7 },
  condActive: { borderColor: colors.primary, backgroundColor: '#FFF9F5' },
  condTitle: { fontSize: 14, fontWeight: '600', color: colors.ink },
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
  thumb: { width: 70, height: 70, borderRadius: 10, backgroundColor: colors.surface },
  addThumb: { alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.primary },
  thumbX: { position: 'absolute', top: 4, right: 4, width: 20, height: 20, borderRadius: 10, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center' },
  hint: { fontSize: 12, color: colors.muted, marginTop: 10, lineHeight: 17 },
});
