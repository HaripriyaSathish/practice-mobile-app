import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from './config';

const TOKEN_KEY = 'southcart_token';
let authToken = null;

export async function loadToken() {
  try {
    authToken = await AsyncStorage.getItem(TOKEN_KEY);
  } catch {
    authToken = null;
  }
  return authToken;
}

export async function saveToken(token) {
  authToken = token;
  try {
    if (token) await AsyncStorage.setItem(TOKEN_KEY, token);
    else await AsyncStorage.removeItem(TOKEN_KEY);
  } catch {
    // storage not available (e.g. private browser window) - token stays in memory
  }
}

/** Small fetch wrapper: adds the auth token and turns API errors into readable messages. */
export async function api(path, { method = 'GET', body } = {}) {
  const headers = { Accept: 'application/json' };
  if (body) headers['Content-Type'] = 'application/json';
  if (authToken) headers.Authorization = `Token ${authToken}`;

  let res;
  try {
    res = await fetch(`${API_URL}/api${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error(`Cannot reach the server at ${API_URL}. Is the Django backend running?`);
  }

  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  if (!res.ok) {
    const message =
      data?.detail ||
      (data && typeof data === 'object'
        ? Object.entries(data).map(([k, v]) => `${k}: ${[].concat(v).join(' ')}`).join('\n')
        : null) ||
      `Request failed (${res.status})`;
    const error = new Error(message);
    error.status = res.status;
    throw error;
  }
  return data;
}
