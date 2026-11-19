import { Ionicons } from '@expo/vector-icons';
import { useEffect } from 'react';
import { Platform, StyleSheet, useWindowDimensions, View } from 'react-native';
import Text from './Text';
import { enableDragScroll } from '../webDragScroll';

const FRAME_WIDTH = 400;

/**
 * On a wide web browser, shows the app inside a phone-shaped frame (centered).
 * On real phones / narrow browser windows, the app simply fills the screen.
 */
export default function PhoneFrame({ children }) {
  const { width, height } = useWindowDimensions();
  const isWeb = Platform.OS === 'web';
  const framed = isWeb && width > 600;

  useEffect(() => {
    if (!isWeb || typeof document === 'undefined') return;
    const style = document.createElement('style');
    // NOTE: no global `overscroll-behavior: contain` / `scroll-behavior: smooth` - they made the
    // mouse wheel get stuck over sideways rows and made scrolling feel laggy.
    style.innerHTML = `
      html, body, #root { height: 100%; margin: 0; overflow: hidden; overscroll-behavior: none; }
      * { -webkit-tap-highlight-color: transparent; }
      ::-webkit-scrollbar { width: 0; height: 0; background: transparent; }
      * { scrollbar-width: none; }
      input, textarea { outline: none; }
    `;
    document.head.appendChild(style);
    const disableDrag = enableDragScroll(); // mouse click-and-drag scrolling, like swiping on a phone
    return () => {
      style.remove();
      disableDrag();
    };
  }, [isWeb]);

  if (!framed) return <View style={styles.full}>{children}</View>;

  const frameHeight = Math.min(860, height - 40);
  return (
    <View style={styles.page}>
      <View style={[styles.frame, { width: FRAME_WIDTH, height: frameHeight }]}>
        <View style={styles.screen}>
          {/* fake status bar keeps content away from the rounded top corners */}
          <View style={styles.statusBar}>
            <Text style={styles.time}>9:41</Text>
            <View style={styles.notch} />
            <View style={styles.statusIcons}>
              <Ionicons name="cellular" size={13} color="#fff" />
              <Ionicons name="wifi" size={13} color="#fff" />
              <Ionicons name="battery-full" size={16} color="#fff" />
            </View>
          </View>
          <View style={{ flex: 1 }}>{children}</View>
          {/* home indicator keeps the tab bar away from the rounded bottom corners */}
          <View style={styles.homeBar}>
            <View style={styles.homePill} />
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  full: { flex: 1 },
  page: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EBDDE3',
  },
  frame: {
    borderRadius: 44,
    borderWidth: 11,
    borderColor: '#2B2328',
    backgroundColor: '#2B2328',
    overflow: 'hidden',
    boxShadow: '0 25px 60px rgba(60, 20, 40, 0.35)',
  },
  screen: { flex: 1, borderRadius: 34, overflow: 'hidden', backgroundColor: '#fff' },
  statusBar: {
    height: 30,
    backgroundColor: '#6B1430',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 26,
  },
  time: { color: '#fff', fontSize: 12, fontWeight: '600', width: 60 },
  notch: { width: 90, height: 18, borderRadius: 10, backgroundColor: '#2B2328' },
  statusIcons: { flexDirection: 'row', gap: 4, width: 60, justifyContent: 'flex-end', alignItems: 'center' },
  homeBar: { height: 18, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  homePill: { width: 110, height: 4, borderRadius: 2, backgroundColor: '#2B2328' },
});
