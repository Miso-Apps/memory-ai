# Memory Detail Screen Redesign

**Date:** 2026-03-30
**File:** `mobile/app/memory/[id].tsx`

## Problem

The current memory detail screen has three core issues:

1. **Crowded header** — back link, uppercase date eyebrow, title, and meta chips are all stacked with no clear visual hierarchy
2. **Generic AI summary card** — a floating rounded box that doesn't feel editorial
3. **Flat action bar** — three equal-weight plain text buttons (Edit / Share / Reflect) with no primary action emphasis

## Design Direction: Editorial Hierarchy

### Header

Replace the current stacked header with a two-zone structure:

**Nav row** (top):
- Left: `‹ Library` back link in `brandAccent`, `DMSans_600SemiBold`, 13px
- Right: share icon (`⬆` or lucide `Share`) in `textMuted`

**Identity row** (below nav):
- Type badge: emoji + type name, `brandAccentLight` background, `brandAccent` border + text, `DMSans_700Bold` 10px uppercase, `borderRadius: 4`
- Date: `textMuted`, 11px — same line as badge, separated by gap

**Title** (below identity):
- `DMSans_700Bold`, 20px, `letterSpacing: -0.4`, `lineHeight: 26`

Remove: the standalone "Back to Library" text link, the all-caps date eyebrow, the plain type chip.

### AI Summary — Pull-Quote Style

Replace the current floating card with a left-border pull-quote:

```
border-left: 3px solid brandAccent
background: brandAccentLight
border-radius: 0 10px 10px 0
padding: 10px 12px 10px 14px
```

Label: `AI INSIGHT` in `brandAccent`, `DMSans_700Bold` 9px uppercase, `letterSpacing: 0.6`
Text: `DMSans_400Regular`, 13px italic, `textSecondary`, `lineHeight: 20`

### Content Body

Keep a thin `hairlineWidth` divider between the pull-quote and body content. Remove the `ORIGINAL` section label — the content speaks for itself. `contentText` stays 16px / lineHeight 25.

### Action Bar — Type-Adaptive

Two-row layout:

**Row 1 — Primary CTA** (full width):
- Background: `brandAccent`, `borderRadius: 10`, padding 11px
- `DMSans_700Bold` 14px white
- Label adapts by type:
  - `text` / `photo`: `✦ Reflect on this memory`
  - `voice`: `▶ Play recording`
  - `link`: `↗ Open link`

**Row 2 — Secondary actions** (two equal buttons):
- Outlined, `border: colors.border`, `borderRadius: 9`
- `DMSans_500Medium` 13px, `textSecondary`
- For `text` / `photo`: Edit · Share
- For `voice`: Reflect · Share
- For `link`: Reflect · Share

The header share icon and the secondary Share button both call `handleShare`. This is intentional — the header icon is a quick reach target, the action bar button is for deliberate use after reading. Remove the share icon from the header if the product prefers a single entry point.

### Voice Memory

Audio player keeps its current layout. The primary CTA becomes `▶ Play recording` and calls `togglePlayback` on the `AudioPlayer` — implement by lifting `togglePlayback` to a ref exposed from `AudioPlayer` (via `useImperativeHandle`) so the action bar can call it.

### Link Memory

The link card thumbnail + URL keeps its current layout. Primary CTA `↗ Open link` calls `WebBrowser.openBrowserAsync` directly.

### Photo Memory

Photo image + AI description box keep their current layout. Primary CTA is `✦ Reflect`.

### Connected Ideas Section

No structural changes — only typography:
- Section title: `DMSans_700Bold` 14px instead of plain `fontWeight: 700`
- Items: keep existing layout

## What Does Not Change

- Audio player component internals
- Edit panel (`EditPanel` component)
- Related memories fetch logic
- Date formatting utilities
- Loading / not-found states
- Dark mode color tokens (all changes use existing theme tokens)

## Token Usage

All new styles use existing `ThemeColors` tokens. No new tokens required. The hardcoded `rgba(197,106,58,...)` values in the AI summary card should be replaced with `colors.brandAccent` and `colors.brandAccentLight`.
