import React, { createContext, useContext, useMemo } from 'react';
import { useColorScheme, Platform, StyleSheet } from 'react-native';
import { useSettingsStore } from '../store/settingsStore';

// ─── Theme mode types ──────────────────────────────────────────────────────
export type ThemeMode = 'light' | 'dark' | 'auto';
export type ResolvedTheme = 'light' | 'dark';

// ─── Color tokens ──────────────────────────────────────────────────────────
export interface ThemeColors {
  // Backgrounds
  bg: string;
  cardBg: string;
  inputBg: string;
  subtleBg: string;
  modalBg: string;

  // Text
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
  textMuted: string;
  textPlaceholder: string;

  // Accent (indigo — same in both themes)
  accent: string;
  accentLight: string;
  accentMid: string;
  accentSubtle: string;

  // Semantic
  error: string;
  errorBg: string;
  errorText: string;
  success: string;
  warning: string;

  // Borders
  border: string;
  borderMed: string;

  // Type badges
  typeBgText: string;
  typeBgVoice: string;
  typeBgLink: string;
  typeBgPhoto: string;

  // Tab bar
  tabBarBg: string;
  tabBarBorder: string;

  // Switches
  switchTrackOff: string;

  // Streak badge
  streakBg: string;
  streakBorder: string;
  streakText: string;
}

// ─── Light theme ───────────────────────────────────────────────────────────
export const LightColors: ThemeColors = {
  bg: '#F9FAFB',
  cardBg: '#FFFFFF',
  inputBg: '#F3F4F6',
  subtleBg: '#F0F0F0',
  modalBg: '#FFFFFF',

  textPrimary: '#111827',
  textSecondary: '#374151',
  textTertiary: '#6B7280',
  textMuted: '#9CA3AF',
  textPlaceholder: '#9CA3AF',

  accent: '#6366F1',
  accentLight: 'rgba(99, 102, 241, 0.1)',
  accentMid: 'rgba(99, 102, 241, 0.15)',
  accentSubtle: 'rgba(99, 102, 241, 0.05)',

  error: '#EF4444',
  errorBg: 'rgba(239, 68, 68, 0.06)',
  errorText: '#B91C1C',
  success: '#10B981',
  warning: '#F59E0B',

  border: '#F0F0F0',
  borderMed: '#E5E7EB',

  typeBgText: '#EEF2FF',
  typeBgVoice: '#F0FDF4',
  typeBgLink: '#FFF7ED',
  typeBgPhoto: '#FDF2F8',

  tabBarBg: '#FFFFFF',
  tabBarBorder: '#F3F4F6',

  switchTrackOff: '#E5E7EB',

  streakBg: '#FEF3C7',
  streakBorder: '#FDE68A',
  streakText: '#D97706',
};

// ─── Dark theme ────────────────────────────────────────────────────────────
export const DarkColors: ThemeColors = {
  bg: '#0F1117',
  cardBg: '#1A1D27',
  inputBg: '#252833',
  subtleBg: '#1E2028',
  modalBg: '#1A1D27',

  textPrimary: '#F3F4F6',
  textSecondary: '#D1D5DB',
  textTertiary: '#9CA3AF',
  textMuted: '#6B7280',
  textPlaceholder: '#6B7280',

  accent: '#818CF8',
  accentLight: 'rgba(129, 140, 248, 0.15)',
  accentMid: 'rgba(129, 140, 248, 0.2)',
  accentSubtle: 'rgba(129, 140, 248, 0.08)',

  error: '#F87171',
  errorBg: 'rgba(248, 113, 113, 0.1)',
  errorText: '#FCA5A5',
  success: '#34D399',
  warning: '#FBBF24',

  border: '#2A2D3A',
  borderMed: '#3A3D4A',

  typeBgText: 'rgba(129, 140, 248, 0.12)',
  typeBgVoice: 'rgba(52, 211, 153, 0.12)',
  typeBgLink: 'rgba(251, 191, 36, 0.12)',
  typeBgPhoto: 'rgba(244, 114, 182, 0.12)',

  tabBarBg: '#1A1D27',
  tabBarBorder: '#2A2D3A',

  switchTrackOff: '#3A3D4A',

  streakBg: 'rgba(217, 119, 6, 0.15)',
  streakBorder: 'rgba(217, 119, 6, 0.3)',
  streakText: '#FBBF24',
};

// ─── Context ───────────────────────────────────────────────────────────────
interface ThemeContextValue {
  colors: ThemeColors;
  isDark: boolean;
  mode: ThemeMode;
}

const ThemeContext = createContext<ThemeContextValue>({
  colors: LightColors,
  isDark: false,
  mode: 'auto',
});

// ─── Provider ──────────────────────────────────────────────────────────────
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const preferences = useSettingsStore((s) => s.preferences);
  const themeMode: ThemeMode = (preferences?.theme_mode as ThemeMode) ?? 'auto';

  const isDark = useMemo(() => {
    if (themeMode === 'dark') return true;
    if (themeMode === 'light') return false;
    return systemScheme === 'dark';
  }, [themeMode, systemScheme]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      colors: isDark ? DarkColors : LightColors,
      isDark,
      mode: themeMode,
    }),
    [isDark, themeMode],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

// ─── Hook ──────────────────────────────────────────────────────────────────
export function useTheme() {
  return useContext(ThemeContext);
}
