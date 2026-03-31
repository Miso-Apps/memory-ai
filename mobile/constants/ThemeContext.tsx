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

  // Accent
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

  // Recall banner
  recallBannerBg: string;
  recallBannerBorder: string;

  // Capture dark modal
  captureBg: string;
  captureCard: string;
  captureBorder: string;
  captureText: string;
  captureMuted: string;
  captureAccent: string;

  // Notification badge
  badgeRed: string;
}

// ─── Light theme ───────────────────────────────────────────────────────────
export const LightColors: ThemeColors = {
  // Backgrounds
  bg: '#FBF7F2',
  cardBg: '#FFFFFF',
  inputBg: '#F5F0EA',
  subtleBg: '#F5F0EA',
  modalBg: '#FFFFFF',

  // Text
  textPrimary: '#2C1810',
  textSecondary: '#5A4035',
  textTertiary: '#8B5E3C',
  textMuted: '#B89080',
  textPlaceholder: '#C8B0A0',
  buttonText: '#FFFFFF',

  // Accent
  accent: '#C2600A',
  accentLight: '#FFF3E8',
  accentMid: '#FFE5CB',
  accentSubtle: 'rgba(194,96,10,0.06)',
  brandAccent: '#C2600A',
  brandAccentLight: 'rgba(194,96,10,0.10)',

  // Semantic
  error: '#EF4444',
  errorBg: 'rgba(239,68,68,0.06)',
  errorText: '#B91C1C',
  success: '#059669',
  successBg: 'rgba(5,150,105,0.08)',
  warning: '#D97706',
  warningBg: 'rgba(217,119,6,0.08)',
  infoBg: 'rgba(194,96,10,0.06)',

  // Borders
  border: '#E8DDD0',
  borderMed: '#D4C4B0',

  // Type badges
  typeBgText: 'transparent',
  typeBgVoice: 'transparent',
  typeBgLink: 'transparent',
  typeBgPhoto: 'transparent',

  // Tab bar
  tabBarBg: 'rgba(251,247,242,0.97)',
  tabBarBorder: '#E8DDD0',

  // Switches
  switchTrackOff: '#E5E7EB',

  // Streak badge
  streakBg: 'rgba(194,96,10,0.07)',
  streakBorder: 'rgba(194,96,10,0.18)',
  streakText: '#C2600A',

  // Recall banner
  recallBannerBg: '#FFF3E8',
  recallBannerBorder: '#F0C89A',

  // Capture dark modal
  captureBg: '#FBF7F2',
  captureCard: '#FFFFFF',
  captureBorder: '#E8DDD0',
  captureText: '#2C1810',
  captureMuted: '#8B5E3C',
  captureAccent: '#C2600A',

  // Notification badge
  badgeRed: '#E8442A',
};

// ─── Dark theme ────────────────────────────────────────────────────────────
export const DarkColors: ThemeColors = {
  // Backgrounds
  bg: '#1c1814',
  cardBg: 'rgba(255,255,255,0.04)',
  inputBg: 'rgba(255,255,255,0.04)',
  subtleBg: 'rgba(255,255,255,0.03)',
  modalBg: '#241e18',

  // Text
  textPrimary: '#f0ede8',
  textSecondary: '#a09890',
  textTertiary: '#8b837a',
  textMuted: '#7b736b',
  textPlaceholder: '#716a62',
  buttonText: '#FFFFFF',

  // Accent
  accent: '#d1804a',
  accentLight: 'rgba(209,128,74,0.16)',
  accentMid: 'rgba(209,128,74,0.24)',
  accentSubtle: 'rgba(209,128,74,0.10)',
  brandAccent: '#C2600A',
  brandAccentLight: 'rgba(194,96,10,0.10)',

  // Semantic — unchanged
  error: '#EF4444',
  errorBg: 'rgba(239,68,68,0.06)',
  errorText: '#FCA5A5',
  success: '#34D399',
  successBg: 'rgba(52,211,153,0.1)',
  warning: '#FBBF24',
  warningBg: 'rgba(251,191,36,0.1)',
  infoBg: 'rgba(209,128,74,0.12)',

  // Borders
  border: 'rgba(255,255,255,0.07)',
  borderMed: 'rgba(255,255,255,0.10)',

  // Type badges
  typeBgText: 'transparent',
  typeBgVoice: 'transparent',
  typeBgLink: 'transparent',
  typeBgPhoto: 'transparent',

  // Tab bar
  tabBarBg: 'rgba(28,24,20,0.97)',
  tabBarBorder: 'rgba(255,255,255,0.08)',

  // Switches
  switchTrackOff: '#2A2A2E',

  // Streak badge
  streakBg: 'rgba(194,96,10,0.08)',
  streakBorder: 'rgba(194,96,10,0.20)',
  streakText: '#C2600A',

  // Recall banner
  recallBannerBg: 'rgba(194,96,10,0.12)',
  recallBannerBorder: 'rgba(194,96,10,0.30)',

  // Capture dark modal (same in dark mode)
  captureBg: '#1C1108',
  captureCard: 'rgba(255,255,255,0.06)',
  captureBorder: 'rgba(255,255,255,0.10)',
  captureText: '#F5EFE8',
  captureMuted: 'rgba(245,239,232,0.45)',
  captureAccent: '#E8844A',

  // Notification badge
  badgeRed: '#E8442A',
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
