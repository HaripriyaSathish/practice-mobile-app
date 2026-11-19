import { StyleSheet, View } from 'react-native';
import { colors } from '../theme';
import { Sparkle } from './Animations';
import Text from './Text';

/** Brand wordmark: "Vetri" + marigold "Shopping Hall", optional tagline and twinkle. */
export default function Logo({ light = true, size = 22, align = 'flex-start', sparkle = true, tagline }) {
  return (
    <View style={{ alignItems: align }}>
      <View>
        <Text style={[styles.name, { fontSize: size, lineHeight: size * 1.3, color: light ? '#fff' : colors.primary }]}>
          Vetri <Text style={[styles.name, { color: colors.accent }]}>Shopping Hall</Text>
        </Text>
        {sparkle && (
          <>
            <Sparkle size={size * 0.55} color={colors.accent} style={{ position: 'absolute', right: -size * 0.7, top: -size * 0.15 }} />
            <Sparkle size={size * 0.32} delay={900} color="#fff" style={{ position: 'absolute', right: -size * 1.05, top: size * 0.45 }} />
          </>
        )}
      </View>
      {tagline ? (
        <Text style={[styles.tagline, { color: light ? '#F5D9E1' : colors.muted, fontSize: Math.max(10, size * 0.5) }]}>{tagline}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  name: { fontWeight: '800', letterSpacing: 0.2 },
  tagline: { marginTop: 1, fontWeight: '500' },
});
