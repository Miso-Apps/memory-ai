# Mobile UI/UX Redesign — Threads × Anthropic
**Date:** 2026-03-29
**Scope:** Full mobile app — all 6 primary screens
**Approach:** Shell + design system first, then per-screen refinement

---

## 1. Design Direction

The redesign targets a **Hybrid** aesthetic: Threads' structural discipline (text-first, minimal chrome, feed density) combined with Anthropic's warmth and intelligence (serif display typography, off-white tones, considered spacing, the feeling that your thoughts deserve care).

**Not:** pure black high-contrast Threads clone. **Not:** soft cream notebook. **Rather:** near-black dark with warm off-white text and earthy orange accents — purposeful depth.

---

## 2. Design System

### 2.1 Color Tokens

All changes are in `mobile/constants/ThemeContext.tsx`.

**Dark theme (updated values):**

| Token | Old | New | Notes |
|---|---|---|---|
| `bg` | `#09090B` | `#0c0c10` | Warmer near-black |
| `cardBg` | `#131316` | `#131318` | Slight warm shift |
| `inputBg` | `#1B1B20` | `rgba(255,255,255,0.04)` | Translucent, lighter |
| `textPrimary` | `#F4F4F5` | `#f0ede8` | Warm off-white (not cold white) |
| `textSecondary` | `#A1A1AA` | `#a8a4a0` | Warmer mid-tone |
| `textMuted` | `#71717A` | `#555555` | Slightly lighter |
| `border` | `#27272A` | `rgba(255,255,255,0.05)` | Softer hairline |
| `borderMed` | `#3F3F46` | `rgba(255,255,255,0.08)` | Slightly more visible |
| `tabBarBg` | `rgba(9,9,11,0.95)` | `rgba(12,12,16,0.97)` | Match new bg |

**Light theme (updated values):**

| Token | Old | New | Notes |
|---|---|---|---|
| `bg` | `#FFFFFF` | `#faf9f7` | Warm off-white (Anthropic-coded) |
| `cardBg` | `#FFFFFF` | `#ffffff` | Pure white card on warm bg |
| `inputBg` | `#F4F4F5` | `#f2efe9` | Warm tint |
| `textPrimary` | `#111111` | `#1a1612` | Warm near-black |
| `textSecondary` | `#3F3F46` | `#5a5550` | Earthy mid-tone |
| `border` | `#E4E4E7` | `#ebe8e3` | Warm hairline |
| `tabBarBg` | `rgba(255,255,255,0.95)` | `rgba(250,249,247,0.96)` | Match new bg |

**Unchanged across both themes:**
- `brandAccent`: `#C56A3A` (orange — already correct)
- `brandAccentLight`: `rgba(197,106,58,0.12)` (already correct)
- `accent` / `accentLight` / `accentMid`: keep existing indigo values

### 2.2 Typography

Add `DM Serif Display` (italic) and `DM Sans` via `expo-google-fonts`. System font (`Inter`/`-apple-system`) is retained for all UI chrome and navigation labels.

**Type scale:**

| Role | Font | Size | Weight | Style | Usage |
|---|---|---|---|---|---|
| Screen title | DM Serif Display | 32–34px | — | Italic | `home`, `library`, `insights`, `profile` screen headers |
| Section title | DM Serif Display | 24–28px | — | Italic | Sub-section headers, memory detail title |
| Card emphasis | DM Sans | 15–17px | 600 | — | Card headings when needed |
| Body / content | DM Sans | 14–15px | 400 | — | Memory text, descriptions |
| Eyebrow / label | DM Sans | 10px | 600 | — | All-caps labels, tags, type chips |
| UI chrome | System | 12–14px | 400–600 | — | Tab labels, buttons, nav items |

Add a shared `<SerifTitle>` component in `mobile/components/SerifTitle.tsx` that wraps `DM Serif Display` italic to avoid repeating font props.

### 2.3 Shared Components

#### `MemoryCard` (`mobile/components/MemoryCard.tsx`)

A new shared card component used in Home, Library, Recall, and Memory Detail lists.

**Props:**
```ts
interface MemoryCardProps {
  memory: Memory;
  tag?: string;          // e.g. "Resurfaced", "On this day"
  onPress: () => void;
  onDismiss?: () => void;
}
```

**Layout:**
- Outer: `background: inputBg`, `borderRadius: 14`, `border: 1px border`, `padding: 12 14`
- Top row: `tag` chip (orange pill, uppercase 9px) + type label (right-aligned, muted)
- Body: memory text in DM Sans 14px, `textSecondary`, 2–3 line clamp
- **Thumbnail** (when `imageUrl`, `thumbnailUrl`, or `linkPreviewUrl` is present):
  - 48×48, `borderRadius: 8`, right-aligned next to body text
  - For `link` type: also render a domain strip below body (favicon placeholder + domain name, 10px muted)
  - For `text` and `voice` type with no image: no thumbnail, full-width text
- Footer row: relative time (muted, 10px) + "Open →" in orange (10px, 500 weight)

#### `CapturePrompt` (`mobile/components/CapturePrompt.tsx`)

Tappable inline prompt on the home screen that opens the capture sheet.

- Background: `rgba(255,255,255,0.03)` with `border: 1px rgba(255,255,255,0.07)`
- Left: 6px orange dot
- Text: "What's on your mind today?" in DM Sans 14px italic, muted color
- Tapping navigates to `/capture`

#### `ScreenHeader` (`mobile/components/ScreenHeader.tsx`)

Shared header used across all tab screens.

- Eyebrow (optional): 10px DM Sans 600, orange, uppercase, `letterSpacing: 1`
- Title: DM Serif Display italic, 32px (or 26px for sub-screens)
- Subtitle (optional): DM Sans 13px, muted

---

## 3. Navigation Shell

File: `mobile/app/(tabs)/_layout.tsx`

**Changes:**
- Tab bar: raise pill height from 78px → 84px iOS, 72px → 78px Android
- `tabBarBg`: update to new warm token
- Active icon: color changes to `textPrimary` (`#f0ede8`) — not accent indigo
- Inactive icon: darken to `#2a2a2a` (more receded than current `textMuted`)
- FAB (`CreateTabButton`): increase ring shadow opacity to 0.35, add warm glow (`shadowColor: brandAccent`)
- Remove `tabBarShowLabel: false` and keep labels hidden (already correct)
- `iconBackground` active state: change from `accentLight` (indigo tint) to `brandAccentLight` (orange tint)

---

## 4. Screen Designs

### 4.1 Home (`mobile/app/(tabs)/home.tsx`)

**Header:**
- Eyebrow: time-of-day greeting — "Good morning, [first name]" / "Good afternoon" / "Good evening" based on local hour
- Title (DM Serif italic): "What's on your mind?" (morning/evening) or "Welcome back" (afternoon)
- Below title: `<CapturePrompt>` component

**Recalled section:**
- Section label: "RECALLED FOR YOU" (10px DM Sans 600, muted, uppercase)
- Uses `<MemoryCard>` for each item — tag comes from radar item `reason_code`
- Divider between sections

**Reminders section (on-this-day, unreviewed):**
- Same `<MemoryCard>` treatment
- Section label changes per group: "ON THIS DAY", "UNREVIEWED"

**Stats row** (currently at top — move to bottom of scroll, before tab bar padding):
- Compact inline row: streak pill (orange) + total count + this week — DM Sans 12px

### 4.2 Capture Sheet (`mobile/app/capture.tsx`)

**Structure** (already a modal — keep as-is):
- Handle bar at top (already exists)
- Mode tabs: Text / Voice / Link / Photo — pill style, active tab gets orange tint background + orange label
- Input area: `inputBg` background card, italic placeholder "What's on your mind..."
- **Quick-tag hints row**: horizontally scrollable chips — 💡 Idea · 📋 Meeting · 🎯 Decision · 💬 Conversation · 📚 Learning. Tapping prepends a tag to the input.
- Action row: Ghost "Cancel" + Primary orange "Save memory" button

### 4.3 Library (`mobile/app/(tabs)/library.tsx`)

**Header:** ScreenHeader eyebrow = memory count ("48 MEMORIES"), title = "Your archive"

**Search bar:** Moves above filter chips. `inputBg` background, 1px border, italic placeholder "Search memories..."

**Filter chips:** Horizontal scroll — All · ✏ · 🎙 · 🔗 · 📷. Active chip: orange pill. Inactive: muted border.

**Memory list:** Replace current `FlatList` rendering with `<MemoryCard>` component. Thumbnails render for photo and link types per spec in §2.3.

### 4.4 Memory Detail (`mobile/app/memory/[id].tsx`)

**Header:**
- Back link: "← Library" or "← Home" in orange 11px
- Eyebrow: formatted date (e.g. "Sunday, March 26")
- Title: DM Serif Display italic — derive from `ai_summary` first line or first 6 words of `content`
- Meta row: type chip + relative time + category name

**Body:**
- Full `content` / `transcription` in DM Sans 15px `textSecondary`, lineHeight 1.6
- **AI summary card**: `rgba(brandAccent, 0.06)` background, `rgba(brandAccent, 0.12)` border, label "✦ AI SUMMARY" in orange 9px caps, summary text in italic 13px

**Action row:** Edit · Share · Reflect (Reflect in orange, others in muted ghost style)

### 4.5 Insights (`mobile/app/(tabs)/insights.tsx`)

**Header:** Eyebrow = "MARCH 2026" (current month), Title = "Your patterns"

**Streak card:**
- `rgba(brandAccent, 0.07)` background, `rgba(brandAccent, 0.15)` border
- Left: streak count in DM Serif Display 28px orange + "DAY STREAK" label
- Right: total memories count in DM Serif Display 20px `textPrimary` + "TOTAL" label

**Heatmap:**
- Cell color scale: `rgba(brandAccent, 0.0)` → `0.2` → `0.45` → `0.75` → `1.0` (5 levels)
- Replaces current green-tinted scale

**Weekly recap card:**
- `inputBg` background, subtle border
- Label: "✦ WEEKLY RECAP" (orange caps)
- Recap text in DM Sans italic 13px, `textSecondary`

### 4.6 Profile (`mobile/app/(tabs)/profile.tsx`)

**Header:** Eyebrow = "SIGNED IN AS", Title = user's first name in DM Serif Display italic

**Settings groups:** Visually grouped in `inputBg` rounded containers (already partially done). Tighten border to `rgba(255,255,255,0.05)`. Row separator uses `rgba(255,255,255,0.04)`.

**Sign out row:** Orange label color, no icon needed.

---

## 5. Implementation Order

1. **Install fonts** — `expo-google-fonts` for DM Serif Display + DM Sans
2. **Update ThemeContext** — all color token changes (dark + light)
3. **Create shared components** — `SerifTitle`, `ScreenHeader`, `CapturePrompt`, `MemoryCard`
4. **Update navigation shell** — `_layout.tsx` tab bar changes
5. **Home screen** — new header + capture prompt + section structure
6. **Library screen** — new header + search + chips + MemoryCard list
7. **Capture sheet** — mode tab styles + quick-tag hints row + button styles
8. **Memory detail** — new header + AI summary card + action row
9. **Insights screen** — streak card + heatmap color scale + recap card
10. **Profile screen** — serif header + grouped settings polish

---

## 6. Out of Scope

- Backend changes (thumbnail/OG image data is already returned by the API)
- New features (decisions screen, chat screen — separate initiatives)
- Web app redesign (separate effort)
- Animation system changes (existing spring/haptic animations are kept as-is)
- i18n string changes (existing keys are reused; any new UI strings get EN + VI entries per CLAUDE.md)

---

## 7. Validation Checklist

- [ ] `npm run type-check` passes from `mobile/`
- [ ] `npm run lint` passes from `mobile/`
- [ ] `npm run i18n:check` passes (for any new strings)
- [ ] Light and dark theme both look correct in simulator
- [ ] Thumbnails render correctly for photo and link memory types
- [ ] Thumbnail gracefully absent for text and voice types with no image
- [ ] Tab bar renders correctly on iOS (safe area) and Android
