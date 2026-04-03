# Login Screen Redesign

**Date:** 2026-04-03  
**Status:** Approved  
**Scope:** `mobile/app/login.tsx`, `mobile/i18n/locales/en.ts`, `mobile/i18n/locales/vi.ts`

---

## Goals

- Visual refresh for a stronger first impression
- Warm & personal aesthetic matching "memory companion" concept
- Improved UX: show/hide password toggle, forgot password flow
- Better brand elevation while staying consistent with the rest of the app
- Full EN/VI i18n parity

---

## Out of Scope

- Backend changes (no new DB models, no migrations)
- Deployment changes (mobile only, no server infrastructure affected)
- Separate login/register screens (single combined screen retained)
- Biometric / additional OAuth providers
- A backend `forgot-password` endpoint (stubbed in mobile for now)

---

## Layout & Structure

Single file: `mobile/app/login.tsx`. No routing changes.

Top-to-bottom visual hierarchy:

1. **Full-screen background** — `#FAF8F5` (warm cream), replaces white
2. **Header zone** — centered, above the card: `BrandMark` (72px) + app name + tagline
3. **Card** — white `#FFFFFF`, `borderRadius: 24`, soft warm shadow, horizontal margin 20px, inner padding 24px
   - Google button (primary CTA)
   - "or" divider
   - Mode toggle (sign in / create account)
   - Form fields (name shown only in register mode)
   - Forgot password link (login mode only, right-aligned, below password)
   - Submit button

`KeyboardAvoidingView` + `ScrollView` structure retained.

---

## Visual Tokens (login.tsx-scoped, no changes to theme.ts)

| Element | Value |
|---|---|
| Screen background | `#FAF8F5` |
| Card background | `#FFFFFF` |
| Card shadow (iOS) | `shadowColor: '#2C1A1A', offset: {0,4}, opacity: 0.08, radius: 16` |
| Card shadow (Android) | `elevation: 4` |
| Input background | `#F5F2EE` |
| Input focus border | `#C4A882`, width 1.5 |
| Submit button bg | `#2C1A1A` |
| Mode toggle active bg | `#2C1A1A` |
| Mode toggle inactive bg | `#EDE8E1` |
| Tagline / forgot password text | `#8C7B6E` |
| Password eye icon | `#8C7B6E` |

All other colors (BrandMark, Google button border, Google icon, divider line, placeholder) inherit from `useTheme()` as before.

---

## Components & Interactions

### Mode Toggle
Pill-shaped segmented control. Height 44px. Active side: `#2C1A1A` background, white text. Inactive side: transparent background, `#8C7B6E` text. Rounded corners (radius 10 inner, radius 12 container). Animation: none (instant state swap is fine for v1).

### Password Show/Hide
- `secureTextEntry` controlled by local `showPassword` boolean (default: `false`, i.e., hidden)
- Eye icon rendered inside an absolute-positioned `TouchableOpacity` on the right edge of the password field
- Icons: `Eye` and `EyeOff` from `lucide-react-native` (already a dependency)
- Icon color: `#8C7B6E`, size 20

### Input Focus State
Each input (name, email, password) has its own `focused` boolean in state.  
- `onFocus` → set focused true  
- `onBlur` → set focused false  
- Focused: `borderColor: #C4A882`, `borderWidth: 1.5`  
- Unfocused: `borderColor: transparent`, `borderWidth: 1.5` (keeps layout stable)

### Forgot Password
- Visible only when `mode === 'login'`
- Right-aligned `TouchableOpacity` below password field
- On press: calls `api.post('/auth/forgot-password', { email })` if email is filled; if email is empty, shows Alert asking user to enter email first
- Backend endpoint does not exist yet → API call will fail; catch block shows Alert: `t('login.forgotPasswordSent')` stub (the UI shows the message regardless for now, as a forward-compatible stub)
- i18n keys needed: `login.forgotPassword`, `login.forgotPasswordSent`, `login.forgotPasswordEmailRequired`

### Tagline Update
- EN: `"Your memories, always with you"` (replaces `"Your personal memory companion"`)
- VI: `"Ký ức của bạn, luôn bên bạn"`
- i18n key: `login.subtitle` (already exists, value updated)

---

## i18n Changes

### New keys (both `en.ts` and `vi.ts`)

| Key | EN | VI |
|---|---|---|
| `login.subtitle` | `"Your memories, always with you"` | `"Ký ức của bạn, luôn bên bạn"` |
| `login.forgotPassword` | `"Forgot password?"` | `"Quên mật khẩu?"` |
| `login.forgotPasswordSent` | `"If an account exists for that email, a reset link has been sent."` | `"Nếu tài khoản tồn tại, liên kết đặt lại mật khẩu đã được gửi."` |
| `login.forgotPasswordEmailRequired` | `"Please enter your email address first."` | `"Vui lòng nhập địa chỉ email trước."` |

`login.subtitle` is an update to an existing key, all others are new additions.

---

## Backend / Database / Deployment

- **No DB migration needed** — purely a frontend change
- **No deployment changes** — no new env vars, no new endpoints, no infrastructure changes
- **Forgot password backend stub**: the mobile app gracefully handles the missing endpoint (catch block shows the confirmation message to avoid leaking whether an email exists — intentional UX pattern)

---

## Testing Plan

1. **Type check**: `npm run type-check` in `mobile/`
2. **Lint**: `npm run lint` in `mobile/`
3. **i18n parity**: `npm run i18n:check` in `mobile/`
4. **Manual verification**:
   - Login flow (email/password, Google)
   - Register flow (name field appears, validation works)
   - Show/hide password toggle
   - Forgot password tap with email filled → Alert shown
   - Forgot password tap with empty email → email-required Alert
   - Keyboard avoidance on iOS and Android
   - Dark mode (if applicable — colors are hardcoded in this file, so dark mode will not affect login screen; acceptable for v1)
