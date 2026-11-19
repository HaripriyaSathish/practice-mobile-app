import { Text as RNText, StyleSheet } from 'react-native';
import { fonts } from '../theme';

const WEIGHT_TO_FONT = {
  normal: fonts.regular,
  100: fonts.regular,
  200: fonts.regular,
  300: fonts.regular,
  400: fonts.regular,
  500: fonts.medium,
  600: fonts.semibold,
  bold: fonts.bold,
  700: fonts.bold,
  800: fonts.displayBold,
  900: fonts.displayBold,
};

/**
 * Drop-in replacement for react-native's Text that applies the app fonts.
 *  - normal text: Poppins, picked from fontWeight (custom fonts need one file per weight)
 *  - <Text display> or style fontFamily: 'display' -> bold Poppins for headings
 */
export default function Text({ style, display, ...props }) {
  const flat = StyleSheet.flatten(style) || {};
  let fontFamily;
  if (display || flat.fontFamily === 'display') {
    fontFamily = Number(flat.fontWeight) >= 700 ? fonts.displayBold : fonts.display;
  } else if (flat.fontFamily) {
    fontFamily = flat.fontFamily;
  } else {
    fontFamily = WEIGHT_TO_FONT[String(flat.fontWeight || '400')] || fonts.regular;
  }
  return <RNText {...props} style={[style, { fontFamily, fontWeight: 'normal' }]} />;
}
