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
  bg: '#faf9f7',                          // was #FFFFFF (warm off-white)
  cardBg: '#ffffff',                      // pure white card on warm bg
  inputBg: '#f2efe9',                     // was #F4F4F5 (warm tint)
  subtleBg: '#f5f3ef',
  modalBg: '#ffffff',

  // Text
  textPrimary: '#1a1612',                 // was #111111 (warm near-black)
  textSecondary: '#5a5550',               // was #3F3F46
  textTertiary: '#7a746e',                // was #52525B
  textMuted: '#9e9894',                   // was #71717A
  textPlaceholder: '#b8b3ac',             // was #A1A1AA
  buttonText: '#FFFFFF',

  // Accent (indigo — keep unchanged)
  accent: '#4F46E5',
  accentLight: 'rgba(79,70,229,0.1)',
  accentMid: 'rgba(79,70,229,0.18)',
  accentSubtle: 'rgba(79,70,229,0.05)',
  brandAccent: '#C56A3A',
  brandAccentLight: 'rgba(197,106,58,0.1)',

  // Semantic
  error: '#EF4444',
  errorBg: 'rgba(239,68,68,0.06)',
  errorText: '#B91C1C',
  success: '#059669',
  successBg: 'rgba(5,150,105,0.08)',
  warning: '#D97706',
  warningBg: 'rgba(217,119,6,0.08)',
  infoBg: 'rgba(79,70,229,0.06)',

  // Borders
  border: '#ebe8e3',                      // was #E4E4E7 (warm hairline)
  borderMed: '#dedad4',                   // was #D4D4D8

  // Type badges
  typeBgText: 'transparent',
  typeBgVoice: 'transparent',
  typeBgLink: 'transparent',
  typeBgPhoto: 'transparent',

  // Tab bar
  tabBarBg: 'rgba(250,249,247,0.96)',     // was rgba(255,255,255,0.95)
  tabBarBorder: '#ebe8e3',

  // Switches
  switchTrackOff: '#E5E7EB',

  // Streak badge
  streakBg: 'rgba(197,106,58,0.07)',
  streakBorder: 'rgba(197,106,58,0.18)',
  streakText: '#C56A3A',
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
