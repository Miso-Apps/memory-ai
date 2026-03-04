import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import i18n, { SupportedLanguage } from '../i18n';
import { preferencesApi, UserPreferences } from '../services/api';

const LANGUAGE_KEY = 'app_language';
const PREFERENCES_CACHE_KEY = 'user_preferences';

interface SettingsState {
  language: SupportedLanguage;
  isLoaded: boolean;
  
  // Server-synced preferences
  preferences: UserPreferences | null;
  preferencesLoading: boolean;

  // Actions
  setLanguage: (lang: SupportedLanguage) => Promise<void>;
  loadSettings: () => Promise<void>;
  
  // Server-synced preferences actions
  loadPreferences: () => Promise<void>;
  updatePreferences: (updates: Partial<Omit<UserPreferences, 'id' | 'user_id' | 'created_at' | 'updated_at'>>) => Promise<void>;
  resetPreferences: () => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  language: 'en',
  isLoaded: false,
  preferences: null,
  preferencesLoading: false,

  setLanguage: async (lang: SupportedLanguage) => {
    await AsyncStorage.setItem(LANGUAGE_KEY, lang);
    i18n.changeLanguage(lang);
    set({ language: lang });
    // Sync to server preferences (best-effort, non-blocking)
    try {
      const prefs = await preferencesApi.update({ language: lang });
      set({ preferences: prefs });
      await AsyncStorage.setItem(PREFERENCES_CACHE_KEY, JSON.stringify(prefs));
    } catch {
      // ignore — language is already saved locally
    }
  },

  loadSettings: async () => {
    try {
      const storedLang = await AsyncStorage.getItem(LANGUAGE_KEY);

      const lang = storedLang as SupportedLanguage;

      if (lang && (lang === 'en' || lang === 'vi')) {
        i18n.changeLanguage(lang);
        set({ language: lang, isLoaded: true });
      } else {
        set({ isLoaded: true });
      }
    } catch {
      set({ isLoaded: true });
    }
  },

  loadPreferences: async () => {
    set({ preferencesLoading: true });
    try {
      // Try loading from cache first
      const cached = await AsyncStorage.getItem(PREFERENCES_CACHE_KEY);
      if (cached) {
        set({ preferences: JSON.parse(cached) });
      }
      
      // Fetch from server
      const prefs = await preferencesApi.get();
      set({ preferences: prefs, preferencesLoading: false });
      
      // Server is the source of truth for language — always apply it.
      // setLanguage() writes it to the server, so on any device/reinstall
      // the user's chosen language is restored automatically.
      const VALID_LANGS: SupportedLanguage[] = ['en', 'vi'];
      const serverLang = prefs.language as SupportedLanguage;
      if (serverLang && VALID_LANGS.includes(serverLang)) {
        await AsyncStorage.setItem(LANGUAGE_KEY, serverLang);
        i18n.changeLanguage(serverLang);
        set({ language: serverLang });
      }
      
      // Cache
      await AsyncStorage.setItem(PREFERENCES_CACHE_KEY, JSON.stringify(prefs));
    } catch (error) {
      set({ preferencesLoading: false });
      console.error('Failed to load preferences:', error);
    }
  },

  updatePreferences: async (updates) => {
    try {
      const prefs = await preferencesApi.update(updates);
      set({ preferences: prefs });
      await AsyncStorage.setItem(PREFERENCES_CACHE_KEY, JSON.stringify(prefs));
    } catch (error) {
      console.error('Failed to update preferences:', error);
      throw error;
    }
  },

  resetPreferences: async () => {
    try {
      const prefs = await preferencesApi.reset();
      set({ preferences: prefs });
      await AsyncStorage.setItem(PREFERENCES_CACHE_KEY, JSON.stringify(prefs));
    } catch (error) {
      console.error('Failed to reset preferences:', error);
      throw error;
    }
  },
}));
