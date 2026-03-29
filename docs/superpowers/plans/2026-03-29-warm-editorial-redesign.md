# Warm Editorial Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current Threads × Anthropic visual direction with a Warm Editorial aesthetic — cream/warm-charcoal palette, DM Sans bold headers (no more serif italic), tighter orange accent, and a smaller square add button in the floating tab bar.

**Architecture:** Visual-only pass. Update design tokens in ThemeContext, add the missing 700-weight font, fix shared components (ScreenHeader, MemoryCard, CapturePrompt, tab bar), then let each screen inherit. Only Memory Detail and Insights need screen-level fixes beyond inheritance.

**Tech Stack:** React Native / Expo, `@expo-google-fonts/dm-sans`, `@expo-google-fonts/dm-serif-display` (being removed), TypeScript.

---

## File Map

| File | Change |
|---|---|
| `mobile/constants/ThemeContext.tsx` | New light + dark token values, new `brandAccent` |
| `mobile/app/_layout.tsx` | Add `DMSans_700Bold`; remove `DMSerifDisplay_400Regular_Italic` |
| `mobile/components/ScreenHeader.tsx` | Replace `SerifTitle` with DM Sans 700 bold inline |
| `mobile/components/MemoryCard.tsx` | `cardBg` bg, shadow, plain type labels, 13px body |
| `mobile/components/CapturePrompt.tsx` | `cardBg` bg + token border |
| `mobile/app/(tabs)/_layout.tsx` | Smaller square add button, fix inactive icon color |
| `mobile/components/SerifTitle.tsx` | **Delete** |
| `mobile/app/memory/[id].tsx` | Replace `SerifTitle` import with inline DM Sans 700 |
| `mobile/app/(tabs)/insights.tsx` | Fix hardcoded orange hex in `heatmapCellColor` |
| `mobile/app/(tabs)/home.tsx` | Verify — no code changes needed |
| `mobile/app/(tabs)/library.tsx` | Search bar tokens, filter pill active state |
| `mobile/app/(tabs)/profile.tsx` | Verify — no code changes needed |
| `mobile/app/capture.tsx` | Mode tab active style via `brandAccent` token |

---

## Task 1: Update color tokens

**Files:**
- Modify: `mobile/constants/ThemeContext.tsx`

- [ ] **Replace the full `LightColors` object**

```typescript
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
```

- [ ] **Replace the full `DarkColors` object**

```typescript
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
```

- [ ] **Commit**

```bash
git add mobile/constants/ThemeContext.tsx
git commit -m "feat: update color tokens to warm editorial palette"
```

---

## Task 2: Add DMSans_700Bold font, remove DMSerifDisplay

**Files:**
- Modify: `mobile/app/_layout.tsx`

- [ ] **Update the import block** — add `DMSans_700Bold`, remove `DMSerifDisplay_400Regular_Italic`

Find this block at the top of `mobile/app/_layout.tsx`:
```typescript
import { useFonts } from 'expo-font';
import { DMSerifDisplay_400Regular_Italic } from '@expo-google-fonts/dm-serif-display';
import {
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_600SemiBold,
} from '@expo-google-fonts/dm-sans';
```

Replace with:
```typescript
import { useFonts } from 'expo-font';
import {
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_600SemiBold,
  DMSans_700Bold,
} from '@expo-google-fonts/dm-sans';
```

- [ ] **Update the `useFonts` call** inside `RootLayout` — remove `DMSerifDisplay_400Regular_Italic`, add `DMSans_700Bold`

Find:
```typescript
const [fontsLoaded] = useFonts({
  DMSerifDisplay_400Regular_Italic,
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_600SemiBold,
});
```

Replace with:
```typescript
const [fontsLoaded] = useFonts({
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_600SemiBold,
  DMSans_700Bold,
});
```

- [ ] **Verify the package has the 700 weight**

```bash
node -e "require('@expo-google-fonts/dm-sans'); console.log('ok')"
```

Expected: `ok`. If it errors, run `cd mobile && npx expo install @expo-google-fonts/dm-sans` to update the package.

- [ ] **Commit**

```bash
git add mobile/app/_layout.tsx
git commit -m "feat: add DMSans_700Bold font, remove DMSerifDisplay"
```

---

## Task 3: Update ScreenHeader — replace SerifTitle with DM Sans 700

**Files:**
- Modify: `mobile/components/ScreenHeader.tsx`

- [ ] **Replace the entire file**

```typescript
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../constants/ThemeContext';

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
  titleSize = 26,
  paddingHorizontal = 20,
}: ScreenHeaderProps) {
  const { colors } = useTheme();

  return (
    <View style={[styles.container, { paddingHorizontal }]}>
      {eyebrow ? (
        <Text style={[styles.eyebrow, { color: colors.textMuted }]}>
          {eyebrow.toUpperCase()}
        </Text>
      ) : null}
      <Text
        style={[
          styles.title,
          { color: colors.textPrimary, fontSize: titleSize },
        ]}
      >
        {title}
      </Text>
      {subtitle ? (
        <Text style={[styles.subtitle, { color: colors.textMuted }]}>
          {subtitle}
        </Text>
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
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  title: {
    fontFamily: 'DMSans_700Bold',
    letterSpacing: -0.5,
    lineHeight: 32,
  },
  subtitle: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 13,
    marginTop: 4,
    lineHeight: 18,
  },
});
```

Note: `eyebrow` now uses `colors.textMuted` instead of `colors.brandAccent` — eyebrows are structural labels, not accent elements.

- [ ] **Commit**

```bash
git add mobile/components/ScreenHeader.tsx
git commit -m "feat: replace serif title in ScreenHeader with DM Sans 700 bold"
```

---

## Task 4: Update MemoryCard

**Files:**
- Modify: `mobile/components/MemoryCard.tsx`

- [ ] **Update the `TYPE_LABEL` map** — remove emoji, use plain lowercase text

Find:
```typescript
const TYPE_LABEL: Record<MemoryCardMemory['type'], string> = {
  text: '✏ text',
  voice: '🎙 voice',
  link: '🔗 link',
  photo: '📷 photo',
};
```

Replace with:
```typescript
const TYPE_LABEL: Record<MemoryCardMemory['type'], string> = {
  text: 'text',
  voice: 'voice',
  link: 'link',
  photo: 'photo',
};
```

- [ ] **Update the card `style`** — use `cardBg` and add light-mode shadow

Find:
```typescript
style={[
  styles.card,
  { backgroundColor: colors.inputBg, borderColor: colors.border },
]}
```

Replace with:
```typescript
style={[
  styles.card,
  {
    backgroundColor: colors.cardBg,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
]}
```

- [ ] **Update `bodyText` fontSize** in `StyleSheet.create`

Find:
```typescript
bodyText: {
  fontFamily: 'DMSans_400Regular',
  fontSize: 14,
  lineHeight: 21,
},
```

Replace with:
```typescript
bodyText: {
  fontFamily: 'DMSans_400Regular',
  fontSize: 13,
  lineHeight: 20,
},
```

- [ ] **Commit**

```bash
git add mobile/components/MemoryCard.tsx
git commit -m "feat: update MemoryCard — cardBg, shadow, plain type labels, 13px body"
```

---

## Task 5: Update CapturePrompt

**Files:**
- Modify: `mobile/components/CapturePrompt.tsx`

- [ ] **Replace the hardcoded `backgroundColor`** with `colors.cardBg` and update text color

Find:
```typescript
style={[
  styles.container,
  {
    borderColor: colors.border,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
]}
```

Replace with:
```typescript
style={[
  styles.container,
  {
    borderColor: colors.border,
    backgroundColor: colors.cardBg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
]}
```

- [ ] **Update placeholder text color** — use `textMuted` instead of `textPlaceholder`

Find:
```typescript
<Text style={[styles.text, { color: colors.textPlaceholder }]}>
```

Replace with:
```typescript
<Text style={[styles.text, { color: colors.textMuted }]}>
```

- [ ] **Remove italic style** from `styles.text`

Find:
```typescript
text: {
  fontFamily: 'DMSans_400Regular',
  fontSize: 14,
  fontStyle: 'italic',
},
```

Replace with:
```typescript
text: {
  fontFamily: 'DMSans_400Regular',
  fontSize: 14,
},
```

- [ ] **Commit**

```bash
git add mobile/components/CapturePrompt.tsx
git commit -m "feat: update CapturePrompt — cardBg, token border, remove italic"
```

---

## Task 6: Update tab bar — smaller square add button

**Files:**
- Modify: `mobile/app/(tabs)/_layout.tsx`

- [ ] **Fix inactive icon color** — replace hardcoded `#2a2a2a` with `colors.textMuted`

Find (two occurrences in `TabIcon`):
```typescript
color={focused ? colors.textPrimary : '#2a2a2a'}
```

Replace with:
```typescript
color={focused ? colors.textPrimary : colors.textMuted}
```

- [ ] **Replace `CreateTabButton` render** — remove outer ring, reduce button to 34×34, square border-radius

Find the JSX inside `CreateTabButton`'s return:
```typescript
<Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
  <View style={[styles.createBtnRing, { backgroundColor: colors.brandAccentLight }]}>
    <View style={[styles.createBtn, { backgroundColor: colors.brandAccent }]}>
      <Plus size={22} color="#FFFFFF" strokeWidth={2.8} />
    </View>
  </View>
</Animated.View>
```

Replace with:
```typescript
<Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
  <View style={[styles.createBtn, { backgroundColor: colors.brandAccent }]}>
    <Plus size={18} color="#FFFFFF" strokeWidth={2.5} />
  </View>
</Animated.View>
```

- [ ] **Update `StyleSheet`** — replace `createBtnRing` + `createBtn` styles

Find:
```typescript
createBtnRing: {
  width: 50,
  height: 50,
  borderRadius: 25,
  alignItems: 'center',
  justifyContent: 'center',
},
createBtn: {
  width: 44,
  height: 44,
  borderRadius: 22,
  alignItems: 'center',
  justifyContent: 'center',
  shadowColor: '#C56A3A',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.35,
  shadowRadius: 10,
  elevation: 6,
},
```

Replace with:
```typescript
createBtn: {
  width: 34,
  height: 34,
  borderRadius: 10,
  alignItems: 'center',
  justifyContent: 'center',
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.15,
  shadowRadius: 4,
  elevation: 3,
},
```

- [ ] **Commit**

```bash
git add mobile/app/(tabs)/_layout.tsx
git commit -m "feat: shrink tab bar add button to 34x34 square, fix inactive icon color"
```

---

## Task 7: Delete SerifTitle component

**Files:**
- Delete: `mobile/components/SerifTitle.tsx`

At this point `SerifTitle` is only imported by `mobile/app/memory/[id].tsx` (handled in Task 8) — `ScreenHeader` no longer uses it after Task 3.

- [ ] **Verify no remaining imports**

```bash
grep -r "SerifTitle" mobile/app mobile/components
```

Expected output: only `mobile/app/memory/[id].tsx` (which Task 8 will fix). If any other file appears, fix it first.

- [ ] **Delete the file**

```bash
rm mobile/components/SerifTitle.tsx
```

- [ ] **Commit**

```bash
git commit -am "feat: delete SerifTitle component"
```

---

## Task 8: Fix Memory Detail — replace SerifTitle with DM Sans 700

**Files:**
- Modify: `mobile/app/memory/[id].tsx`

- [ ] **Remove the SerifTitle import**

Find:
```typescript
import { SerifTitle } from '../../components/SerifTitle';
```

Delete that line entirely.

- [ ] **Find where `SerifTitle` is used** in this file

```bash
grep -n "SerifTitle" mobile/app/memory/\[id\].tsx
```

Note the line number(s) returned.

- [ ] **Replace each `<SerifTitle>` usage** with a `<Text>` styled with DM Sans 700

Replace any usage like:
```typescript
<SerifTitle size={28}>{memory.content}</SerifTitle>
```

With:
```typescript
<Text
  style={{
    fontFamily: 'DMSans_700Bold',
    fontSize: 22,
    letterSpacing: -0.3,
    lineHeight: 28,
    color: colors.textPrimary,
  }}
>
  {memory.content}
</Text>
```

Adjust the field name (`memory.content`, `memory.title`, etc.) to match what the file actually renders. Use the line number from the grep above to read the exact context.

- [ ] **Commit**

```bash
git add "mobile/app/memory/[id].tsx"
git commit -m "feat: replace SerifTitle with DM Sans 700 in memory detail"
```

---

## Task 9: Fix Insights — update hardcoded orange in heatmap

**Files:**
- Modify: `mobile/app/(tabs)/insights.tsx`

- [ ] **Replace the `heatmapCellColor` function** — swap hardcoded `#C56A3A` for `#b85c20` and update empty-cell bg to be theme-aware

Find:
```typescript
function heatmapCellColor(count: number, max: number): string {
  if (count === 0) return 'rgba(255,255,255,0.04)';
  const ratio = count / Math.max(max, 1);
  if (ratio < 0.25) return 'rgba(197,106,58,0.2)';
  if (ratio < 0.5)  return 'rgba(197,106,58,0.45)';
  if (ratio < 0.75) return 'rgba(197,106,58,0.7)';
  return '#C56A3A';
}
```

Replace with:
```typescript
function heatmapCellColor(count: number, max: number, isDark: boolean): string {
  if (count === 0) return isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)';
  const ratio = count / Math.max(max, 1);
  if (ratio < 0.25) return 'rgba(184,92,32,0.20)';
  if (ratio < 0.5)  return 'rgba(184,92,32,0.45)';
  if (ratio < 0.75) return 'rgba(184,92,32,0.70)';
  return '#b85c20';
}
```

- [ ] **Pass `isDark` to every call site** of `heatmapCellColor`

Search for all usages:
```bash
grep -n "heatmapCellColor" mobile/app/\(tabs\)/insights.tsx
```

For each call like `heatmapCellColor(count, max)`, update to `heatmapCellColor(count, max, isDark)`. The `isDark` value comes from `const { colors, isDark } = useTheme()` — verify that destructure exists in the component using the function, adding `isDark` to the destructure if needed.

- [ ] **Commit**

```bash
git add mobile/app/\(tabs\)/insights.tsx
git commit -m "feat: fix hardcoded orange in insights heatmap, make light-mode aware"
```

---

## Task 10: Fix Library — search bar and filter pill active state

**Files:**
- Modify: `mobile/app/(tabs)/library.tsx`

- [ ] **Find the search bar style** (look for `background` or `backgroundColor` near "search")

```bash
grep -n "search\|Search\|inputBg\|rgba(255,255" mobile/app/\(tabs\)/library.tsx | head -20
```

Update the search bar container style to use `colors.cardBg` for background and `colors.border` for border, with a light shadow:

```typescript
{
  backgroundColor: colors.cardBg,
  borderColor: colors.border,
  borderWidth: 1,
  borderRadius: 10,
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 1 },
  shadowOpacity: 0.04,
  shadowRadius: 3,
  elevation: 1,
}
```

- [ ] **Find the filter pill active/inactive styles** in the same file

```bash
grep -n "brandAccent\|filter\|pill\|active" mobile/app/\(tabs\)/library.tsx | head -20
```

Ensure the active pill uses `colors.brandAccentLight` background and `colors.brandAccent` text. The inactive pill uses `colors.cardBg` background, `colors.border` border, and `colors.textMuted` text. Make sure no hardcoded hex values like `#C56A3A` remain.

- [ ] **Commit**

```bash
git add mobile/app/\(tabs\)/library.tsx
git commit -m "feat: update library search bar and filter pills to warm editorial tokens"
```

---

## Task 11: Fix Capture sheet — mode tab active style

**Files:**
- Modify: `mobile/app/capture.tsx`

- [ ] **Find the mode tab (text/voice/link/photo) active indicator**

```bash
grep -n "active\|brandAccent\|C56A3A\|mode" mobile/app/capture.tsx | head -30
```

- [ ] **Replace any hardcoded orange hex** in the mode tabs with `colors.brandAccent`

For active tab text/underline/pill styles, use `colors.brandAccent`. For active tab background (if used), use `colors.brandAccentLight`. For the submit/save button, ensure it uses `colors.brandAccent` as background (not a hardcoded hex).

Example pattern to find and fix:
```typescript
// Before (hardcoded)
backgroundColor: '#C56A3A'
color: '#C56A3A'

// After (token)
backgroundColor: colors.brandAccent
color: colors.brandAccent
```

- [ ] **Commit**

```bash
git add mobile/app/capture.tsx
git commit -m "feat: update capture sheet mode tabs to use brandAccent token"
```

---

## Task 12: Verify Home and Profile screens

**Files:**
- Read: `mobile/app/(tabs)/home.tsx`
- Read: `mobile/app/(tabs)/profile.tsx`

These screens use `ScreenHeader` + `MemoryCard` + theme tokens — they inherit all changes from Tasks 1–6 automatically. This task is a sanity check only.

- [ ] **Scan Home for any hardcoded orange hex**

```bash
grep -n "C56A3A\|C56a3a\|c56a3a" mobile/app/\(tabs\)/home.tsx
```

Expected: no matches. If any appear, replace with `colors.brandAccent`.

- [ ] **Scan Profile for any hardcoded orange hex**

```bash
grep -n "C56A3A\|C56a3a\|c56a3a" mobile/app/\(tabs\)/profile.tsx
```

Expected: no matches. If any appear, replace with `colors.brandAccent`.

- [ ] **Do a project-wide hardcoded hex sweep**

```bash
grep -rn "C56A3A\|C56a3a" mobile/app mobile/components
```

Replace any remaining hits with `colors.brandAccent` (or `colors.brandAccentLight` for the light variant).

- [ ] **Commit any fixes found**, or if nothing to change:

```bash
git commit --allow-empty -m "chore: verify home and profile inherit warm editorial tokens"
```

---

## Task 13: Final sweep and smoke test

- [ ] **Check no remaining SerifTitle references**

```bash
grep -rn "SerifTitle\|DMSerifDisplay" mobile/
```

Expected: zero matches.

- [ ] **Check no remaining old brandAccent hex**

```bash
grep -rn "C56A3A" mobile/
```

Expected: zero matches.

- [ ] **Start the app and visually verify each screen**

```bash
cd mobile && npx expo start --ios
```

Walk through: Home → Library → Insights → Profile → tap a memory (detail) → tap + (capture). Confirm:
- Background is cream in light mode, warm charcoal in dark mode
- Screen titles are bold sans-serif (not italic serif)
- Cards have white background (light) / translucent (dark) with subtle shadow
- Add button is small and square, not a large circle
- Orange accent is consistent and slightly darker than before

- [ ] **Final commit**

```bash
git add -A
git commit -m "feat: complete warm editorial redesign — all screens updated"
```
