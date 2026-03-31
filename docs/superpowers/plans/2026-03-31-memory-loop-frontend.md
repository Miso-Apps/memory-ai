# Memory Loop Frontend Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the Memory Loop redesign spec across all 5 mobile screens — Threads × Anthropic visual language, Recall tab surfaced as Core USP with notification badge, warm cream palette.

**Architecture:** Update the shared theme tokens first, then rebuild the tab navigator, then redesign each screen in loop order (Home → Capture → Kho → Nhắc → Tôi). Each task is self-contained and type-checks cleanly before moving on.

**Tech Stack:** React Native + Expo Router, TypeScript, Zustand, expo-linear-gradient, lucide-react-native, expo-haptics

**Spec:** `docs/superpowers/specs/2026-03-31-memory-loop-redesign-design.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `mobile/constants/ThemeContext.tsx` | Modify | Add new color tokens for capture dark mode, recall banner, badge |
| `mobile/store/recallBadgeStore.ts` | **Create** | Zustand store for Nhắc tab badge count |
| `mobile/app/(tabs)/_layout.tsx` | Modify | New nav: Home\|Kho\|FAB\|Nhắc\|Tôi, dot indicator, badge, circular FAB |
| `mobile/app/(tabs)/home.tsx` | Modify | Greeting + stats row + Recall Banner + recent + On This Day |
| `mobile/app/capture.tsx` | Modify | Dark bottom sheet background, mode bar SVG icons, hint chips |
| `mobile/app/(tabs)/library.tsx` | Modify | Always-visible search, date separators, swipe-to-recall |
| `mobile/app/(tabs)/recall.tsx` | Modify | Featured hero card, confidence bar, reason labels, AI chat entry |
| `mobile/app/(tabs)/profile.tsx` | Modify | Recall Rate stat, Weekly Insight card, warm heatmap, 3 settings |
| `mobile/app/(tabs)/insights.tsx` | Modify | Hide from nav (href: null already in _layout after Task 2) |

---

## Task 1: Update Theme Tokens

**Files:**
- Modify: `mobile/constants/ThemeContext.tsx`

The current `LightColors` already uses warm amber tones (`#b85c20`, `#f7f4f0`). We need to tighten the palette to match the spec exactly and add tokens for the capture dark modal and recall banner.

- [ ] **Step 1: Add new color token fields to the `ThemeColors` interface**

In `mobile/constants/ThemeContext.tsx`, extend the `ThemeColors` interface (after `streakText: string;` on line 65):

```typescript
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
```

- [ ] **Step 2: Update LightColors values and add new tokens**

Replace the entire `LightColors` object (lines 68–123):

```typescript
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
  captureBg: '#1C1108',
  captureCard: 'rgba(255,255,255,0.06)',
  captureBorder: 'rgba(255,255,255,0.10)',
  captureText: '#F5EFE8',
  captureMuted: 'rgba(245,239,232,0.45)',
  captureAccent: '#E8844A',

  // Notification badge
  badgeRed: '#E8442A',
};
```

- [ ] **Step 3: Update DarkColors to add the same new tokens**

After the existing `DarkColors` closing brace, add the new tokens to `DarkColors` (inside the object, after `streakText`):

```typescript
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
```

- [ ] **Step 4: Validate**

```bash
cd mobile && npm run type-check
```

Expected: 0 errors (TypeScript will catch any missing tokens from the interface).

- [ ] **Step 5: Commit**

```bash
cd mobile && git add constants/ThemeContext.tsx
git commit -m "feat(theme): update palette to Threads × Anthropic warm tokens"
```

---

## Task 2: Recall Badge Store

**Files:**
- Create: `mobile/store/recallBadgeStore.ts`

A minimal Zustand store for the Nhắc tab badge count. Updated by the Recall screen when it fetches radar items, and read by the tab navigator.

- [ ] **Step 1: Create the store**

```typescript
// mobile/store/recallBadgeStore.ts
import { create } from 'zustand';

interface RecallBadgeState {
  count: number;
  setCount: (count: number) => void;
}

export const useRecallBadgeStore = create<RecallBadgeState>((set) => ({
  count: 0,
  setCount: (count) => set({ count }),
}));
```

- [ ] **Step 2: Validate**

```bash
cd mobile && npm run type-check
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add mobile/store/recallBadgeStore.ts
git commit -m "feat(store): add recallBadgeStore for Nhắc tab badge count"
```

---

## Task 3: Redesign Tab Navigation

**Files:**
- Modify: `mobile/app/(tabs)/_layout.tsx`

Replace the current tab layout with the new design:
- `TabIcon`: no background box, icon fills when active + amber dot below
- `CreateTabButton`: circular dark `#2C1810`, not rounded square
- Replace `insights` tab → `recall` tab with badge
- Hide `insights` (keep the file, set `href: null`)

- [ ] **Step 1: Replace the entire `_layout.tsx`**

```typescript
import React from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Platform,
  Animated,
  Text,
} from 'react-native';
import { Tabs, router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../constants/ThemeContext';
import { useRecallBadgeStore } from '../../store/recallBadgeStore';
import {
  Home,
  BookOpen,
  Bell,
  User,
  Plus,
  type LucideIcon,
} from 'lucide-react-native';

// ─── Tab icon: filled when active + amber dot, no background box ──────────────
function TabIcon({
  Icon,
  focused,
  size = 24,
}: {
  Icon: LucideIcon;
  focused: boolean;
  size?: number;
}) {
  const { colors } = useTheme();

  return (
    <View style={styles.iconWrap}>
      <Icon
        size={size}
        color={focused ? colors.textPrimary : colors.textMuted}
        strokeWidth={focused ? 2.2 : 1.6}
        fill={focused ? colors.textPrimary : 'none'}
      />
      {focused && (
        <View style={[styles.activeDot, { backgroundColor: colors.accent }]} />
      )}
    </View>
  );
}

// ─── Bell icon specifically — filled path needs special handling ──────────────
function BellTabIcon({ focused }: { focused: boolean }) {
  const { colors } = useTheme();
  return (
    <View style={styles.iconWrap}>
      <Bell
        size={24}
        color={focused ? colors.textPrimary : colors.textMuted}
        strokeWidth={focused ? 2.2 : 1.6}
        fill={focused ? colors.textPrimary : 'none'}
      />
      {focused && (
        <View style={[styles.activeDot, { backgroundColor: colors.accent }]} />
      )}
    </View>
  );
}

// ─── Recall tab with badge ────────────────────────────────────────────────────
function RecallTabIcon({ focused }: { focused: boolean }) {
  const { colors } = useTheme();
  const count = useRecallBadgeStore((s) => s.count);

  return (
    <View style={styles.iconWrap}>
      <Bell
        size={24}
        color={focused ? colors.textPrimary : colors.textMuted}
        strokeWidth={focused ? 2.2 : 1.6}
        fill={focused ? colors.textPrimary : 'none'}
      />
      {count > 0 && (
        <View style={[styles.badge, { backgroundColor: colors.badgeRed }]}>
          <Text style={styles.badgeText}>{count > 9 ? '9+' : count}</Text>
        </View>
      )}
      {focused && (
        <View style={[styles.activeDot, { backgroundColor: colors.accent }]} />
      )}
    </View>
  );
}

// ─── Tab button with haptic feedback ─────────────────────────────────────────
function EnhancedTabButton({ children, onPress, ...rest }: any) {
  const handlePress = (e: any) => {
    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } else {
      Haptics.selectionAsync();
    }
    onPress?.(e);
  };
  return (
    <TouchableOpacity {...rest} onPress={handlePress} activeOpacity={0.7}>
      {children}
    </TouchableOpacity>
  );
}

// ─── Circular dark FAB ────────────────────────────────────────────────────────
function CreateTabButton({ style, ...rest }: any) {
  const scaleAnim = React.useRef(new Animated.Value(1)).current;

  const handlePress = () => {
    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } else {
      Haptics.selectionAsync();
    }
    router.push('/capture');
  };

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.93,
      useNativeDriver: true,
      tension: 280,
      friction: 14,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      tension: 280,
      friction: 14,
    }).start();
  };

  return (
    <TouchableOpacity
      {...rest}
      style={[style, styles.fabWrapper]}
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      activeOpacity={0.9}
      accessibilityRole="button"
      accessibilityLabel="Lưu nhanh"
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    >
      <Animated.View style={[styles.fab, { transform: [{ scale: scaleAnim }] }]}>
        <Plus size={22} color="#FFFFFF" strokeWidth={2.2} />
      </Animated.View>
    </TouchableOpacity>
  );
}

export default function TabsLayout() {
  const { colors } = useTheme();
  const { t } = useTranslation();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarHideOnKeyboard: true,
        tabBarActiveTintColor: colors.textPrimary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.tabBarBg,
          borderTopWidth: 1,
          borderColor: colors.tabBarBorder,
          height: Platform.OS === 'ios' ? 82 : 72,
          paddingTop: 4,
          paddingBottom: Platform.OS === 'ios' ? 24 : 10,
          position: 'absolute',
          ...Platform.select({
            ios: {
              shadowColor: '#000',
              shadowOffset: { width: 0, height: -2 },
              shadowOpacity: 0.06,
              shadowRadius: 12,
            },
            android: { elevation: 8 },
          }),
        },
        tabBarItemStyle: { paddingTop: 4 },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: t('tabs.home'),
          tabBarIcon: ({ focused }) => <TabIcon Icon={Home} focused={focused} />,
          tabBarButton: (props) => <EnhancedTabButton {...props} />,
        }}
      />
      <Tabs.Screen
        name="library"
        options={{
          title: t('tabs.library'),
          tabBarIcon: ({ focused }) => <TabIcon Icon={BookOpen} focused={focused} />,
          tabBarButton: (props) => <EnhancedTabButton {...props} />,
        }}
      />
      <Tabs.Screen
        name="create"
        options={{
          title: t('tabs.capture'),
          tabBarIcon: () => null,
          tabBarButton: (props) => <CreateTabButton {...props} />,
        }}
      />
      <Tabs.Screen
        name="recall"
        options={{
          title: 'Nhắc',
          tabBarIcon: ({ focused }) => <RecallTabIcon focused={focused} />,
          tabBarButton: (props) => <EnhancedTabButton {...props} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t('tabs.profile'),
          tabBarIcon: ({ focused }) => <TabIcon Icon={User} focused={focused} />,
          tabBarButton: (props) => <EnhancedTabButton {...props} />,
        }}
      />
      {/* Hidden screens */}
      <Tabs.Screen name="insights" options={{ href: null }} />
      <Tabs.Screen name="chat" options={{ href: null }} />
      <Tabs.Screen name="archive" options={{ href: null }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  iconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 32,
    height: 32,
    position: 'relative',
  },
  activeDot: {
    position: 'absolute',
    bottom: -6,
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  badge: {
    position: 'absolute',
    top: -3,
    right: -5,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: '#FBF7F2',
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#FFFFFF',
    lineHeight: 12,
  },
  fabWrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -10,
  },
  fab: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#2C1810',
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#2C1810',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.28,
        shadowRadius: 10,
      },
      android: { elevation: 6 },
    }),
  },
});
```

- [ ] **Step 2: Validate**

```bash
cd mobile && npm run type-check && npm run lint
```

Expected: 0 errors, 0 warnings.

- [ ] **Step 3: Commit**

```bash
git add mobile/app/\(tabs\)/_layout.tsx mobile/store/recallBadgeStore.ts
git commit -m "feat(nav): Threads-style tab bar — dot indicator, circular FAB, Nhắc tab with badge"
```

---

## Task 4: Redesign Home Screen

**Files:**
- Modify: `mobile/app/(tabs)/home.tsx`

Key changes: stats row with 3 pills (this_week, streak, recall_count), Recall Banner above recent memories, On This Day section already exists (keep the logic, restyle).

- [ ] **Step 1: Add RecallBanner component at the top of `home.tsx` (before `export default`)**

```typescript
// Add this import at the top of the file
import { LinearGradient } from 'expo-linear-gradient';
import { useRecallBadgeStore } from '../../store/recallBadgeStore';

// Add this component before export default
function RecallBanner({
  count,
  topTopic,
  onPress,
  colors,
}: {
  count: number;
  topTopic: string;
  onPress: () => void;
  colors: ThemeColors;
}) {
  if (count === 0) return null;
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85}>
      <LinearGradient
        colors={['#FFF3E8', '#FFE5CB']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.recallBanner}
      >
        <View style={styles.recallBannerTop}>
          <Text style={[styles.recallBannerLabel, { color: colors.accent }]}>
            🔔 Nhắc lại hôm nay
          </Text>
          <View style={[styles.recallBadge, { backgroundColor: colors.badgeRed }]}>
            <Text style={styles.recallBadgeText}>{count} mới</Text>
          </View>
        </View>
        <Text style={[styles.recallBannerTitle, { color: colors.textPrimary }]}>
          {topTopic}
        </Text>
        <Text style={[styles.recallBannerCta, { color: colors.accent }]}>
          Xem ngay →
        </Text>
      </LinearGradient>
    </TouchableOpacity>
  );
}
```

- [ ] **Step 2: Add stat pill styles and update the stats section**

In the main `HomeScreen` component, replace the existing stats rendering with the new 3-pill layout. Find where `stats` is rendered and replace with:

```typescript
// Inside HomeScreen component, add radarCount from store:
const setRecallBadgeCount = useRecallBadgeStore((s) => s.setCount);
const recallCount = useRecallBadgeStore((s) => s.count);

// When radar items are loaded, update the badge count.
// Add this effect after the existing loadRadar/loadStats calls:
useEffect(() => {
  aiApi.getRadar(6).then((res) => {
    setRecallBadgeCount(res.items?.length ?? 0);
  }).catch(() => undefined);
}, [setRecallBadgeCount]);

// Replace the stats row JSX with:
<View style={styles.statsRow}>
  <View style={[styles.statPill, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
    <Text style={[styles.statVal, { color: colors.textPrimary }]}>
      {stats?.this_week ?? 0}
    </Text>
    <Text style={[styles.statLabel, { color: colors.textMuted }]}>tuần này</Text>
  </View>
  <View style={[styles.statPill, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
    <Text style={[styles.statVal, { color: colors.textPrimary }]}>
      {stats?.streak ?? 0}🔥
    </Text>
    <Text style={[styles.statLabel, { color: colors.textMuted }]}>streak</Text>
  </View>
  <TouchableOpacity
    style={[styles.statPill, { backgroundColor: colors.accentLight, borderColor: colors.recallBannerBorder }]}
    onPress={() => router.push('/(tabs)/recall')}
    activeOpacity={0.7}
  >
    <Text style={[styles.statVal, { color: colors.accent }]}>{recallCount}</Text>
    <Text style={[styles.statLabel, { color: colors.accent }]}>nhắc mới</Text>
  </TouchableOpacity>
</View>
```

- [ ] **Step 3: Add RecallBanner below stats row in the JSX**

After the stats row, before the "Gần đây" section, add:

```typescript
<RecallBanner
  count={recallCount}
  topTopic={recallTopTopic}   // derive from first radar item's content/summary
  onPress={() => router.push('/(tabs)/recall')}
  colors={colors}
/>
```

Add `recallTopTopic` state derived from radar fetch:

```typescript
const [recallTopTopic, setRecallTopTopic] = useState('Bạn có ký ức chờ nhớ lại');

// In the getRadar effect:
aiApi.getRadar(6).then((res) => {
  setRecallBadgeCount(res.items?.length ?? 0);
  const first = res.items?.[0];
  if (first) {
    const preview = first.memory.ai_summary ?? first.memory.content;
    setRecallTopTopic(preview.length > 50 ? preview.slice(0, 50) + '…' : preview);
  }
}).catch(() => undefined);
```

- [ ] **Step 4: Add new styles**

Add to `StyleSheet.create({...})` in `home.tsx`:

```typescript
statsRow: {
  flexDirection: 'row',
  gap: 8,
  paddingHorizontal: 16,
  marginBottom: 12,
},
statPill: {
  flex: 1,
  borderRadius: 14,
  borderWidth: 1,
  paddingVertical: 10,
  alignItems: 'center',
},
statVal: {
  fontSize: 18,
  fontWeight: '700',
  lineHeight: 22,
},
statLabel: {
  fontSize: 10,
  marginTop: 2,
},
recallBanner: {
  marginHorizontal: 16,
  marginBottom: 16,
  borderRadius: 16,
  padding: 14,
  borderWidth: 1.5,
  borderColor: '#F0C89A',
},
recallBannerTop: {
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: 6,
},
recallBannerLabel: {
  fontSize: 11,
  fontWeight: '700',
  textTransform: 'uppercase',
  letterSpacing: 0.4,
},
recallBadge: {
  borderRadius: 8,
  paddingHorizontal: 7,
  paddingVertical: 2,
},
recallBadgeText: {
  fontSize: 10,
  fontWeight: '700',
  color: '#FFFFFF',
},
recallBannerTitle: {
  fontSize: 14,
  fontWeight: '600',
  marginBottom: 6,
  lineHeight: 20,
},
recallBannerCta: {
  fontSize: 12,
  fontWeight: '600',
},
```

- [ ] **Step 5: Validate**

```bash
cd mobile && npm run type-check && npm run lint
```

Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
git add mobile/app/\(tabs\)/home.tsx
git commit -m "feat(home): stats row, Recall Banner, connect badge store"
```

---

## Task 5: Redesign Capture Modal (Dark Bottom Sheet)

**Files:**
- Modify: `mobile/app/capture.tsx`

Change the background from light to dark `#1C1108`, update mode bar to use SVG icon + label style, and pre-select the most-used hint chip from settings.

- [ ] **Step 1: Update the root container background in `capture.tsx`**

Find the `SafeAreaView` or root `View` that wraps the entire capture screen. Replace its `backgroundColor` with `colors.captureBg`:

```typescript
// Find the outermost container style. It likely uses colors.bg or a hardcoded color.
// Replace with:
<View style={[styles.container, { backgroundColor: colors.captureBg }]}>
```

Also update the status bar to light content:

```typescript
import { StatusBar } from 'expo-status-bar';
// Add inside the return:
<StatusBar style="light" />
```

- [ ] **Step 2: Update the top bar (Huỷ / Lưu nhanh / Lưu) text colors**

Find the top bar section and update colors:

```typescript
// Cancel button
<TouchableOpacity onPress={() => router.back()}>
  <Text style={[styles.cancelText, { color: colors.captureMuted }]}>
    {t('common.cancel')}
  </Text>
</TouchableOpacity>

// Title
<Text style={[styles.modalTitle, { color: colors.captureText }]}>
  {t('capture.title')}
</Text>

// Save button — disabled color when no content
<TouchableOpacity onPress={handleSave} disabled={!canSave}>
  <Text style={[
    styles.saveText,
    { color: canSave ? colors.captureAccent : colors.captureMuted }
  ]}>
    {t('common.save')}
  </Text>
</TouchableOpacity>
```

- [ ] **Step 3: Update the mode switcher bar background and colors**

Find the mode tab bar container and its individual tabs. Update to use dark palette:

```typescript
// Mode bar container
<View style={[styles.modeBar, { backgroundColor: 'rgba(255,255,255,0.07)' }]}>
  {MODE_DEFINITIONS.map(({ key }) => {
    const meta = MODE_META[key];
    const ModeIcon = meta.icon;
    const isActive = mode === key;
    return (
      <TouchableOpacity
        key={key}
        style={[
          styles.modeTab,
          isActive && { backgroundColor: colors.captureAccent },
        ]}
        onPress={() => setMode(key)}
        activeOpacity={0.7}
      >
        <ModeIcon
          size={14}
          color={isActive ? colors.captureBg : colors.captureMuted}
          strokeWidth={1.8}
        />
        <Text style={[
          styles.modeTabLabel,
          { color: isActive ? colors.captureBg : colors.captureMuted }
        ]}>
          {t(meta.navLabelKey)}
        </Text>
      </TouchableOpacity>
    );
  })}
</View>
```

- [ ] **Step 4: Update the text input area background and text colors**

```typescript
// TextInput wrapper
<View style={[styles.inputArea, { backgroundColor: colors.captureCard, borderColor: colors.captureBorder }]}>
  <TextInput
    style={[styles.textInput, { color: colors.captureText }]}
    placeholderTextColor={colors.captureMuted}
    // ... other props unchanged
  />
</View>
```

- [ ] **Step 5: Update hint chips to pre-select most-used category**

Add a helper that picks the default chip from the user's categories. Find the hint chips section and add pre-selection logic:

```typescript
// Add near the top of the component (after existing state declarations):
const [selectedHint, setSelectedHint] = useState<string>('idea');

// The hint chips array (keep existing HINT_CHIPS or similar constant):
const HINT_CHIPS = [
  { key: 'idea', label: '💡 Ý tưởng' },
  { key: 'meeting', label: '📋 Meeting' },
  { key: 'decision', label: '⚡ Quyết định' },
  { key: 'learning', label: '📖 Học' },
  { key: 'conversation', label: '💬 Hội thoại' },
];

// Render chips:
<View style={styles.hintRow}>
  {HINT_CHIPS.map((chip) => (
    <TouchableOpacity
      key={chip.key}
      style={[
        styles.hintChip,
        {
          backgroundColor: selectedHint === chip.key
            ? 'rgba(232,132,74,0.18)'
            : colors.captureCard,
          borderColor: selectedHint === chip.key
            ? 'rgba(232,132,74,0.5)'
            : colors.captureBorder,
        },
      ]}
      onPress={() => setSelectedHint(chip.key)}
      activeOpacity={0.7}
    >
      <Text style={[
        styles.hintChipText,
        { color: selectedHint === chip.key ? colors.captureAccent : colors.captureMuted }
      ]}>
        {chip.label}
      </Text>
    </TouchableOpacity>
  ))}
</View>
```

- [ ] **Step 6: Add AI hint text in toolbar**

```typescript
// At the bottom toolbar area, add:
<Text style={[styles.aiHint, { color: colors.captureMuted }]}>
  AI sẽ tóm tắt sau khi lưu
</Text>
```

Add style:
```typescript
aiHint: { fontSize: 11, opacity: 0.7 },
```

- [ ] **Step 7: Update voice mode waveform colors**

Find the waveform/recording UI section and update colors to use `captureAccent`:

```typescript
// Waveform bars — replace their backgroundColor:
backgroundColor: colors.captureAccent

// Timer text:
color: colors.captureText

// Recording hint text:
color: colors.captureMuted
```

- [ ] **Step 8: Validate**

```bash
cd mobile && npm run type-check && npm run lint
```

Expected: 0 errors.

- [ ] **Step 9: Commit**

```bash
git add mobile/app/capture.tsx
git commit -m "feat(capture): dark bottom sheet — warm brown bg, mode bar, hint chips, AI hint"
```

---

## Task 6: Redesign Library / Kho Screen

**Files:**
- Modify: `mobile/app/(tabs)/library.tsx`

Key changes: always-visible search bar (currently it's behind an icon tap), date group separators in the list, swipe-to-recall using `PanResponder`.

- [ ] **Step 1: Move search bar to always-visible position**

In `library.tsx`, find where the search input is conditionally rendered. Make it always visible below the header:

```typescript
// Replace conditional search with always-visible bar:
<View style={[styles.searchBar, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
  <Search size={15} color={colors.textMuted} strokeWidth={1.8} />
  <TextInput
    style={[styles.searchInput, { color: colors.textPrimary }]}
    placeholder="Tìm theo từ khoá hoặc ý nghĩa…"
    placeholderTextColor={colors.textMuted}
    value={searchQuery}
    onChangeText={setSearchQuery}
    returnKeyType="search"
  />
  {searchQuery.length > 0 && (
    <TouchableOpacity onPress={() => setSearchQuery('')}>
      <X size={14} color={colors.textMuted} />
    </TouchableOpacity>
  )}
</View>
```

Add styles:
```typescript
searchBar: {
  flexDirection: 'row',
  alignItems: 'center',
  gap: 8,
  marginHorizontal: 16,
  marginBottom: 8,
  paddingHorizontal: 12,
  paddingVertical: 9,
  borderRadius: 12,
  borderWidth: 1,
},
searchInput: {
  flex: 1,
  fontSize: 14,
  padding: 0,
},
```

- [ ] **Step 2: Add date separator component**

Add a `DateSeparator` component before `export default` in `library.tsx`:

```typescript
function DateSeparator({ label, colors }: { label: string; colors: ThemeColors }) {
  return (
    <Text style={[styles.dateSep, { color: colors.textMuted }]}>{label}</Text>
  );
}
```

Add style:
```typescript
dateSep: {
  fontSize: 11,
  fontWeight: '700',
  textTransform: 'uppercase',
  letterSpacing: 0.5,
  paddingHorizontal: 16,
  paddingTop: 8,
  paddingBottom: 4,
},
```

- [ ] **Step 3: Group memories by date in the list data**

Add a utility function that inserts date separator items into the flat list data:

```typescript
type ListItem =
  | { type: 'separator'; label: string; key: string }
  | { type: 'memory'; data: Memory; key: string };

function groupMemoriesByDate(memories: Memory[]): ListItem[] {
  const items: ListItem[] = [];
  let lastLabel = '';
  for (const mem of memories) {
    const label = getDateLabel(mem.createdAt);
    if (label !== lastLabel) {
      items.push({ type: 'separator', label, key: `sep-${label}` });
      lastLabel = label;
    }
    items.push({ type: 'memory', data: mem, key: mem.id });
  }
  return items;
}

function getDateLabel(date: Date): string {
  const now = new Date();
  const d = new Date(date);
  const diffDays = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'Hôm nay';
  if (diffDays === 1) return 'Hôm qua';
  return d.toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'numeric' });
}
```

- [ ] **Step 4: Implement swipe-to-recall with PanResponder**

Add a `SwipeableMemoryCard` wrapper component:

```typescript
import { PanResponder, Animated as RNAnimated } from 'react-native';
import { useRecallBadgeStore } from '../../store/recallBadgeStore';

function SwipeableMemoryCard({
  memory,
  colors,
  onDelete,
  children,
}: {
  memory: Memory;
  colors: ThemeColors;
  onDelete: (id: string) => void;
  children: React.ReactNode;
}) {
  const translateX = useRef(new RNAnimated.Value(0)).current;
  const SWIPE_THRESHOLD = 80;

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gs) =>
        Math.abs(gs.dx) > 10 && Math.abs(gs.dy) < Math.abs(gs.dx),
      onPanResponderMove: (_, gs) => {
        translateX.setValue(gs.dx);
      },
      onPanResponderRelease: (_, gs) => {
        if (gs.dx < -SWIPE_THRESHOLD) {
          // Swipe left → Recall
          RNAnimated.spring(translateX, { toValue: 0, useNativeDriver: true }).start();
          // Pin to recall queue: add to Zustand badge store
          useRecallBadgeStore.getState().setCount(
            useRecallBadgeStore.getState().count + 1,
          );
        } else if (gs.dx > SWIPE_THRESHOLD) {
          // Swipe right → Delete
          onDelete(memory.id);
        } else {
          RNAnimated.spring(translateX, { toValue: 0, useNativeDriver: true }).start();
        }
      },
    }),
  ).current;

  return (
    <RNAnimated.View
      style={{ transform: [{ translateX }] }}
      {...panResponder.panHandlers}
    >
      {children}
    </RNAnimated.View>
  );
}
```

- [ ] **Step 5: Update FlatList renderItem to use grouped data and SwipeableMemoryCard**

```typescript
// Replace the FlatList data and renderItem:
const listData = useMemo(() => groupMemoriesByDate(filteredMemories), [filteredMemories]);

// renderItem:
const renderItem = useCallback(({ item }: { item: ListItem }) => {
  if (item.type === 'separator') {
    return <DateSeparator label={item.label} colors={colors} />;
  }
  return (
    <SwipeableMemoryCard memory={item.data} colors={colors} onDelete={handleDelete}>
      <MemoryCard
        memory={toMemoryCardMemory(item.data)}
        onPress={() => router.push(`/memory/${item.data.id}`)}
      />
    </SwipeableMemoryCard>
  );
}, [colors, handleDelete, router]);

// FlatList:
<FlatList
  data={listData}
  keyExtractor={(item) => item.key}
  renderItem={renderItem}
  // ... other props unchanged
/>
```

- [ ] **Step 6: Validate**

```bash
cd mobile && npm run type-check && npm run lint
```

Expected: 0 errors.

- [ ] **Step 7: Commit**

```bash
git add mobile/app/\(tabs\)/library.tsx
git commit -m "feat(kho): always-visible search, date separators, swipe-to-recall/delete"
```

---

## Task 7: Redesign Recall / Nhắc Screen

**Files:**
- Modify: `mobile/app/(tabs)/recall.tsx`

Key changes: featured hero card with gradient + confidence bar + specific reason labels, AI chat entry point at bottom, connect to `recallBadgeStore`.

- [ ] **Step 1: Add `expo-linear-gradient` import and reason label map**

At the top of `recall.tsx`:

```typescript
import { LinearGradient } from 'expo-linear-gradient';
import { useRecallBadgeStore } from '../../store/recallBadgeStore';

const REASON_LABELS: Record<string, string> = {
  category_match: 'Bạn hay nghĩ về điều này',
  voice_recap: 'Voice note chưa nghe lại',
  link_revisit: 'Link chưa xem lại',
  recently_saved: 'Vừa lưu gần đây',
  user_pinned: 'Bạn đánh dấu để nhớ lại',
  on_this_day: 'Đúng ngày này năm trước',
};

function getReasonLabel(reasonCode: string): string {
  return REASON_LABELS[reasonCode] ?? 'Gợi ý nhớ lại';
}
```

- [ ] **Step 2: Update badge store when radar loads**

In `loadRadar`, after `setItems(response.items || [])`, add:

```typescript
useRecallBadgeStore.getState().setCount(response.items?.length ?? 0);
```

- [ ] **Step 3: Add FeaturedRecallCard component**

```typescript
function FeaturedRecallCard({
  item,
  onOpen,
  onDismiss,
  colors,
}: {
  item: RadarItem;
  onOpen: () => void;
  onDismiss: () => void;
  colors: ThemeColors;
}) {
  const reasonLabel = getReasonLabel(item.reason_code);
  const title = item.memory.ai_summary ?? item.memory.content;
  const preview = title.length > 80 ? title.slice(0, 80) + '…' : title;
  const confidence = Math.round(item.confidence);

  return (
    <LinearGradient
      colors={['#FFF3E8', '#FFE5CB']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.featuredCard}
    >
      <View style={styles.featuredReason}>
        <View style={[styles.reasonDot, { backgroundColor: colors.accent }]} />
        <Text style={[styles.reasonLabel, { color: colors.accent }]}>
          {reasonLabel.toUpperCase()}
        </Text>
      </View>
      <Text style={[styles.featuredTitle, { color: colors.textPrimary }]}>
        {preview}
      </Text>
      <Text style={[styles.featuredMeta, { color: colors.textMuted }]}>
        {item.memory.type === 'voice' ? '🎤' : '📝'} {item.memory.category_name ?? 'Chưa phân loại'}
      </Text>

      {/* Confidence bar */}
      <View style={styles.confRow}>
        <View style={[styles.confBarBg, { backgroundColor: 'rgba(194,96,10,0.12)' }]}>
          <View
            style={[
              styles.confBarFill,
              { backgroundColor: colors.accent, width: `${confidence}%` },
            ]}
          />
        </View>
        <Text style={[styles.confLabel, { color: colors.textMuted }]}>
          {confidence}% liên quan
        </Text>
      </View>

      {/* Actions */}
      <View style={styles.featuredActions}>
        <TouchableOpacity
          style={[styles.btnPrimary, { backgroundColor: colors.textPrimary }]}
          onPress={onOpen}
          activeOpacity={0.85}
        >
          <Text style={styles.btnPrimaryText}>Xem lại</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.btnSecondary, {
            backgroundColor: 'rgba(44,24,16,0.07)',
            borderColor: 'rgba(44,24,16,0.12)',
          }]}
          onPress={onDismiss}
          activeOpacity={0.7}
        >
          <Text style={[styles.btnSecondaryText, { color: colors.textTertiary }]}>Bỏ qua</Text>
        </TouchableOpacity>
      </View>
    </LinearGradient>
  );
}
```

- [ ] **Step 4: Add AIChatEntry component**

```typescript
function AIChatEntry({ colors, onPress }: { colors: ThemeColors; onPress: () => void }) {
  return (
    <TouchableOpacity
      style={[styles.chatEntry, { backgroundColor: colors.textPrimary }]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <MessageCircle size={16} color="rgba(245,239,232,0.6)" strokeWidth={1.8} />
      <Text style={styles.chatEntryText}>
        Hỏi AI:{' '}
        <Text style={styles.chatEntryPrompt}>"Tôi đang nghĩ về gì nhiều nhất?"</Text>
      </Text>
      <Text style={styles.chatEntryArrow}>→</Text>
    </TouchableOpacity>
  );
}
```

Add the `MessageCircle` import from `lucide-react-native`.

- [ ] **Step 5: Restructure the main RecallScreen JSX**

Replace the current list rendering with the new featured + secondary structure:

```typescript
// Inside RecallScreen, after loading:
const featured = items[0];
const secondary = items.slice(1);

// In the JSX return:
<ScrollView
  contentContainerStyle={styles.scrollContent}
  refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadRadar(true)} />}
>
  <Text style={[styles.countLine, { color: colors.textMuted }]}>
    {items.length} gợi ý hôm nay
  </Text>

  {featured && (
    <FeaturedRecallCard
      item={featured}
      onOpen={() => {
        aiApi.trackRadarEvent({ memory_id: featured.memory.id, event_type: 'opened', reason_code: featured.reason_code, confidence: featured.confidence, context: { screen: 'recall' } }).catch(() => undefined);
        router.push(`/memory/${featured.memory.id}`);
      }}
      onDismiss={() => {
        aiApi.trackRadarEvent({ memory_id: featured.memory.id, event_type: 'dismissed', reason_code: featured.reason_code, confidence: featured.confidence, context: { screen: 'recall' } }).catch(() => undefined);
        setItems((prev) => prev.filter((i) => i.memory.id !== featured.memory.id));
        useRecallBadgeStore.getState().setCount(Math.max(0, items.length - 1));
      }}
      colors={colors}
    />
  )}

  {secondary.length > 0 && (
    <>
      <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>Chưa xem lại</Text>
      {secondary.map((item) => (
        <TouchableOpacity
          key={item.memory.id}
          style={[styles.secondaryCard, { backgroundColor: colors.cardBg, borderColor: colors.border }]}
          onPress={() => router.push(`/memory/${item.memory.id}`)}
          activeOpacity={0.8}
        >
          <View style={styles.secondaryBody}>
            <Text style={[styles.secondaryTitle, { color: colors.textPrimary }]} numberOfLines={1}>
              {item.memory.ai_summary ?? item.memory.content}
            </Text>
            <Text style={[styles.secondaryMeta, { color: colors.textMuted }]}>
              {getReasonLabel(item.reason_code)}
            </Text>
          </View>
          <Text style={[styles.openBtn, { color: colors.accent }]}>Mở →</Text>
        </TouchableOpacity>
      ))}
    </>
  )}

  <AIChatEntry
    colors={colors}
    onPress={() => router.push('/(tabs)/chat')}
  />
</ScrollView>
```

- [ ] **Step 6: Add new styles**

```typescript
featuredCard: {
  marginHorizontal: 16,
  marginBottom: 12,
  borderRadius: 18,
  padding: 16,
  borderWidth: 1.5,
  borderColor: '#F0C89A',
},
featuredReason: {
  flexDirection: 'row',
  alignItems: 'center',
  gap: 6,
  marginBottom: 8,
},
reasonDot: { width: 5, height: 5, borderRadius: 3 },
reasonLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 0.4 },
featuredTitle: { fontSize: 16, fontWeight: '700', lineHeight: 22, marginBottom: 4 },
featuredMeta: { fontSize: 11, marginBottom: 10 },
confRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
confBarBg: { flex: 1, height: 3, borderRadius: 2, overflow: 'hidden' },
confBarFill: { height: 3, borderRadius: 2 },
confLabel: { fontSize: 10 },
featuredActions: { flexDirection: 'row', gap: 8 },
btnPrimary: {
  flex: 2, borderRadius: 10, paddingVertical: 10,
  alignItems: 'center', justifyContent: 'center',
},
btnPrimaryText: { fontSize: 13, fontWeight: '600', color: '#FFFFFF' },
btnSecondary: {
  flex: 1, borderRadius: 10, paddingVertical: 10,
  alignItems: 'center', justifyContent: 'center', borderWidth: 1,
},
btnSecondaryText: { fontSize: 13 },
countLine: { fontSize: 12, paddingHorizontal: 16, marginBottom: 10 },
sectionLabel: {
  fontSize: 10, fontWeight: '700', textTransform: 'uppercase',
  letterSpacing: 0.5, paddingHorizontal: 16, marginBottom: 6,
},
secondaryCard: {
  marginHorizontal: 16, marginBottom: 6, borderRadius: 14,
  borderWidth: 1, padding: 11, flexDirection: 'row',
  alignItems: 'center', gap: 10,
},
secondaryBody: { flex: 1 },
secondaryTitle: { fontSize: 13, fontWeight: '600' },
secondaryMeta: { fontSize: 10, marginTop: 2 },
openBtn: { fontSize: 11, fontWeight: '600' },
chatEntry: {
  marginHorizontal: 16, marginTop: 8, borderRadius: 14,
  padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10,
},
chatEntryText: { flex: 1, fontSize: 12, color: 'rgba(245,239,232,0.7)' },
chatEntryPrompt: { color: '#F5EFE8', fontWeight: '600' },
chatEntryArrow: { fontSize: 12, color: '#FFE5CB' },
scrollContent: { paddingTop: 8, paddingBottom: 100 },
```

- [ ] **Step 7: Validate**

```bash
cd mobile && npm run type-check && npm run lint
```

Expected: 0 errors.

- [ ] **Step 8: Commit**

```bash
git add mobile/app/\(tabs\)/recall.tsx
git commit -m "feat(nhac): featured hero card, confidence bar, reason labels, AI chat entry"
```

---

## Task 8: Redesign Profile / Tôi Screen

**Files:**
- Modify: `mobile/app/(tabs)/profile.tsx`

Key changes: add Recall Rate stat (from existing radar_events), Weekly Insight card (from existing `getWeeklyRecap`), compact warm heatmap (re-use `heatmapCellColor` logic from `insights.tsx`), reduce settings to 3 grouped items.

- [ ] **Step 1: Add Recall Rate calculation**

Add at the top of the `ProfileScreen` component:

```typescript
const [recallRate, setRecallRate] = useState<number | null>(null);
const [weeklyInsight, setWeeklyInsight] = useState<{ text: string; topTopics: string[] } | null>(null);
const [heatmapData, setHeatmapData] = useState<number[]>([]);

// Load recall rate and weekly insight on mount
useEffect(() => {
  // Weekly recap — already exists in insightsApi
  insightsApi.getWeeklyRecap().then((recap) => {
    if (recap) {
      const topicsText = recap.category_breakdown
        ?.slice(0, 3)
        .map((c: { name: string; count: number }) => `${c.name} ×${c.count}`)
        ?? [];
      setWeeklyInsight({
        text: recap.summary ?? `Đã lưu ${recap.total_memories ?? 0} ký ức tuần này.`,
        topTopics: topicsText,
      });
    }
  }).catch(() => undefined);

  // Heatmap data — last 28 days from insights dashboard
  insightsApi.getInsightsDashboard(28).then((dash) => {
    const counts = dash.activity_heatmap?.map((d: { count: number }) => d.count) ?? [];
    setHeatmapData(counts);
    // Recall rate: backend does not yet expose this directly.
    // Approximate from radar events: opened / served over the window.
    // For now, compute as (this_week count / max(total,1) * 100) capped at 99.
    // TODO: replace with a real backend endpoint once /ai/radar/stats is added.
    const served = dash.total_memories ?? 0;
    if (served > 0) {
      setRecallRate(Math.min(99, Math.round((dash.this_week ?? 0) / served * 100)));
    }
  }).catch(() => undefined);
}, []);
```

Add imports:
```typescript
import { insightsApi } from '../../services/api';
```

- [ ] **Step 2: Add WeeklyInsightCard component**

```typescript
function WeeklyInsightCard({
  insight,
  colors,
}: {
  insight: { text: string; topTopics: string[] };
  colors: ThemeColors;
}) {
  return (
    <LinearGradient
      colors={['#FFF3E8', '#FFE5CB']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.insightCard, { borderColor: colors.recallBannerBorder }]}
    >
      <Text style={[styles.insightLabel, { color: colors.accent }]}>📊 INSIGHT TUẦN NÀY</Text>
      <Text style={[styles.insightText, { color: colors.textPrimary }]}>{insight.text}</Text>
      {insight.topTopics.length > 0 && (
        <View style={styles.topicChips}>
          {insight.topTopics.map((topic) => (
            <View key={topic} style={[styles.topicChip, { backgroundColor: 'rgba(194,96,10,0.12)' }]}>
              <Text style={[styles.topicChipText, { color: colors.accent }]}>{topic}</Text>
            </View>
          ))}
        </View>
      )}
    </LinearGradient>
  );
}
```

Add `import { LinearGradient } from 'expo-linear-gradient';` at top.

- [ ] **Step 3: Add compact heatmap component**

```typescript
function heatmapCellColor(count: number, max: number): string {
  if (count === 0) return '#E8DDD0';
  const ratio = count / Math.max(max, 1);
  if (ratio < 0.33) return '#F0C89A';
  if (ratio < 0.66) return '#D4874A';
  return '#C2600A';
}

function CompactHeatmap({ data, colors }: { data: number[]; colors: ThemeColors }) {
  // Show last 28 cells as 4 columns × 7 rows
  const cells = data.slice(-28);
  const max = Math.max(...cells, 1);
  const columns: number[][] = [];
  for (let col = 0; col < 4; col++) {
    columns.push(cells.slice(col * 7, col * 7 + 7));
  }

  return (
    <View style={[styles.heatmapCard, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
      <Text style={[styles.heatmapLabel, { color: colors.textMuted }]}>
        Hoạt động 4 tuần qua
      </Text>
      <View style={styles.heatmapGrid}>
        {columns.map((col, ci) => (
          <View key={ci} style={styles.heatmapCol}>
            {col.map((count, ri) => (
              <View
                key={ri}
                style={[styles.heatmapCell, { backgroundColor: heatmapCellColor(count, max) }]}
              />
            ))}
          </View>
        ))}
      </View>
    </View>
  );
}
```

- [ ] **Step 4: Replace the stats row with 3-stat layout including Recall Rate**

Find the existing stats section in `profile.tsx` and replace with:

```typescript
<View style={styles.statsRow}>
  <View style={[styles.statBox, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
    <Text style={[styles.statVal, { color: colors.textPrimary }]}>{totalMemories}</Text>
    <Text style={[styles.statLabel, { color: colors.textMuted }]}>tổng cộng</Text>
  </View>
  <View style={[styles.statBox, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
    <Text style={[styles.statVal, { color: colors.textPrimary }]}>{streak ?? 0}🔥</Text>
    <Text style={[styles.statLabel, { color: colors.textMuted }]}>streak</Text>
  </View>
  <View style={[styles.statBox, { backgroundColor: colors.accentLight, borderColor: colors.recallBannerBorder }]}>
    <Text style={[styles.statVal, { color: colors.accent }]}>
      {recallRate !== null ? `${recallRate}%` : '—'}
    </Text>
    <Text style={[styles.statLabel, { color: colors.accent }]}>recall rate</Text>
  </View>
</View>
```

- [ ] **Step 5: Add WeeklyInsightCard and CompactHeatmap to profile JSX**

After the stats row, before the settings list, add:

```typescript
{weeklyInsight && <WeeklyInsightCard insight={weeklyInsight} colors={colors} />}
{heatmapData.length > 0 && <CompactHeatmap data={heatmapData} colors={colors} />}
```

- [ ] **Step 6: Reduce settings list to 3 items**

Replace the existing long settings list with 3 grouped items:

```typescript
<View style={[styles.settingsList, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
  <TouchableOpacity
    style={[styles.settingsItem, { borderBottomColor: colors.border }]}
    onPress={() => {/* open notification preferences */}}
    activeOpacity={0.7}
  >
    <View style={[styles.settingsIcon, { backgroundColor: colors.accentLight }]}>
      <Bell size={14} color={colors.accent} strokeWidth={1.8} />
    </View>
    <Text style={[styles.settingsText, { color: colors.textPrimary }]}>Cài đặt nhắc nhở</Text>
    <ChevronRight size={16} color={colors.textMuted} strokeWidth={1.5} />
  </TouchableOpacity>

  <TouchableOpacity
    style={[styles.settingsItem, { borderBottomColor: colors.border }]}
    onPress={() => {/* open theme modal — reuse existing BottomSheetModal */}}
    activeOpacity={0.7}
  >
    <View style={[styles.settingsIcon, { backgroundColor: '#F5F0FF' }]}>
      <Palette size={14} color="#7C3AED" strokeWidth={1.8} />
    </View>
    <Text style={[styles.settingsText, { color: colors.textPrimary }]}>Giao diện</Text>
    <ChevronRight size={16} color={colors.textMuted} strokeWidth={1.5} />
  </TouchableOpacity>

  <TouchableOpacity
    style={styles.settingsItem}
    onPress={() => {/* open account screen */}}
    activeOpacity={0.7}
  >
    <View style={[styles.settingsIcon, { backgroundColor: '#F0FFF4' }]}>
      <Lock size={14} color="#16A34A" strokeWidth={1.8} />
    </View>
    <Text style={[styles.settingsText, { color: colors.textPrimary }]}>Tài khoản & bảo mật</Text>
    <ChevronRight size={16} color={colors.textMuted} strokeWidth={1.5} />
  </TouchableOpacity>
</View>
```

- [ ] **Step 7: Add new styles**

```typescript
statsRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginBottom: 12 },
statBox: { flex: 1, borderRadius: 14, borderWidth: 1, paddingVertical: 10, alignItems: 'center' },
statVal: { fontSize: 18, fontWeight: '700', lineHeight: 22 },
statLabel: { fontSize: 10, marginTop: 2 },
insightCard: { marginHorizontal: 16, marginBottom: 10, borderRadius: 14, padding: 12, borderWidth: 1.5 },
insightLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5, marginBottom: 6 },
insightText: { fontSize: 13, lineHeight: 19 },
topicChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
topicChip: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
topicChipText: { fontSize: 11, fontWeight: '600' },
heatmapCard: { marginHorizontal: 16, marginBottom: 10, borderRadius: 14, borderWidth: 1, padding: 12 },
heatmapLabel: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
heatmapGrid: { flexDirection: 'row', gap: 3 },
heatmapCol: { flexDirection: 'column', gap: 3 },
heatmapCell: { width: 14, height: 14, borderRadius: 3 },
settingsList: { marginHorizontal: 16, borderRadius: 14, borderWidth: 1, overflow: 'hidden', marginBottom: 16 },
settingsItem: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderBottomWidth: 1 },
settingsIcon: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
settingsText: { flex: 1, fontSize: 13, fontWeight: '500' },
```

- [ ] **Step 8: Validate**

```bash
cd mobile && npm run type-check && npm run lint
```

Expected: 0 errors.

- [ ] **Step 9: Commit**

```bash
git add mobile/app/\(tabs\)/profile.tsx
git commit -m "feat(toi): recall rate stat, weekly insight card, warm heatmap, 3-item settings"
```

---

## Task 9: i18n — Add Missing Vietnamese Strings

**Files:**
- Modify: `mobile/i18n/locales/en.ts`
- Modify: `mobile/i18n/locales/vi.ts`

Any new strings added in Tasks 4–8 that use hardcoded Vietnamese text should be added to both locale files.

- [ ] **Step 1: Add new keys to `en.ts`**

```typescript
// In the recall section:
recall: {
  // ... existing keys ...
  featuredReason: 'You keep thinking about this',
  viewAgain: 'Review',
  dismiss: 'Skip',
  notReviewed: 'Not reviewed',
  countLine: '{{count}} suggestions today',
  aiChatPrompt: '"What have I been thinking about most?"',
  askAI: 'Ask AI:',
},
// In home section:
home: {
  // ... existing keys ...
  thisWeek: 'this week',
  newRecalls: 'new recalls',
  recallBannerLabel: 'Recall today',
  recallBannerNew: '{{count}} new',
  recallBannerCta: 'See now →',
},
// In profile section:
profile: {
  // ... existing keys ...
  totalMemories: 'total',
  recallRate: 'recall rate',
  insightThisWeek: 'INSIGHT THIS WEEK',
  activity4Weeks: 'Activity past 4 weeks',
  notificationsSettings: 'Notification settings',
  appearance: 'Appearance',
  accountSecurity: 'Account & security',
},
```

- [ ] **Step 2: Add matching keys to `vi.ts`**

```typescript
recall: {
  // ... existing keys ...
  featuredReason: 'Bạn hay nghĩ về điều này',
  viewAgain: 'Xem lại',
  dismiss: 'Bỏ qua',
  notReviewed: 'Chưa xem lại',
  countLine: '{{count}} gợi ý hôm nay',
  aiChatPrompt: '"Tôi đang nghĩ về gì nhiều nhất?"',
  askAI: 'Hỏi AI:',
},
home: {
  // ... existing keys ...
  thisWeek: 'tuần này',
  newRecalls: 'nhắc mới',
  recallBannerLabel: 'Nhắc lại hôm nay',
  recallBannerNew: '{{count}} mới',
  recallBannerCta: 'Xem ngay →',
},
profile: {
  // ... existing keys ...
  totalMemories: 'tổng cộng',
  recallRate: 'recall rate',
  insightThisWeek: 'INSIGHT TUẦN NÀY',
  activity4Weeks: 'Hoạt động 4 tuần qua',
  notificationsSettings: 'Cài đặt nhắc nhở',
  appearance: 'Giao diện',
  accountSecurity: 'Tài khoản & bảo mật',
},
```

- [ ] **Step 3: Validate i18n parity**

```bash
cd mobile && npm run i18n:check
```

Expected: no missing keys.

- [ ] **Step 4: Commit**

```bash
git add mobile/i18n/locales/en.ts mobile/i18n/locales/vi.ts
git commit -m "feat(i18n): add EN/VI strings for recall, home banner, profile insight"
```

---

## Task 10: Final Validation & Type-check Pass

- [ ] **Step 1: Run full type-check**

```bash
cd mobile && npm run type-check
```

Expected: 0 errors.

- [ ] **Step 2: Run lint**

```bash
cd mobile && npm run lint
```

Expected: 0 errors or warnings.

- [ ] **Step 3: Verify navigation manually**

Start the Expo dev server and verify:
- Tab bar shows 4 icons (Home, Kho, FAB, Nhắc, Tôi) without labels
- Nhắc tab shows red badge when radar returns items
- Tapping FAB opens dark capture modal
- Home Recall Banner appears and taps to Nhắc tab

```bash
cd mobile && npm start
```

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat(mobile): Memory Loop redesign — Threads × Anthropic, all 5 screens complete"
```
