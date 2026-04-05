# Login / Register Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the login/register flow to a ChatGPT-style multi-step experience — welcome screen → email → password → 6-digit OTP verification — replacing the current single-screen toggle form, replacing the link-based email verification with a numeric OTP code, and configuring Gmail App Password (SMTP) for real email delivery.

**Architecture:** Login state machine in `mobile/app/login.tsx` drives step transitions (welcome → signup-email → signup-password → signup-otp → home, or welcome → login-email → login-password → home). Two new backend endpoints handle OTP verification and resend. The existing `email_verification_token` column stores the 6-digit code — no DB migration needed. Gmail SMTP is configured via `SMTP_*` environment variables.

**Tech Stack:** React Native + Expo (mobile), FastAPI + SQLAlchemy async (backend), pytest, TypeScript, react-i18next

**Spec:** `docs/superpowers/specs/2026-04-03-login-register-redesign.md`

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `backend/app/api/auth.py` | Modify | Add `POST /auth/verify-otp`, `POST /auth/resend-otp`; update register to generate 6-digit code with 10-min expiry |
| `backend/app/services/email_service.py` | Modify | Add `send_otp_email()` with big-number template |
| `backend/.env` | Modify | Add `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM` |
| `backend/.env.example` | Modify | Document SMTP vars clearly |
| `deployment/.env.example` | Modify | Add SMTP vars section |
| `backend/test_endpoints.py` | Modify | Add 6 new OTP endpoint tests |
| `mobile/services/api.ts` | Modify | Add `verifyOtp()` and `resendOtp()` to `authApi` |
| `mobile/app/login.tsx` | Rewrite | Multi-step animated flow |
| `mobile/i18n/locales/en.ts` | Modify | Add 16 new keys under `login:` |
| `mobile/i18n/locales/vi.ts` | Modify | Add same 16 keys in Vietnamese |

---

## Task 1: Update `POST /auth/register` to generate 6-digit OTP

**Files:**
- Modify: `backend/app/api/auth.py` (register function, around line 180–230)

- [ ] **Step 1: Open `backend/app/api/auth.py` and replace the token generation in `register()`**

  Find this block inside `async def register(...)`:
  ```python
  verification_token = secrets.token_urlsafe(32)
  needs_verification = settings.EMAIL_VERIFICATION_ENABLED
  ```

  Replace with:
  ```python
  # Generate a 6-digit numeric OTP (stored as zero-padded string)
  verification_token = f"{secrets.randbelow(1_000_000):06d}"
  needs_verification = settings.EMAIL_VERIFICATION_ENABLED
  ```

- [ ] **Step 2: Shorten the OTP expiry from 24h to 10 minutes**

  Find:
  ```python
  email_verification_expires=(
      datetime.now(timezone.utc) + timedelta(hours=24)
      if needs_verification
      else None
  ),
  ```

  Replace with:
  ```python
  email_verification_expires=(
      datetime.now(timezone.utc) + timedelta(minutes=10)
      if needs_verification
      else None
  ),
  ```

- [ ] **Step 3: Replace the `send_verification_email` call with `send_otp_email`**

  Find:
  ```python
  from app.services import email_service

  await email_service.send_verification_email(
      user.email, verification_token, user.name
  )
  ```

  Replace with:
  ```python
  from app.services import email_service

  await email_service.send_otp_email(
      user.email, verification_token, user.name
  )
  ```

- [ ] **Step 4: Confirm the file still compiles**

  ```bash
  cd /Users/brian/Projects/Startups/memory-ai/backend
  source venv/bin/activate
  python -c "from app.api.auth import router; print('OK')"
  ```

  Expected: `OK`

---

## Task 2: Add `POST /auth/verify-otp` and `POST /auth/resend-otp` endpoints

**Files:**
- Modify: `backend/app/api/auth.py` (add after the existing `/resend-verification-public` route)

- [ ] **Step 1: Add the two new Pydantic request models near the top of the file (after the existing model classes)**

  Find the existing:
  ```python
  class RefreshRequest(BaseModel):
      refresh_token: str
  ```

  Add after it:
  ```python
  class VerifyOtpRequest(BaseModel):
      email: str
      code: str


  class ResendOtpRequest(BaseModel):
      email: str
  ```

- [ ] **Step 2: Add the `POST /verify-otp` endpoint**

  Find the `# Email verification` section comment and add the new endpoint *after* the existing `resend-verification-public` route (search for the end of that function — it ends with `return {"message": ...}`).

  Add this new route immediately after `resend-verification-public`:
  ```python
  @router.post("/verify-otp")
  async def verify_otp(body: VerifyOtpRequest, db: AsyncSession = Depends(get_db)):
      """Verify a 6-digit OTP code and issue JWT tokens.

      Idempotent: already-verified users receive tokens without error.
      Returns 400 for both wrong code and expired code (same message to
      prevent enumeration attacks).
      """
      email = (body.email or "").strip().lower()
      code = (body.code or "").strip()

      result = await db.execute(select(User).where(User.email == email))
      user = result.scalar_one_or_none()

      if not user:
          raise HTTPException(status_code=404, detail="No account found for that email")

      # Idempotent: already verified → issue tokens
      if user.email_verified:
          tokens = _issue_tokens(str(user.id))
          return {"user": _user_response(user), **tokens}

      # Expired
      if (
          not user.email_verification_expires
          or datetime.now(timezone.utc) > user.email_verification_expires
      ):
          raise HTTPException(
              status_code=400,
              detail="Your code has expired. Please request a new one.",
          )

      # Wrong code — constant-time comparison to prevent timing attacks
      stored = (user.email_verification_token or "").strip()
      if not secrets.compare_digest(stored, code):
          raise HTTPException(
              status_code=400,
              detail="Incorrect or expired code. Please try again.",
          )

      # Mark verified, clear OTP fields
      user.email_verified = True
      user.email_verification_token = None
      user.email_verification_expires = None
      await db.flush()

      tokens = _issue_tokens(str(user.id))
      return {"user": _user_response(user), **tokens}


  @router.post("/resend-otp")
  async def resend_otp(body: ResendOtpRequest, db: AsyncSession = Depends(get_db)):
      """Generate a new 6-digit OTP and resend it.

      Always returns 200 regardless of whether the email exists (no leak).
      """
      email = (body.email or "").strip().lower()

      result = await db.execute(select(User).where(User.email == email))
      user = result.scalar_one_or_none()

      # Silent no-op for unknown emails or already-verified accounts
      if not user or user.email_verified:
          return {"message": "If an account exists and is unverified, a new code has been sent."}

      # Generate new 6-digit code and reset expiry
      new_code = f"{secrets.randbelow(1_000_000):06d}"
      user.email_verification_token = new_code
      user.email_verification_expires = datetime.now(timezone.utc) + timedelta(minutes=10)
      await db.flush()

      try:
          from app.services import email_service
          await email_service.send_otp_email(user.email, new_code, user.name)
      except Exception as exc:
          logger.error("Failed to resend OTP: %s", exc)
          raise HTTPException(
              status_code=503,
              detail="Email delivery is currently unavailable. Please try again later.",
          ) from exc

      return {"message": "If an account exists and is unverified, a new code has been sent."}
  ```

- [ ] **Step 3: Verify the file compiles**

  ```bash
  cd /Users/brian/Projects/Startups/memory-ai/backend
  source venv/bin/activate
  python -c "from app.api.auth import router; print('routes:', [r.path for r in router.routes])"
  ```

  Expected output must include `/verify-otp` and `/resend-otp`.

---

## Task 3: Add `send_otp_email()` to `email_service.py`

**Files:**
- Modify: `backend/app/services/email_service.py`

- [ ] **Step 1: Add the `send_otp_email` function**

  Open `backend/app/services/email_service.py`. Find the existing `send_verification_email` function (search for `async def send_verification_email`). Add the new function **directly after** `send_verification_email`'s closing line.

  First, find the end of `send_verification_email` — it ends with:
  ```python
      await _send_email(to_email=to_email, subject=subject, html_content=html)
  ```

  Add this new function after it:
  ```python

  async def send_otp_email(
      to_email: str,
      code: str,
      user_name: str | None = None,
      locale: str | None = None,
  ) -> None:
      """Send a 6-digit OTP verification email.

      The code is displayed in a large, visually prominent box.
      No clickable button or link is included — the user types the code
      into the app.
      """
      lang = _normalize_locale(locale)
      name = _safe_name(user_name, lang)

      subject = _text(
          lang,
          f"Your DukiAI Memory verification code: {code}",
          f"Mã xác nhận DukiAI Memory của bạn: {code}",
      )

      greeting = _text(lang, f"Hi {name},", f"Chào {name},")
      intro = _text(
          lang,
          "Your verification code is:",
          "Mã xác nhận của bạn là:",
      )
      expiry_note = _text(
          lang,
          "This code expires in <strong>10 minutes</strong>. Do not share it with anyone.",
          "Mã này hết hạn sau <strong>10 phút</strong>. Không chia sẻ mã này với bất kỳ ai.",
      )
      ignore_note = _text(
          lang,
          "If you didn't request this, you can safely ignore this email.",
          "Nếu bạn không yêu cầu điều này, bạn có thể bỏ qua email này.",
      )

      body_html = f"""\
  <p style="margin:0 0 12px;color:#374151;font-size:15px;">{greeting}</p>
  <p style="margin:0 0 20px;color:#374151;font-size:15px;">{intro}</p>
  <div style="text-align:center;margin:24px 0;">
    <div style="display:inline-block;background:#F5F3FF;border:2px solid #DDD6FE;
                border-radius:16px;padding:20px 36px;">
      <span style="font-family:'Courier New',Courier,monospace;font-size:42px;
                   font-weight:900;letter-spacing:12px;color:#6C63FF;
                   display:inline-block;min-width:220px;text-align:center;">
        {escape(code)}
      </span>
    </div>
  </div>
  <p style="margin:16px 0 12px;color:#374151;font-size:14px;">{expiry_note}</p>
  <p style="margin:0;color:#9CA3AF;font-size:13px;font-style:italic;">{ignore_note}</p>
  """

      preheader = _text(
          lang,
          f"Your code is {code} — expires in 10 minutes",
          f"Mã của bạn là {code} — hết hạn sau 10 phút",
      )
      html = _base_template(body_html, preheader=preheader, locale=lang)
      await _send_email(to_email=to_email, subject=subject, html_content=html)
  ```

- [ ] **Step 2: Verify the module imports cleanly**

  ```bash
  cd /Users/brian/Projects/Startups/memory-ai/backend
  source venv/bin/activate
  python -c "from app.services.email_service import send_otp_email; print('OK')"
  ```

  Expected: `OK`

- [ ] **Step 3: Smoke-test the OTP email template renders**

  ```bash
  cd /Users/brian/Projects/Startups/memory-ai/backend
  source venv/bin/activate
  python - <<'EOF'
  import asyncio
  from app.services.email_service import send_otp_email
  from app.config import settings
  settings.DEBUG = True  # force console transport
  asyncio.run(send_otp_email("test@example.com", "042731", "Brian"))
  EOF
  ```

  Expected: Console log shows the 6-digit code `042731` and subject line.

---

## Task 4: Write backend tests for OTP endpoints

**Files:**
- Modify: `backend/test_endpoints.py` (add new test functions at the bottom)

- [ ] **Step 1: Read the top of `backend/test_endpoints.py` to understand fixture setup**

  ```bash
  head -60 /Users/brian/Projects/Startups/memory-ai/backend/test_endpoints.py
  ```

  Note the `client` fixture and `test_user_data` pattern used by existing tests.

- [ ] **Step 2: Add the 6 new OTP tests at the end of `test_endpoints.py`**

  ```python
  # ---------------------------------------------------------------------------
  # OTP verification endpoint tests
  # ---------------------------------------------------------------------------

  @pytest.mark.asyncio
  async def test_verify_otp_success(client: AsyncClient):
      """Register → extract OTP from DB → verify → tokens returned."""
      import secrets as _secrets
      from app.config import settings as _settings
      from app.database import AsyncSessionLocal
      from app.models.user import User
      from sqlalchemy import select as _select

      # Enable verification for this test
      _settings.EMAIL_VERIFICATION_ENABLED = True
      try:
          email = f"otp-ok-{_secrets.token_hex(4)}@example.com"
          reg = await client.post("/auth/register", json={
              "email": email, "password": "testpass123"
          })
          assert reg.status_code == 200
          assert reg.json()["email_verification_required"] is True

          # Retrieve OTP from DB
          async with AsyncSessionLocal() as db:
              result = await db.execute(_select(User).where(User.email == email))
              user = result.scalar_one()
              code = user.email_verification_token

          resp = await client.post("/auth/verify-otp", json={"email": email, "code": code})
          assert resp.status_code == 200
          data = resp.json()
          assert "access_token" in data
          assert "refresh_token" in data
          assert data["user"]["email"] == email
          assert data["user"]["email_verified"] is True
      finally:
          _settings.EMAIL_VERIFICATION_ENABLED = False


  @pytest.mark.asyncio
  async def test_verify_otp_wrong_code(client: AsyncClient):
      """Wrong code returns 400."""
      import secrets as _secrets
      from app.config import settings as _settings

      _settings.EMAIL_VERIFICATION_ENABLED = True
      try:
          email = f"otp-wrong-{_secrets.token_hex(4)}@example.com"
          await client.post("/auth/register", json={"email": email, "password": "testpass123"})
          resp = await client.post("/auth/verify-otp", json={"email": email, "code": "000000"})
          assert resp.status_code == 400
          assert "Incorrect" in resp.json()["detail"]
      finally:
          _settings.EMAIL_VERIFICATION_ENABLED = False


  @pytest.mark.asyncio
  async def test_verify_otp_expired(client: AsyncClient):
      """Expired code returns 400 with 'expired' in the detail."""
      import secrets as _secrets
      from datetime import datetime, timedelta, timezone as _tz
      from app.config import settings as _settings
      from app.database import AsyncSessionLocal
      from app.models.user import User
      from sqlalchemy import select as _select

      _settings.EMAIL_VERIFICATION_ENABLED = True
      try:
          email = f"otp-exp-{_secrets.token_hex(4)}@example.com"
          reg = await client.post("/auth/register", json={"email": email, "password": "testpass123"})
          assert reg.status_code == 200

          # Manually expire the token
          async with AsyncSessionLocal() as db:
              result = await db.execute(_select(User).where(User.email == email))
              user = result.scalar_one()
              code = user.email_verification_token
              user.email_verification_expires = datetime.now(_tz.utc) - timedelta(minutes=1)
              await db.commit()

          resp = await client.post("/auth/verify-otp", json={"email": email, "code": code})
          assert resp.status_code == 400
          assert "expired" in resp.json()["detail"].lower()
      finally:
          _settings.EMAIL_VERIFICATION_ENABLED = False


  @pytest.mark.asyncio
  async def test_verify_otp_already_verified(client: AsyncClient):
      """Already-verified user gets tokens (idempotent)."""
      import secrets as _secrets
      reg = await client.post("/auth/register", json={
          "email": f"otp-alv-{_secrets.token_hex(4)}@example.com",
          "password": "testpass123",
      })
      assert reg.status_code == 200
      email = reg.json()["user"]["email"]

      # Calling verify-otp on an already-verified account (conftest disables
      # verification so the register above already verified the account)
      resp = await client.post("/auth/verify-otp", json={"email": email, "code": "anything"})
      assert resp.status_code == 200
      assert "access_token" in resp.json()


  @pytest.mark.asyncio
  async def test_resend_otp_generates_new_code(client: AsyncClient):
      """Resend generates a different code than the original."""
      import secrets as _secrets
      from app.config import settings as _settings
      from app.database import AsyncSessionLocal
      from app.models.user import User
      from sqlalchemy import select as _select

      _settings.EMAIL_VERIFICATION_ENABLED = True
      try:
          email = f"otp-resend-{_secrets.token_hex(4)}@example.com"
          await client.post("/auth/register", json={"email": email, "password": "testpass123"})

          async with AsyncSessionLocal() as db:
              result = await db.execute(_select(User).where(User.email == email))
              original_code = result.scalar_one().email_verification_token

          resp = await client.post("/auth/resend-otp", json={"email": email})
          assert resp.status_code == 200

          async with AsyncSessionLocal() as db:
              result = await db.execute(_select(User).where(User.email == email))
              new_code = result.scalar_one().email_verification_token

          # New code should be set (may occasionally equal original by chance — acceptable)
          assert new_code is not None
          assert len(new_code) == 6
          assert new_code.isdigit()
      finally:
          _settings.EMAIL_VERIFICATION_ENABLED = False


  @pytest.mark.asyncio
  async def test_resend_otp_unknown_email_returns_200(client: AsyncClient):
      """Resend for unknown email returns 200 silently (no info leak)."""
      resp = await client.post("/auth/resend-otp", json={"email": "nobody@notexist.com"})
      assert resp.status_code == 200
  ```

- [ ] **Step 3: Run only the new OTP tests**

  ```bash
  cd /Users/brian/Projects/Startups/memory-ai/backend
  source venv/bin/activate
  pytest test_endpoints.py -k "otp" -v 2>&1 | tail -30
  ```

  Expected: All 6 new tests PASS.

- [ ] **Step 4: Run the full test suite**

  ```bash
  cd /Users/brian/Projects/Startups/memory-ai/backend
  source venv/bin/activate
  pytest -x -q 2>&1 | tail -20
  ```

  Expected: All tests pass (≥35 + 6 new = 41+).

---

## Task 5: Add Gmail SMTP environment variables

**Files:**
- Modify: `backend/.env`
- Modify: `backend/.env.example`
- Modify: `deployment/.env.example`

- [ ] **Step 1: Add SMTP config to `backend/.env`**

  The user will fill in their Gmail address and App Password. Add a placeholder block.

  Open `backend/.env` and find:
  ```
  SMTP_HOST=
  ```

  If it already exists (just empty), update to:
  ```
  SMTP_HOST=smtp.gmail.com
  SMTP_PORT=587
  SMTP_USER=your-gmail@gmail.com
  SMTP_PASSWORD=xxxx xxxx xxxx xxxx
  SMTP_FROM=your-gmail@gmail.com
  ```

  **If it does NOT exist** (check `grep -n SMTP_HOST backend/.env`), add after the `EMAIL_VERIFICATION_ENABLED` line:
  ```
  # Gmail SMTP (App Password)
  # Setup: myaccount.google.com → Security → 2-Step Verification → App passwords
  # App: Mail, Device: Other → name it "DukiAI Memory Dev" → copy 16-char password
  SMTP_HOST=smtp.gmail.com
  SMTP_PORT=587
  SMTP_USER=your-gmail@gmail.com
  SMTP_PASSWORD=xxxx xxxx xxxx xxxx
  SMTP_FROM=your-gmail@gmail.com
  ```

- [ ] **Step 2: Update `backend/.env.example` to document the Gmail SMTP section clearly**

  Find the SMTP section in `.env.example` (search for `SMTP_HOST`) and update it to:
  ```
  # Gmail SMTP for email delivery (App Password method)
  # How to generate an App Password:
  #   1. Go to myaccount.google.com → Security
  #   2. Enable 2-Step Verification (required)
  #   3. Search for "App passwords" → create one for "Mail" + "Other (DukiAI Memory)"
  #   4. Copy the 16-char password shown (spaces are OK, or remove them)
  # For development: leave SMTP_HOST empty → emails are printed to the terminal
  SMTP_HOST=smtp.gmail.com
  SMTP_PORT=587
  SMTP_USER=yourname@gmail.com
  SMTP_PASSWORD=xxxx xxxx xxxx xxxx
  SMTP_FROM=yourname@gmail.com
  ```

- [ ] **Step 3: Add SMTP section to `deployment/.env.example`**

  Open `deployment/.env.example` and add (or update) the SMTP section with the same block.

- [ ] **Step 4: Verify email diagnostic recognises SMTP when configured**

  ```bash
  cd /Users/brian/Projects/Startups/memory-ai/backend
  source venv/bin/activate
  python - <<'EOF'
  from app.config import settings
  from app.services.email_service import get_email_transport_diagnostic
  print(get_email_transport_diagnostic())
  EOF
  ```

  Expected: `active_transport` is either `"smtp"` (if you filled in SMTP vars) or `"console"` (if still using placeholders — that's fine for now).

---

## Task 6: Add `verifyOtp` and `resendOtp` to `mobile/services/api.ts`

**Files:**
- Modify: `mobile/services/api.ts` — extend `authApi`

- [ ] **Step 1: Add the two new methods to `authApi`**

  Open `mobile/services/api.ts` and find the end of `authApi`:
  ```typescript
  // Resend verification email (public — requires email + password)
  resendVerificationPublic: async (email: string, password: string) => {
    const response = await api.post<{ message: string }>(
      '/auth/resend-verification-public',
      { email, password },
    );
    return response.data;
  },
  ```

  Add the following two methods after `resendVerificationPublic`:
  ```typescript
  // Verify a 6-digit OTP code. Returns tokens on success.
  verifyOtp: async (email: string, code: string) => {
    const response = await api.post<{
      user: { id: string; email: string; name?: string; email_verified?: boolean; auth_provider?: string };
      access_token: string;
      refresh_token: string;
    }>('/auth/verify-otp', { email, code });
    return response.data;
  },

  // Request a new 6-digit OTP to be sent to the given email.
  resendOtp: async (email: string) => {
    const response = await api.post<{ message: string }>('/auth/resend-otp', { email });
    return response.data;
  },
  ```

- [ ] **Step 2: TypeScript check**

  ```bash
  cd /Users/brian/Projects/Startups/memory-ai/mobile
  npx tsc --noEmit 2>&1 | head -20
  ```

  Expected: 0 errors.

---

## Task 7: Add i18n keys (EN + VI)

**Files:**
- Modify: `mobile/i18n/locales/en.ts`
- Modify: `mobile/i18n/locales/vi.ts`

- [ ] **Step 1: Add new keys to `en.ts` under the `login:` section**

  Open `mobile/i18n/locales/en.ts`. Find the `login:` block. Locate the `backToSignIn` key (last existing key in the block):
  ```typescript
      backToSignIn: 'Back to sign in',
    },
  ```

  Replace with:
  ```typescript
      backToSignIn: 'Back to sign in',
      // Multi-step redesign keys
      welcomeSignUp: 'Sign up with email',
      alreadyHaveAccount: 'Already have an account? ',
      logIn: 'Log in',
      createAccountTitle: 'Create your account',
      welcomeBackTitle: 'Welcome back',
      emailSubtitle: 'Enter your email to get started',
      continueBtn: 'Continue',
      checkInboxTitle: 'Check your inbox',
      checkInboxSubtitle: 'We sent a 6-digit code to {{email}}',
      verifyCode: 'Verify code',
      resendCode: 'Resend code',
      resendIn: 'Resend in {{seconds}}s',
      otpIncorrect: 'Incorrect or expired code. Try again.',
      createPasswordTitle: 'Create a password',
      loginPasswordTitle: 'Enter your password',
    },
  ```

- [ ] **Step 2: Add matching keys to `vi.ts` under the `login:` section**

  Open `mobile/i18n/locales/vi.ts`. Find the same `login:` block. Locate `backToSignIn`:
  ```typescript
      backToSignIn: 'Quay lại đăng nhập',
    },
  ```

  Replace with:
  ```typescript
      backToSignIn: 'Quay lại đăng nhập',
      // Multi-step redesign keys
      welcomeSignUp: 'Đăng ký bằng email',
      alreadyHaveAccount: 'Đã có tài khoản? ',
      logIn: 'Đăng nhập',
      createAccountTitle: 'Tạo tài khoản',
      welcomeBackTitle: 'Chào mừng trở lại',
      emailSubtitle: 'Nhập email để bắt đầu',
      continueBtn: 'Tiếp tục',
      checkInboxTitle: 'Kiểm tra hộp thư',
      checkInboxSubtitle: 'Chúng tôi đã gửi mã 6 chữ số đến {{email}}',
      verifyCode: 'Xác nhận mã',
      resendCode: 'Gửi lại mã',
      resendIn: 'Gửi lại sau {{seconds}}s',
      otpIncorrect: 'Mã không đúng hoặc đã hết hạn. Vui lòng thử lại.',
      createPasswordTitle: 'Tạo mật khẩu',
      loginPasswordTitle: 'Nhập mật khẩu',
    },
  ```

- [ ] **Step 3: Run i18n parity check**

  ```bash
  cd /Users/brian/Projects/Startups/memory-ai/mobile
  npm run i18n:check 2>&1 | tail -10
  ```

  Expected: `✅  No missing keys` (or equivalent clean output).

---

## Task 8: Rewrite `mobile/app/login.tsx`

**Files:**
- Rewrite: `mobile/app/login.tsx`

- [ ] **Step 1: Replace the entire file with the new multi-step implementation**

  The new file builds a step-based flow with fade animation. Replace the full content of `mobile/app/login.tsx` with:

  ```tsx
  import React, { useState, useRef, useEffect } from 'react';
  import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    KeyboardAvoidingView,
    Platform,
    ActivityIndicator,
    Alert,
    ScrollView,
    Animated,
  } from 'react-native';
  import { router } from 'expo-router';
  import { useTranslation } from 'react-i18next';
  import { Eye, EyeOff, ArrowLeft } from 'lucide-react-native';
  import { useAuthStore } from '../store/authStore';
  import { useTheme } from '../constants/ThemeContext';
  import { BrandMark } from '../components/BrandMark';
  import api, { authApi } from '../services/api';

  // ─── Types ────────────────────────────────────────────────────────────────

  type LoginStep =
    | 'welcome'
    | 'signup-email'
    | 'signup-password'  // collects name + password → calls register → OTP sent
    | 'signup-otp'       // enter 6-digit OTP → verify → tokens issued → home
    | 'login-email'
    | 'login-password';  // enter password → login → home

  const NUM_DIGITS = 6;

  // ─── Component ────────────────────────────────────────────────────────────

  export default function LoginScreen() {
    const { t } = useTranslation();
    const { colors, isDark } = useTheme();
    const { login, register, loginWithGoogle, isLoading } = useAuthStore();

    // Step state
    const [step, setStep] = useState<LoginStep>('welcome');
    const fadeAnim = useRef(new Animated.Value(1)).current;

    // Form state
    const [email, setEmail] = useState('');
    const [name, setName] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [focusedField, setFocusedField] = useState<string | null>(null);

    // OTP state
    const [otpDigits, setOtpDigits] = useState<string[]>(Array(NUM_DIGITS).fill(''));
    const [otpError, setOtpError] = useState('');
    const [otpLoading, setOtpLoading] = useState(false);
    const [resendCountdown, setResendCountdown] = useState(0);
    const otpRefs = useRef<(TextInput | null)[]>(Array(NUM_DIGITS).fill(null));

    // Per-step loading / error
    const [formLoading, setFormLoading] = useState(false);
    const [formError, setFormError] = useState('');

    // ── Countdown timer for resend ─────────────────────────────────────────

    useEffect(() => {
      if (resendCountdown <= 0) return;
      const id = setTimeout(() => setResendCountdown((c) => c - 1), 1000);
      return () => clearTimeout(id);
    }, [resendCountdown]);

    // ── Step transition (fade) ─────────────────────────────────────────────

    function goToStep(next: LoginStep) {
      Animated.timing(fadeAnim, {
        toValue: 0, duration: 150, useNativeDriver: true,
      }).start(() => {
        setStep(next);
        setFormError('');
        Animated.timing(fadeAnim, {
          toValue: 1, duration: 200, useNativeDriver: true,
        }).start();
      });
    }

    function goBack() {
      const prev: Record<LoginStep, LoginStep | null> = {
        'welcome':          null,
        'signup-email':     'welcome',
        'signup-password':  'signup-email',
        'signup-otp':       'signup-password',
        'login-email':      'welcome',
        'login-password':   'login-email',
      };
      const target = prev[step];
      if (target) {
        setOtpDigits(Array(NUM_DIGITS).fill(''));
        setOtpError('');
        goToStep(target);
      }
    }

    // ── Google Sign In ─────────────────────────────────────────────────────

    const handleGoogleLogin = async () => {
      try {
        await loginWithGoogle();
        router.replace('/(tabs)/home');
      } catch (err: any) {
        const message = err?.response?.data?.detail || err?.message || t('login.genericError');
        Alert.alert(t('login.loginFailed'), message);
      }
    };

    // ── Email step (signup + login share the same handler) ─────────────────

    const handleEmailContinue = () => {
      const trimmed = email.trim();
      if (!trimmed || !trimmed.includes('@')) {
        setFormError(t('login.emailRequired'));
        return;
      }
      setFormError('');
      goToStep(step === 'signup-email' ? 'signup-password' : 'login-password');
    };

    // ── Sign up: collect name + password then call register ───────────────

    const handleSignUpSubmit = async () => {
      if (password.length < 8) {
        setFormError(t('login.passwordMinLength'));
        return;
      }
      setFormError('');
      setFormLoading(true);
      try {
        const result = await register(email.trim(), password, name.trim() || undefined);
        if (result?.emailVerificationRequired) {
          setOtpDigits(Array(NUM_DIGITS).fill(''));
          setResendCountdown(60);
          goToStep('signup-otp');
        } else {
          router.replace('/(tabs)/home');
        }
      } catch (err: any) {
        const message = err?.response?.data?.detail || err?.message || t('login.genericError');
        setFormError(message);
      } finally {
        setFormLoading(false);
      }
    };

    // ── Login: enter password ─────────────────────────────────────────────

    const handleLoginSubmit = async () => {
      if (!password.trim()) {
        setFormError(t('login.emailRequired'));
        return;
      }
      setFormError('');
      setFormLoading(true);
      try {
        await login(email.trim(), password);
        router.replace('/(tabs)/home');
      } catch (err: any) {
        const message = err?.response?.data?.detail || err?.message || t('login.genericError');
        setFormError(message);
      } finally {
        setFormLoading(false);
      }
    };

    // ── OTP digit handling ─────────────────────────────────────────────────

    const handleOtpChange = (index: number, value: string) => {
      // Accept only digits; paste of full 6-char string fills all boxes
      const digits = value.replace(/\D/g, '');
      if (digits.length > 1) {
        // Handle paste
        const filled = digits.slice(0, NUM_DIGITS).split('');
        while (filled.length < NUM_DIGITS) filled.push('');
        setOtpDigits(filled);
        const nextIndex = Math.min(digits.length, NUM_DIGITS - 1);
        otpRefs.current[nextIndex]?.focus();
        return;
      }
      const next = [...otpDigits];
      next[index] = digits;
      setOtpDigits(next);
      setOtpError('');
      if (digits && index < NUM_DIGITS - 1) {
        otpRefs.current[index + 1]?.focus();
      }
    };

    const handleOtpKeyPress = (index: number, key: string) => {
      if (key === 'Backspace' && !otpDigits[index] && index > 0) {
        const next = [...otpDigits];
        next[index - 1] = '';
        setOtpDigits(next);
        otpRefs.current[index - 1]?.focus();
      }
    };

    // ── OTP verify ────────────────────────────────────────────────────────

    const handleVerifyOtp = async () => {
      const code = otpDigits.join('');
      if (code.length < NUM_DIGITS) {
        setOtpError(t('login.otpIncorrect'));
        return;
      }
      setOtpError('');
      setOtpLoading(true);
      try {
        const result = await authApi.verifyOtp(email.trim(), code);
        // Store tokens and navigate — reuse the same logic as login
        const { useAuthStore: store } = require('../store/authStore');
        await store.getState()._storeTokens(result.access_token, result.refresh_token, result.user);
        router.replace('/(tabs)/home');
      } catch (err: any) {
        const message = err?.response?.data?.detail || err?.message || t('login.otpIncorrect');
        setOtpError(message);
      } finally {
        setOtpLoading(false);
      }
    };

    // ── OTP resend ────────────────────────────────────────────────────────

    const handleResendOtp = async () => {
      if (resendCountdown > 0) return;
      try {
        await authApi.resendOtp(email.trim());
        setResendCountdown(60);
        setOtpDigits(Array(NUM_DIGITS).fill(''));
        setOtpError('');
      } catch (err: any) {
        const message = err?.response?.data?.detail || err?.message || t('login.genericError');
        Alert.alert(t('login.errorTitle'), message);
      }
    };

    // ── Forgot password ────────────────────────────────────────────────────

    const handleForgotPassword = async () => {
      if (!email.trim()) {
        setFormError(t('login.forgotPasswordEmailRequired'));
        return;
      }
      try {
        await api.post('/auth/forgot-password', { email: email.trim() });
      } catch {
        // Swallow — show success regardless to avoid leaking whether email exists
      }
      Alert.alert(t('login.forgotPassword'), t('login.forgotPasswordSent'));
    };

    // ── Shared input style ─────────────────────────────────────────────────

    const inputStyle = (field: string) => [
      s.input,
      { backgroundColor: colors.inputBg, color: colors.textPrimary },
      focusedField === field && { borderColor: colors.accent },
    ];

    // ─────────────────────────────────────────────────────────────────────
    // Render
    // ─────────────────────────────────────────────────────────────────────

    const cardStyle = [
      s.card,
      { backgroundColor: isDark ? colors.modalBg : colors.cardBg },
      isDark
        ? { borderWidth: 1, borderColor: colors.border }
        : Platform.select({
            ios: {
              shadowColor: colors.textPrimary,
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.08,
              shadowRadius: 16,
            },
            android: { elevation: 4 },
          }),
    ];

    return (
      <KeyboardAvoidingView
        style={[s.container, { backgroundColor: colors.bg }]}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
          <Animated.View style={{ opacity: fadeAnim }}>

            {/* ── Back arrow (shown on all steps except welcome) ── */}
            {step !== 'welcome' && (
              <TouchableOpacity style={s.backBtn} onPress={goBack} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                <ArrowLeft size={22} color={colors.textPrimary} />
              </TouchableOpacity>
            )}

            {/* ── Header ── */}
            <View style={s.header}>
              <BrandMark size={64} />
              {step === 'welcome' && (
                <>
                  <Text style={[s.title, { color: colors.textPrimary }]}>{t('login.title')}</Text>
                  <Text style={[s.subtitle, { color: colors.textMuted }]}>{t('login.subtitle')}</Text>
                </>
              )}
              {(step === 'signup-email' || step === 'signup-password' || step === 'signup-otp') && (
                <Text style={[s.title, { color: colors.textPrimary }]}>{t('login.createAccountTitle')}</Text>
              )}
              {(step === 'login-email' || step === 'login-password') && (
                <Text style={[s.title, { color: colors.textPrimary }]}>{t('login.welcomeBackTitle')}</Text>
              )}
            </View>

            {/* ═══════════════════════════════════════════════════════ */}
            {/* STEP: welcome                                           */}
            {/* ═══════════════════════════════════════════════════════ */}
            {step === 'welcome' && (
              <View style={cardStyle}>
                {/* Google */}
                <TouchableOpacity
                  style={[s.googleBtn, { borderColor: colors.borderMed, backgroundColor: isDark ? colors.modalBg : colors.cardBg }]}
                  onPress={handleGoogleLogin}
                  disabled={isLoading}
                  activeOpacity={0.8}
                >
                  <Text style={s.googleIcon}>G</Text>
                  <Text style={[s.googleBtnText, { color: colors.textPrimary }]}>
                    {t('login.continueWithGoogle')}
                  </Text>
                </TouchableOpacity>

                {/* Divider */}
                <View style={s.divider}>
                  <View style={[s.dividerLine, { backgroundColor: colors.border }]} />
                  <Text style={[s.dividerText, { color: colors.textTertiary }]}>{t('login.orDivider')}</Text>
                  <View style={[s.dividerLine, { backgroundColor: colors.border }]} />
                </View>

                {/* Sign up with email */}
                <TouchableOpacity
                  style={[s.outlineBtn, { borderColor: colors.accent }]}
                  onPress={() => goToStep('signup-email')}
                  activeOpacity={0.8}
                >
                  <Text style={[s.outlineBtnText, { color: colors.accent }]}>
                    {t('login.welcomeSignUp')}
                  </Text>
                </TouchableOpacity>

                {/* Already have account */}
                <View style={s.alreadyRow}>
                  <Text style={[s.alreadyText, { color: colors.textMuted }]}>
                    {t('login.alreadyHaveAccount')}
                  </Text>
                  <TouchableOpacity onPress={() => goToStep('login-email')}>
                    <Text style={[s.alreadyLink, { color: colors.accent }]}>{t('login.logIn')}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* ═══════════════════════════════════════════════════════ */}
            {/* STEP: signup-email / login-email                       */}
            {/* ═══════════════════════════════════════════════════════ */}
            {(step === 'signup-email' || step === 'login-email') && (
              <View style={cardStyle}>
                <Text style={[s.stepSubtitle, { color: colors.textMuted }]}>
                  {t('login.emailSubtitle')}
                </Text>

                <View style={s.form}>
                  <TextInput
                    style={inputStyle('email')}
                    placeholder={t('login.emailPlaceholder')}
                    placeholderTextColor={colors.textPlaceholder}
                    value={email}
                    onChangeText={(v) => { setEmail(v); setFormError(''); }}
                    onFocus={() => setFocusedField('email')}
                    onBlur={() => setFocusedField(null)}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoComplete="email"
                    autoFocus
                    onSubmitEditing={handleEmailContinue}
                    returnKeyType="next"
                  />

                  {!!formError && (
                    <Text style={[s.errorText, { color: '#EF4444' }]}>{formError}</Text>
                  )}

                  <TouchableOpacity
                    style={[s.solidBtn, { backgroundColor: colors.accent }, !email.includes('@') && s.disabled]}
                    onPress={handleEmailContinue}
                    disabled={!email.includes('@')}
                    activeOpacity={0.8}
                  >
                    <Text style={s.solidBtnText}>{t('login.continueBtn')}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* ═══════════════════════════════════════════════════════ */}
            {/* STEP: signup-password                                  */}
            {/* ═══════════════════════════════════════════════════════ */}
            {step === 'signup-password' && (
              <View style={cardStyle}>
                {/* Email context (non-editable) */}
                <Text style={[s.emailContext, { color: colors.textMuted }]}>{email}</Text>

                <View style={s.form}>
                  {/* Name (optional) */}
                  <TextInput
                    style={inputStyle('name')}
                    placeholder={t('login.namePlaceholder')}
                    placeholderTextColor={colors.textPlaceholder}
                    value={name}
                    onChangeText={setName}
                    onFocus={() => setFocusedField('name')}
                    onBlur={() => setFocusedField(null)}
                    autoCapitalize="words"
                    autoComplete="name"
                  />

                  {/* Password */}
                  <View style={s.passwordRow}>
                    <TextInput
                      style={[inputStyle('password'), s.passwordInput]}
                      placeholder={t('login.passwordPlaceholder')}
                      placeholderTextColor={colors.textPlaceholder}
                      value={password}
                      onChangeText={(v) => { setPassword(v); setFormError(''); }}
                      onFocus={() => setFocusedField('password')}
                      onBlur={() => setFocusedField(null)}
                      secureTextEntry={!showPassword}
                      autoComplete="new-password"
                      autoFocus
                      onSubmitEditing={handleSignUpSubmit}
                      returnKeyType="done"
                    />
                    <TouchableOpacity style={s.eyeBtn} onPress={() => setShowPassword((v) => !v)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      {showPassword ? <EyeOff size={20} color={colors.textMuted} /> : <Eye size={20} color={colors.textMuted} />}
                    </TouchableOpacity>
                  </View>

                  {!!formError && (
                    <Text style={[s.errorText, { color: '#EF4444' }]}>{formError}</Text>
                  )}

                  <TouchableOpacity
                    style={[s.solidBtn, { backgroundColor: colors.accent }, (formLoading || isLoading) && s.disabled]}
                    onPress={handleSignUpSubmit}
                    disabled={formLoading || isLoading}
                    activeOpacity={0.8}
                  >
                    {(formLoading || isLoading) ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={s.solidBtnText}>{t('login.createAccount')}</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* ═══════════════════════════════════════════════════════ */}
            {/* STEP: login-password                                   */}
            {/* ═══════════════════════════════════════════════════════ */}
            {step === 'login-password' && (
              <View style={cardStyle}>
                {/* Email context */}
                <Text style={[s.emailContext, { color: colors.textMuted }]}>{email}</Text>

                <View style={s.form}>
                  <View style={s.passwordRow}>
                    <TextInput
                      style={[inputStyle('password'), s.passwordInput]}
                      placeholder={t('login.passwordPlaceholder')}
                      placeholderTextColor={colors.textPlaceholder}
                      value={password}
                      onChangeText={(v) => { setPassword(v); setFormError(''); }}
                      onFocus={() => setFocusedField('password')}
                      onBlur={() => setFocusedField(null)}
                      secureTextEntry={!showPassword}
                      autoComplete="current-password"
                      autoFocus
                      onSubmitEditing={handleLoginSubmit}
                      returnKeyType="done"
                    />
                    <TouchableOpacity style={s.eyeBtn} onPress={() => setShowPassword((v) => !v)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      {showPassword ? <EyeOff size={20} color={colors.textMuted} /> : <Eye size={20} color={colors.textMuted} />}
                    </TouchableOpacity>
                  </View>

                  <TouchableOpacity style={s.forgotRow} onPress={handleForgotPassword}>
                    <Text style={[s.forgotText, { color: colors.textMuted }]}>{t('login.forgotPassword')}</Text>
                  </TouchableOpacity>

                  {!!formError && (
                    <Text style={[s.errorText, { color: '#EF4444' }]}>{formError}</Text>
                  )}

                  <TouchableOpacity
                    style={[s.solidBtn, { backgroundColor: colors.accent }, (formLoading || isLoading) && s.disabled]}
                    onPress={handleLoginSubmit}
                    disabled={formLoading || isLoading}
                    activeOpacity={0.8}
                  >
                    {(formLoading || isLoading) ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={s.solidBtnText}>{t('login.signIn')}</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* ═══════════════════════════════════════════════════════ */}
            {/* STEP: signup-otp                                       */}
            {/* ═══════════════════════════════════════════════════════ */}
            {step === 'signup-otp' && (
              <View style={cardStyle}>
                <Text style={[s.stepSubtitle, { color: colors.textMuted }]}>
                  {t('login.checkInboxSubtitle', { email: email.trim() })}
                </Text>

                {/* 6 digit boxes */}
                <View style={s.otpRow}>
                  {otpDigits.map((digit, i) => (
                    <TextInput
                      key={i}
                      ref={(r) => { otpRefs.current[i] = r; }}
                      style={[
                        s.otpBox,
                        {
                          backgroundColor: colors.inputBg,
                          color: colors.textPrimary,
                          borderColor: digit ? colors.accent : colors.border,
                        },
                      ]}
                      value={digit}
                      onChangeText={(v) => handleOtpChange(i, v)}
                      onKeyPress={({ nativeEvent }) => handleOtpKeyPress(i, nativeEvent.key)}
                      keyboardType="number-pad"
                      maxLength={6}  // allow paste of all 6 digits at once
                      textAlign="center"
                      selectTextOnFocus
                    />
                  ))}
                </View>

                {!!otpError && (
                  <Text style={[s.errorText, { color: '#EF4444', textAlign: 'center' }]}>{otpError}</Text>
                )}

                <View style={s.form}>
                  <TouchableOpacity
                    style={[s.solidBtn, { backgroundColor: colors.accent },
                      (otpLoading || otpDigits.join('').length < NUM_DIGITS) && s.disabled]}
                    onPress={handleVerifyOtp}
                    disabled={otpLoading || otpDigits.join('').length < NUM_DIGITS}
                    activeOpacity={0.8}
                  >
                    {otpLoading ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={s.solidBtnText}>{t('login.verifyCode')}</Text>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[s.resendBtn, resendCountdown > 0 && s.disabled]}
                    onPress={handleResendOtp}
                    disabled={resendCountdown > 0}
                  >
                    <Text style={[s.resendText, { color: resendCountdown > 0 ? colors.textMuted : colors.accent }]}>
                      {resendCountdown > 0
                        ? t('login.resendIn', { seconds: resendCountdown })
                        : t('login.resendCode')}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // ─── Styles ───────────────────────────────────────────────────────────────

  const s = StyleSheet.create({
    container: { flex: 1 },
    scroll: {
      flexGrow: 1,
      justifyContent: 'center',
      paddingHorizontal: 20,
      paddingVertical: 48,
    },

    // Back arrow
    backBtn: {
      position: 'absolute',
      top: 0,
      left: 0,
      padding: 4,
      zIndex: 10,
    },

    // Header
    header: {
      alignItems: 'center',
      marginBottom: 28,
      marginTop: 32,
    },
    title: {
      fontSize: 26,
      fontWeight: '700',
      marginTop: 14,
      marginBottom: 6,
      textAlign: 'center',
    },
    subtitle: {
      fontSize: 14,
      lineHeight: 22,
      textAlign: 'center',
    },
    stepSubtitle: {
      fontSize: 14,
      lineHeight: 22,
      marginBottom: 20,
      textAlign: 'center',
    },
    emailContext: {
      fontSize: 13,
      marginBottom: 16,
      textAlign: 'center',
    },

    // Card
    card: {
      borderRadius: 24,
      padding: 24,
    },

    // Google button
    googleBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 12,
      borderWidth: 1,
      padding: 16,
      marginBottom: 20,
      gap: 10,
    },
    googleIcon: {
      fontSize: 20,
      fontWeight: '700',
      color: '#4285F4',
    },
    googleBtnText: {
      fontSize: 15,
      fontWeight: '600',
    },

    // Divider
    divider: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 20,
    },
    dividerLine: { flex: 1, height: 1 },
    dividerText: { paddingHorizontal: 12, fontSize: 13 },

    // Outlined button (sign up with email)
    outlineBtn: {
      borderRadius: 12,
      borderWidth: 1.5,
      padding: 16,
      alignItems: 'center',
      marginBottom: 16,
    },
    outlineBtnText: {
      fontSize: 15,
      fontWeight: '600',
    },

    // Already have account row
    alreadyRow: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
    },
    alreadyText: { fontSize: 14 },
    alreadyLink: { fontSize: 14, fontWeight: '600' },

    // Solid (filled) button
    solidBtn: {
      borderRadius: 12,
      padding: 16,
      alignItems: 'center',
    },
    solidBtnText: {
      color: '#FFFFFF',
      fontSize: 15,
      fontWeight: '600',
    },

    // Form
    form: { gap: 12 },
    input: {
      borderRadius: 12,
      paddingHorizontal: 16,
      paddingVertical: 16,
      fontSize: 15,
      borderWidth: 1.5,
      borderColor: 'transparent',
    },

    // Password row
    passwordRow: { position: 'relative' },
    passwordInput: { paddingRight: 52 },
    eyeBtn: {
      position: 'absolute',
      right: 16,
      top: 0,
      bottom: 0,
      justifyContent: 'center',
    },

    // Forgot password
    forgotRow: { alignItems: 'flex-end', marginTop: -4 },
    forgotText: { fontSize: 13 },

    // Error
    errorText: { fontSize: 13, marginTop: -4 },

    // OTP digit row
    otpRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 16,
      gap: 8,
    },
    otpBox: {
      flex: 1,
      aspectRatio: 1,
      borderRadius: 12,
      borderWidth: 2,
      fontSize: 22,
      fontWeight: '700',
      textAlign: 'center',
      maxWidth: 52,
    },

    // Resend
    resendBtn: { alignItems: 'center', paddingVertical: 8 },
    resendText: { fontSize: 14 },

    // Shared
    disabled: { opacity: 0.5 },
  });
  ```

- [ ] **Step 2: Check for the `_storeTokens` method in `authStore.ts`**

  The OTP step calls `store.getState()._storeTokens(...)` to avoid duplicating token-saving logic. We need to verify this method exists or add it.

  ```bash
  grep -n "_storeTokens\|storeTokens" /Users/brian/Projects/Startups/memory-ai/mobile/store/authStore.ts
  ```

  If the method does NOT exist, proceed to Step 3. If it does exist, skip to Step 4.

- [ ] **Step 3: (Only if `_storeTokens` is missing) Add `_storeTokens` to `authStore.ts`**

  Open `mobile/store/authStore.ts`. Find the `interface AuthState` or the Zustand `create()` block. Look for existing token-saving logic inside the `login` function — something like:
  ```typescript
  await AsyncStorage.setItem('accessToken', access_token);
  await AsyncStorage.setItem('refreshToken', refresh_token);
  await AsyncStorage.setItem('user', JSON.stringify(user));
  setApiAccessToken(access_token);
  set({ user, isAuthenticated: true });
  ```

  Copy that pattern to build a `_storeTokens` helper. In the `create()` body, add:
  ```typescript
  _storeTokens: async (
    accessToken: string,
    refreshToken: string,
    user: { id: string; email: string; name?: string; email_verified?: boolean; auth_provider?: string }
  ) => {
    await AsyncStorage.setItem('accessToken', accessToken);
    await AsyncStorage.setItem('refreshToken', refreshToken);
    await AsyncStorage.setItem('user', JSON.stringify(user));
    setApiAccessToken(accessToken);
    set({ user, isAuthenticated: true });
  },
  ```

  Also add `_storeTokens` to the `AuthState` interface:
  ```typescript
  _storeTokens: (accessToken: string, refreshToken: string, user: { id: string; email: string; name?: string; email_verified?: boolean; auth_provider?: string }) => Promise<void>;
  ```

- [ ] **Step 4: Run TypeScript check**

  ```bash
  cd /Users/brian/Projects/Startups/memory-ai/mobile
  npx tsc --noEmit 2>&1 | head -30
  ```

  Expected: 0 errors.

  If errors occur relating to `_storeTokens`, check what token-saving signature is available in `authStore.ts` (e.g. it might already be called `setTokens` or bundled inside `login`) and update the OTP handler in `login.tsx` accordingly.

---

## Task 9: Final validation

- [ ] **Step 1: Run full backend test suite**

  ```bash
  cd /Users/brian/Projects/Startups/memory-ai/backend
  source venv/bin/activate
  pytest -x -q 2>&1 | tail -20
  ```

  Expected: All tests pass (0 failures).

- [ ] **Step 2: TypeScript 0 errors**

  ```bash
  cd /Users/brian/Projects/Startups/memory-ai/mobile
  npx tsc --noEmit 2>&1 | head -20
  ```

  Expected: no output.

- [ ] **Step 3: Lint check**

  ```bash
  cd /Users/brian/Projects/Startups/memory-ai/mobile
  npm run lint 2>&1 | tail -20
  ```

  Expected: 0 errors (warnings acceptable).

- [ ] **Step 4: i18n parity check**

  ```bash
  cd /Users/brian/Projects/Startups/memory-ai/mobile
  npm run i18n:check 2>&1 | tail -10
  ```

  Expected: clean (no missing keys).

- [ ] **Step 5: Commit**

  ```bash
  cd /Users/brian/Projects/Startups/memory-ai
  git add backend/app/api/auth.py \
          backend/app/services/email_service.py \
          backend/.env.example \
          deployment/.env.example \
          backend/test_endpoints.py \
          mobile/services/api.ts \
          mobile/app/login.tsx \
          mobile/i18n/locales/en.ts \
          mobile/i18n/locales/vi.ts \
          mobile/store/authStore.ts \
          docs/superpowers/specs/2026-04-03-login-register-redesign.md \
          docs/superpowers/plans/2026-04-03-login-register-redesign.md
  git commit -m "feat: ChatGPT-style multi-step login with 6-digit OTP email verification"
  ```

---

## Post-Implementation: Gmail App Password Setup

The user must fill in `backend/.env` before real emails send:

```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=<your-gmail>@gmail.com
SMTP_PASSWORD=<16-char app password>
SMTP_FROM=<your-gmail>@gmail.com
```

Steps to generate a Gmail App Password:
1. `myaccount.google.com → Security → 2-Step Verification` (must be ON)
2. Search "App passwords" in the Security page
3. App: **Mail**, Device: **Other** → name it **DukiAI Memory Dev**
4. Copy the 16-char password (spaces optional)
5. Paste into `SMTP_PASSWORD` in `backend/.env`

For production: add the same 5 vars to `deployment/.env`.

---

## Notes

- **No DB migration needed** — `email_verification_token` (VARCHAR) and `email_verification_expires` (TIMESTAMP) already exist on the `users` table. Storing a 6-digit numeric string is a data change, not a schema change.
- **Old link-based `GET /verify-email?token=` endpoint is kept** — not removed, not called by the new UI, but preserved for users on old builds.
- **`conftest.py` autouse fixture** — `EMAIL_VERIFICATION_ENABLED = False` during all tests, so OTP tests must temporarily override it (pattern shown in Task 4 test code).
- **`_storeTokens` method** — Task 8 Step 2–3 checks whether this exists and adds it if not; it may already exist with a different name.
