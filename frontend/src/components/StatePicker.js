import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { api } from '../api';
import { colors, fonts } from '../theme';
import Text from './Text';

let cached = null;

/** Tap-to-choose Indian state (needed for GST: same state = CGST+SGST, other state = IGST). */
export default function StatePicker({ value, onChange, style, label = 'STATE' }) {
  const [open, setOpen] = useState(false);
  const [states, setStates] = useState(cached || []);
  const [q, setQ] = useState('');

  useEffect(() => {
    if (cached) return;
    api('/auth/states/')
      .then((s) => {
        cached = s;
        setStates(s);
      })
      .catch(() => {});
  }, []);

  const shown = states.filter((s) => s.toLowerCase().includes(q.trim().toLowerCase()));

  return (
    <View style={style}>
      <Text style={styles.label}>{label}</Text>
      <Pressable style={styles.field} onPress={() => setOpen(true)} accessibilityLabel="Choose state">
        <Ionicons name="map-outline" size={18} color={colors.muted} />
        <Text style={styles.value}>{value || 'Choose your state'}</Text>
        <Ionicons name="chevron-down" size={16} color={colors.muted} />
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <Text style={styles.sheetTitle}>Choose state</Text>
            <TextInput style={styles.search} placeholder="Search" placeholderTextColor="#aaa" value={q} onChangeText={setQ} />
            <FlatList
              data={shown}
              keyExtractor={(s) => s}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <Pressable style={styles.row} onPress={() => { onChange(item); setOpen(false); setQ(''); }}>
                  <Text style={[styles.rowText, item === value && { color: colors.primary, fontWeight: '700' }]}>{item}</Text>
                  {item === value && <Ionicons name="checkmark" size={18} color={colors.primary} />}
                </Pressable>
              )}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 10.5, color: colors.muted, fontWeight: '600', letterSpacing: 1.4, marginBottom: 7 },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 13,
    paddingHorizontal: 13,
    height: 50,
    backgroundColor: '#FBF9F7',
  },
  value: { flex: 1, fontSize: 15, color: colors.ink },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: 24 },
  sheet: { backgroundColor: '#fff', borderRadius: 16, padding: 16, maxHeight: '75%' },
  sheetTitle: { fontSize: 17, fontWeight: '700', color: colors.ink, marginBottom: 10 },
  search: {
    fontFamily: fonts.regular,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 42,
    marginBottom: 8,
    color: colors.ink,
  },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: '#f3ede7' },
  rowText: { flex: 1, fontSize: 14.5, color: colors.ink },
});
