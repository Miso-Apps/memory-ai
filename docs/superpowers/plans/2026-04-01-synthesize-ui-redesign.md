# Synthesize UI Redesign — Library Screen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the broken synthesize chip in the filter scroll row with a header icon button, fix clipped checkboxes, and make the action bar always visible in select mode.

**Architecture:** `ScreenHeader` gets a `rightAction` prop; `library.tsx` replaces the synthesize chip with a Sparkles icon in the header, swaps the header for an inline select-mode header, and repositions checkboxes inside card bounds. Two new i18n keys added to both locales.

**Tech Stack:** React Native, Expo, TypeScript, i18next, lucide-react-native

---

## File Map

| File | Change |
|------|--------|
| `mobile/components/ScreenHeader.tsx` | Add `rightAction?: React.ReactNode` prop |
| `mobile/app/(tabs)/library.tsx` | Remove synthesize chip; add header icon button; inline select-mode header; fix checkboxes; fix action bar |
| `mobile/i18n/locales/en.ts` | Add `library.selectMode`, `library.selectHint`, `library.memoriesCount` |
| `mobile/i18n/locales/vi.ts` | Same keys in Vietnamese |

---

## Task 1: Add `rightAction` prop to `ScreenHeader`

**Files:**
- Modify: `mobile/components/ScreenHeader.tsx`

- [ ] **Step 1: Open the file and verify current shape**

Run: `cd mobile && npm run type-check 2>&1 | tail -5`
Expected: no errors (baseline)

- [ ] **Step 2: Update `ScreenHeader.tsx`**

Replace the entire file with:

```tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../constants/ThemeContext';

interface ScreenHeaderProps {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  titleSize?: number;
  paddingHorizontal?: number;
  rightAction?: React.ReactNode;
}

export function ScreenHeader({
  eyebrow,
  title,
  subtitle,
  titleSize = 26,
  paddingHorizontal = 16,
  rightAction,
}: ScreenHeaderProps) {
  const { colors } = useTheme();

  return (
    <View style={[styles.container, { paddingHorizontal }]}>
      {eyebrow ? (
        <Text style={[styles.eyebrow, { color: colors.textMuted }]}>
          {eyebrow.toUpperCase()}
        </Text>
      ) : null}
      <View style={styles.titleRow}>
        <Text
          style={[
            styles.title,
            { color: colors.textPrimary, fontSize: titleSize },
          ]}
        >
          {title}
        </Text>
        {rightAction ?? null}
      </View>
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
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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

- [ ] **Step 3: Verify type-check passes**

Run: `cd mobile && npm run type-check 2>&1 | tail -10`
Expected: no new errors

- [ ] **Step 4: Commit**

```bash
git add mobile/components/ScreenHeader.tsx
git commit -m "feat(ui): add rightAction prop to ScreenHeader"
```

---

## Task 2: Add missing i18n keys

**Files:**
- Modify: `mobile/i18n/locales/en.ts`
- Modify: `mobile/i18n/locales/vi.ts`

- [ ] **Step 1: Add keys to `en.ts`**

Inside the `library:` block (after `synthesizeAction`), add:

```ts
    selectMode: 'SELECT MEMORIES',
    selectHint: 'Select 2 or more to synthesize',
    memoriesCount: '{{count}} memories',
```

The `library:` block should now end with:
```ts
    synthesize: '✦ Synthesize',
    cancelSelect: 'Cancel',
    selectedCount: '{{count}} selected',
    synthesizing: 'Synthesizing...',
    synthesizeAction: 'Synthesize →',
    selectMode: 'SELECT MEMORIES',
    selectHint: 'Select 2 or more to synthesize',
    memoriesCount: '{{count}} memories',
  },
```

- [ ] **Step 2: Add keys to `vi.ts`**

Inside the `library:` block (after `synthesizeAction`), add:

```ts
    selectMode: 'CHỌN KÝ ỨC',
    selectHint: 'Chọn 2 hoặc nhiều hơn để tổng hợp',
    memoriesCount: '{{count}} ký ức',
```

- [ ] **Step 3: Verify i18n parity**

Run: `cd mobile && npm run i18n:check`
Expected: no missing keys reported

- [ ] **Step 4: Commit**

```bash
git add mobile/i18n/locales/en.ts mobile/i18n/locales/vi.ts
git commit -m "feat(i18n): add selectMode, selectHint, memoriesCount keys for library"
```

---

## Task 3: Replace synthesize chip with header icon button

**Files:**
- Modify: `mobile/app/(tabs)/library.tsx`

- [ ] **Step 1: Remove the synthesize chip from the filter ScrollView**

Find and delete this block (around line 754–770):

```tsx
          <TouchableOpacity
            onPress={toggleSelectMode}
            style={[
              styles.synthesizeBtn,
              { backgroundColor: colors.brandAccentLight, borderColor: selectMode ? colors.brandAccent : 'transparent' },
            ]}
            accessibilityLabel={selectMode ? t('library.cancelSelect') : t('library.synthesize')}
          >
            <Sparkles size={12} color={colors.brandAccent} />
            <Text style={[styles.synthesizeBtnText, { color: colors.brandAccent }]}>
              {selectMode
                ? selectedIds.size > 0
                  ? t('library.selectedCount', { count: selectedIds.size })
                  : t('library.cancelSelect')
                : t('library.synthesize')}
            </Text>
          </TouchableOpacity>
```

- [ ] **Step 2: Replace the static `<ScreenHeader>` with conditional rendering**

Find (around line 642–648):
```tsx
      <ScreenHeader
        eyebrow={t('library.eyebrow', { count: memories.length })}
        title={t('library.title')}
        titleSize={30}
        paddingHorizontal={16}
      />
```

Replace with:
```tsx
      {selectMode ? (
        <View style={[styles.selectHeader, { paddingHorizontal: 16 }]}>
          <Text style={[styles.selectEyebrow, { color: colors.brandAccent }]}>
            {t('library.selectMode')}
          </Text>
          <View style={styles.selectTitleRow}>
            <Text style={[styles.selectCount, { color: colors.brandAccent }]}>
              {t('library.selectedCount', { count: selectedIds.size })}
            </Text>
            <TouchableOpacity onPress={toggleSelectMode} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={[styles.cancelLink, { color: colors.brandAccent }]}>
                {t('library.cancelSelect')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <ScreenHeader
          eyebrow={t('library.eyebrow', { count: memories.length })}
          title={t('library.title')}
          titleSize={30}
          paddingHorizontal={16}
          rightAction={
            <TouchableOpacity
              style={[styles.synthIconBtn, { backgroundColor: colors.brandAccentLight }]}
              onPress={toggleSelectMode}
              accessibilityLabel={t('library.synthesize')}
              activeOpacity={0.7}
            >
              <Sparkles size={15} color={colors.brandAccent} strokeWidth={2} />
            </TouchableOpacity>
          }
        />
      )}
```

- [ ] **Step 3: Add new styles to the `StyleSheet.create({...})` block**

Add after the existing `catFilterChevron` style (around line 999):

```tsx
  // ── Select mode header ──────────────────────────────────
  selectHeader: {
    paddingTop: 16,
    paddingBottom: 12,
  },
  selectEyebrow: {
    fontFamily: 'DMSans_600SemiBold',
    fontSize: 10,
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  selectTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  selectCount: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 24,
    letterSpacing: -0.5,
    lineHeight: 32,
  },
  cancelLink: {
    fontFamily: 'DMSans_600SemiBold',
    fontSize: 15,
  },
  synthIconBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
```

- [ ] **Step 4: Remove the old `synthesizeBtn` and `synthesizeBtnText` styles**

Find and delete:
```tsx
  synthesizeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderWidth: 1.5,
    marginLeft: 'auto',
  },
  synthesizeBtnText: {
    fontSize: 11,
    fontWeight: '600',
  },
```

- [ ] **Step 5: Verify type-check passes**

Run: `cd mobile && npm run type-check 2>&1 | tail -10`
Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add mobile/app/(tabs)/library.tsx
git commit -m "feat(library): replace synthesize chip with header icon button"
```

---

## Task 4: Fix checkbox position

**Files:**
- Modify: `mobile/app/(tabs)/library.tsx`

- [ ] **Step 1: Update the checkbox style**

Find in `StyleSheet.create`:
```tsx
  checkbox: {
    position: 'absolute',
    top: 12,
    left: -8,
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.3)',
    backgroundColor: 'transparent',
    zIndex: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
```

Replace with:
```tsx
  checkbox: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.25)',
    backgroundColor: 'rgba(0,0,0,0.15)',
    zIndex: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
```

- [ ] **Step 2: Add select-mode padding to the card wrapper in `renderItem`**

Find (around line 598–605):
```tsx
          <View style={[
            styles.cardWrapper,
            styles.memoryCardWrapper,
            selectMode && selectedIds.has(memory.id) && {
              borderColor: colors.brandAccent,
              borderWidth: 1.5,
              borderRadius: 12,
            },
          ]}>
```

Replace with:
```tsx
          <View style={[
            styles.cardWrapper,
            styles.memoryCardWrapper,
            selectMode && styles.memoryCardSelectPadding,
            selectMode && selectedIds.has(memory.id) && {
              borderColor: colors.brandAccent,
              borderWidth: 1.5,
              borderRadius: 12,
            },
          ]}>
```

- [ ] **Step 3: Add `memoryCardSelectPadding` style**

Find `memoryCardWrapper` in `StyleSheet.create`:
```tsx
  memoryCardWrapper: {
    position: 'relative',
  },
```

Add after it:
```tsx
  memoryCardSelectPadding: {
    paddingRight: 36,
  },
```

- [ ] **Step 4: Verify type-check passes**

Run: `cd mobile && npm run type-check 2>&1 | tail -10`
Expected: no errors

- [ ] **Step 5: Commit**

```bash
git add mobile/app/(tabs)/library.tsx
git commit -m "fix(library): move selection checkboxes inside card bounds"
```

---

## Task 5: Fix action bar — always visible in select mode

**Files:**
- Modify: `mobile/app/(tabs)/library.tsx`

- [ ] **Step 1: Update the action bar conditional**

Find (around line 841):
```tsx
      {/* ── Synthesize action bar ── */}
      {selectMode && selectedIds.size > 0 && (
        <View style={[styles.actionBar, { backgroundColor: colors.brandAccentLight, borderColor: colors.brandAccent }]}>
          <Text style={[styles.actionBarText, { color: colors.textSecondary }]}>
            {t('library.selectedCount', { count: selectedIds.size })}
          </Text>
          <TouchableOpacity
            onPress={handleSynthesize}
            disabled={selectedIds.size < 2 || isSynthesizing}
            style={[
              styles.synthesizeActionBtn,
              { backgroundColor: colors.brandAccent },
              (selectedIds.size < 2 || isSynthesizing) && { opacity: 0.5 },
            ]}
          >
            <Text style={[styles.synthesizeActionBtnText, { color: colors.buttonText }]}>
              {isSynthesizing ? t('library.synthesizing') : t('library.synthesizeAction')}
            </Text>
          </TouchableOpacity>
        </View>
      )}
```

Replace with:
```tsx
      {/* ── Synthesize action bar ── */}
      {selectMode && (
        <View style={[styles.actionBar, { backgroundColor: colors.brandAccentLight, borderColor: colors.brandAccent }]}>
          {selectedIds.size < 2 ? (
            <Text style={[styles.actionBarText, { color: colors.textMuted, fontStyle: 'italic' }]}>
              {t('library.selectHint')}
            </Text>
          ) : (
            <Text style={[styles.actionBarText, { color: colors.textSecondary }]}>
              {t('library.memoriesCount', { count: selectedIds.size })}
            </Text>
          )}
          <TouchableOpacity
            onPress={handleSynthesize}
            disabled={selectedIds.size < 2 || isSynthesizing}
            style={[
              styles.synthesizeActionBtn,
              { backgroundColor: colors.brandAccent },
              (selectedIds.size < 2 || isSynthesizing) && { opacity: 0.35 },
            ]}
          >
            <Text style={[styles.synthesizeActionBtnText, { color: colors.buttonText }]}>
              {isSynthesizing ? t('library.synthesizing') : t('library.synthesizeAction')}
            </Text>
          </TouchableOpacity>
        </View>
      )}
```

- [ ] **Step 2: Verify type-check + lint**

Run: `cd mobile && npm run type-check && npm run lint 2>&1 | tail -15`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add mobile/app/(tabs)/library.tsx
git commit -m "fix(library): show action bar immediately on select mode enter with hint text"
```

---

## Task 6: Final validation

- [ ] **Step 1: Full type-check and lint**

Run: `cd mobile && npm run type-check && npm run lint`
Expected: clean output

- [ ] **Step 2: i18n parity check**

Run: `cd mobile && npm run i18n:check`
Expected: no missing keys

- [ ] **Step 3: Verify no stale references to removed style names**

Run: `grep -n "synthesizeBtn\b\|synthesizeBtnText\b" mobile/app/\(tabs\)/library.tsx`
Expected: no matches (both styles removed)

- [ ] **Step 4: Verify no `marginLeft.*auto` in filter ScrollView**

Run: `grep -n "marginLeft.*auto" mobile/app/\(tabs\)/library.tsx`
Expected: no matches

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "feat(library): synthesize UI redesign — header icon, fixed checkboxes, better action bar"
```
