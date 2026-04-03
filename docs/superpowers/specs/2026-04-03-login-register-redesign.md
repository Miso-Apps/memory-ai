# Login / Register Redesign — Spec

**Date:** 2026-04-03  
**Status:** Approved

---

## 1. Goal

Redesign the login/register flow to match the ChatGPT-style multi-step experience: a clean welcome screen with Google OAuth, email sign-up via a 6-digit OTP code (not a clickable link), and email login with password. Gmail App Password (SMTP) is used to send real codes in development and production.

---

## 2. UX Flow

### State machine

```
welcome
  ├─► [Continue with Google]    → Google OAuth → home
  ├─► [Sign up with email]       → signup-email
  │     └─► [Continue]           → signup-password
  │           └─► [Create account] → signup-otp (OTP sent by register endpoint)
  │                 └─► [Verify code] → home (tokens issued)
  └─► [Already have account?]   → login-email
        └─► [Continue]           → login-password
              └─► [Log in]       → home
                    └─► [Forgot password?] → forgotSent (inline, no new step)
```

> **Note:** Sign-up collects email → password → then OTP (same order as ChatGPT). The account is created server-side when [Create account] is tapped; the OTP step follows to confirm email ownership before tokens are issued. This matches the existing backend `POST /auth/register` → `POST /auth/verify-otp` flow without needing temporary state storage.

### Step screens (detailed layout)

#### Step: `welcome`
- BrandMark (72px) + app title + tagline
- `[G  Continue with Google]` — accent-filled pill button
- `──── or ────` divider  
- `[Sign up with email]` — outlined pill button  
- `Already have an account? Log in` — text link  

#### Step: `signup-email` / `login-email`
- Back arrow (←) in top-left
- Heading: "Create your account" / "Welcome back"
- Subtext: "Enter your email to get started"
- Single email TextInput (auto-focused)
- `[Continue →]` button — disabled until valid email format

#### Step: `signup-password`
- Back arrow
- Heading: "Create a password"
- Name field (optional) — shown only during sign-up
- Email shown muted above as context (non-editable)
- Password field + eye toggle
- `[Create account →]` button → calls `POST /auth/register` → OTP sent, transitions to `signup-otp`

#### Step: `signup-otp`
- Back arrow
- Heading: "Check your inbox"
- Subtext: "We sent a 6-digit code to {{email}}"
- **6 individual digit boxes** in a row (each a single-char TextInput; auto-advance on each keystroke; backspace moves to previous)
- `[Verify code]` button → calls `POST /auth/verify-otp` → tokens issued → navigate to home
- `Didn't receive it? Resend (60s countdown)` — timer shown live; tapping resend calls `POST /auth/resend-otp`

#### Step: `login-password`
- Back arrow  
- Heading: "Welcome back"
- Subtext: user's email (muted, not editable)
- Password field + eye toggle
- `Forgot password?` link (tap → existing `handleForgotPassword` flow)
- `[Log in →]` button

---

## 3. Backend Changes

### 3.1 OTP generation in `POST /auth/register`

Current behaviour: generates a 32-char URL-safe token, stores in `email_verification_token`.  
New behaviour:
1. Generate a **6-digit numeric code** (zero-padded, e.g. `"083741"`).
2. Store code string in `email_verification_token` (existing column, no migration needed).
3. Expiry window shortened from 24h → **10 minutes** (stored in `email_verification_expires`).
4. Send a new **OTP email template** (big number display, no button/link).
5. Return `{ email_verification_required: true, message: "..." }` as before (no tokens yet).

### 3.2 New endpoint: `POST /auth/verify-otp`

```
Request:  { email: str, code: str }
Success:  { user: {...}, access_token: str, refresh_token: str }
Errors:
  400 — code is wrong
  400 — code expired (with detail distinguishing from wrong code)
  400 — already verified (idempotent: return tokens anyway)
  404 — email not found
```

Logic:
1. Look up `User` by email.
2. If already verified → issue tokens (idempotent).
3. Check `email_verification_expires` — if expired → 400.
4. Compare `code.strip()` == `user.email_verification_token` — constant-time safe with `secrets.compare_digest`.
5. If match: set `email_verified = True`, clear `email_verification_token` + `email_verification_expires`, issue tokens.
6. If no match: 400 with generic "incorrect or expired code" message (don't distinguish to prevent enumeration).

### 3.3 New endpoint: `POST /auth/resend-otp`

```
Request:  { email: str }
Response: { message: "Code resent" }
```

Logic:
1. Look up user by email.
2. If not found or already verified → return 200 silently (no leak).
3. Generate a **new** 6-digit code, update token + set new 10-min expiry.
4. Send OTP email.

Rate-limiting: existing per-endpoint behaviour (no new infra needed).

### 3.4 Old link-based endpoint kept

`GET /verify-email?token=` is preserved without change for backwards compatibility. It's not called by the new UI but may be bookmarked by users still on old builds.

---

## 4. Email Template

`email_service.py` — add `send_otp_email(to_email, code, user_name, locale)`:

```
Subject (EN): Your Memory AI verification code: 123456
Subject (VI): Mã xác nhận Memory AI của bạn: 123456

Body:
  Branded header (already exists via _base_template)
  
  Hi {{name}},

  Your verification code is:

  ┌─────────────────────────────────┐
  │          1  2  3  4  5  6       │  ← big monospace, centered
  └─────────────────────────────────┘

  This code expires in 10 minutes. Do not share it.

  If you didn't request this, you can ignore this email.
```

Key differences from old verification email:
- **No button or link** — only the code is shown
- Larger, monospace font for the 6-digit code
- Body text says "expires in 10 minutes"

---

## 5. Gmail SMTP Setup (dev + prod)

User sets these in `backend/.env`:

```bash
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=yourname@gmail.com
SMTP_PASSWORD=xxxx xxxx xxxx xxxx   # Gmail App Password
SMTP_FROM=yourname@gmail.com
```

How to generate an App Password:
1. Go to myaccount.google.com → Security → 2-Step Verification (must be ON)
2. Scroll down → "App passwords"
3. Select app: "Mail", device: "Other" → name it "Memory AI Dev"
4. Copy the 16-char password into `SMTP_PASSWORD` (spaces OK, strip when reading)

Production: add same vars to `deployment/.env`.

---

## 6. Frontend Changes (`mobile/app/login.tsx`)

### New state

```typescript
type LoginStep =
  | 'welcome'
  | 'signup-email'
  | 'signup-password'  // collect name + password → calls register → OTP sent
  | 'signup-otp'       // enter 6-digit code → verify → tokens
  | 'login-email'
  | 'login-password';  // enter password → login → tokens

const [step, setStep] = useState<LoginStep>('welcome');
const [email, setEmail] = useState('');
const [name, setName] = useState('');
const [password, setPassword] = useState('');
const [showPassword, setShowPassword] = useState(false);
const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '']);
const [otpError, setOtpError] = useState('');
const [resendCountdown, setResendCountdown] = useState(0);
const [formLoading, setFormLoading] = useState(false);
```

### OTP digit box behaviour
- 6 `TextInput` refs in an array
- `maxLength={1}`, `keyboardType="numeric"`
- On `onChangeText`: fill digit, auto-focus next ref
- On `onKeyPress` with `Backspace` + empty field: focus previous ref
- Combined code: `otpDigits.join('')`

### New API call

`authApi.verifyOtp(email, code)` → calls `POST /auth/verify-otp`  
`authApi.resendOtp(email)` → calls `POST /auth/resend-otp`

### Animation

`Animated.Value` (opacity + translateY) — each step transition fades out old step, fades in new step. Keep it simple: 200ms fade only.

### Back navigation

Each step's back arrow calls `setStep(previousStep)` and resets relevant state (OTP digits, errors).  
Back from `signup-email` / `login-email` → `welcome`.  
Back from `signup-password` → `signup-email`.  
Back from `signup-otp` → `signup-password` (reset OTP digits + error; user can go back to change password or just resent code).  
Back from `login-password` → `login-email`.

---

## 7. i18n Changes

All new keys in both `en.ts` and `vi.ts` under the `login:` namespace.

| Key | EN | VI |
|---|---|---|
| `login.welcomeSignUp` | "Sign up with email" | "Đăng ký bằng email" |
| `login.alreadyHaveAccount` | "Already have an account? " | "Đã có tài khoản? " |
| `login.logIn` | "Log in" | "Đăng nhập" |
| `login.createAccountTitle` | "Create your account" | "Tạo tài khoản" |
| `login.welcomeBackTitle` | "Welcome back" | "Chào mừng trở lại" |
| `login.emailSubtitle` | "Enter your email to get started" | "Nhập email để bắt đầu" |
| `login.continueBtn` | "Continue" | "Tiếp tục" |
| `login.checkInboxTitle` | "Check your inbox" | "Kiểm tra hộp thư" |
| `login.checkInboxSubtitle` | "We sent a 6-digit code to {{email}}" | "Chúng tôi đã gửi mã 6 chữ số đến {{email}}" |
| `login.verifyCode` | "Verify code" | "Xác nhận mã" |
| `login.resendCode` | "Resend code" | "Gửi lại mã" |
| `login.resendIn` | "Resend in {{seconds}}s" | "Gửi lại sau {{seconds}}s" |
| `login.otpIncorrect` | "Incorrect or expired code. Try again." | "Mã không đúng hoặc đã hết hạn. Vui lòng thử lại." |
| `login.createPasswordTitle` | "Create a password" | "Tạo mật khẩu" |
| `login.namePlaceholder` | "Name (optional)" | "Tên (tùy chọn)" |
| `login.loginPasswordTitle` | "Enter your password" | "Nhập mật khẩu" |

Existing keys **kept**: `signIn`, `createAccount`, `continueWithGoogle`, `orDivider`, `emailPlaceholder`, `passwordPlaceholder`, `forgotPassword`, `forgotPasswordSent`, `forgotPasswordEmailRequired`, `checkEmailTitle`, `checkEmailSubtitle`, `checkEmailHint`, `resendVerification`, `resendSuccess`, `resendSuccessMessage`, `backToSignIn`, all error keys.

---

## 8. Database Migration

**None required.** Both `email_verification_token` (VARCHAR) and `email_verification_expires` (TIMESTAMP) already exist on the `users` table. Storing a 6-digit string instead of a 32-char token is a data change, not a schema change.

---

## 9. Deployment

No infrastructure changes needed.

Add/update these vars in `deployment/.env` (user to fill):
```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=<gmail address>
SMTP_PASSWORD=<gmail app password>
SMTP_FROM=<gmail address>
```

Update `deployment/.env.example` to document these clearly (already done for SMTP_HOST; no schema changes to deploy).

---

## 10. Testing Plan

### Backend (pytest)

1. `test_verify_otp_success` — register → extract token from DB → POST `/auth/verify-otp` → 200, tokens returned
2. `test_verify_otp_wrong_code` — POST with wrong code → 400
3. `test_verify_otp_expired` — manually set `email_verification_expires` to past → 400 and message contains "expired"
4. `test_resend_otp` — call resend → new code stored in DB, different from original
5. `test_verify_otp_already_verified` — verify twice → second call returns tokens (idempotent)
6. `test_register_still_returns_verification_required` — `EMAIL_VERIFICATION_ENABLED=True` → register → no tokens returned
7. Existing 35 tests must continue to pass (conftest.py autouse fixture handles isolation)

### Mobile (TypeScript)

- `npx tsc --noEmit` → 0 errors
- `npm run lint` → 0 errors
- Manual smoke test via Expo Go: welcome → sign up → OTP → password → home

### i18n

- `npm run i18n:check` → 0 missing keys

---

## 11. Out of Scope

- Push notification for OTP (email only)
- SMS OTP
- Forgot password OTP flow (existing email link still used for resets — separate future task)
- Rate limiting / IP blocking for OTP brute force (future task)
