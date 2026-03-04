import { Platform, StyleSheet } from 'react-native';

// ─── Colours ──────────────────────────────────────────────────────────────────
export const Colors = {
  // Backgrounds
  bg: '#F9FAFB',
  cardBg: '#FFFFFF',
  inputBg: '#F3F4F6',
  subtleBg: '#F0F0F0',

  // Text
  textPrimary: '#111827',
  textSecondary: '#374151',
  textTertiary: '#6B7280',
  textMuted: '#9CA3AF',
  textPlaceholder: '#9CA3AF',

  // Accent (indigo — consistent with profile)
  accent: '#6366F1',
  accentLight: 'rgba(99, 102, 241, 0.1)',
  accentMid: 'rgba(99, 102, 241, 0.15)',
  accentSubtle: 'rgba(99, 102, 241, 0.05)',

  // Semantic
  error: '#EF4444',
  errorBg: 'rgba(239, 68, 68, 0.06)',
  errorText: '#B91C1C',
  success: '#10B981',
  warning: '#F59E0B',

  // Borders
  border: '#F0F0F0',
  borderMed: '#E5E7EB',

  // Type badges (light bg per memory type)
  typeBgText: '#EEF2FF',
  typeBgVoice: '#F0FDF4',
  typeBgLink: '#FFF7ED',
} as const;

// ─── Typography ───────────────────────────────────────────────────────────────
export const Typography = {
  pageTitle: { fontSize: 26, fontWeight: '600' as const, color: Colors.textPrimary },
  pageSubtitle: { fontSize: 13, color: Colors.textMuted },
  sectionTitle: { fontSize: 13, fontWeight: '600' as const, color: Colors.textTertiary, textTransform: 'uppercase' as const, letterSpacing: 0.5 },
  bodyLarge: { fontSize: 17, lineHeight: 26, color: Colors.textPrimary },
  body: { fontSize: 15, lineHeight: 22, color: Colors.textPrimary },
  bodySmall: { fontSize: 13, lineHeight: 18, color: Colors.textTertiary },
  caption: { fontSize: 12, color: Colors.textMuted },
  label: { fontSize: 14, fontWeight: '500' as const, color: Colors.textPrimary },
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
