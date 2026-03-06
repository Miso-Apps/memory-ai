import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authApi, setApiAccessToken } from '../services/api';

interface User {
  id: string;
  email: string;
  name?: string;
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;

  // Actions
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name?: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  loadStoredAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  refreshToken: null,
  isLoading: false,
  isAuthenticated: false,

  login: async (email: string, password: string) => {
    try {
      set({ isLoading: true });
      const response = await authApi.login(email, password);

      await AsyncStorage.multiSet([
        ['accessToken', response.access_token],
        ['refreshToken', response.refresh_token],
        ['user', JSON.stringify(response.user)],
      ]);
      setApiAccessToken(response.access_token);

      set({
        user: response.user,
        accessToken: response.access_token,
        refreshToken: response.refresh_token,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  register: async (email: string, password: string, name?: string) => {
    try {
      set({ isLoading: true });
      const response = await authApi.register(email, password, name);

      await AsyncStorage.multiSet([
        ['accessToken', response.access_token],
        ['refreshToken', response.refresh_token],
        ['user', JSON.stringify(response.user)],
      ]);
      setApiAccessToken(response.access_token);

      set({
        user: response.user,
        accessToken: response.access_token,
        refreshToken: response.refresh_token,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  loginWithGoogle: async () => {
    try {
      set({ isLoading: true });
      const response = await authApi.loginWithGoogle();

      await AsyncStorage.multiSet([
        ['accessToken', response.access_token],
        ['refreshToken', response.refresh_token],
        ['user', JSON.stringify(response.user)],
      ]);
      setApiAccessToken(response.access_token);

      set({
        user: response.user,
        accessToken: response.access_token,
        refreshToken: response.refresh_token,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  logout: async () => {
    try {
      await authApi.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      await AsyncStorage.multiRemove(['accessToken', 'refreshToken', 'user']);
      setApiAccessToken(null);
      set({
        user: null,
        accessToken: null,
        refreshToken: null,
        isAuthenticated: false,
      });
    }
  },

  loadStoredAuth: async () => {
    try {
      const [accessToken, refreshToken, userString] = await AsyncStorage.multiGet([
        'accessToken',
        'refreshToken',
        'user',
      ]);

      const token = accessToken[1];
      const refresh = refreshToken[1];
      const userStr = userString[1];

      if (!token || !refresh || !userStr) return;

      // Validate it looks like a real JWT (3 base64 segments) — rejects stale mocks
      const parts = token.split('.');
      if (parts.length !== 3) {
        await AsyncStorage.multiRemove(['accessToken', 'refreshToken', 'user']);
        return;
      }

      // Check expiry from payload without a library
      try {
        const payload = JSON.parse(atob(parts[1]));
        if (payload.exp && payload.exp * 1000 < Date.now()) {
          await AsyncStorage.multiRemove(['accessToken', 'refreshToken', 'user']);
          return;
        }
      } catch {
        await AsyncStorage.multiRemove(['accessToken', 'refreshToken', 'user']);
        return;
      }

      set({
        user: JSON.parse(userStr),
        accessToken: token,
        refreshToken: refresh,
        isAuthenticated: true,
      });
      setApiAccessToken(token);
    } catch (error) {
      console.error('Load stored auth error:', error);
    }
  },
}));
