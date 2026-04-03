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

export default function LoginScreen() {
  const { t } = useTranslation();
  const { colors, isDark } = useTheme();
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
      // Intentionally swallowed — show success regardless to avoid leaking
      // whether an email is registered (forward-compatible stub).
    }
    Alert.alert(t('login.forgotPassword'), t('login.forgotPasswordSent'));
  };

  const inputStyle = (field: string) => [
    styles.input,
    { backgroundColor: colors.inputBg, color: colors.textPrimary },
    focusedField === field && { borderColor: colors.accent },
  ];

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.bg }]}
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
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>{t('login.subtitle')}</Text>
        </View>

        {/* ── Card ── */}
        <View style={[
          styles.card,
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
        ]}>
          {/* Google Sign In */}
          <TouchableOpacity
            style={[
              styles.googleButton,
              { backgroundColor: isDark ? colors.modalBg : colors.cardBg, borderColor: colors.borderMed },
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
          <View style={[styles.modeToggle, { backgroundColor: colors.subtleBg }]}>
            <TouchableOpacity
              style={[
                styles.modeButton,
                mode === 'login' && { backgroundColor: colors.accent },
              ]}
              onPress={() => setMode('login')}
            >
              <Text
                style={[
                  styles.modeButtonText,
                  mode === 'login'
                    ? styles.modeButtonTextActive
                    : { color: colors.textMuted },
                ]}
              >
                {t('login.signIn')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.modeButton,
                mode === 'register' && { backgroundColor: colors.accent },
              ]}
              onPress={() => setMode('register')}
            >
              <Text
                style={[
                  styles.modeButtonText,
                  mode === 'register'
                    ? styles.modeButtonTextActive
                    : { color: colors.textMuted },
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
                  <EyeOff size={20} color={colors.textMuted} />
                ) : (
                  <Eye size={20} color={colors.textMuted} />
                )}
              </TouchableOpacity>
            </View>

            {/* Forgot password (login mode only) */}
            {mode === 'login' && (
              <TouchableOpacity
                style={styles.forgotPasswordRow}
                onPress={handleForgotPassword}
              >
                <Text style={[styles.forgotPasswordText, { color: colors.textMuted }]}>
                  {t('login.forgotPassword')}
                </Text>
              </TouchableOpacity>
            )}

            {/* Submit */}
            <TouchableOpacity
              style={[styles.submitButton, { backgroundColor: colors.accent }, isLoading && styles.disabled]}
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
    textAlign: 'center',
  },

  // Card
  card: {
    borderRadius: 24,
    padding: 24,
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
  },

  // Submit
  submitButton: {
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
