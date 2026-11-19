import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

/**
 * Where Cashfree's result page should send the user back to.
 *  - Phone (Expo Go): a deep link like exp://192.168.1.5:8081/--/payment
 *  - Web browser: this web app's own address
 */
export function appReturnUrl() {
  if (Platform.OS === 'web') return `${window.location.origin}/`;
  return Linking.createURL('payment');
}

/** Opens the Cashfree checkout page. Resolves when the user comes back (phone only). */
export async function openPaymentPage(paymentUrl) {
  if (Platform.OS === 'web') {
    // Same tab: after paying, the result page redirects back to this web app.
    window.location.href = paymentUrl;
    return 'redirected';
  }
  const result = await WebBrowser.openAuthSessionAsync(paymentUrl, appReturnUrl());
  return result.type; // 'success' (returned via link), 'cancel' or 'dismiss'
}

/** On web, read ?order=12&status=PAID after Cashfree redirects back, then clean the URL. */
export function readWebPaymentReturn() {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  const order = params.get('order');
  if (!order) return null;
  window.history.replaceState({}, '', window.location.pathname);
  return { orderId: Number(order), status: params.get('status') };
}
