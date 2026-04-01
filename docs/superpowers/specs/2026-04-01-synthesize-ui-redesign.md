# Synthesize UI Redesign — Library Screen

**Date:** 2026-04-01
**Branch:** feature/mobile-ui-ux-redesign
**Status:** Approved

## Problem

The Synthesize feature in the Library tab has several UX issues:

1. **Hidden entry point** — the Synthesize chip lives inside the horizontal filter `ScrollView`, gets pushed to the right with `marginLeft: 'auto'` (which doesn't work in ScrollView), and is easy to miss entirely.
2. **Confusing toggle** — the same chip cycles through three states: "Synthesize" → "N selected" → "Cancel", making its role unclear.
3. **Clipped checkboxes** — selection checkboxes are positioned at `left: -8px`, hanging outside the card boundary and getting clipped.
4. **Duplicate count** — selected count appears in both the chip and the floating action bar.

## Design Decision

**Option A: Header Icon Button** — a `✨` Sparkles icon button in the screen header, right-aligned next to the title. This follows the iOS multi-select pattern (Photos app), has zero footprint in the filter row, and scales cleanly to the select-mode header transformation.

Synthesize is an **occasional power feature**, not a primary workflow, so it does not need prominent persistent UI.

## States

### State 1 — Normal (default)

- `ScreenHeader` renders with eyebrow ("N MEMORIES"), title ("Library"), and a new `rightAction` prop containing the Sparkles icon button.
- Icon button: `brandAccentLight` background, `brandAccent` icon color — consistent with active filter chip palette.
- Filter chips row: unchanged, no Synthesize chip.
- Tapping the icon button enters select mode.

### State 2 — Select mode, 0 selected

- Header eyebrow: "SELECT MEMORIES" in `brandAccent` color.
- Header title row: "0 selected" count (accent color) on the left, "Cancel" link (accent color) on the right.
- Cards: each shows a 15×15px circle checkbox in the **top-right corner inside the card** (right: 8, top: 8). Cards get extra right padding (~28px) so text doesn't overlap.
- Action bar: appears immediately at the bottom (not only after first selection). Shows hint text "Select 2 or more to synthesize" on the left, dimmed Synthesize button on the right (opacity 0.35, disabled).
- Filter chips remain visible and usable — user can change type filter then select.

### State 3 — 2+ selected, ready to synthesize

- Header count updates live: "2 selected", "3 selected", etc.
- Selected cards: `brandAccent` border (1.5px) + subtle `brandAccent` background tint. Checkbox fills with `brandAccent`.
- Action bar left: "N memories". Synthesize button fully active.
- Tapping Synthesize: navigates to `/chat?synthesis_ids=…`, resets select mode and clears selections.
- Tapping Cancel: exits select mode, clears selections.

## Component Changes

### `mobile/components/ScreenHeader.tsx`

Add an optional `rightAction?: React.ReactNode` prop. Wrap the title in a flex row (`flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'`) so `rightAction` appears to the right of the title text.

### `mobile/app/(tabs)/library.tsx`

1. **Remove** the `synthesizeBtn` TouchableOpacity from the filter `ScrollView`.
2. **Replace** the static `<ScreenHeader>` with conditional rendering:
   - Not in select mode: `<ScreenHeader rightAction={<SparklesIconBtn />} />`
   - In select mode: inline header view (bypasses `ScreenHeader`) with accent eyebrow + count/Cancel title row.
3. **Move checkboxes** from `left: -8` absolute position to `right: 8, top: 8` inside the card. Remove `margin-left: 8` offset on cards.
4. **Show action bar** whenever `selectMode === true` (not only when `selectedIds.size > 0`). Synthesize button disabled when `selectedIds.size < 2`.
5. **Remove** `synthesizeBtn` and `synthesizeBtnText` styles. Add `selectHeader`, `selectCount`, `cancelLink` styles.

### `mobile/i18n/locales/en.ts` and `vi.ts`

Add keys if not already present:
- `library.selectMode` — "SELECT MEMORIES"
- `library.selectHint` — "Select 2 or more to synthesize"
- `library.memoriesCount` — "{{count}} memories" (for action bar left label)

Existing keys to keep: `library.selectedCount`, `library.cancelSelect`, `library.synthesize`, `library.synthesizeAction`, `library.synthesizing`.

## Color Consistency

All new elements use the existing `colors.brandAccent` / `colors.brandAccentLight` palette — the same colors used by active filter chips and the existing action bar. No new color values are introduced.
