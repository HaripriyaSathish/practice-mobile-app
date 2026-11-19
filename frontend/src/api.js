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

/**
 * Add a picked photo (from expo-image-picker) to FormData.
 * Web gives a real File object; Android/iOS need the {uri, name, type} form.
 */
export function appendImage(form, field, asset) {
  if (asset.file) {
    form.append(field, asset.file, asset.file.name || asset.fileName || 'photo.jpg');
    return;
  }
  const type = asset.mimeType || 'image/jpeg';
  const ext = type.split('/')[1] || 'jpg';
  form.append(field, { uri: asset.uri, name: asset.fileName || `photo.${ext}`, type });
}

/** Small fetch wrapper: adds the auth token and turns API errors into readable messages.
 *  `body` is sent as JSON; `form` (FormData) is sent as multipart for photo uploads. */
export async function api(path, { method = 'GET', body, form } = {}) {
  const headers = { Accept: 'application/json' };
  if (body) headers['Content-Type'] = 'application/json';
  if (authToken) headers.Authorization = `Token ${authToken}`;

  let res;
  try {
    res = await fetch(`${API_URL}/api${path}`, {
      method,
      headers,
      body: form || (body ? JSON.stringify(body) : undefined),
    });
  } catch {
    throw new Error(`Cannot reach the server at ${API_URL}. Is the Django backend running?`);
  }

  let data = null;
  if (res.status !== 204) {
    try {
      data = await res.json();
    } catch {
      data = null;
    }
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
