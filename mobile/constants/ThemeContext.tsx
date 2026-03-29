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
  // Backgrounds
  bg: '#f7f4f0',
  cardBg: '#ffffff',
  inputBg: '#f2efe9',
  subtleBg: '#f2efe9',
  modalBg: '#ffffff',

  // Text
  textPrimary: '#1c1814',
  textSecondary: '#5a5248',
  textTertiary: '#7a7268',
  textMuted: '#b8b0a7',
  textPlaceholder: '#c8c0b8',
  buttonText: '#FFFFFF',

  // Accent (indigo — unchanged)
  accent: '#4F46E5',
  accentLight: 'rgba(79,70,229,0.1)',
  accentMid: 'rgba(79,70,229,0.18)',
  accentSubtle: 'rgba(79,70,229,0.05)',
  brandAccent: '#b85c20',
  brandAccentLight: 'rgba(184,92,32,0.10)',

  // Semantic — unchanged
  error: '#EF4444',
  errorBg: 'rgba(239,68,68,0.06)',
  errorText: '#B91C1C',
  success: '#059669',
  successBg: 'rgba(5,150,105,0.08)',
  warning: '#D97706',
  warningBg: 'rgba(217,119,6,0.08)',
  infoBg: 'rgba(79,70,229,0.06)',

  // Borders
  border: '#ede8e2',
  borderMed: '#d8d3cc',

  // Type badges
  typeBgText: 'transparent',
  typeBgVoice: 'transparent',
  typeBgLink: 'transparent',
  typeBgPhoto: 'transparent',

  // Tab bar
  tabBarBg: 'rgba(247,244,240,0.97)',
  tabBarBorder: '#d8d3cc',

  // Switches
  switchTrackOff: '#E5E7EB',

  // Streak badge
  streakBg: 'rgba(184,92,32,0.07)',
  streakBorder: 'rgba(184,92,32,0.18)',
  streakText: '#b85c20',
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
  textTertiary: '#7a7268',
  textMuted: '#5a5248',
  textPlaceholder: '#4a4440',
  buttonText: '#FFFFFF',

  // Accent (indigo — unchanged)
  accent: '#818CF8',
  accentLight: 'rgba(129,140,248,0.14)',
  accentMid: 'rgba(129,140,248,0.22)',
  accentSubtle: 'rgba(129,140,248,0.06)',
  brandAccent: '#b85c20',
  brandAccentLight: 'rgba(184,92,32,0.10)',

  // Semantic — unchanged
  error: '#EF4444',
  errorBg: 'rgba(239,68,68,0.06)',
  errorText: '#FCA5A5',
  success: '#34D399',
  successBg: 'rgba(52,211,153,0.1)',
  warning: '#FBBF24',
  warningBg: 'rgba(251,191,36,0.1)',
  infoBg: 'rgba(129,140,248,0.1)',

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
  streakBg: 'rgba(184,92,32,0.08)',
  streakBorder: 'rgba(184,92,32,0.20)',
  streakText: '#b85c20',
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
