import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import Text from '../components/Text';
import { api } from '../api';
import { Button, TopBar } from '../components/common';
import { useApp } from '../context/AppContext';
import { colors, notify } from '../theme';

export default function ProfileScreen({ navigation }) {
  const { user, setUser } = useApp();
  const [fullName, setFullName] = useState(user?.full_name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (phone && !/^\d{10}$/.test(phone)) {
      notify('Phone number', 'Please enter a 10-digit mobile number.');
      return;
    }
    setSaving(true);
    try {
      const updated = await api('/auth/me/', { method: 'PUT', body: { full_name: fullName.trim(), phone } });
      setUser(updated);
      navigation.goBack();
    } catch (e) {
      notify('Profile', e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <TopBar title="Edit Profile" back showCart={false} />
      <View style={styles.card}>
        <Text style={styles.label}>Email (login)</Text>
        <Text style={styles.readonly}>{user?.email}</Text>

        <Text style={styles.label}>Full name</Text>
        <TextInput style={styles.input} value={fullName} onChangeText={setFullName} placeholder="Your name" placeholderTextColor="#aaa" />

        <Text style={styles.label}>Mobile number</Text>
        <TextInput
          style={styles.input}
          value={phone}
          onChangeText={(t) => setPhone(t.replace(/\D/g, ''))}
          keyboardType="number-pad"
          maxLength={10}
          placeholder="10-digit mobile number"
          placeholderTextColor="#aaa"
        />

        <Button title="Save changes" onPress={save} loading={saving} style={{ marginTop: 24 }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  card: { backgroundColor: '#fff', margin: 12, borderRadius: 12, padding: 16 },
  label: { fontSize: 12, color: colors.muted, fontWeight: '700', marginTop: 14, marginBottom: 6 },
  readonly: { fontSize: 15, color: colors.text, paddingVertical: 4 },
  input: {
    fontFamily: 'Poppins_400Regular',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 48,
    fontSize: 15,
    color: colors.text,
    backgroundColor: '#FCFAF8',
  },
});
