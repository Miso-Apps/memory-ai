import { Platform, StyleSheet } from 'react-native';

// ─── Colours ──────────────────────────────────────────────────────────────────
export const Colors = {
  // Backgrounds
  bg: '#FFFFFF',
  cardBg: '#FFFFFF',
  inputBg: '#F4F4F5',
  subtleBg: '#FAFAFA',

  // Text
  textPrimary: '#111111',
  textSecondary: '#3F3F46',
  textTertiary: '#52525B',
  textMuted: '#71717A',
  textPlaceholder: '#A1A1AA',

  // Accent (Threads-like restrained neutral)
  accent: '#111111',
  accentLight: 'rgba(17, 17, 17, 0.14)',
  accentMid: 'rgba(17, 17, 17, 0.22)',
  accentSubtle: 'rgba(17, 17, 17, 0.06)',

  // Flat neutral palette (kept for compatibility with existing API)
  gradientPrimary: ['#111111', '#111111'],
  gradientSoft: ['#27272A', '#27272A'],

  // Semantic
  error: '#EF4444',
  errorBg: 'rgba(239, 68, 68, 0.06)',
  errorText: '#B91C1C',
  success: '#111111',
  successBg: 'rgba(17, 17, 17, 0.1)',
  warning: '#111111',
  warningBg: 'rgba(17, 17, 17, 0.1)',

  // Borders
  border: '#E4E4E7',
  borderMed: '#D4D4D8',

  // Type badges
  typeBgText: 'transparent',
  typeBgVoice: 'transparent',
  typeBgLink: 'transparent',
  typeBgPhoto: 'transparent',

  // Glass-morphism
  glassBg: 'rgba(255, 255, 255, 0.7)',
  glassBlur: 'rgba(255, 255, 255, 0.5)',
} as const;

// ─── Typography ───────────────────────────────────────────────────────────────
export const Typography = {
  pageTitle: { fontSize: 27, fontWeight: '600' as const, color: Colors.textPrimary },
  pageSubtitle: { fontSize: 14, color: Colors.textMuted },
  sectionTitle: { fontSize: 13, fontWeight: '600' as const, color: Colors.textTertiary, textTransform: 'uppercase' as const, letterSpacing: 0.5 },
  bodyLarge: { fontSize: 16, lineHeight: 24, color: Colors.textPrimary },
  body: { fontSize: 15, lineHeight: 22, color: Colors.textPrimary },
  bodySmall: { fontSize: 14, lineHeight: 20, color: Colors.textTertiary },
  caption: { fontSize: 12, color: Colors.textMuted },
  label: { fontSize: 14, fontWeight: '600' as const, color: Colors.textPrimary },
} as const;

// ─── Shadows ──────────────────────────────────────────────────────────────────
export const Shadows = {
  card: Platform.select({
    ios: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.06,
      shadowRadius: 4,
    },
    android: { elevation: 2 },
  }),
  elevated: Platform.select({
    ios: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.1,
      shadowRadius: 8,
    },
    android: { elevation: 6 },
  }),
} as const;

// ─── Shared component styles ──────────────────────────────────────────────────
export const Shared = StyleSheet.create({
  // Page wrappers
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 8,
  },
  pageTitle: {
    fontSize: 26,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  pageSubtitle: {
    fontSize: 13,
    color: Colors.textMuted,
  },

  // Cards
  card: {
    backgroundColor: Colors.cardBg,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 4,
      },
      android: { elevation: 2 },
    }),
  },

  // Search bar
  searchBar: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    height: 44,
    backgroundColor: Colors.cardBg,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 14,
  },

  // Chip (filter pill)
  chip: {
    height: 34,
    paddingHorizontal: 16,
    borderRadius: 17,
    backgroundColor: Colors.cardBg,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  chipActive: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: Colors.textTertiary,
  },
  chipTextActive: {
    color: '#FFFFFF',
  },

  // Action pill button
  actionPill: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingVertical: 13,
    borderRadius: 999,
  },

  // Divider
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.border,
  },

  // Row separator in lists (indented to align with text)
  listSeparator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.border,
    marginLeft: 58,
  },
});
