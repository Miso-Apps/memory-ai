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
  buttonText: string;

  // Accent (indigo — same in both themes)
  accent: string;
  accentLight: string;
  accentMid: string;
  accentSubtle: string;
  brandAccent: string;
  brandAccentLight: string;

  // Semantic
  error: string;
  errorBg: string;
  errorText: string;
  success: string;
  successBg: string;
  warning: string;
  warningBg: string;
  infoBg: string;

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
  bg: '#FFFFFF',
  cardBg: '#FFFFFF',
  inputBg: '#F4F4F5',
  subtleBg: '#FAFAFA',
  modalBg: '#FFFFFF',

  textPrimary: '#111111',
  textSecondary: '#3F3F46',
  textTertiary: '#52525B',
  textMuted: '#71717A',
  textPlaceholder: '#A1A1AA',
  buttonText: '#FFFFFF',

  accent: '#111111',
  accentLight: 'rgba(17, 17, 17, 0.14)',
  accentMid: 'rgba(17, 17, 17, 0.22)',
  accentSubtle: 'rgba(17, 17, 17, 0.06)',
  brandAccent: '#C56A3A',
  brandAccentLight: 'rgba(197, 106, 58, 0.16)',

  error: '#EF4444',
  errorBg: 'rgba(239, 68, 68, 0.06)',
  errorText: '#B91C1C',
  success: '#111111',
  successBg: 'rgba(16, 185, 129, 0.1)',
  warning: '#111111',
  warningBg: 'rgba(245, 158, 11, 0.1)',
  infoBg: 'rgba(99, 102, 241, 0.1)',

  border: '#E4E4E7',
  borderMed: '#D4D4D8',

  typeBgText: 'transparent',
  typeBgVoice: 'transparent',
  typeBgLink: 'transparent',
  typeBgPhoto: 'transparent',

  tabBarBg: 'rgba(255,255,255,0.95)',
  tabBarBorder: '#E4E4E7',

  switchTrackOff: '#E5E7EB',

  streakBg: 'rgba(24, 24, 27, 0.08)',
  streakBorder: 'rgba(24, 24, 27, 0.16)',
  streakText: '#111111',
};

// ─── Dark theme ────────────────────────────────────────────────────────────
export const DarkColors: ThemeColors = {
  // Backgrounds
  bg: '#0c0c10',
  cardBg: '#131318',
  inputBg: 'rgba(255,255,255,0.04)',
  subtleBg: '#0f0f14',
  modalBg: '#131318',

  // Text
  textPrimary: '#f0ede8',
  textSecondary: '#a8a4a0',
  textTertiary: '#777370',
  textMuted: '#555555',
  textPlaceholder: '#333333',
  buttonText: '#FFFFFF',

  // Accent (indigo — keep unchanged)
  accent: '#818CF8',
  accentLight: 'rgba(129,140,248,0.14)',
  accentMid: 'rgba(129,140,248,0.22)',
  accentSubtle: 'rgba(129,140,248,0.06)',
  brandAccent: '#C56A3A',
  brandAccentLight: 'rgba(197,106,58,0.12)',

  // Semantic
  error: '#EF4444',
  errorBg: 'rgba(239,68,68,0.06)',
  errorText: '#FCA5A5',
  success: '#34D399',
  successBg: 'rgba(52,211,153,0.1)',
  warning: '#FBBF24',
  warningBg: 'rgba(251,191,36,0.1)',
  infoBg: 'rgba(129,140,248,0.1)',

  // Borders
  border: 'rgba(255,255,255,0.05)',
  borderMed: 'rgba(255,255,255,0.08)',

  // Type badges (keep transparent)
  typeBgText: 'transparent',
  typeBgVoice: 'transparent',
  typeBgLink: 'transparent',
  typeBgPhoto: 'transparent',

  // Tab bar
  tabBarBg: 'rgba(12,12,16,0.97)',
  tabBarBorder: 'rgba(255,255,255,0.05)',

  // Switches
  switchTrackOff: '#2A2A2E',

  // Streak badge
  streakBg: 'rgba(197,106,58,0.08)',
  streakBorder: 'rgba(197,106,58,0.2)',
  streakText: '#C56A3A',
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
