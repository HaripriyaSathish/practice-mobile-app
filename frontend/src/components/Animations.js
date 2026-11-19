/**
 * Sparkles & animations built on React Native's Animated API (works in Expo Go and on the web).
 */
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, Platform, Pressable, Text as RNText, StyleSheet, View } from 'react-native';
import { colors } from '../theme';
import Text from './Text';

const native = Platform.OS !== 'web'; // the native driver is not available on web

/* ------------------------------------------------------------------ Sparkle */
/** A single twinkling 4-point star. */
export function Sparkle({ size = 14, color = colors.accent, delay = 0, duration = 1600, style }) {
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(t, { toValue: 1, duration: duration / 2, easing: Easing.out(Easing.quad), useNativeDriver: native }),
        Animated.timing(t, { toValue: 0, duration: duration / 2, easing: Easing.in(Easing.quad), useNativeDriver: native }),
        Animated.delay(600),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [t, delay, duration]);

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        style,
        {
          opacity: t,
          transform: [
            { scale: t.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }) },
            { rotate: t.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '45deg'] }) },
          ],
        },
      ]}
    >
      <RNText style={{ fontSize: size, color, lineHeight: size * 1.1 }}>✦</RNText>
    </Animated.View>
  );
}

/** Many sparkles scattered over the parent (place inside a relatively positioned View). */
export function SparkleField({ count = 8, color = colors.accent, minSize = 8, maxSize = 16, seed = 1 }) {
  const items = useMemo(() => {
    let s = seed * 9301 + 49297;
    const rnd = () => {
      s = (s * 9301 + 49297) % 233280;
      return s / 233280;
    };
    return Array.from({ length: count }, (_, i) => ({
      key: i,
      left: `${5 + rnd() * 88}%`,
      top: `${5 + rnd() * 85}%`,
      size: minSize + rnd() * (maxSize - minSize),
      delay: Math.round(rnd() * 2400),
      duration: 1400 + Math.round(rnd() * 1400),
    }));
  }, [count, minSize, maxSize, seed]);

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {items.map((it) => (
        <Sparkle key={it.key} size={it.size} color={color} delay={it.delay} duration={it.duration}
          style={{ position: 'absolute', left: it.left, top: it.top }} />
      ))}
    </View>
  );
}

/* ------------------------------------------------------------------ Entrances */
/** Fades and slides its children up when first shown. */
export function FadeInUp({ delay = 0, distance = 18, duration = 520, style, children }) {
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(t, { toValue: 1, duration, delay, easing: Easing.out(Easing.cubic), useNativeDriver: native }).start();
  }, [t, delay, duration]);
  return (
    <Animated.View
      style={[style, {
        opacity: t,
        transform: [{ translateY: t.interpolate({ inputRange: [0, 1], outputRange: [distance, 0] }) }],
      }]}
    >
      {children}
    </Animated.View>
  );
}

/** Image that fades in once it has loaded. Accepts the same props as Animated.Image. */
export function FadeImage({ style, ...props }) {
  const o = useRef(new Animated.Value(0)).current;
  const shown = useRef(false);
  const show = () => {
    if (shown.current) return;
    shown.current = true;
    Animated.timing(o, { toValue: 1, duration: 450, useNativeDriver: native }).start();
  };
  // Safety net: some platforms (e.g. web with cached images) never report onLoad - never leave an image hidden
  useEffect(() => {
    const t = setTimeout(show, 900);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return <Animated.Image {...props} onLoad={show} onLoadEnd={show} onError={show} style={[style, { opacity: o }]} />;
}

/* ------------------------------------------------------------------ Touch */
/** Pressable that gently shrinks with a spring while pressed. */
export function ScalePressable({ onPress, style, containerStyle, children, scaleTo = 0.965, ...rest }) {
  const s = useRef(new Animated.Value(1)).current;
  const to = (v) => Animated.spring(s, { toValue: v, useNativeDriver: native, speed: 40, bounciness: 6 }).start();
  return (
    <Pressable onPress={onPress} onPressIn={() => to(scaleTo)} onPressOut={() => to(1)} style={containerStyle} {...rest}>
      <Animated.View style={[style, { transform: [{ scale: s }] }]}>{children}</Animated.View>
    </Pressable>
  );
}

/** Returns an Animated.Value-based style that "pops" whenever `trigger` changes (e.g. cart count). */
export function usePop(trigger) {
  const s = useRef(new Animated.Value(1)).current;
  const prev = useRef(trigger);
  useEffect(() => {
    const before = prev.current;
    prev.current = trigger;
    // no pop on first render or when data first arrives (undefined -> value)
    if (before === trigger || before === undefined || before === null) return;
    s.setValue(0.6);
    Animated.spring(s, { toValue: 1, friction: 3, tension: 160, useNativeDriver: native }).start();
  }, [trigger, s]);
  return { transform: [{ scale: s }] };
}

/** Gentle endless float (up and down) - for empty-state icons. */
export function Float({ children, distance = 6, duration = 1800 }) {
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(t, { toValue: 1, duration, easing: Easing.inOut(Easing.sin), useNativeDriver: native }),
        Animated.timing(t, { toValue: 0, duration, easing: Easing.inOut(Easing.sin), useNativeDriver: native }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [t, duration]);
  return (
    <Animated.View style={{ transform: [{ translateY: t.interpolate({ inputRange: [0, 1], outputRange: [0, -distance] }) }] }}>
      {children}
    </Animated.View>
  );
}

/** Soft pulsing glow scale loop (for logo rings). */
export function Pulse({ children, scale = 1.06, duration = 1400 }) {
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(t, { toValue: 1, duration, easing: Easing.inOut(Easing.sin), useNativeDriver: native }),
        Animated.timing(t, { toValue: 0, duration, easing: Easing.inOut(Easing.sin), useNativeDriver: native }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [t, duration]);
  return (
    <Animated.View style={{ transform: [{ scale: t.interpolate({ inputRange: [0, 1], outputRange: [1, scale] }) }] }}>
      {children}
    </Animated.View>
  );
}

/* ------------------------------------------------------------------ Celebration */
/** Full-screen gold sparkle burst with a check mark, e.g. after an order is placed. */
export function SparkleBurst({ title, subtitle, onDone, duration = 2600 }) {
  const t = useRef(new Animated.Value(0)).current; // burst progress
  const fade = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 220, useNativeDriver: native }),
      Animated.timing(t, { toValue: 1, duration: 1100, easing: Easing.out(Easing.cubic), useNativeDriver: native }),
    ]).start();
    const timer = setTimeout(() => {
      Animated.timing(fade, { toValue: 0, duration: 300, useNativeDriver: native }).start(() => onDone?.());
    }, duration);
    return () => clearTimeout(timer);
  }, [t, fade, duration, onDone]);

  const rays = Array.from({ length: 14 }, (_, i) => {
    const angle = (i / 14) * Math.PI * 2;
    const dist = 90 + (i % 3) * 28;
    return { i, x: Math.cos(angle) * dist, y: Math.sin(angle) * dist, size: 10 + (i % 4) * 5 };
  });

  return (
    <Animated.View style={[styles.overlay, { opacity: fade }]}>
      <Pressable style={StyleSheet.absoluteFill} onPress={() => onDone?.()} />
      <View style={styles.center} pointerEvents="none">
        {rays.map((r) => (
          <Animated.View
            key={r.i}
            style={{
              position: 'absolute',
              opacity: t.interpolate({ inputRange: [0, 0.2, 0.85, 1], outputRange: [0, 1, 1, 0.6] }),
              transform: [
                { translateX: t.interpolate({ inputRange: [0, 1], outputRange: [0, r.x] }) },
                { translateY: t.interpolate({ inputRange: [0, 1], outputRange: [0, r.y] }) },
                { scale: t.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.2, 1.2, 0.9] }) },
                { rotate: t.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] }) },
              ],
            }}
          >
            <RNText style={{ fontSize: r.size, color: r.i % 3 === 0 ? '#fff' : colors.accent }}>✦</RNText>
          </Animated.View>
        ))}
        <Animated.View
          style={[styles.check, {
            transform: [{ scale: t.interpolate({ inputRange: [0, 0.4, 0.7, 1], outputRange: [0, 1.25, 0.95, 1] }) }],
          }]}
        >
          <Ionicons name="checkmark" size={46} color="#fff" />
        </Animated.View>
      </View>
      <Animated.View
        pointerEvents="none"
        style={{ alignItems: 'center', marginTop: 40, opacity: t, transform: [{ translateY: t.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }] }}
      >
        <Text display style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(40, 10, 24, 0.86)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 50,
    elevation: 50,
  },
  center: { width: 120, height: 120, alignItems: 'center', justifyContent: 'center' },
  check: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  title: { color: '#fff', fontSize: 28, textAlign: 'center' },
  subtitle: { color: 'rgba(255,255,255,0.8)', fontSize: 14, marginTop: 8, textAlign: 'center', paddingHorizontal: 30, lineHeight: 20 },
});
