import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api, loadToken, saveToken } from '../api';

const DELIVERY_KEY = 'vetri_delivery_address';

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [booting, setBooting] = useState(true);
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);
  const [cart, setCart] = useState({ items: [], count: 0, total: 0, mrp_total: 0, savings: 0 });

  const [addresses, setAddresses] = useState([]);
  const [deliveryId, setDeliveryId] = useState(null);

  const refreshCart = useCallback(async () => {
    try {
      setCart(await api('/cart/'));
    } catch {
      // ignore (e.g. offline)
    }
  }, []);

  // ---- "Deliver to" address (shown under the search bar, used at checkout)
  const refreshAddresses = useCallback(async () => {
    try {
      const list = await api('/addresses/');
      setAddresses(list);
      let saved = null;
      try {
        saved = Number(await AsyncStorage.getItem(DELIVERY_KEY)) || null;
      } catch {
        saved = null;
      }
      setDeliveryId((cur) => {
        const pick = [cur, saved].find((id) => id && list.some((a) => a.id === id));
        return pick || list.find((a) => a.is_default)?.id || list[list.length - 1]?.id || null;
      });
      return list;
    } catch {
      return [];
    }
  }, []);

  const chooseDelivery = useCallback(async (id) => {
    setDeliveryId(id);
    try {
      await AsyncStorage.setItem(DELIVERY_KEY, String(id));
    } catch {
      // storage not available - choice is kept for this session
    }
  }, []);

  const deliveryAddress = addresses.find((a) => a.id === deliveryId) || null;

  // On app start: restore saved login
  useEffect(() => {
    (async () => {
      const saved = await loadToken();
      if (saved) {
        try {
          const me = await api('/auth/me/');
          setUser(me);
          setToken(saved);
        } catch (e) {
          if (e.status === 401) await saveToken(null);
        }
      }
      setBooting(false);
    })();
  }, []);

  useEffect(() => {
    if (token) {
      refreshCart();
      refreshAddresses();
    }
  }, [token, refreshCart, refreshAddresses]);

  const login = async (newToken, newUser) => {
    await saveToken(newToken);
    setUser(newUser);
    setToken(newToken);
  };

  const logout = async () => {
    try {
      await api('/auth/logout/', { method: 'POST' });
    } catch {
      // token may already be invalid
    }
    await saveToken(null);
    setToken(null);
    setUser(null);
    setCart({ items: [], count: 0, total: 0, mrp_total: 0, savings: 0 });
    setAddresses([]);
    setDeliveryId(null);
  };

  /** mode 'add' adds quantity, 'set' replaces it (0 removes). */
  const updateCart = async (productId, quantity, mode = 'add') => {
    const data = await api('/cart/', { method: 'POST', body: { product_id: productId, quantity, mode } });
    setCart(data);
    return data;
  };

  return (
    <AppContext.Provider
      value={{
        booting, token, user, setUser, login, logout, cart, refreshCart, updateCart,
        addresses, refreshAddresses, deliveryAddress, chooseDelivery,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export const useApp = () => useContext(AppContext);
