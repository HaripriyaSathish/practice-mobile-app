import { Alert, Platform } from 'react-native';

// Brand palette: kumkum maroon + marigold
export const colors = {
  primary: '#8B1E3F', // kumkum maroon
  primaryDark: '#6B1430',
  accent: '#F4A300', // marigold
  accentSoft: '#FFF3D6',
  accentInk: '#3A2500', // text on marigold
  ink: '#212121',
  green: '#1E8E3E',
  bg: '#F6F1EC',
  card: '#FFFFFF',
  text: '#212121',
  muted: '#6F6F6F',
  border: '#E8E0D8',
  surface: '#F3ECE6', // image backgrounds, chips
  danger: '#D32F2F',
};

// Fonts (loaded in App.js) - Poppins everywhere; headings use the bold weights.
export const fonts = {
  regular: 'Poppins_400Regular',
  medium: 'Poppins_500Medium',
  semibold: 'Poppins_600SemiBold',
  bold: 'Poppins_700Bold',
  display: 'Poppins_700Bold',
  displayBold: 'Poppins_800ExtraBold',
};

export function formatPrice(value) {
  const n = Math.round(Number(value) || 0).toString();
  // Indian number format: 1,23,456
  const last3 = n.slice(-3);
  const rest = n.slice(0, -3);
  const grouped = rest ? rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + last3 : last3;
  return `₹${grouped}`;
}

/** Alert that also works in the web browser (react-native Alert is a no-op on web). */
export function notify(title, message = '') {
  if (Platform.OS === 'web') window.alert(message ? `${title}\n\n${message}` : title);
  else Alert.alert(title, message);
}

export function confirmAction(title, message, onYes) {
  if (Platform.OS === 'web') {
    if (window.confirm(`${title}\n\n${message}`)) onYes();
    return;
  }
  Alert.alert(title, message, [
    { text: 'No', style: 'cancel' },
    { text: 'Yes', style: 'destructive', onPress: onYes },
  ]);
}

// Soft, diffused shadow for cards
export const shadow = Platform.select({
  web: { boxShadow: '0 6px 18px rgba(60, 25, 40, 0.07)' },
  default: {
    shadowColor: '#3C1928',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
});
