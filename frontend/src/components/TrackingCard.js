import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { colors } from '../theme';
import Text from './Text';

// Parcel tracking from the demo courier: courier + AWB, current step and the full history.
// Steps move forward automatically on the server; pull down to refresh to see the latest.
const STEPS = [
  ['BOOKED', 'Booked', 'document-text-outline'],
  ['PICKED_UP', 'Picked up', 'cube-outline'],
  ['IN_TRANSIT', 'In transit', 'car-outline'],
  ['OUT_FOR_DELIVERY', 'Out for delivery', 'bicycle-outline'],
  ['DELIVERED', 'Delivered', 'checkmark-done-outline'],
];

const when = (iso) =>
  new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

export default function TrackingCard({ tracking, title }) {
  const [open, setOpen] = useState(false);
  if (!tracking) return null;
  const cancelled = tracking.status === 'CANCELLED';
  const current = STEPS.findIndex(([s]) => s === tracking.status);
  const last = tracking.events[tracking.events.length - 1];

  return (
    <View style={styles.box}>
      <Pressable onPress={() => setOpen((v) => !v)} style={styles.head} hitSlop={6} accessibilityRole="button"
        accessibilityLabel={open ? 'Hide tracking details' : 'Show tracking details'}>
        <Ionicons name={cancelled ? 'close-circle-outline' : 'navigate-circle-outline'} size={20}
          color={cancelled ? colors.danger : colors.primary} />
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{title || tracking.status_display}</Text>
          <Text style={styles.sub}>
            {tracking.courier} · AWB {tracking.awb}
            {tracking.demo ? ' · demo' : ''}
          </Text>
        </View>
        <Text style={styles.toggle}>{open ? 'Hide' : 'Track'}</Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={16} color={colors.primary} />
      </Pressable>

      {!cancelled && (
        <View style={styles.steps}>
          {STEPS.map(([key, label, icon], i) => {
            const done = i <= current;
            return (
              <View key={key} style={styles.step}>
                <View style={[styles.dot, done && styles.dotDone]}>
                  <Ionicons name={icon} size={12} color={done ? '#fff' : colors.muted} />
                </View>
                {i < STEPS.length - 1 && <View style={[styles.line, i < current && styles.lineDone]} />}
                <Text style={[styles.stepText, done && styles.stepTextDone]} numberOfLines={2}>{label}</Text>
              </View>
            );
          })}
        </View>
      )}

      {!open && last ? (
        <Text style={styles.latest} numberOfLines={1}>
          {last.message}
          {last.location ? ` · ${last.location}` : ''}
        </Text>
      ) : null}

      {open && (
        <View style={styles.history}>
          {[...tracking.events].reverse().map((e, i) => (
            <View key={`${e.status}${i}`} style={styles.event}>
              <View style={[styles.evDot, i === 0 && { backgroundColor: cancelled ? colors.danger : colors.green }]} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.evText, i === 0 && { fontWeight: '700', color: colors.ink }]}>{e.message}</Text>
                <Text style={styles.evMeta}>
                  {e.location ? `${e.location} · ` : ''}
                  {when(e.at)}
                </Text>
              </View>
            </View>
          ))}
          {!cancelled && tracking.status !== 'DELIVERED' && (
            <Text style={styles.hint}>Updates arrive automatically. Pull down to refresh.</Text>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { marginTop: 10, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: '#FBF7F3', padding: 10 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: 13.5, fontWeight: '700', color: colors.ink },
  sub: { fontSize: 11.5, color: colors.muted },
  toggle: { fontSize: 12.5, fontWeight: '700', color: colors.primary },
  steps: { flexDirection: 'row', marginTop: 10 },
  step: { flex: 1, alignItems: 'center' },
  dot: { width: 24, height: 24, borderRadius: 12, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', zIndex: 1 },
  dotDone: { backgroundColor: colors.green },
  line: { position: 'absolute', top: 11, left: '50%', width: '100%', height: 2, backgroundColor: colors.border },
  lineDone: { backgroundColor: colors.green },
  stepText: { fontSize: 10, color: colors.muted, marginTop: 4, textAlign: 'center' },
  stepTextDone: { color: colors.ink, fontWeight: '600' },
  latest: { fontSize: 11.5, color: colors.muted, marginTop: 8 },
  history: { marginTop: 10, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 8, gap: 8 },
  event: { flexDirection: 'row', gap: 8 },
  evDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.border, marginTop: 5 },
  evText: { fontSize: 12.5, color: colors.muted },
  evMeta: { fontSize: 11, color: colors.muted },
  hint: { fontSize: 11, color: colors.muted, fontStyle: 'italic' },
});
