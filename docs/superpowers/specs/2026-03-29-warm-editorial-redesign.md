# Mobile UI/UX Redesign — Warm Editorial
**Date:** 2026-03-29
**Replaces:** `2026-03-29-mobile-ui-ux-redesign.md` (Threads × Anthropic direction — abandoned)
**Scope:** Full visual layer of the mobile app — design tokens, typography, shared components, and all 6 primary screens
**Approach:** Option 2 — System + screens. Update tokens and typography first, then rework each screen's visual layer. Data/logic code is untouched.

---

## 1. Design Direction

**Warm Editorial.** The aesthetic of quality print and thoughtful software — cream backgrounds, warm shadows, clean bold sans-serif typography, and a rich terracotta orange accent. References: Bear, Craft, Day One.

**What this is not:** The previous Threads × Anthropic direction used DM Serif Display italic headers, a near-black `#0c0c10` background that felt cold, and decorative flourishes that didn't cohere. All of that is replaced.

---

## 2. Design System

### 2.1 Color Tokens

All changes are in `mobile/constants/ThemeContext.tsx`.

**Light theme:**

| Token | Value | Notes |
|---|---|---|
| `bg` | `#f7f4f0` | Warm cream |
| `cardBg` | `#ffffff` | Pure white card on cream bg |
| `inputBg` | `#f2efe9` | Slightly warmer than bg |
| `subtleBg` | `#f2efe9` | Same as inputBg |
| `textPrimary` | `#1c1814` | Warm near-black |
| `textSecondary` | `#5a5248` | Earthy mid-tone |
| `textTertiary` | `#7a7268` | — |
| `textMuted` | `#b8b0a7` | Warm light gray |
| `textPlaceholder` | `#c8c0b8` | — |
| `border` | `#ede8e2` | Warm hairline |
| `borderMed` | `#d8d3cc` | More visible border |
| `tabBarBg` | `rgba(247,244,240,0.97)` | Match bg |
| `tabBarBorder` | `#d8d3cc` | Pill border in light mode |

**Dark theme:**

| Token | Value | Notes |
|---|---|---|
| `bg` | `#1c1814` | Warm charcoal |
| `cardBg` | `rgba(255,255,255,0.04)` | Translucent warm |
| `inputBg` | `rgba(255,255,255,0.04)` | Same as cardBg |
| `subtleBg` | `rgba(255,255,255,0.03)` | — |
| `textPrimary` | `#f0ede8` | Warm off-white |
| `textSecondary` | `#a09890` | Warm mid-tone |
| `textTertiary` | `#7a7268` | — |
| `textMuted` | `#5a5248` | Dark muted |
| `textPlaceholder` | `#4a4440` | — |
| `border` | `rgba(255,255,255,0.07)` | Soft hairline |
| `borderMed` | `rgba(255,255,255,0.10)` | — |
| `tabBarBg` | `rgba(28,24,20,0.97)` | Match bg |
| `tabBarBorder` | `rgba(255,255,255,0.08)` | Pill border in dark mode |

**Shared (both themes):**

| Token | Value | Notes |
|---|---|---|
| `brandAccent` | `#b85c20` | Richer terracotta (was `#C56A3A`) |
| `brandAccentLight` | `rgba(184,92,32,0.10)` | — |

### 2.2 Typography

Remove `DM Serif Display` entirely. `DM Sans` is the sole typeface.

**Updated type scale:**

| Role | Font | Size | Weight | Usage |
|---|---|---|---|---|
| Screen title | DM Sans | 26–28px | 700 | All screen headers |
| Section heading | DM Sans | 16px | 600 | Sub-section labels |
| Card body | DM Sans | 13–14px | 400 | Memory card text |
| Eyebrow / label | DM Sans | 10px | 600 | Uppercase section labels, type chips |
| Timestamp | DM Sans | 10px | 400 | Card footers |

**Remove:** `SerifTitle` component (`mobile/components/SerifTitle.tsx`) — it becomes unused and should be deleted.

**`ScreenHeader` update:** Remove serif rendering. Use `DM Sans 700` at 26px, tracking -0.5px.

### 2.3 Shared Components

#### `MemoryCard` (`mobile/components/MemoryCard.tsx`)

Changes:
- `backgroundColor`: `colors.cardBg` (was `colors.inputBg`)
- `borderColor`: `colors.border`
- Add `box-shadow` equivalent in light mode: `shadowColor: '#000', shadowOffset: {width:0,height:1}, shadowOpacity:0.04, shadowRadius:4, elevation:1`
- Remove emoji from `TYPE_LABEL` — use plain text: `text`, `voice`, `link`, `photo`
- `bodyText` font size: 13px (was 14px) — tighter with the warm palette
- `tagText`: `DMSans_600SemiBold`, 9px

#### `ScreenHeader` (`mobile/components/ScreenHeader.tsx`)

Changes:
- Remove serif/italic rendering
- Title: `DMSans_700Bold`, 26px, letterSpacing -0.5, color `colors.textPrimary`
- Eyebrow (if present): `DMSans_600SemiBold`, 10px, uppercase, `colors.textMuted`

#### `CapturePrompt` (`mobile/components/CapturePrompt.tsx`)

Changes:
- `backgroundColor`: `colors.cardBg` with `border: 1px solid colors.border`
- Light mode: add subtle shadow (`shadowOpacity: 0.04`)
- Placeholder text: `colors.textMuted`

#### `SerifTitle` — delete

This component becomes unused once all screens are updated.

### 2.4 Tab Bar (`mobile/app/(tabs)/_layout.tsx`)

Keep floating pill. Changes:
- **Add button size**: reduce from 44×44 to 34×34, border-radius 10 (square-ish, was 22 = circle)
- Remove outer ring (`createBtnRing`) — single button only
- `iconBackground` active state: use `colors.brandAccentLight` with no glow shadow
- Inactive icon color: `colors.textMuted` (was hardcoded `#2a2a2a`)
- Tab bar height: reduce by ~4px (was over-padded)

---

## 3. Screens

All screens: remove serif title usage, replace with `ScreenHeader` using updated DM Sans bold style.

### 3.1 Home (`mobile/app/(tabs)/home.tsx`)
- Replace `SerifTitle` greeting with `ScreenHeader` (eyebrow + bold title)
- Cards already use `MemoryCard` — picks up component-level changes automatically
- No structural changes

### 3.2 Library (`mobile/app/(tabs)/library.tsx`)
- Replace `SerifTitle` with `ScreenHeader`
- Search bar: `backgroundColor: colors.cardBg`, `borderColor: colors.border`, light shadow in light mode
- Filter pills: active state uses `brandAccentLight` bg + `brandAccent` text
- No structural changes

### 3.3 Insights (`mobile/app/(tabs)/insights.tsx`)
- Replace serif header with `ScreenHeader`
- Streak card: keep orange but use `brandAccent` token consistently
- Heatmap cells: use `brandAccent` for filled days (remove any hardcoded orange)

### 3.4 Profile (`mobile/app/(tabs)/profile.tsx`)
- Replace serif header with `ScreenHeader`
- Settings rows: `backgroundColor: colors.cardBg`, grouped sections with `colors.border` separator
- Sign-out button: `color: colors.error` (no change needed if already correct)

### 3.5 Memory Detail (`mobile/app/memory/[id].tsx` or similar)
- Replace serif title with DM Sans 700 at 22px
- AI summary card: `backgroundColor: colors.cardBg`, `borderColor: colors.border`
- Action row: use `brandAccent` for primary action

### 3.6 Capture Sheet (`mobile/app/capture.tsx`)
- Mode tabs (text/voice/link/photo): active tab uses `brandAccent` underline or pill
- Input area: `backgroundColor: colors.cardBg`
- Submit button: `backgroundColor: colors.brandAccent`

---

## 4. Implementation Order

1. **Tokens** — update `ThemeContext.tsx` (light + dark palettes)
2. **Fonts** — confirm `DM Serif Display` import can be removed; keep `DM Sans` variants
3. **Components** — `MemoryCard`, `ScreenHeader`, `CapturePrompt`, tab bar `_layout.tsx`; delete `SerifTitle`
4. **Screens** — Home, Library, Insights, Profile, Memory Detail, Capture (in that order)

Each step is independently reviewable. No step touches API calls, state management, or navigation logic.

---

## 5. Out of Scope

- Navigation structure changes
- New features or screens
- Backend / API changes
- Animation or transition changes (beyond removing the warm glow)
- Onboarding / login screen
