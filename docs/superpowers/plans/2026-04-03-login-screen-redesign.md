# Login Screen Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign `mobile/app/login.tsx` with a warm-card aesthetic, show/hide password toggle, and forgot-password stub while keeping all auth logic and routing unchanged.

**Architecture:** Single-file change to `login.tsx` with scoped local color constants (no `theme.ts` changes). i18n keys updated in both `en.ts` and `vi.ts`. No backend, DB, or deployment changes.

**Tech Stack:** React Native, Expo Router, lucide-react-native (`Eye`/`EyeOff`), react-i18next

**Spec:** `docs/superpowers/specs/2026-04-03-login-screen-redesign.md`

---

## Files

- **Modify:** `mobile/app/login.tsx` — full redesign
- **Modify:** `mobile/i18n/locales/en.ts` — update `login.subtitle`, add `forgotPassword`, `forgotPasswordSent`, `forgotPasswordEmailRequired`
- **Modify:** `mobile/i18n/locales/vi.ts` — same keys in Vietnamese

---

### Task 1: Update i18n keys (EN + VI)

**Files:**
- Modify: `mobile/i18n/locales/en.ts`
- Modify: `mobile/i18n/locales/vi.ts`

- [ ] **Step 1: Update `login.subtitle` and add new keys in `en.ts`**

In `mobile/i18n/locales/en.ts`, find the `login:` block and replace:
```ts
  login: {
    title: 'Memory AI',
    subtitle: 'Your personal memory companion',
```
with:
```ts
  login: {
    title: 'Memory AI',
    subtitle: 'Your memories, always with you',
```

Then add the three new keys after `orDivider`:
```ts
    orDivider: 'or',
    forgotPassword: 'Forgot password?',
    forgotPasswordSent: 'If an account exists for that email, a reset link has been sent.',
    forgotPasswordEmailRequired: 'Please enter your email address first.',
  },
```

- [ ] **Step 2: Update `login.subtitle` and add new keys in `vi.ts`**

In `mobile/i18n/locales/vi.ts`, find the `login:` block and replace:
```ts
  login: {
    title: 'Memory AI',
    subtitle: 'Trợ lý ghi nhớ cá nhân của bạn',
```
with:
```ts
  login: {
    title: 'Memory AI',
    subtitle: 'Ký ức của bạn, luôn bên bạn',
```

Then add after `orDivider`:
```ts
    orDivider: 'hoặc',
    forgotPassword: 'Quên mật khẩu?',
    forgotPasswordSent: 'Nếu tài khoản tồn tại, liên kết đặt lại mật khẩu đã được gửi.',
    forgotPasswordEmailRequired: 'Vui lòng nhập địa chỉ email trước.',
  },
```

- [ ] **Step 3: Run i18n parity check**

```bash
cd mobile && npm run i18n:check
```

Expected: no missing keys reported.

- [ ] **Step 4: Commit**

```bash
git add mobile/i18n/locales/en.ts mobile/i18n/locales/vi.ts
git commit -m "feat(i18n): update login subtitle and add forgot-password keys (EN + VI)"
```

---

### Task 2: Rewrite `login.tsx` with warm-card design

**Files:**
- Modify: `mobile/app/login.tsx`

This is a complete replacement of the file content. All auth logic (`handleSubmit`, `handleGoogleLogin`) and routing remain identical — only the JSX structure, local state, and `StyleSheet` change.

- [ ] **Step 1: Replace the entire content of `mobile/app/login.tsx`**

```tsx
import React, { useState } from 'react';
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
} from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Eye, EyeOff } from 'lucide-react-native';
import { useAuthStore } from '../store/authStore';
import { useTheme } from '../constants/ThemeContext';
import { BrandMark } from '../components/BrandMark';
import api from '../services/api';

// ─── Login-scoped warm palette (does not affect theme.ts) ─────────────────────
const W = {
  screenBg: '#FAF8F5',
  cardBg: '#FFFFFF',
  inputBg: '#F5F2EE',
  focusBorder: '#C4A882',
  submitBg: '#2C1A1A',
  toggleActiveBg: '#2C1A1A',
  toggleInactiveBg: '#EDE8E1',
  muted: '#8C7B6E',
} as const;

export default function LoginScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);

  const { login, register, loginWithGoogle, isLoading } = useAuthStore();

  const handleGoogleLogin = async () => {
    try {
      await loginWithGoogle();
      router.replace('/(tabs)/home');
    } catch (err: any) {
      const message =
        err?.response?.data?.detail ||
        err?.message ||
        t('login.genericError');
      Alert.alert(t('login.loginFailed'), message);
    }
  };

  const handleSubmit = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert(t('login.errorTitle'), t('login.emailRequired'));
      return;
    }
    try {
      if (mode === 'login') {
        await login(email.trim(), password);
      } else {
        if (password.length < 8) {
          Alert.alert(t('login.errorTitle'), t('login.passwordMinLength'));
          return;
        }
        await register(email.trim(), password, name.trim() || undefined);
      }
      router.replace('/(tabs)/home');
    } catch (err: any) {
      const message =
        err?.response?.data?.detail ||
        err?.message ||
        t('login.genericError');
      Alert.alert(
        mode === 'login' ? t('login.loginFailed') : t('login.registerFailed'),
        message,
      );
    }
  };

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      Alert.alert(t('login.errorTitle'), t('login.forgotPasswordEmailRequired'));
      return;
    }
    try {
      await api.post('/auth/forgot-password', { email: email.trim() });
    } catch {
      // Intentionally swallowed — we show success regardless to avoid leaking
      // whether an email is registered (forward-compatible stub).
    }
    Alert.alert(t('login.forgotPassword'), t('login.forgotPasswordSent'));
  };

  const inputStyle = (field: string) => [
    styles.input,
    { backgroundColor: W.inputBg, color: colors.textPrimary },
    focusedField === field && styles.inputFocused,
  ];

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Header (above card) ── */}
        <View style={styles.header}>
          <BrandMark size={72} />
          <Text style={[styles.title, { color: colors.textPrimary }]}>
            {t('login.title')}
          </Text>
          <Text style={styles.subtitle}>{t('login.subtitle')}</Text>
        </View>

        {/* ── Card ── */}
        <View style={styles.card}>
          {/* Google Sign In */}
          <TouchableOpacity
            style={[
              styles.googleButton,
              { borderColor: colors.borderMed },
              isLoading && styles.disabled,
            ]}
            onPress={handleGoogleLogin}
            disabled={isLoading}
            activeOpacity={0.8}
          >
            <Text style={styles.googleIcon}>G</Text>
            <Text style={[styles.googleButtonText, { color: colors.textPrimary }]}>
              {t('login.continueWithGoogle')}
            </Text>
          </TouchableOpacity>

          {/* Divider */}
          <View style={styles.divider}>
            <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
            <Text style={[styles.dividerText, { color: colors.textTertiary }]}>
              {t('login.orDivider')}
            </Text>
            <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
          </View>

          {/* Mode toggle */}
          <View style={styles.modeToggle}>
            <TouchableOpacity
              style={[
                styles.modeButton,
                mode === 'login' && styles.modeButtonActive,
              ]}
              onPress={() => setMode('login')}
            >
              <Text
                style={[
                  styles.modeButtonText,
                  mode === 'login'
                    ? styles.modeButtonTextActive
                    : { color: W.muted },
                ]}
              >
                {t('login.signIn')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.modeButton,
                mode === 'register' && styles.modeButtonActive,
              ]}
              onPress={() => setMode('register')}
            >
              <Text
                style={[
                  styles.modeButtonText,
                  mode === 'register'
                    ? styles.modeButtonTextActive
                    : { color: W.muted },
                ]}
              >
                {t('login.createAccount')}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Form fields */}
          <View style={styles.form}>
            {mode === 'register' && (
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
            )}

            <TextInput
              style={inputStyle('email')}
              placeholder={t('login.emailPlaceholder')}
              placeholderTextColor={colors.textPlaceholder}
              value={email}
              onChangeText={setEmail}
              onFocus={() => setFocusedField('email')}
              onBlur={() => setFocusedField(null)}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
            />

            {/* Password row with show/hide toggle */}
            <View style={styles.passwordRow}>
              <TextInput
                style={[inputStyle('password'), styles.passwordInput]}
                placeholder={t('login.passwordPlaceholder')}
                placeholderTextColor={colors.textPlaceholder}
                value={password}
                onChangeText={setPassword}
                onFocus={() => setFocusedField('password')}
                onBlur={() => setFocusedField(null)}
                secureTextEntry={!showPassword}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              />
              <TouchableOpacity
                style={styles.eyeButton}
                onPress={() => setShowPassword((v) => !v)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                {showPassword ? (
                  <EyeOff size={20} color={W.muted} />
                ) : (
                  <Eye size={20} color={W.muted} />
                )}
              </TouchableOpacity>
            </View>

            {/* Forgot password (login mode only) */}
            {mode === 'login' && (
              <TouchableOpacity
                style={styles.forgotPasswordRow}
                onPress={handleForgotPassword}
              >
                <Text style={styles.forgotPasswordText}>
                  {t('login.forgotPassword')}
                </Text>
              </TouchableOpacity>
            )}

            {/* Submit */}
            <TouchableOpacity
              style={[styles.submitButton, isLoading && styles.disabled]}
              onPress={handleSubmit}
              disabled={isLoading}
              activeOpacity={0.8}
            >
              {isLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.submitButtonText}>
                  {mode === 'login' ? t('login.signIn') : t('login.createAccount')}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: W.screenBg,
  },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 40,
  },

  // Header (above card)
  header: {
    alignItems: 'center',
    marginBottom: 28,
  },
  title: {
    fontSize: 28,
    fontWeight: '600',
    marginTop: 14,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 22,
    color: W.muted,
    textAlign: 'center',
  },

  // Card
  card: {
    backgroundColor: W.cardBg,
    borderRadius: 24,
    padding: 24,
    ...Platform.select({
      ios: {
        shadowColor: '#2C1A1A',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 16,
      },
      android: { elevation: 4 },
    }),
  },

  // Google button
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginBottom: 20,
    gap: 10,
    backgroundColor: W.cardBg,
  },
  googleIcon: {
    fontSize: 20,
    fontWeight: '700',
    color: '#4285F4',
  },
  googleButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },

  // Divider
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    paddingHorizontal: 12,
    fontSize: 13,
  },

  // Mode toggle
  modeToggle: {
    flexDirection: 'row',
    backgroundColor: W.toggleInactiveBg,
    borderRadius: 12,
    padding: 4,
    marginBottom: 20,
  },
  modeButton: {
    flex: 1,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
  },
  modeButtonActive: {
    backgroundColor: W.toggleActiveBg,
  },
  modeButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  modeButtonTextActive: {
    color: '#FFFFFF',
  },

  // Form
  form: {
    gap: 12,
  },
  input: {
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 15,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  inputFocused: {
    borderColor: W.focusBorder,
  },

  // Password row
  passwordRow: {
    position: 'relative',
  },
  passwordInput: {
    paddingRight: 52,
  },
  eyeButton: {
    position: 'absolute',
    right: 16,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },

  // Forgot password
  forgotPasswordRow: {
    alignItems: 'flex-end',
    marginTop: -4,
  },
  forgotPasswordText: {
    fontSize: 13,
    color: W.muted,
  },

  // Submit
  submitButton: {
    backgroundColor: W.submitBg,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 4,
  },
  disabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
});
```

**Note on the `api` import:** The default export from `mobile/services/api.ts` is the axios instance. Check the export — if it's a named export or different, adjust the import line. Verify with:

```bash
grep "export default\|^export const api\b" mobile/services/api.ts | head -5
```

If `api` is not the default export, import it as:
```tsx
import { api } from '../services/api';  // named export
```

- [ ] **Step 2: Verify the api import resolves correctly**

```bash
grep "export default\|^export const api " mobile/services/api.ts | head -5
```

Adjust the import in `login.tsx` if needed (named vs default).

- [ ] **Step 3: Run TypeScript check**

```bash
cd mobile && npm run type-check
```

Expected: 0 errors.

- [ ] **Step 4: Run linter**

```bash
cd mobile && npm run lint
```

Expected: 0 errors (warnings acceptable).

- [ ] **Step 5: Commit**

```bash
git add mobile/app/login.tsx
git commit -m "feat(mobile): login screen warm-card redesign with show/hide password and forgot password"
```

---

### Task 3: Verify i18n parity and run full validation

**Files:** (no new changes)

- [ ] **Step 1: Run i18n parity check one more time (after all changes)**

```bash
cd mobile && npm run i18n:check
```

Expected: no missing keys reported between `en.ts` and `vi.ts`.

- [ ] **Step 2: Run type-check again on full project**

```bash
cd mobile && npm run type-check
```

Expected: 0 errors.

- [ ] **Step 3: Manual checklist**

Verify on iOS simulator (or device):
- [ ] Login flow: enter email + password → success → navigates to home
- [ ] Register flow: tab toggle shows name field; name field disappears on switching back to sign in
- [ ] Show/hide password: eye icon toggles `secureTextEntry`; icon changes between Eye and EyeOff
- [ ] Forgot password (email filled): Alert shown with `forgotPasswordSent` message
- [ ] Forgot password (email empty): Alert shown with `forgotPasswordEmailRequired` message
- [ ] Input focus: border turns warm amber when field is focused
- [ ] Google login button works
- [ ] Keyboard avoidance: form fields are accessible when keyboard is open

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "chore: login redesign — verified and complete"
```

---

## No DB / Deployment Changes

This plan makes no changes outside `mobile/`. No migrations, no `deployment/` updates, no new env vars.
