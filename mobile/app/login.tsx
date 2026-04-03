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

type LoginStep =
  | 'welcome'
  | 'signup-email'
  | 'signup-password'
  | 'signup-otp'
  | 'login-email'
  | 'login-password';

const NUM_DIGITS = 6;

export default function LoginScreen() {
  const { t } = useTranslation();
  const { colors, isDark } = useTheme();
  const { login, register, loginWithGoogle, isLoading, _storeTokens } = useAuthStore();

  const [step, setStep] = useState<LoginStep>('welcome');
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState('');

  const [otpDigits, setOtpDigits] = useState<string[]>(Array(NUM_DIGITS).fill(''));
  const [otpError, setOtpError] = useState('');
  const [otpLoading, setOtpLoading] = useState(false);
  const [resendCountdown, setResendCountdown] = useState(0);
  const otpRefs = useRef<(TextInput | null)[]>(Array(NUM_DIGITS).fill(null));

  useEffect(() => {
    if (resendCountdown <= 0) return;
    const id = setTimeout(() => setResendCountdown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [resendCountdown]);

  function goToStep(next: LoginStep) {
    Animated.timing(fadeAnim, { toValue: 0, duration: 150, useNativeDriver: true }).start(() => {
      setStep(next);
      setFormError('');
      Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    });
  }

  function goBack() {
    const prev: Partial<Record<LoginStep, LoginStep>> = {
      'signup-email': 'welcome',
      'signup-password': 'signup-email',
      'signup-otp': 'signup-password',
      'login-email': 'welcome',
      'login-password': 'login-email',
    };
    const target = prev[step];
    if (target) {
      setOtpDigits(Array(NUM_DIGITS).fill(''));
      setOtpError('');
      setPassword('');
      goToStep(target);
    }
  }

  const handleGoogleLogin = async () => {
    try {
      await loginWithGoogle();
      router.replace('/(tabs)/home');
    } catch (err: any) {
      const message = err?.response?.data?.detail || err?.message || t('login.genericError');
      Alert.alert(t('login.loginFailed'), message);
    }
  };

  const handleEmailContinue = () => {
    const trimmed = email.trim();
    if (!trimmed || !trimmed.includes('@')) {
      setFormError(t('login.emailRequired'));
      return;
    }
    setFormError('');
    goToStep(step === 'signup-email' ? 'signup-password' : 'login-password');
  };

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

  const handleOtpChange = (index: number, value: string) => {
    const digits = value.replace(/[^0-9]/g, '');
    if (digits.length > 1) {
      const filled = digits.slice(0, NUM_DIGITS).split('');
      while (filled.length < NUM_DIGITS) filled.push('');
      setOtpDigits(filled);
      otpRefs.current[Math.min(digits.length, NUM_DIGITS - 1)]?.focus();
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
      await _storeTokens(result.access_token, result.refresh_token, result.user);
      router.replace('/(tabs)/home');
    } catch (err: any) {
      const message = err?.response?.data?.detail || err?.message || t('login.otpIncorrect');
      setOtpError(message);
    } finally {
      setOtpLoading(false);
    }
  };

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

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      setFormError(t('login.forgotPasswordEmailRequired'));
      return;
    }
    try {
      await api.post('/auth/forgot-password', { email: email.trim() });
    } catch {
      // swallowed — don't leak whether email is registered
    }
    Alert.alert(t('login.forgotPassword'), t('login.forgotPasswordSent'));
  };

  const inputStyle = (field: string) => [
    s.input,
    { backgroundColor: colors.inputBg, color: colors.textPrimary },
    focusedField === field && { borderColor: colors.accent },
  ];

  const cardStyle: any[] = [
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

          {step !== 'welcome' && (
            <TouchableOpacity
              style={s.backBtn}
              onPress={goBack}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <ArrowLeft size={22} color={colors.textPrimary} />
            </TouchableOpacity>
          )}

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

          {/* WELCOME */}
          {step === 'welcome' && (
            <View style={cardStyle}>
              <TouchableOpacity
                style={[s.googleBtn, { borderColor: colors.borderMed, backgroundColor: isDark ? colors.modalBg : colors.cardBg }, isLoading && s.disabled]}
                onPress={handleGoogleLogin}
                disabled={isLoading}
                activeOpacity={0.8}
              >
                <Text style={s.googleIcon}>G</Text>
                <Text style={[s.googleBtnText, { color: colors.textPrimary }]}>{t('login.continueWithGoogle')}</Text>
              </TouchableOpacity>

              <View style={s.divider}>
                <View style={[s.dividerLine, { backgroundColor: colors.border }]} />
                <Text style={[s.dividerText, { color: colors.textTertiary }]}>{t('login.orDivider')}</Text>
                <View style={[s.dividerLine, { backgroundColor: colors.border }]} />
              </View>

              <TouchableOpacity
                style={[s.outlineBtn, { borderColor: colors.accent }]}
                onPress={() => goToStep('signup-email')}
                activeOpacity={0.8}
              >
                <Text style={[s.outlineBtnText, { color: colors.accent }]}>{t('login.welcomeSignUp')}</Text>
              </TouchableOpacity>

              <View style={s.alreadyRow}>
                <Text style={[s.alreadyText, { color: colors.textMuted }]}>{t('login.alreadyHaveAccount')}</Text>
                <TouchableOpacity onPress={() => goToStep('login-email')}>
                  <Text style={[s.alreadyLink, { color: colors.accent }]}>{t('login.logIn')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* EMAIL STEP */}
          {(step === 'signup-email' || step === 'login-email') && (
            <View style={cardStyle}>
              <Text style={[s.stepSubtitle, { color: colors.textMuted }]}>{t('login.emailSubtitle')}</Text>
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
                {!!formError && <Text style={[s.errorText, { color: '#EF4444' }]}>{formError}</Text>}
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

          {/* SIGNUP PASSWORD */}
          {step === 'signup-password' && (
            <View style={cardStyle}>
              <Text style={[s.emailContext, { color: colors.textMuted }]}>{email}</Text>
              <View style={s.form}>
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
                  <TouchableOpacity style={s.eyeBtn} onPress={() => setShowPassword((v) => !v)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    {showPassword ? <EyeOff size={20} color={colors.textMuted} /> : <Eye size={20} color={colors.textMuted} />}
                  </TouchableOpacity>
                </View>
                {!!formError && <Text style={[s.errorText, { color: '#EF4444' }]}>{formError}</Text>}
                <TouchableOpacity
                  style={[s.solidBtn, { backgroundColor: colors.accent }, (formLoading || isLoading) && s.disabled]}
                  onPress={handleSignUpSubmit}
                  disabled={formLoading || isLoading}
                  activeOpacity={0.8}
                >
                  {(formLoading || isLoading) ? <ActivityIndicator color="#fff" /> : <Text style={s.solidBtnText}>{t('login.createAccount')}</Text>}
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* LOGIN PASSWORD */}
          {step === 'login-password' && (
            <View style={cardStyle}>
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
                  <TouchableOpacity style={s.eyeBtn} onPress={() => setShowPassword((v) => !v)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    {showPassword ? <EyeOff size={20} color={colors.textMuted} /> : <Eye size={20} color={colors.textMuted} />}
                  </TouchableOpacity>
                </View>
                <TouchableOpacity style={s.forgotRow} onPress={handleForgotPassword}>
                  <Text style={[s.forgotText, { color: colors.textMuted }]}>{t('login.forgotPassword')}</Text>
                </TouchableOpacity>
                {!!formError && <Text style={[s.errorText, { color: '#EF4444' }]}>{formError}</Text>}
                <TouchableOpacity
                  style={[s.solidBtn, { backgroundColor: colors.accent }, (formLoading || isLoading) && s.disabled]}
                  onPress={handleLoginSubmit}
                  disabled={formLoading || isLoading}
                  activeOpacity={0.8}
                >
                  {(formLoading || isLoading) ? <ActivityIndicator color="#fff" /> : <Text style={s.solidBtnText}>{t('login.signIn')}</Text>}
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* OTP STEP */}
          {step === 'signup-otp' && (
            <View style={cardStyle}>
              <Text style={[s.stepSubtitle, { color: colors.textMuted }]}>
                {t('login.checkInboxSubtitle', { email: email.trim() })}
              </Text>
              <View style={s.otpRow}>
                {otpDigits.map((digit, i) => (
                  <TextInput
                    key={i}
                    ref={(r) => { otpRefs.current[i] = r; }}
                    style={[s.otpBox, { backgroundColor: colors.inputBg, color: colors.textPrimary, borderColor: digit ? colors.accent : colors.border }]}
                    value={digit}
                    onChangeText={(v) => handleOtpChange(i, v)}
                    onKeyPress={({ nativeEvent }) => handleOtpKeyPress(i, nativeEvent.key)}
                    keyboardType="number-pad"
                    maxLength={6}
                    textAlign="center"
                    selectTextOnFocus
                    autoFocus={i === 0}
                  />
                ))}
              </View>
              {!!otpError && (
                <Text style={[s.errorText, { color: '#EF4444', textAlign: 'center', marginBottom: 8 }]}>{otpError}</Text>
              )}
              <View style={s.form}>
                <TouchableOpacity
                  style={[s.solidBtn, { backgroundColor: colors.accent }, (otpLoading || otpDigits.join('').length < NUM_DIGITS) && s.disabled]}
                  onPress={handleVerifyOtp}
                  disabled={otpLoading || otpDigits.join('').length < NUM_DIGITS}
                  activeOpacity={0.8}
                >
                  {otpLoading ? <ActivityIndicator color="#fff" /> : <Text style={s.solidBtnText}>{t('login.verifyCode')}</Text>}
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.resendBtn, resendCountdown > 0 && s.disabled]}
                  onPress={handleResendOtp}
                  disabled={resendCountdown > 0}
                >
                  <Text style={[s.resendText, { color: resendCountdown > 0 ? colors.textMuted : colors.accent }]}>
                    {resendCountdown > 0 ? t('login.resendIn', { seconds: resendCountdown }) : t('login.resendCode')}
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

const s = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 20, paddingVertical: 48 },
  backBtn: { position: 'absolute', top: 0, left: 0, padding: 4, zIndex: 10 },
  header: { alignItems: 'center', marginBottom: 28, marginTop: 32 },
  title: { fontSize: 26, fontWeight: '700', marginTop: 14, marginBottom: 4, textAlign: 'center' },
  subtitle: { fontSize: 14, lineHeight: 22, textAlign: 'center' },
  stepSubtitle: { fontSize: 14, lineHeight: 22, marginBottom: 20, textAlign: 'center' },
  emailContext: { fontSize: 13, marginBottom: 16, textAlign: 'center' },
  card: { borderRadius: 24, padding: 24 },
  googleBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: 12, borderWidth: 1, padding: 16, marginBottom: 20, gap: 10 },
  googleIcon: { fontSize: 20, fontWeight: '700', color: '#4285F4' },
  googleBtnText: { fontSize: 15, fontWeight: '600' },
  divider: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  dividerLine: { flex: 1, height: 1 },
  dividerText: { paddingHorizontal: 12, fontSize: 13 },
  outlineBtn: { borderRadius: 12, borderWidth: 1.5, padding: 16, alignItems: 'center', marginBottom: 16 },
  outlineBtnText: { fontSize: 15, fontWeight: '600' },
  alreadyRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 4 },
  alreadyText: { fontSize: 14 },
  alreadyLink: { fontSize: 14, fontWeight: '600' },
  solidBtn: { borderRadius: 12, padding: 16, alignItems: 'center' },
  solidBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
  form: { gap: 12 },
  input: { borderRadius: 12, paddingHorizontal: 16, paddingVertical: 16, fontSize: 15, borderWidth: 1.5, borderColor: 'transparent' },
  passwordRow: { position: 'relative' },
  passwordInput: { paddingRight: 52 },
  eyeBtn: { position: 'absolute', right: 16, top: 0, bottom: 0, justifyContent: 'center' },
  forgotRow: { alignItems: 'flex-end', marginTop: -4 },
  forgotText: { fontSize: 13 },
  errorText: { fontSize: 13, marginTop: -4 },
  otpRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16, gap: 8 },
  otpBox: { flex: 1, aspectRatio: 1, borderRadius: 12, borderWidth: 2, fontSize: 22, fontWeight: '700', maxWidth: 52 },
  resendBtn: { alignItems: 'center', paddingVertical: 8 },
  resendText: { fontSize: 14 },
  disabled: { opacity: 0.5 },
});
