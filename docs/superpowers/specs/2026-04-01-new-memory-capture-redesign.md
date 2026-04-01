# New Memory Capture — Redesign Spec

**Date:** 2026-04-01
**Branch:** feature/mobile-ui-ux-redesign
**File in scope:** `mobile/app/capture.tsx`

---

## Summary

Replace the current 4-tab mode switcher (Text / Voice / Link / Photo) in the capture screen with a single Threads-style composer. Every memory type becomes an optional inline attachment rather than a mode the user must select before typing. Each save produces one memory entry (no thread chaining).

---

## Design Direction

Inspired by the Meta Threads "New Thread" composer:
- Avatar + username as identity anchor at the top-left
- One freeform text input — the primary capture surface
- Voice, image, and link are *attachments* added via a bottom toolbar
- No mode switching; the screen is always in "compose" state
- Dark-first (matches existing `captureBg` / `captureCard` tokens)

---

## Layout Structure

```
┌─────────────────────────────────────┐
│  Cancel       New memory       Save  │  ← Header
├─────────────────────────────────────┤
│ [avatar]  brian                      │
│    │      What's on your mind?       │  ← Composer row
│    │      [image thumbnail]          │
│    │      [🎙 0:42 ✕]               │
│    ╵                                 │
├─────────────────────────────────────┤
│  🎙   🖼   🔗              500      │  ← Toolbar
├─────────────────────────────────────┤
│  💡 Idea  📋 Meeting  ✅ Decision   │  ← Hint chips (empty state only)
└─────────────────────────────────────┘
```

---

## Component Breakdown

### 1. Header

| Element | Detail |
|---|---|
| Left | "Cancel" — text button, `captureMuted` color, calls `router.back()` |
| Center | "New memory" — 15px bold |
| Right | "Save" pill — white bg / black text when `canSave`, `#1e1e1e` bg / `#444` text when disabled |

No change to save logic (`canSave` conditions remain the same).

---

### 2. Composer Row

Two-column flex layout:

**Left column (avatar column):**
- 38×38 circular avatar — shows user initials (or profile photo in future)
- Thin vertical thread line below avatar, fades to transparent, extends to bottom of content

**Right column (content column):**
- Username in 14px bold white, `#fff`
- `TextInput` — 15px, `lineHeight: 1.55`, `captureMuted` placeholder ("What's on your mind?"), expands with content, `autoFocus: true`
- Attachments render below the text input (see Attachments section)

---

### 3. Attachments

Attachments are added via the toolbar and rendered inline in the content column.

#### Voice
- **While recording:** inline waveform card (amber-tinted, `rgba(232,132,74,0.08)` bg, `rgba(232,132,74,0.25)` border)
  - Red dot + animated waveform bars + `MM:SS` counter + square stop button
  - Other toolbar icons dim to 20% opacity during recording
- **After recording:** amber pill — `🎙 0:42 ✕` — tap ✕ to discard

#### Image
- Full-width rounded thumbnail (14px radius, 130px tall) inline in the content column
- Top-right ✕ button to remove
- Upload/analysis state: spinner overlay on thumbnail

#### Link
- Green pill — `🔗 example.com ✕`
- Clipboard detection: if a URL is on clipboard when screen opens, auto-populate a link pill with Quick Save / Use / Dismiss options (same logic as current, moved into pill UI)
- URL validation error shown as small red text below the pill

---

### 4. Bottom Toolbar

Always visible, pinned to bottom above safe area.

| Icon | Action | State |
|---|---|---|
| 🎙 Mic | Start voice recording | Amber + active when recording |
| 🖼 Image | Open image picker | Normal / disabled during recording |
| 🔗 Link | Show a URL `TextInput` inline below the main text (same composer column), `keyboardType="url"` | Normal / disabled during recording |
| `500` | Character counter (right-aligned) | Amber when < 50 chars remaining |

During recording, image and link icons dim to `opacity: 0.2` and are non-interactive.

---

### 5. Hint Chips

- Visible **only** when the text input is empty and no attachments exist
- Displayed below the toolbar in a horizontal scroll row
- Same chips as today: 💡 Idea, 📋 Meeting, ✅ Decision, 💬 Conversation, 📚 Learning
- Tapping a chip prepends the label to the text input (same behavior as current)
- Hidden as soon as `content.length > 0`

---

### 6. Success Overlay

No change — existing animated `✓ Saved` overlay remains.

---

## State Machine

```
EMPTY
  → user types          → COMPOSING
  → taps 🎙             → RECORDING
  → taps 🖼             → (image picker opens) → COMPOSING (with image)
  → taps 🔗             → COMPOSING (link input focused inline)

COMPOSING
  → taps Save           → SAVING → success overlay → back()
  → taps 🎙             → RECORDING (text preserved)
  → taps Cancel         → back()

RECORDING
  → taps stop           → UPLOADING → COMPOSING (voice pill added)
  → (image/link blocked during recording)
```

---

## Removed

- `BottomModeBar` component — deleted entirely
- `MODE_DEFINITIONS` and `MODE_META` arrays — deleted
- `modeBarStyles` StyleSheet — deleted
- Separate full-screen `VoiceRecorder` and `ImageUpload` layout modes — voice and image now render inline in the composer column

The `VoiceRecorder` and `ImageUpload` sub-components are refactored, not deleted — their logic (recording, upload, picker) is preserved, only their outer layout changes.

---

## i18n

New or changed keys needed:

| Key | English | Vietnamese |
|---|---|---|
| `capture.placeholder` | What's on your mind? | Bạn đang nghĩ gì? |
| `capture.voicePill` | `{duration}` | `{duration}` |
| `capture.linkPill` | `{domain}` | `{domain}` |

Existing keys (`capture.save`, `capture.title`, hint chip keys, error keys) are unchanged.

---

## Out of Scope

- Thread chaining (multiple entries per save) — not in this redesign
- User avatar from API — use initials for now
- Light mode variation — dark tokens unchanged, light mode picks up existing `captureBg` light values automatically
- Any backend changes — purely frontend

---

## Validation Checklist

Before marking complete:
- [ ] `npm run type-check` passes in `mobile/`
- [ ] `npm run lint` passes in `mobile/`
- [ ] `npm run i18n:check` passes (new keys added to both `en.ts` and `vi.ts`)
- [ ] Voice recording starts, waveform shows, pill appears after stop
- [ ] Image picks, thumbnail shows inline, ✕ removes it
- [ ] Link clipboard detection still works
- [ ] Save disabled when empty, enabled when content or attachment present
- [ ] Hint chips visible on empty state, hidden once typing starts
- [ ] Keyboard avoiding behavior intact on both iOS and Android
