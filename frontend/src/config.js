import Constants from 'expo-constants';
import { Platform } from 'react-native';

// Django port. Vetri uses 8001 so it can run alongside other projects on 8000.
// Override with EXPO_PUBLIC_API_PORT if needed.
const BACKEND_PORT = process.env.EXPO_PUBLIC_API_PORT || 8001;

// If auto-detection fails, put your PC's IP here, e.g. 'http://192.168.1.5:8001'
const MANUAL_API_URL = '';

function detectApiUrl() {
  if (MANUAL_API_URL) return MANUAL_API_URL;

  // Web browser: backend runs on the same computer
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return `http://${window.location.hostname}:${BACKEND_PORT}`;
  }

  // Expo Go on a phone: reuse the IP of the computer running `npx expo start`
  const hostUri = Constants.expoConfig?.hostUri || Constants.expoGoConfig?.debuggerHost;
  if (hostUri) {
    return `http://${hostUri.split(':')[0]}:${BACKEND_PORT}`;
  }

  // Android emulator fallback
  return `http://10.0.2.2:${BACKEND_PORT}`;
}

export const API_URL = detectApiUrl();
