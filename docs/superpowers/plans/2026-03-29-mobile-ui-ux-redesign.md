# Mobile UI/UX Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the DukiAI Memory mobile app with a Threads × Anthropic aesthetic — near-black dark palette with warm off-white text, DM Serif Display italic headers, DM Sans body, and a shared MemoryCard component with inline thumbnails across all 6 screens.

**Architecture:** Design system first (color tokens → fonts → shared components), then navigation shell, then screens in dependency order. All screens use the same `MemoryCard`, `ScreenHeader`, and `CapturePrompt` components. No backend changes required — thumbnail data is already in the API response.

**Tech Stack:** React Native (Expo 51), `@expo-google-fonts/dm-serif-display`, `@expo-google-fonts/dm-sans`, `expo-font`, existing `ThemeContext`, `expo-router`, `react-i18next`

---

## File Map

**Create:**
- `mobile/components/SerifTitle.tsx` — DM Serif Display italic wrapper
- `mobile/components/ScreenHeader.tsx` — eyebrow + serif title + subtitle
- `mobile/components/CapturePrompt.tsx` — tappable inline prompt for home screen
- `mobile/components/MemoryCard.tsx` — shared memory card with thumbnail support

**Modify:**
- `mobile/package.json` — add font packages
- `mobile/app/_layout.tsx` — load fonts at root
- `mobile/constants/ThemeContext.tsx` — updated color tokens (dark + light)
- `mobile/app/(tabs)/_layout.tsx` — nav shell changes
- `mobile/app/(tabs)/home.tsx` — new header + capture prompt + MemoryCard sections
- `mobile/app/(tabs)/library.tsx` — new header + search + chips + MemoryCard list
- `mobile/app/capture.tsx` — mode tab styles + quick-tag hints row
- `mobile/app/memory/[id].tsx` — new header + AI summary card + action row
- `mobile/app/(tabs)/insights.tsx` — streak card + orange heatmap + recap card
- `mobile/app/(tabs)/profile.tsx` — serif header + grouped settings polish
- `mobile/i18n/locales/en.ts` — new strings
- `mobile/i18n/locales/vi.ts` — Vietnamese translations for new strings

---

## Task 1: Install fonts

**Files:**
- Modify: `mobile/package.json`
- Modify: `mobile/app/_layout.tsx`

- [ ] **Step 1: Install font packages**

```bash
cd mobile && npx expo install @expo-google-fonts/dm-serif-display @expo-google-fonts/dm-sans expo-font
```

Expected: packages added to `package.json`, no errors.

- [ ] **Step 2: Add font loading to root layout**

In `mobile/app/_layout.tsx`, add these imports after the existing imports:

```tsx
import { useFonts } from 'expo-font';
import { DMSerifDisplay_400Italic } from '@expo-google-fonts/dm-serif-display';
import {
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_600SemiBold,
} from '@expo-google-fonts/dm-sans';
```

Replace the `RootLayout` function with:

```tsx
export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    DMSerifDisplay_400Italic,
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_600SemiBold,
  });

  if (!fontsLoaded) return null;

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <ThemedStatusBar />
          <AuthGate>
            <ThemedStack />
          </AuthGate>
        </ThemeProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
```

- [ ] **Step 3: Type-check**

```bash
cd mobile && npm run type-check
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
cd mobile && git add package.json app/_layout.tsx && git commit -m "feat: install DM Serif Display + DM Sans fonts"
```

---

## Task 2: Update dark theme color tokens

**Files:**
- Modify: `mobile/constants/ThemeContext.tsx`

- [ ] **Step 1: Update `DarkColors` in ThemeContext**

In `mobile/constants/ThemeContext.tsx`, replace the `DarkColors` object's values with the following changes (keep any tokens not listed here unchanged):

```tsx
export const DarkColors: ThemeColors = {
  // Backgrounds
  bg: '#0c0c10',                          // was #09090B
  cardBg: '#131318',                      // was #131316
  inputBg: 'rgba(255,255,255,0.04)',      // was #1B1B20
  subtleBg: '#0f0f14',                    // was #18181B
  modalBg: '#131318',                     // was #1C1C1F

  // Text
  textPrimary: '#f0ede8',                 // was #F4F4F5 (cold white → warm off-white)
  textSecondary: '#a8a4a0',               // was #A1A1AA
  textTertiary: '#777370',                // was #71717A
  textMuted: '#555555',                   // was #71717A
  textPlaceholder: '#333333',             // was #52525B
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
  border: 'rgba(255,255,255,0.05)',       // was #27272A
  borderMed: 'rgba(255,255,255,0.08)',    // was #3F3F46

  // Type badges (keep transparent)
  typeBgText: 'transparent',
  typeBgVoice: 'transparent',
  typeBgLink: 'transparent',
  typeBgPhoto: 'transparent',

  // Tab bar
  tabBarBg: 'rgba(12,12,16,0.97)',        // was rgba(9,9,11,0.95)
  tabBarBorder: 'rgba(255,255,255,0.05)',

  // Switches
  switchTrackOff: '#2A2A2E',

  // Streak badge
  streakBg: 'rgba(197,106,58,0.08)',
  streakBorder: 'rgba(197,106,58,0.2)',
  streakText: '#C56A3A',
};
```

- [ ] **Step 2: Type-check**

```bash
cd mobile && npm run type-check
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd mobile && git add constants/ThemeContext.tsx && git commit -m "feat: update dark theme color tokens to warm palette"
```

---

## Task 3: Update light theme color tokens

**Files:**
- Modify: `mobile/constants/ThemeContext.tsx`

- [ ] **Step 1: Update `LightColors` in ThemeContext**

In `mobile/constants/ThemeContext.tsx`, replace the `LightColors` object with:

```tsx
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
```

- [ ] **Step 2: Type-check**

```bash
cd mobile && npm run type-check
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd mobile && git add constants/ThemeContext.tsx && git commit -m "feat: update light theme to warm off-white palette"
```

---

## Task 4: Create SerifTitle component

**Files:**
- Create: `mobile/components/SerifTitle.tsx`

- [ ] **Step 1: Create the component**

Create `mobile/components/SerifTitle.tsx`:

```tsx
import React from 'react';
import { Text, StyleProp, TextStyle } from 'react-native';
import { useTheme } from '../constants/ThemeContext';

interface SerifTitleProps {
  children: React.ReactNode;
  size?: number;
  style?: StyleProp<TextStyle>;
}

export function SerifTitle({ children, size = 32, style }: SerifTitleProps) {
  const { colors } = useTheme();
  return (
    <Text
      style={[
        {
          fontFamily: 'DMSerifDisplay_400Italic',
          fontSize: size,
          color: colors.textPrimary,
          lineHeight: size * 1.15,
          letterSpacing: -0.2,
        },
        style,
      ]}
    >
      {children}
    </Text>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
cd mobile && npm run type-check
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd mobile && git add components/SerifTitle.tsx && git commit -m "feat: add SerifTitle component (DM Serif Display italic)"
```

---

## Task 5: Create ScreenHeader component

**Files:**
- Create: `mobile/components/ScreenHeader.tsx`

- [ ] **Step 1: Create the component**

Create `mobile/components/ScreenHeader.tsx`:

```tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../constants/ThemeContext';
import { SerifTitle } from './SerifTitle';

interface ScreenHeaderProps {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  titleSize?: number;
  paddingHorizontal?: number;
}

export function ScreenHeader({
  eyebrow,
  title,
  subtitle,
  titleSize = 32,
  paddingHorizontal = 20,
}: ScreenHeaderProps) {
  const { colors } = useTheme();

  return (
    <View style={[styles.container, { paddingHorizontal }]}>
      {eyebrow ? (
        <Text style={[styles.eyebrow, { color: colors.brandAccent }]}>
          {eyebrow.toUpperCase()}
        </Text>
      ) : null}
      <SerifTitle size={titleSize}>{title}</SerifTitle>
      {subtitle ? (
        <Text style={[styles.subtitle, { color: colors.textMuted }]}>{subtitle}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: 16,
    paddingBottom: 12,
  },
  eyebrow: {
    fontFamily: 'DMSans_600SemiBold',
    fontSize: 10,
    letterSpacing: 1,
    marginBottom: 6,
  },
  subtitle: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 13,
    marginTop: 4,
    lineHeight: 18,
  },
});
```

- [ ] **Step 2: Type-check**

```bash
cd mobile && npm run type-check
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd mobile && git add components/ScreenHeader.tsx && git commit -m "feat: add ScreenHeader component"
```

---

## Task 6: Create CapturePrompt component

**Files:**
- Create: `mobile/components/CapturePrompt.tsx`
- Modify: `mobile/i18n/locales/en.ts`
- Modify: `mobile/i18n/locales/vi.ts`

- [ ] **Step 1: Add i18n strings to en.ts**

In `mobile/i18n/locales/en.ts`, add inside the `home` key (create the key if it doesn't exist, or add to existing):

```ts
home: {
  // ...existing keys...
  capturePromptText: "What's on your mind today?",
  capturePromptA11y: 'Capture a new memory',
},
```

- [ ] **Step 2: Add i18n strings to vi.ts**

In `mobile/i18n/locales/vi.ts`, add the matching keys under `home`:

```ts
home: {
  // ...existing keys...
  capturePromptText: 'Bạn đang nghĩ gì hôm nay?',
  capturePromptA11y: 'Lưu một ký ức mới',
},
```

- [ ] **Step 3: Create the component**

Create `mobile/components/CapturePrompt.tsx`:

```tsx
import React from 'react';
import { TouchableOpacity, View, Text, StyleSheet, Platform } from 'react-native';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../constants/ThemeContext';

export function CapturePrompt() {
  const { colors } = useTheme();
  const { t } = useTranslation();

  const handlePress = () => {
    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } else {
      Haptics.selectionAsync();
    }
    router.push('/capture');
  };

  return (
    <TouchableOpacity
      onPress={handlePress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={t('home.capturePromptA11y')}
      style={[
        styles.container,
        {
          borderColor: colors.border,
          backgroundColor: 'rgba(255,255,255,0.03)',
        },
      ]}
    >
      <View style={[styles.dot, { backgroundColor: colors.brandAccent }]} />
      <Text style={[styles.text, { color: colors.textPlaceholder }]}>
        {t('home.capturePromptText')}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginTop: 12,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  text: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 14,
    fontStyle: 'italic',
  },
});
```

- [ ] **Step 4: Verify i18n parity**

```bash
cd mobile && npm run i18n:check
```

Expected: no parity errors.

- [ ] **Step 5: Type-check**

```bash
cd mobile && npm run type-check
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
cd mobile && git add components/CapturePrompt.tsx i18n/locales/en.ts i18n/locales/vi.ts && git commit -m "feat: add CapturePrompt component + i18n strings"
```

---

## Task 7: Create MemoryCard component

**Files:**
- Create: `mobile/components/MemoryCard.tsx`
- Modify: `mobile/i18n/locales/en.ts`
- Modify: `mobile/i18n/locales/vi.ts`

- [ ] **Step 1: Add i18n strings**

In `mobile/i18n/locales/en.ts`, add inside the `common` key:

```ts
common: {
  // ...existing keys...
  openMemory: 'Open',
  dismissMemory: 'Dismiss',
},
```

In `mobile/i18n/locales/vi.ts`, add the matching keys:

```ts
common: {
  // ...existing keys...
  openMemory: 'Mở',
  dismissMemory: 'Bỏ qua',
},
```

- [ ] **Step 2: Create the component**

Create `mobile/components/MemoryCard.tsx`:

```tsx
import React from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../constants/ThemeContext';

export interface MemoryCardMemory {
  id: string;
  content: string;
  type: 'text' | 'link' | 'voice' | 'photo';
  createdAt: Date;
  imageUrl?: string;
  thumbnailUrl?: string;
  linkPreviewUrl?: string;
  sourceUrl?: string;
  aiSummary?: string;
}

interface MemoryCardProps {
  memory: MemoryCardMemory;
  tag?: string;
  timeAgo?: string;
  onPress: () => void;
  onDismiss?: () => void;
}

function pickThumbUrl(memory: MemoryCardMemory): string | undefined {
  const candidates = [memory.thumbnailUrl, memory.imageUrl, memory.linkPreviewUrl];
  return candidates.find(
    (v) => typeof v === 'string' && /^(https?:\/\/|file:\/\/|content:\/\/|\/)/i.test(v)
  );
}

function extractDomain(url?: string): string | undefined {
  if (!url) return undefined;
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return undefined;
  }
}

const TYPE_LABEL: Record<MemoryCardMemory['type'], string> = {
  text: '✏ text',
  voice: '🎙 voice',
  link: '🔗 link',
  photo: '📷 photo',
};

export function MemoryCard({ memory, tag, timeAgo, onPress, onDismiss }: MemoryCardProps) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const thumbUrl = pickThumbUrl(memory);
  const domain = memory.type === 'link' ? extractDomain(memory.sourceUrl) : undefined;
  const displayText = memory.aiSummary || memory.content;

  const handlePress = () => {
    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } else {
      Haptics.selectionAsync();
    }
    onPress();
  };

  const handleDismiss = () => {
    if (onDismiss) {
      if (Platform.OS === 'ios') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } else {
        Haptics.selectionAsync();
      }
      onDismiss();
    }
  };

  return (
    <TouchableOpacity
      onPress={handlePress}
      activeOpacity={0.75}
      style={[
        styles.card,
        { backgroundColor: colors.inputBg, borderColor: colors.border },
      ]}
    >
      {/* Top row: tag + type */}
      <View style={styles.topRow}>
        {tag ? (
          <View style={[styles.tagPill, { backgroundColor: colors.brandAccentLight }]}>
            <Text style={[styles.tagText, { color: colors.brandAccent }]}>
              {tag.toUpperCase()}
            </Text>
          </View>
        ) : null}
        <Text style={[styles.typeLabel, { color: colors.textMuted }]}>
          {TYPE_LABEL[memory.type]}
        </Text>
      </View>

      {/* Body row: text + thumbnail */}
      <View style={styles.bodyRow}>
        <View style={styles.textWrap}>
          <Text
            style={[styles.bodyText, { color: colors.textSecondary }]}
            numberOfLines={3}
          >
            {displayText}
          </Text>
          {domain ? (
            <View style={styles.domainRow}>
              <View style={[styles.favicon, { backgroundColor: colors.border }]} />
              <Text style={[styles.domainText, { color: colors.textMuted }]}>{domain}</Text>
            </View>
          ) : null}
        </View>
        {thumbUrl ? (
          <Image
            source={{ uri: thumbUrl }}
            style={[styles.thumb, { borderColor: colors.border }]}
            resizeMode="cover"
          />
        ) : null}
      </View>

      {/* Footer: time + actions */}
      <View style={styles.footer}>
        <Text style={[styles.timeText, { color: colors.textMuted }]}>{timeAgo ?? ''}</Text>
        <View style={styles.footerActions}>
          {onDismiss ? (
            <TouchableOpacity onPress={handleDismiss} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={[styles.dismissText, { color: colors.textMuted }]}>
                {t('common.dismissMemory')}
              </Text>
            </TouchableOpacity>
          ) : null}
          <Text style={[styles.openText, { color: colors.brandAccent }]}>
            {t('common.openMemory')} →
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    marginBottom: 8,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 7,
  },
  tagPill: {
    borderRadius: 100,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  tagText: {
    fontFamily: 'DMSans_600SemiBold',
    fontSize: 9,
    letterSpacing: 0.5,
  },
  typeLabel: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  bodyRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
  },
  textWrap: {
    flex: 1,
  },
  bodyText: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 14,
    lineHeight: 21,
  },
  domainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 5,
  },
  favicon: {
    width: 12,
    height: 12,
    borderRadius: 2,
  },
  domainText: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 10,
  },
  thumb: {
    width: 48,
    height: 48,
    borderRadius: 8,
    borderWidth: 1,
    flexShrink: 0,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  timeText: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 10,
  },
  footerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  dismissText: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 11,
  },
  openText: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 11,
  },
});
```

- [ ] **Step 3: Verify i18n parity**

```bash
cd mobile && npm run i18n:check
```

Expected: no parity errors.

- [ ] **Step 4: Type-check**

```bash
cd mobile && npm run type-check
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
cd mobile && git add components/MemoryCard.tsx i18n/locales/en.ts i18n/locales/vi.ts && git commit -m "feat: add MemoryCard component with thumbnail support"
```

---

## Task 8: Update navigation shell

**Files:**
- Modify: `mobile/app/(tabs)/_layout.tsx`

- [ ] **Step 1: Update TabIcon active state and tab bar sizing**

In `mobile/app/(tabs)/_layout.tsx`, make the following targeted changes:

**Replace the `TabIcon` function** with:

```tsx
function TabIcon({
  Icon,
  focused,
  size = 20,
}: {
  Icon: LucideIcon;
  focused: boolean;
  size?: number;
}) {
  const { colors } = useTheme();
  const scaleAnim = React.useRef(new Animated.Value(focused ? 1 : 0.98)).current;
  const opacityAnim = React.useRef(new Animated.Value(focused ? 1 : 0)).current;

  React.useEffect(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: focused ? 1 : 0.98,
        useNativeDriver: true,
        tension: 260,
        friction: 18,
      }),
      Animated.timing(opacityAnim, {
        toValue: focused ? 1 : 0,
        duration: 170,
        useNativeDriver: true,
      }),
    ]).start();
  }, [focused]);

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <View style={styles.iconContainer}>
        <Animated.View
          style={[
            styles.iconBackground,
            {
              backgroundColor: colors.brandAccentLight,  // orange tint (was accentLight indigo)
              opacity: opacityAnim,
            },
          ]}
        />
        <Icon
          size={size}
          color={focused ? colors.textPrimary : '#2a2a2a'}  // warm off-white active, dark inactive
          strokeWidth={focused ? 2.5 : 1.8}
        />
      </View>
    </Animated.View>
  );
}
```

**Replace the `tabBarStyle` object** inside `screenOptions` with:

```tsx
tabBarStyle: {
  backgroundColor: colors.tabBarBg,
  borderTopWidth: 0,
  borderRadius: 24,
  marginHorizontal: 14,
  marginBottom: Platform.OS === 'ios' ? 16 : 12,
  height: Platform.OS === 'ios' ? 84 : 78,   // was 78/72
  paddingTop: 8,
  paddingBottom: Platform.OS === 'ios' ? 8 : 7,
  position: 'absolute',
  ...Platform.select({
    ios: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.12,
      shadowRadius: 16,
    },
    android: {
      elevation: 10,
    },
  }),
},
```

**Replace the `createBtn` style** in the `StyleSheet.create` at the bottom with:

```tsx
createBtn: {
  width: 44,
  height: 44,
  borderRadius: 22,
  alignItems: 'center',
  justifyContent: 'center',
  shadowColor: '#C56A3A',             // warm glow shadow (was generic color)
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.35,                // was 0.24
  shadowRadius: 10,
  elevation: 6,
},
```

- [ ] **Step 2: Update `tabBarActiveTintColor`**

In the `screenOptions`, update:

```tsx
tabBarActiveTintColor: colors.textPrimary,   // was colors.accent (indigo)
tabBarInactiveTintColor: '#2a2a2a',          // was colors.textMuted
```

- [ ] **Step 3: Type-check**

```bash
cd mobile && npm run type-check
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
cd mobile && git add app/\(tabs\)/_layout.tsx && git commit -m "feat: update nav shell — orange active tint, taller pill, warm glow FAB"
```

---

## Task 9: Redesign Home screen header + capture prompt

**Files:**
- Modify: `mobile/app/(tabs)/home.tsx`
- Modify: `mobile/i18n/locales/en.ts`
- Modify: `mobile/i18n/locales/vi.ts`

- [ ] **Step 1: Add i18n strings**

Note: `capturePromptText` and `capturePromptA11y` were already added under `home` in Task 6. Add only the new keys here.

In `mobile/i18n/locales/en.ts`, add inside the existing `home` key:

```ts
home: {
  // ...keys added in Task 6 (capturePromptText, capturePromptA11y) already present...
  greetingMorning: 'Good morning',
  greetingAfternoon: 'Good afternoon',
  greetingEvening: 'Good evening',
  titleMorning: "What's on your mind?",
  titleAfternoon: 'Welcome back',
  titleEvening: 'End of day reflection',
  sectionRecalled: 'Recalled for you',
  sectionOnThisDay: 'On this day',
  sectionUnreviewed: 'Unreviewed',
},
```

In `mobile/i18n/locales/vi.ts`, add the matching keys:

```ts
home: {
  // ...keys added in Task 6 already present...
  greetingMorning: 'Chào buổi sáng',
  greetingAfternoon: 'Xin chào',
  greetingEvening: 'Chào buổi tối',
  titleMorning: 'Bạn đang nghĩ gì?',
  titleAfternoon: 'Chào mừng trở lại',
  titleEvening: 'Nhìn lại cuối ngày',
  sectionRecalled: 'Được gợi nhớ',
  sectionOnThisDay: 'Ngày này năm xưa',
  sectionUnreviewed: 'Chưa xem',
},
```

- [ ] **Step 2: Add greeting helper and import components**

At the top of `mobile/app/(tabs)/home.tsx`, add these imports after existing imports:

```tsx
import { ScreenHeader } from '../../components/ScreenHeader';
import { CapturePrompt } from '../../components/CapturePrompt';
import { MemoryCard, type MemoryCardMemory } from '../../components/MemoryCard';
```

After the `BRAND_ORANGE` constant, add the greeting helper:

```tsx
function getGreeting(t: Function): { eyebrow: string; title: string } {
  const hour = new Date().getHours();
  if (hour < 12) return { eyebrow: t('home.greetingMorning'), title: t('home.titleMorning') };
  if (hour < 17) return { eyebrow: t('home.greetingAfternoon'), title: t('home.titleAfternoon') };
  return { eyebrow: t('home.greetingEvening'), title: t('home.titleEvening') };
}
```

- [ ] **Step 3: Replace the home screen header section**

Find the section in `HomeScreen` (or the main exported component) that renders the header/greeting — it currently has a `BrandMark` or title at the top. Replace just that header block with:

```tsx
{/* ── Header ── */}
{(() => {
  const { eyebrow, title } = getGreeting(t);
  return (
    <View style={[styles.headerWrap, { borderBottomColor: colors.border }]}>
      <ScreenHeader
        eyebrow={eyebrow}
        title={title}
        titleSize={30}
        paddingHorizontal={20}
      />
      <View style={{ paddingHorizontal: 20, paddingBottom: 14 }}>
        <CapturePrompt />
      </View>
    </View>
  );
})()}
```

Add to `StyleSheet.create`:

```tsx
headerWrap: {
  borderBottomWidth: StyleSheet.hairlineWidth,
},
```

- [ ] **Step 4: Update section labels to use i18n keys**

In the recalled section rendering, change any hardcoded section label strings to use:
- `t('home.sectionRecalled')` for the AI recalled section
- `t('home.sectionOnThisDay')` for on-this-day memories
- `t('home.sectionUnreviewed')` for unreviewed memories

Update section label `Text` styles to use:
```tsx
style={[styles.sectionLabel, { color: colors.textMuted }]}
```

Add to `StyleSheet.create`:
```tsx
sectionLabel: {
  fontFamily: 'DMSans_600SemiBold',
  fontSize: 10,
  textTransform: 'uppercase',
  letterSpacing: 1,
  marginBottom: 10,
  paddingHorizontal: 16,
  marginTop: 16,
},
```

- [ ] **Step 5: Move stats row to bottom of scroll**

The stats row (streak + total + this week) currently renders near the top. Move it to the bottom of the `ScrollView` content, just above the tab bar padding. Wrap it in a compact inline layout:

```tsx
{/* ── Stats row (bottom of scroll) ── */}
<View style={[styles.statsRow, { borderTopColor: colors.border }]}>
  <View style={[styles.statsPill, { backgroundColor: colors.streakBg, borderColor: colors.streakBorder }]}>
    <Text style={[styles.statsPillText, { color: colors.streakText }]}>
      🔥 {stats?.streak ?? 0}
    </Text>
  </View>
  <Text style={[styles.statsText, { color: colors.textMuted }]}>
    {stats?.total ?? 0} total · {stats?.this_week ?? 0} this week
  </Text>
</View>
```

Add to `StyleSheet.create`:

```tsx
statsRow: {
  flexDirection: 'row',
  alignItems: 'center',
  gap: 10,
  paddingHorizontal: 20,
  paddingVertical: 14,
  borderTopWidth: StyleSheet.hairlineWidth,
  marginTop: 8,
},
statsPill: {
  borderRadius: 100,
  borderWidth: 1,
  paddingHorizontal: 10,
  paddingVertical: 4,
},
statsPillText: {
  fontFamily: 'DMSans_600SemiBold',
  fontSize: 12,
},
statsText: {
  fontFamily: 'DMSans_400Regular',
  fontSize: 12,
},
```

- [ ] **Step 6: Replace recall card rendering with MemoryCard**

Find where the home screen renders individual recall/reminder memory items (the `map` over recalled items or `ReminderMemory` list). Replace each card render with `<MemoryCard>`.

For example, if there's a recalled item render like:
```tsx
items.map((item) => (
  <SomeCard key={item.id} ... />
))
```

Replace with:
```tsx
items.map((item) => {
  const mem: MemoryCardMemory = {
    id: item.id,
    content: item.content,
    type: item.type,
    createdAt: item.createdAt,
    imageUrl: item.imageUrl,
    thumbnailUrl: item.thumbnailUrl,
    sourceUrl: item.sourceUrl,
  };
  return (
    <View key={item.id} style={{ paddingHorizontal: 16 }}>
      <MemoryCard
        memory={mem}
        tag={item.reason}
        timeAgo={formatRelative(item.createdAt, t)}
        onPress={() => router.push({ pathname: '/memory/[id]', params: { id: item.id } })}
        onDismiss={item.onDismiss}
      />
    </View>
  );
})
```

- [ ] **Step 7: Verify i18n parity**

```bash
cd mobile && npm run i18n:check
```

Expected: no parity errors.

- [ ] **Step 8: Type-check and lint**

```bash
cd mobile && npm run type-check && npm run lint
```

Expected: no errors.

- [ ] **Step 9: Commit**

```bash
cd mobile && git add app/\(tabs\)/home.tsx i18n/locales/en.ts i18n/locales/vi.ts && git commit -m "feat: redesign home screen — serif greeting, capture prompt, MemoryCard sections"
```

---

## Task 10: Redesign Library screen

**Files:**
- Modify: `mobile/app/(tabs)/library.tsx`
- Modify: `mobile/i18n/locales/en.ts`
- Modify: `mobile/i18n/locales/vi.ts`

- [ ] **Step 1: Add i18n strings**

In `mobile/i18n/locales/en.ts`, update the `library` key:

```ts
library: {
  // ...existing keys...
  eyebrow: '{{count}} memories',
  title: 'Your archive',
  searchPlaceholder: 'Search memories...',
},
```

In `mobile/i18n/locales/vi.ts`:

```ts
library: {
  // ...existing keys...
  eyebrow: '{{count}} ký ức',
  title: 'Kho lưu trữ',
  searchPlaceholder: 'Tìm kiếm ký ức...',
},
```

- [ ] **Step 2: Add imports**

At the top of `mobile/app/(tabs)/library.tsx`, add after existing imports:

```tsx
import { ScreenHeader } from '../../components/ScreenHeader';
import { MemoryCard, type MemoryCardMemory } from '../../components/MemoryCard';
```

- [ ] **Step 3: Replace the screen header**

Find the current header rendering (title text, any subtitle) and replace it with:

```tsx
<ScreenHeader
  eyebrow={t('library.eyebrow', { count: total })}
  title={t('library.title')}
  titleSize={30}
  paddingHorizontal={16}
/>
```

Where `total` is the total memory count from state. If not yet tracked, use `memories.length` as the value.

- [ ] **Step 4: Update search bar styling**

Find the search `TextInput` and update its container style:

```tsx
// Search container
style={[
  styles.searchContainer,
  { backgroundColor: colors.inputBg, borderColor: colors.border },
]}

// TextInput
style={[styles.searchInput, { color: colors.textPrimary }]}
placeholder={t('library.searchPlaceholder')}
placeholderTextColor={colors.textPlaceholder}
```

Update `StyleSheet.create` entries:

```tsx
searchContainer: {
  flexDirection: 'row',
  alignItems: 'center',
  borderRadius: 12,
  borderWidth: 1,
  paddingHorizontal: 12,
  paddingVertical: 9,
  marginHorizontal: 16,
  marginBottom: 10,
  gap: 8,
},
searchInput: {
  flex: 1,
  fontFamily: 'DMSans_400Regular',
  fontSize: 14,
  fontStyle: 'italic',
},
```

- [ ] **Step 5: Update filter chips**

Find the filter chip row and update chip styles:

```tsx
// Active chip
style={[
  styles.chip,
  styles.chipActive,
  { backgroundColor: colors.brandAccentLight, borderColor: 'rgba(197,106,58,0.3)' },
]}
// Active chip text
style={[styles.chipText, { color: colors.brandAccent }]}

// Inactive chip
style={[styles.chip, { borderColor: colors.border }]}
// Inactive chip text
style={[styles.chipText, { color: colors.textMuted }]}
```

Update `StyleSheet.create`:

```tsx
chip: {
  borderRadius: 100,
  borderWidth: 1,
  paddingHorizontal: 14,
  paddingVertical: 6,
},
chipActive: {},
chipText: {
  fontFamily: 'DMSans_600SemiBold',
  fontSize: 11,
},
```

- [ ] **Step 6: Replace FlatList item renderer with MemoryCard**

Find the `renderItem` function (or inline render) in the FlatList and replace it:

```tsx
const renderItem = useCallback(({ item }: { item: Memory }) => {
  const mem: MemoryCardMemory = {
    id: item.id,
    content: item.content,
    type: item.type,
    createdAt: item.createdAt,
    imageUrl: item.imageUrl,
    thumbnailUrl: item.thumbnailUrl,
    linkPreviewUrl: item.linkPreviewUrl,
    sourceUrl: item.sourceUrl,
    aiSummary: item.aiSummary,
  };
  return (
    <View style={styles.cardWrapper}>
      <MemoryCard
        memory={mem}
        timeAgo={formatRelative(item.createdAt, t)}
        onPress={() => router.push({ pathname: '/memory/[id]', params: { id: item.id } })}
      />
    </View>
  );
}, [t, router]);
```

Add to `StyleSheet.create`:

```tsx
cardWrapper: {
  paddingHorizontal: 16,
},
```

- [ ] **Step 7: Verify i18n parity, type-check, lint**

```bash
cd mobile && npm run i18n:check && npm run type-check && npm run lint
```

Expected: no errors.

- [ ] **Step 8: Commit**

```bash
cd mobile && git add app/\(tabs\)/library.tsx i18n/locales/en.ts i18n/locales/vi.ts && git commit -m "feat: redesign library screen — serif header, warm search bar, MemoryCard list"
```

---

## Task 11: Redesign Capture sheet

**Files:**
- Modify: `mobile/app/capture.tsx`
- Modify: `mobile/i18n/locales/en.ts`
- Modify: `mobile/i18n/locales/vi.ts`

- [ ] **Step 1: Add i18n strings for quick-tag hints**

In `mobile/i18n/locales/en.ts`, add inside the `capture` key:

```ts
capture: {
  // ...existing keys...
  hintIdea: '💡 Idea',
  hintMeeting: '📋 Meeting',
  hintDecision: '🎯 Decision',
  hintConversation: '💬 Conversation',
  hintLearning: '📚 Learning',
},
```

In `mobile/i18n/locales/vi.ts`:

```ts
capture: {
  // ...existing keys...
  hintIdea: '💡 Ý tưởng',
  hintMeeting: '📋 Cuộc họp',
  hintDecision: '🎯 Quyết định',
  hintConversation: '💬 Cuộc trò chuyện',
  hintLearning: '📚 Học hỏi',
},
```

- [ ] **Step 2: Update mode tab styles**

In `mobile/app/capture.tsx`, find the mode selector tabs (Text / Voice / Link / Photo). Update the tab button styles:

```tsx
// Active mode tab
style={[
  styles.modeTab,
  styles.modeTabActive,
  {
    backgroundColor: colors.brandAccentLight,
    borderColor: 'rgba(197,106,58,0.25)',
  },
]}
// Active mode tab text
style={[styles.modeTabText, { color: colors.brandAccent }]}

// Inactive mode tab
style={[styles.modeTab, { borderColor: colors.border }]}
// Inactive mode tab text
style={[styles.modeTabText, { color: colors.textMuted }]}
```

Update `StyleSheet.create`:

```tsx
modeTab: {
  flex: 1,
  alignItems: 'center',
  paddingVertical: 8,
  borderRadius: 10,
  borderWidth: 1,
},
modeTabActive: {},
modeTabText: {
  fontFamily: 'DMSans_600SemiBold',
  fontSize: 11,
  textTransform: 'uppercase',
  letterSpacing: 0.5,
},
```

- [ ] **Step 3: Update text input placeholder style**

Find the main `TextInput` in capture.tsx and update:

```tsx
placeholder={t('capture.smartHintText')}   // already exists
placeholderTextColor={colors.textPlaceholder}
style={[
  styles.textInput,
  {
    color: colors.textPrimary,
    backgroundColor: colors.inputBg,
    borderColor: colors.border,
    fontFamily: 'DMSans_400Regular',
    fontSize: 15,
  },
]}
```

- [ ] **Step 4: Add quick-tag hints row**

After the `TextInput` block and before the action buttons, add:

```tsx
{/* Quick-tag hints */}
<ScrollView
  horizontal
  showsHorizontalScrollIndicator={false}
  contentContainerStyle={styles.hintsScroll}
>
  {[
    t('capture.hintIdea'),
    t('capture.hintMeeting'),
    t('capture.hintDecision'),
    t('capture.hintConversation'),
    t('capture.hintLearning'),
  ].map((hint) => (
    <TouchableOpacity
      key={hint}
      onPress={() => {
        // Prepend hint text to input value
        setText((prev) => (prev ? `${hint} ${prev}` : `${hint} `));
      }}
      style={[styles.hintChip, { borderColor: colors.border }]}
    >
      <Text style={[styles.hintChipText, { color: colors.textMuted }]}>{hint}</Text>
    </TouchableOpacity>
  ))}
</ScrollView>
```

Add `ScrollView` to the imports from `react-native` if not already present. Add `setText` to existing state if the input state variable has a different name — use whatever the existing text state setter is called.

Add to `StyleSheet.create`:

```tsx
hintsScroll: {
  paddingHorizontal: 16,
  paddingVertical: 8,
  gap: 8,
  flexDirection: 'row',
},
hintChip: {
  borderRadius: 100,
  borderWidth: 1,
  paddingHorizontal: 12,
  paddingVertical: 5,
},
hintChipText: {
  fontFamily: 'DMSans_400Regular',
  fontSize: 12,
},
```

- [ ] **Step 5: Update Save button style**

Find the save/submit button and update:

```tsx
style={[styles.saveButton, { backgroundColor: colors.brandAccent }]}
// text:
style={[styles.saveButtonText]}
```

Update `StyleSheet.create`:

```tsx
saveButton: {
  flex: 1,
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: 12,
  paddingVertical: 13,
},
saveButtonText: {
  fontFamily: 'DMSans_600SemiBold',
  fontSize: 15,
  color: '#FFFFFF',
},
```

- [ ] **Step 6: Verify i18n parity, type-check, lint**

```bash
cd mobile && npm run i18n:check && npm run type-check && npm run lint
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
cd mobile && git add app/capture.tsx i18n/locales/en.ts i18n/locales/vi.ts && git commit -m "feat: redesign capture sheet — orange mode tabs, quick-tag hints, warm button"
```

---

## Task 12: Redesign Memory Detail screen

**Files:**
- Modify: `mobile/app/memory/[id].tsx`
- Modify: `mobile/i18n/locales/en.ts`
- Modify: `mobile/i18n/locales/vi.ts`

- [ ] **Step 1: Add i18n strings**

In `mobile/i18n/locales/en.ts`, add/update in the `memory` key:

```ts
memory: {
  // ...existing keys...
  aiSummaryLabel: '✦ AI Summary',
  actionEdit: 'Edit',
  actionShare: 'Share',
  actionReflect: 'Reflect',
  backToLibrary: '← Library',
  backToHome: '← Home',
},
```

In `mobile/i18n/locales/vi.ts`:

```ts
memory: {
  // ...existing keys...
  aiSummaryLabel: '✦ Tóm tắt AI',
  actionEdit: 'Chỉnh sửa',
  actionShare: 'Chia sẻ',
  actionReflect: 'Suy ngẫm',
  backToLibrary: '← Thư viện',
  backToHome: '← Trang chủ',
},
```

- [ ] **Step 2: Add imports**

In `mobile/app/memory/[id].tsx`, add:

```tsx
import { ScreenHeader } from '../../components/ScreenHeader';
import { SerifTitle } from '../../components/SerifTitle';
```

- [ ] **Step 3: Add serif title derivation helper**

After imports, add:

```tsx
function deriveTitle(aiSummary?: string, content?: string): string {
  if (aiSummary) {
    const firstSentence = aiSummary.split(/[.!?]/)[0].trim();
    if (firstSentence.length > 0 && firstSentence.length <= 60) return firstSentence;
  }
  if (content) {
    const words = content.trim().split(/\s+/).slice(0, 6).join(' ');
    return words.length > 0 ? words : content.slice(0, 40);
  }
  return '';
}
```

- [ ] **Step 4: Replace the screen header block**

Find the existing header section in the memory detail screen. Replace it with:

```tsx
{/* ── Header ── */}
<View style={[styles.detailHeader, { borderBottomColor: colors.border }]}>
  <TouchableOpacity onPress={() => router.back()}>
    <Text style={[styles.backLink, { color: colors.brandAccent }]}>
      {t('memory.backToLibrary')}
    </Text>
  </TouchableOpacity>
  {memory ? (
    <>
      <Text style={[styles.dateEyebrow, { color: colors.brandAccent }]}>
        {new Date(memory.created_at).toLocaleDateString(undefined, {
          weekday: 'long', month: 'long', day: 'numeric',
        }).toUpperCase()}
      </Text>
      <SerifTitle size={24} style={{ paddingHorizontal: 0, marginBottom: 6 }}>
        {deriveTitle(memory.ai_summary, memory.content)}
      </SerifTitle>
      <View style={styles.metaRow}>
        <View style={[styles.typeChip, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
          <Text style={[styles.typeChipText, { color: colors.textMuted }]}>
            {memory.type?.toLowerCase()}
          </Text>
        </View>
        <Text style={[styles.metaTime, { color: colors.textMuted }]}>
          {formatRelative(new Date(memory.created_at))}
        </Text>
      </View>
    </>
  ) : null}
</View>
```

Add to `StyleSheet.create`:

```tsx
detailHeader: {
  paddingHorizontal: 20,
  paddingTop: 16,
  paddingBottom: 14,
  borderBottomWidth: StyleSheet.hairlineWidth,
},
backLink: {
  fontFamily: 'DMSans_500Medium',
  fontSize: 12,
  marginBottom: 14,
},
dateEyebrow: {
  fontFamily: 'DMSans_600SemiBold',
  fontSize: 10,
  letterSpacing: 1,
  marginBottom: 8,
},
metaRow: {
  flexDirection: 'row',
  alignItems: 'center',
  gap: 8,
},
typeChip: {
  borderRadius: 100,
  borderWidth: 1,
  paddingHorizontal: 9,
  paddingVertical: 3,
},
typeChipText: {
  fontFamily: 'DMSans_600SemiBold',
  fontSize: 10,
  textTransform: 'uppercase',
  letterSpacing: 0.5,
},
metaTime: {
  fontFamily: 'DMSans_400Regular',
  fontSize: 11,
},
```

- [ ] **Step 5: Add AI summary card**

Find where `ai_summary` is currently displayed. Replace it with:

```tsx
{memory?.ai_summary ? (
  <View style={[
    styles.aiSummaryCard,
    {
      backgroundColor: 'rgba(197,106,58,0.06)',
      borderColor: 'rgba(197,106,58,0.14)',
    },
  ]}>
    <Text style={[styles.aiSummaryLabel, { color: colors.brandAccent }]}>
      {t('memory.aiSummaryLabel')}
    </Text>
    <Text style={[styles.aiSummaryText, { color: colors.textSecondary }]}>
      {memory.ai_summary}
    </Text>
  </View>
) : null}
```

Add to `StyleSheet.create`:

```tsx
aiSummaryCard: {
  borderRadius: 14,
  borderWidth: 1,
  padding: 14,
  marginHorizontal: 20,
  marginTop: 16,
},
aiSummaryLabel: {
  fontFamily: 'DMSans_600SemiBold',
  fontSize: 10,
  textTransform: 'uppercase',
  letterSpacing: 0.8,
  marginBottom: 6,
},
aiSummaryText: {
  fontFamily: 'DMSans_400Regular',
  fontSize: 13,
  fontStyle: 'italic',
  lineHeight: 20,
},
```

- [ ] **Step 6: Update action row**

Find the bottom action buttons (Edit, Share, Delete or similar). Replace with:

```tsx
<View style={[styles.actionRow, { borderTopColor: colors.border }]}>
  <TouchableOpacity style={[styles.actionBtn, { borderColor: colors.border }]}>
    <Text style={[styles.actionBtnText, { color: colors.textSecondary }]}>
      {t('memory.actionEdit')}
    </Text>
  </TouchableOpacity>
  <TouchableOpacity style={[styles.actionBtn, { borderColor: colors.border }]}>
    <Text style={[styles.actionBtnText, { color: colors.textSecondary }]}>
      {t('memory.actionShare')}
    </Text>
  </TouchableOpacity>
  <TouchableOpacity
    style={[styles.actionBtn, { borderColor: 'rgba(197,106,58,0.25)' }]}
  >
    <Text style={[styles.actionBtnText, { color: colors.brandAccent }]}>
      {t('memory.actionReflect')}
    </Text>
  </TouchableOpacity>
</View>
```

Add to `StyleSheet.create`:

```tsx
actionRow: {
  flexDirection: 'row',
  gap: 8,
  padding: 16,
  borderTopWidth: StyleSheet.hairlineWidth,
},
actionBtn: {
  flex: 1,
  alignItems: 'center',
  paddingVertical: 10,
  borderRadius: 12,
  borderWidth: 1,
},
actionBtnText: {
  fontFamily: 'DMSans_500Medium',
  fontSize: 13,
},
```

- [ ] **Step 7: Verify i18n parity, type-check, lint**

```bash
cd mobile && npm run i18n:check && npm run type-check && npm run lint
```

Expected: no errors.

- [ ] **Step 8: Commit**

```bash
cd mobile && git add "app/memory/[id].tsx" i18n/locales/en.ts i18n/locales/vi.ts && git commit -m "feat: redesign memory detail — serif title, AI summary card, orange action row"
```

---

## Task 13: Redesign Insights screen

**Files:**
- Modify: `mobile/app/(tabs)/insights.tsx`
- Modify: `mobile/i18n/locales/en.ts`
- Modify: `mobile/i18n/locales/vi.ts`

- [ ] **Step 1: Add i18n strings**

In `mobile/i18n/locales/en.ts`, update the `insights` key:

```ts
insights: {
  // ...existing keys...
  eyebrow: '{{month}} {{year}}',
  title: 'Your patterns',
  streakLabel: 'Day streak',
  totalLabel: 'Total',
  activityLabel: 'Activity — last 12 weeks',
  recapLabel: '✦ Weekly recap',
},
```

In `mobile/i18n/locales/vi.ts`:

```ts
insights: {
  // ...existing keys...
  eyebrow: '{{month}} {{year}}',
  title: 'Mô hình của bạn',
  streakLabel: 'Ngày liên tiếp',
  totalLabel: 'Tổng số',
  activityLabel: 'Hoạt động — 12 tuần qua',
  recapLabel: '✦ Tóm tắt tuần',
},
```

- [ ] **Step 2: Add imports**

In `mobile/app/(tabs)/insights.tsx`, add:

```tsx
import { ScreenHeader } from '../../components/ScreenHeader';
import { SerifTitle } from '../../components/SerifTitle';
```

- [ ] **Step 3: Replace screen header**

Find the current insights screen header and replace with:

```tsx
<ScreenHeader
  eyebrow={t('insights.eyebrow', {
    month: new Date().toLocaleString('default', { month: 'long' }).toUpperCase(),
    year: new Date().getFullYear(),
  })}
  title={t('insights.title')}
  titleSize={30}
  paddingHorizontal={16}
/>
```

- [ ] **Step 4: Replace streak card**

Find the current streak display and replace with:

```tsx
<View style={[
  styles.streakCard,
  {
    backgroundColor: 'rgba(197,106,58,0.07)',
    borderColor: 'rgba(197,106,58,0.18)',
  },
]}>
  <View>
    <Text style={[styles.streakValue, { color: colors.brandAccent, fontFamily: 'DMSerifDisplay_400Italic' }]}>
      🔥 {streakDetails?.current_streak ?? 0}
    </Text>
    <Text style={[styles.streakLabel, { color: colors.brandAccent }]}>
      {t('insights.streakLabel').toUpperCase()}
    </Text>
  </View>
  <View style={styles.streakRight}>
    <Text style={[styles.totalValue, { color: colors.textPrimary, fontFamily: 'DMSerifDisplay_400Italic' }]}>
      {dashboard?.total_memories ?? 0}
    </Text>
    <Text style={[styles.totalLabel, { color: colors.textMuted }]}>
      {t('insights.totalLabel').toUpperCase()}
    </Text>
  </View>
</View>
```

Add to `StyleSheet.create`:

```tsx
streakCard: {
  borderRadius: 16,
  borderWidth: 1,
  padding: 16,
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginHorizontal: 16,
  marginBottom: 12,
},
streakValue: {
  fontSize: 28,
  lineHeight: 32,
},
streakLabel: {
  fontFamily: 'DMSans_600SemiBold',
  fontSize: 9,
  letterSpacing: 0.8,
  marginTop: 3,
  opacity: 0.7,
},
streakRight: {
  alignItems: 'flex-end',
},
totalValue: {
  fontSize: 22,
  lineHeight: 26,
},
totalLabel: {
  fontFamily: 'DMSans_600SemiBold',
  fontSize: 9,
  letterSpacing: 0.8,
  marginTop: 3,
},
```

- [ ] **Step 5: Update heatmap cell colors to orange scale**

Find where heatmap cell background colors are defined (usually a function or array mapping count to color). Replace with:

```tsx
function heatmapCellColor(count: number, max: number): string {
  if (count === 0) return 'rgba(255,255,255,0.04)';
  const ratio = count / Math.max(max, 1);
  if (ratio < 0.25) return 'rgba(197,106,58,0.2)';
  if (ratio < 0.5)  return 'rgba(197,106,58,0.45)';
  if (ratio < 0.75) return 'rgba(197,106,58,0.7)';
  return '#C56A3A';
}
```

In the heatmap cell render, use:

```tsx
style={[styles.heatCell, { backgroundColor: heatmapCellColor(cell.count, maxCount) }]}
```

- [ ] **Step 6: Update weekly recap card**

Find the existing `RecapCard` component or inline recap rendering. Replace the card container and label styles:

```tsx
<View style={[
  styles.recapCard,
  { backgroundColor: colors.inputBg, borderColor: colors.border },
]}>
  <Text style={[styles.recapLabel, { color: colors.brandAccent }]}>
    {t('insights.recapLabel').toUpperCase()}
  </Text>
  {recap.recap ? (
    <Text style={[styles.recapText, { color: colors.textSecondary }]}>
      {recap.recap}
    </Text>
  ) : null}
</View>
```

Update `StyleSheet.create`:

```tsx
recapCard: {
  borderRadius: 14,
  borderWidth: 1,
  padding: 14,
  marginHorizontal: 16,
  marginTop: 12,
},
recapLabel: {
  fontFamily: 'DMSans_600SemiBold',
  fontSize: 9,
  letterSpacing: 0.8,
  marginBottom: 8,
},
recapText: {
  fontFamily: 'DMSans_400Regular',
  fontSize: 13,
  fontStyle: 'italic',
  lineHeight: 20,
},
```

- [ ] **Step 7: Verify i18n parity, type-check, lint**

```bash
cd mobile && npm run i18n:check && npm run type-check && npm run lint
```

Expected: no errors.

- [ ] **Step 8: Commit**

```bash
cd mobile && git add app/\(tabs\)/insights.tsx i18n/locales/en.ts i18n/locales/vi.ts && git commit -m "feat: redesign insights — orange streak card, orange heatmap, serif recap"
```

---

## Task 14: Redesign Profile screen

**Files:**
- Modify: `mobile/app/(tabs)/profile.tsx`
- Modify: `mobile/i18n/locales/en.ts`
- Modify: `mobile/i18n/locales/vi.ts`

- [ ] **Step 1: Add i18n strings**

In `mobile/i18n/locales/en.ts`, add to the `profile` key:

```ts
profile: {
  // ...existing keys...
  eyebrow: 'Signed in as',
},
```

In `mobile/i18n/locales/vi.ts`:

```ts
profile: {
  // ...existing keys...
  eyebrow: 'Đang đăng nhập với',
},
```

- [ ] **Step 2: Add imports**

In `mobile/app/(tabs)/profile.tsx`, add:

```tsx
import { ScreenHeader } from '../../components/ScreenHeader';
```

- [ ] **Step 3: Replace screen header**

Find the current profile header (user name, email, avatar area at top). Replace the entire header section with:

```tsx
{/* ── Header ── */}
<View style={[styles.profileHeader, { borderBottomColor: colors.border }]}>
  <ScreenHeader
    eyebrow={t('profile.eyebrow')}
    title={user?.name?.split(' ')[0] ?? user?.email?.split('@')[0] ?? 'You'}
    titleSize={30}
    paddingHorizontal={20}
  />
</View>
```

Add to `StyleSheet.create`:

```tsx
profileHeader: {
  borderBottomWidth: StyleSheet.hairlineWidth,
  paddingBottom: 4,
},
```

- [ ] **Step 4: Update settings group container styling**

Find each grouped settings section (Preferences group, Account group, etc.). Update their container style to use tighter tokens:

```tsx
style={[
  styles.settingsGroup,
  { backgroundColor: colors.inputBg, borderColor: colors.border },
]}
```

Update `StyleSheet.create`:

```tsx
settingsGroup: {
  borderRadius: 14,
  borderWidth: 1,
  overflow: 'hidden',
  marginHorizontal: 16,
  marginBottom: 12,
},
```

- [ ] **Step 5: Update row separators within groups**

Find the border/separator between rows inside settings groups and update to:

```tsx
borderBottomColor: colors.border,  // was borderMed or hardcoded
borderBottomWidth: StyleSheet.hairlineWidth,
```

- [ ] **Step 6: Update sign-out row label color**

Find the sign-out button/row and update the label color:

```tsx
style={[styles.signOutText, { color: colors.brandAccent }]}
```

Update `StyleSheet.create`:

```tsx
signOutText: {
  fontFamily: 'DMSans_500Medium',
  fontSize: 15,
},
```

- [ ] **Step 7: Verify i18n parity, type-check, lint**

```bash
cd mobile && npm run i18n:check && npm run type-check && npm run lint
```

Expected: no errors.

- [ ] **Step 8: Commit**

```bash
cd mobile && git add app/\(tabs\)/profile.tsx i18n/locales/en.ts i18n/locales/vi.ts && git commit -m "feat: redesign profile — serif name header, grouped settings polish"
```

---

## Task 15: Final validation

- [ ] **Step 1: Full type-check**

```bash
cd mobile && npm run type-check
```

Expected: no errors.

- [ ] **Step 2: Full lint**

```bash
cd mobile && npm run lint
```

Expected: no errors or only pre-existing warnings.

- [ ] **Step 3: i18n parity check**

```bash
cd mobile && npm run i18n:check
```

Expected: all keys present in both `en.ts` and `vi.ts`.

- [ ] **Step 4: Verify light + dark theme in simulator**

Start the app and verify in iOS simulator:
- Toggle dark mode: warm near-black bg, off-white text, orange accents visible throughout
- Toggle light mode: warm off-white bg (#faf9f7), warm near-black text, consistent orange accents
- Check tab bar: active icon is warm off-white, inactive is dark, FAB has orange glow
- Check Home: greeting eyebrow, serif italic title, capture prompt visible
- Check Library: card list with thumbnails on photo/link items
- Check Insights: orange streak card, orange heatmap cells, italic recap text

- [ ] **Step 5: Final commit**

```bash
cd mobile && git add -A && git commit -m "chore: final UI redesign validation pass"
```
