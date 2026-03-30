# New Memory Screen Redesign

**Date:** 2026-03-30
**Status:** Approved
**File:** `mobile/app/capture.tsx`

## Goal

Redesign the capture screen (`/capture`) to feel playful, expressive, warm, and alive — replacing the current generic UI with a design that has personality.

## What Changes

### Removed
- **Avatar + author name** in the composer row (was a Twitter/Threads pattern — wrong for a personal memory tool)
- **Mode pill badge** above the input (was redundant with the mode bar below)
- The `composerRow`, `avatar`, `avatarText`, `authorName` styles and their JSX

### Header
- Keep the three-element layout: `cancel` (left) · title (center) · `save` button (right)
- Title changes from `"New Memory"` (title case, no emoji) to `🧠 new memory` (brain emoji + lowercase)
- `cancel` text stays left; `save` pill button stays right with brand amber background
- Save button remains disabled/faded when `canSave` is false

### Input area (text & link modes)
- Input no longer sits bare in a composer row — it floats inside a **white rounded card** (`borderRadius: 22`, soft shadow: `0 4px 20px rgba(0,0,0,0.07)`)
- Background of the screen: `#faf7f2` (warm off-white, already in theme as `bg`)
- A **subtle dashed separator** (`borderStyle: 'dashed'`, `borderTopWidth: 1.5`, `borderColor: '#f2d5b8'`) separates the text input area from the hint chips
- Hint chips move **inside** the card, below the divider

### Hint chips (text mode only)
Color-coded by semantic type — each chip has its own background, border, and text color:

| Chip | Background | Border | Text |
|------|-----------|--------|------|
| ✨ idea | `#fff8f2` | `#f5dfc8` | `#c47a3a` |
| 📅 meeting | `#f2f8ff` | `#d0e8ff` | `#4a7ab5` |
| ✅ decision | `#f0fff4` | `#b8e8c8` | `#2e7d52` |
| 💭 feeling | `#fff0f8` | `#f0c0dc` | `#a0456a` |
| 🌟 insight | `#f5f0ff` | `#d8c8f8` | `#6a4ab5` |

Chips prepend their label to the text input content on press (existing behavior unchanged).

### Mode bar (bottom)
- Shell background: `#efe9df` (warm sand — already close to existing `inputBg`)
- Active mode: fills with `colors.brandAccent` (`#c97d3a`) background, white label
- Inactive modes: emoji + label at ~45% opacity
- Icons change from `LucideIcon` circles to **emoji** (✍️ 🎤 🔗 📷) — removes the uniform-circles visual problem
- Labels stay uppercase, same font

### Voice mode
- Existing large mic button kept, but wrapped in two concentric pulse rings (`border: 2px solid rgba(201,125,58,0.15/0.25)`) for warmth
- Mic button uses `linear-gradient(135deg, #e8734a, #c97d3a)` instead of flat `colors.accent`
- Transcription box styled as a white card (same shadow treatment as text input card) with italic placeholder copy

### Link mode
- URL input field rendered as a styled row inside the white card (icon + placeholder), not a bare `TextInput`
- Clipboard banner moves **inside** the card — no longer a separate banner above the content
- Optional note field below the clipboard banner inside the card

### Photo mode
- Picker state: white card with `borderStyle: 'dashed'`, centered 📷 emoji in an amber-tinted icon well, friendly copy: `"AI will describe what it sees and save it as a memory"`
- Post-pick state: unchanged (image preview + analysis box)

### Success overlay
- No change needed — existing `✓ saved` animation is fine

## What Does Not Change
- All save logic, API calls, validation, clipboard detection, voice recording, image upload
- `KeyboardAvoidingView` and `SafeAreaView` structure
- Accessibility roles and labels
- Haptics
- `canSave` logic
- Theme color tokens (we use existing tokens throughout)

## File Scope
Single file: `mobile/app/capture.tsx`
No new components, no new files.
