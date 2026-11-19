import { useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { api } from '../../api';
import { FormError } from '../../components/AuthUI';
import { Button, TopBar } from '../../components/common';
import Text from '../../components/Text';
import { colors, fonts, formatPrice, notify } from '../../theme';

/** Business buyer asks the seller for a special price for a big quantity. */
export default function RequestQuoteScreen({ navigation, route }) {
  const { product } = route.params;
  const min = Math.max(product.wholesale?.moq || 2, 2);
  const [qty, setQty] = useState(String(Math.max(min, 50)));
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const send = async () => {
    if (!(Number(qty) >= min)) {
      setError(`Quotes are for at least ${min} pieces.`);
      return;
    }
    setBusy(true);
    setError('');
    try {
      await api('/quotes/', { method: 'POST', body: { product_id: product.id, quantity: Number(qty), note: note.trim() } });
      notify('Quote requested', `${product.seller_name} will reply with a price. You'll get an email, and you can see it in My Quotes.`);
      navigation.replace('Quotes');
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <TopBar title="Get a quote" back showCart={false} />
      <ScrollView contentContainerStyle={{ padding: 12 }} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
            <Image source={{ uri: product.image }} style={styles.img} />
            <View style={{ flex: 1 }}>
              <Text style={styles.name} numberOfLines={2}>{product.name}</Text>
              <Text style={styles.meta}>Sold by {product.seller_name}</Text>
              <Text style={styles.meta}>Normal price {formatPrice(product.price)} · {product.stock} in stock</Text>
            </View>
          </View>
        </View>
        <View style={styles.card}>
          <Text style={styles.label}>HOW MANY PIECES?</Text>
          <TextInput style={styles.input} value={qty} onChangeText={(t) => { setQty(t.replace(/\D/g, '')); setError(''); }}
            keyboardType="number-pad" placeholder={`At least ${min}`} placeholderTextColor="#aaa" />
          <Text style={styles.label}>MESSAGE TO SELLER (OPTIONAL)</Text>
          <TextInput style={[styles.input, { height: 100, paddingTop: 10, textAlignVertical: 'top' }]} multiline value={note}
            onChangeText={setNote} placeholder="Delivery date, packing, colours…" placeholderTextColor="#aaa" />
          <Text style={styles.hint}>The seller replies with a price per piece. If you accept, it goes to your cart at that price. Offers are valid for 7 days.</Text>
        </View>
        <FormError message={error} />
        <Button title="Send quote request" variant="accent" icon="send-outline" onPress={send} loading={busy} style={{ marginTop: 12 }} />
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
  label: { fontSize: 10.5, color: colors.muted, fontWeight: '600', letterSpacing: 1.3, marginTop: 8, marginBottom: 7 },
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
  hint: { fontSize: 12, color: colors.muted, marginTop: 10, lineHeight: 18 },
});
