import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Pressable,
  Switch,
  Modal,
  RefreshControl,
  Animated,
  TouchableWithoutFeedback,
  Alert,
  Linking,
  Platform,
  TextInput,
  Share,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { memoriesApi, insightsApi, userApi } from '../../services/api';
import {
  Sparkles,
  ChevronRight,
  Info,
  Archive,
  Mail,
  Lock,
  LogOut,
  Trash2,
  Download,
  Shield,
  ExternalLink,
  MessageCircle,
  X,
  Globe,
  Zap,
  Bell,
  Palette,
  FolderOpen,
  ArrowLeft,
  Eye,
  EyeOff,
} from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../store/authStore';
import { useSettingsStore } from '../../store/settingsStore';
import { useTheme, type ThemeMode } from '../../constants/ThemeContext';
import type { ThemeColors } from '../../constants/ThemeContext';
import type { SupportedLanguage } from '../../i18n';
import { ScreenHeader } from '../../components/ScreenHeader';

function BottomSheetModal({
  visible,
  onClose,
  title,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  const { colors } = useTheme();
  const slideAnim = useRef(new Animated.Value(600)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
        Animated.spring(slideAnim, { toValue: 0, damping: 30, stiffness: 300, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 600, duration: 250, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <Animated.View style={[sh.backdrop, { opacity: fadeAnim }]} />
      </TouchableWithoutFeedback>
      <Animated.View style={[sh.sheet, { backgroundColor: colors.modalBg, transform: [{ translateY: slideAnim }] }]}>
        <View style={[sh.sheetHeader, { borderBottomColor: colors.border }]}>
          <Text style={[sh.sheetTitle, { color: colors.textPrimary }]}>{title}</Text>
          <TouchableOpacity style={[sh.closeBtn, { backgroundColor: colors.inputBg }]} onPress={onClose} hitSlop={8}>
            <X size={20} color={colors.textTertiary} />
          </TouchableOpacity>
        </View>
        <ScrollView style={sh.sheetScroll} showsVerticalScrollIndicator={false}>
          {children}
        </ScrollView>
      </Animated.View>
    </Modal>
  );
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  const { colors } = useTheme();
  return (
    <View style={r.row}>
      <View style={[r.iconWrap, { backgroundColor: colors.accentSubtle }]}>{icon}</View>
      <View style={r.rowText}>
        <Text style={[r.rowLabel, { color: colors.textMuted }]}>{label}</Text>
        <Text style={[r.rowValue, { color: colors.textPrimary }]}>{value}</Text>
      </View>
    </View>
  );
}

function ActionButton({ label, icon, variant = 'default', onPress }: {
  label: string; icon?: React.ReactNode; variant?: 'default' | 'accent' | 'danger'; onPress?: () => void;
}) {
  const { colors } = useTheme();
  const bgColors = { default: colors.inputBg, accent: colors.accentSubtle, danger: colors.errorBg };
  const textColors = { default: colors.textPrimary, accent: colors.accent, danger: colors.error };
  return (
    <TouchableOpacity style={[r.actionBtn, { backgroundColor: bgColors[variant] }]} onPress={onPress} activeOpacity={0.7}>
      {icon}
      <Text style={[r.actionBtnText, { color: textColors[variant] }]}>{label}</Text>
    </TouchableOpacity>
  );
}

function ExternalLinkButton({ label, url }: { label: string; url?: string }) {
  const { colors } = useTheme();
  return (
    <TouchableOpacity style={[r.externalBtn, { backgroundColor: colors.inputBg }]} onPress={() => url && Linking.openURL(url)} activeOpacity={0.7}>
      <Text style={[r.externalBtnText, { color: colors.textPrimary }]}>{label}</Text>
      <ExternalLink size={14} color={colors.textTertiary} />
    </TouchableOpacity>
  );
}

function BulletPoint({ text }: { text: string }) {
  const { colors } = useTheme();
  return (
    <View style={r.bullet}>
      <View style={[r.bulletDot, { backgroundColor: colors.accent }]} />
      <Text style={[r.bulletText, { color: colors.textSecondary }]}>{text}</Text>
    </View>
  );
}

function SectionDivider() {
  const { colors } = useTheme();
  return <View style={[r.divider, { backgroundColor: colors.border }]} />;
}

function PreferenceToggleRow({
  icon,
  label,
  description,
  value,
  onToggle,
  showTopBorder = false,
}: {
  icon: React.ReactNode;
  label: string;
  description: string;
  value: boolean;
  onToggle: (next: boolean) => void;
  showTopBorder?: boolean;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();

  return (
    <View
      style={[
        s.recallRow,
        showTopBorder && {
          marginTop: 16,
          paddingTop: 16,
          borderTopWidth: 1,
          borderTopColor: colors.border,
        },
      ]}
    >
      <View style={[s.recallIcon, { backgroundColor: colors.inputBg }]}>{icon}</View>
      <Pressable
        style={s.recallTextWrap}
        onPress={() => onToggle(!value)}
        accessibilityRole="switch"
        accessibilityState={{ checked: value }}
        accessibilityLabel={label}
        accessibilityHint={description}
      >
        <Text style={[s.recallLabel, { color: colors.textPrimary }]}>{label}</Text>
        <Text style={[s.recallDesc, { color: colors.textMuted }]}>{description}</Text>
      </Pressable>
      <View style={s.toggleControlWrap}>
        <Switch
          value={value}
          onValueChange={onToggle}
          trackColor={{ false: colors.switchTrackOff, true: colors.brandAccentLight }}
          thumbColor={value ? colors.brandAccent : colors.cardBg}
          ios_backgroundColor={colors.switchTrackOff}
          style={s.toggleSwitch}
          accessibilityLabel={label}
          accessibilityHint={description}
        />
      </View>
    </View>
  );
}

function WeeklyInsightCard({
  insight,
  colors,
  isDark,
  t,
}: {
  insight: { text: string; topTopics: { name: string; count: number }[] };
  colors: ThemeColors;
  isDark: boolean;
  t: (key: string, options?: Record<string, any>) => string;
}) {
  const insightGradient = isDark
    ? ['rgba(61,36,16,0.96)', 'rgba(40,25,12,0.98)']
    : ['#FFF3E8', '#FFE5CB'];
  const topicChipBg = isDark ? 'rgba(247,177,116,0.16)' : 'rgba(194,96,10,0.12)';

  return (
    <LinearGradient
      colors={insightGradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[p.insightCard, { borderColor: colors.recallBannerBorder }]}
    >
      <Text style={[p.insightLabel, { color: colors.accent }]}>{t('profile.insightThisWeek')}</Text>
      <Text style={[p.insightText, { color: colors.textPrimary }]}>{insight.text}</Text>
      {insight.topTopics.length > 0 && (
        <View style={p.topicChips}>
          {insight.topTopics.map((topic) => (
            <View key={`${topic.name}-${topic.count}`} style={[p.topicChip, { backgroundColor: topicChipBg }]}>
              <Text style={[p.topicChipText, { color: colors.accent }]}>{`${topic.name} ×${topic.count}`}</Text>
            </View>
          ))}
        </View>
      )}
    </LinearGradient>
  );
}

function heatmapCellColor(count: number, max: number, isDark: boolean): string {
  if (count === 0) return isDark ? 'rgba(255,255,255,0.06)' : '#E8DDD0';
  const ratio = count / Math.max(max, 1);
  if (isDark) {
    if (ratio < 0.33) return 'rgba(245,172,111,0.38)';
    if (ratio < 0.66) return 'rgba(228,141,75,0.70)';
    return '#D4874A';
  }
  if (ratio < 0.33) return '#F0C89A';
  if (ratio < 0.66) return '#D4874A';
  return '#C2600A';
}

function CompactHeatmap({
  data,
  isDark,
  colors,
  t,
}: {
  data: number[];
  isDark: boolean;
  colors: ThemeColors;
  t: (key: string, options?: Record<string, any>) => string;
}) {
  const cells = data.length >= 28
    ? data.slice(-28)
    : [...Array(Math.max(0, 28 - data.length)).fill(0), ...data];
  const totalCaptures = cells.reduce((sum, count) => sum + count, 0);
  const activeDays = cells.filter((count) => count > 0).length;
  const max = Math.max(...cells, 1);
  const columns: number[][] = [];
  for (let col = 0; col < 4; col++) {
    columns.push(cells.slice(col * 7, col * 7 + 7));
  }

  return (
    <View style={[p.heatmapCard, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
      <Text style={[p.heatmapLabel, { color: colors.textMuted }]}>
        {t('profile.activity4Weeks')}
      </Text>
      <View style={p.heatmapGrid}>
        {columns.map((col, ci) => (
          <View key={ci} style={p.heatmapCol}>
            {col.map((count, ri) => (
              <View
                key={ri}
                style={[p.heatmapCell, { backgroundColor: heatmapCellColor(count, max, isDark) }]}
              />
            ))}
          </View>
        ))}
      </View>
      {totalCaptures > 0 ? (
        <Text style={[p.heatmapSummary, { color: colors.textMuted }]}>
          {t('profile.activitySummary', { count: totalCaptures, days: activeDays })}
        </Text>
      ) : (
        <Text style={[p.heatmapNoData, { color: colors.textMuted }]}>
          {t('profile.activityNoData')}
        </Text>
      )}
    </View>
  );
}

function buildHeatmapSeries(entries: { date: string; count: number }[], totalDays: number = 28): number[] {
  const dateToCount = new Map(entries.map((entry) => [entry.date, entry.count]));
  const now = new Date();
  const todayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const result: number[] = [];

  for (let offset = totalDays - 1; offset >= 0; offset -= 1) {
    const day = new Date(todayUtc);
    day.setUTCDate(todayUtc.getUTCDate() - offset);
    const key = day.toISOString().slice(0, 10);
    result.push(dateToCount.get(key) ?? 0);
  }

  return result;
}

export default function ProfileScreen() {
  const { t } = useTranslation();
  const { user, logout, updateUser } = useAuthStore();
  const { language, setLanguage, preferences, loadPreferences, updatePreferences } = useSettingsStore();
  type ModalType = 'account' | 'privacy' | 'about' | 'language' | 'appearance' | 'aiFeatures' | null;
  type AccountSubView = 'main' | 'changeEmail' | 'changePassword';
  const [activeModal, setActiveModal] = useState<ModalType>(null);
  const [accountSubView, setAccountSubView] = useState<AccountSubView>('main');
  // Inline form state
  const [formEmail, setFormEmail] = useState('');
  const [formCurrentPwd, setFormCurrentPwd] = useState('');
  const [formNewPwd, setFormNewPwd] = useState('');
  const [formConfirmPwd, setFormConfirmPwd] = useState('');
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState('');
  const [showCurrentPwd, setShowCurrentPwd] = useState(false);
  const [showNewPwd, setShowNewPwd] = useState(false);
  const [showConfirmPwd, setShowConfirmPwd] = useState(false);
  const [dismissedCount, setDismissedCount] = useState(0);
  const [totalMemories, setTotalMemories] = useState(0);
  const [streak, setStreak] = useState(0);
  const [recallRate, setRecallRate] = useState<number | null>(null);
  const [weeklyInsight, setWeeklyInsight] = useState<{ text: string; topTopics: { name: string; count: number }[] } | null>(null);
  const [heatmapData, setHeatmapData] = useState<number[]>(() => Array(28).fill(0));
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const { colors, isDark, mode: themeMode } = useTheme();
  const insightsLoadingRef = useRef(false);

  const loadProfileInsights = useCallback(async () => {
    if (insightsLoadingRef.current) {
      return;
    }
    insightsLoadingRef.current = true;
    try {
      await loadPreferences();

      await insightsApi.getWeeklyRecap().then((recap) => {
        if (recap) {
          const topicsText = (recap.categories_used ?? [])
            .slice(0, 3)
            .map((c: { name: string; icon: string }) => ({ name: c.name, count: 1 }));
          setWeeklyInsight({
            text: recap.recap ?? t('profile.weeklyInsightFallback', { count: recap.total_memories ?? 0 }),
            topTopics: topicsText,
          });
        }
      }).catch(() => undefined);

      await insightsApi.getDashboard(28).then((dash) => {
        const counts = buildHeatmapSeries(dash.activity_heatmap ?? [], 28);
        setHeatmapData(counts);
        setStreak(dash.current_streak ?? 0);

        const topTopics = (dash.category_breakdown ?? [])
          .filter((c: { name?: string }) => !!c.name)
          .slice(0, 3)
          .map((c: { name?: string; count: number }) => ({
            name: c.name || 'Other',
            count: c.count,
          }));

        setWeeklyInsight((prev) => {
          const total = dash.total_memories ?? 0;
          const growth = dash.growth_percentage ?? 0;
          const fallback = t('profile.weeklyInsightFallback', { count: total });
          const baseText = prev?.text || fallback;
          const growthText = `${growth >= 0 ? '+' : ''}${growth}%`;
          const composed = `${baseText} (${growthText} ${t('insights.vsPrevious')})`;
          return {
            text: composed,
            topTopics: topTopics.length > 0 ? topTopics : (prev?.topTopics ?? []),
          };
        });
      }).catch(() => undefined);

      await insightsApi.getRecallRate(30).then((rate) => {
        setRecallRate(Math.round(rate.recall_rate));
      }).catch(() => undefined);

      await memoriesApi.stats().then((stats) => {
        setTotalMemories(stats.total ?? 0);
        setStreak((prev) => (prev > 0 ? prev : stats.streak ?? 0));
      }).catch(() => undefined);

      setLastUpdatedAt(new Date());
    } finally {
      insightsLoadingRef.current = false;
    }
  }, [loadPreferences, t]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadProfileInsights();
    setRefreshing(false);
  }, [loadProfileInsights]);

  useFocusEffect(
    useCallback(() => {
      void loadProfileInsights();
      memoriesApi.listDismissed({ limit: 100 })
        .then((response) => setDismissedCount(response.total ?? response.memories.length))
        .catch(() => { });
    }, [loadProfileInsights])
  );

  const closeAccountModal = () => {
    setActiveModal(null);
    setAccountSubView('main');
    setFormEmail('');
    setFormCurrentPwd('');
    setFormNewPwd('');
    setFormConfirmPwd('');
    setFormError('');
    setShowCurrentPwd(false);
    setShowNewPwd(false);
    setShowConfirmPwd(false);
  };

  const handleLogout = () => {
    Alert.alert(t('alerts.signOutTitle'), t('alerts.signOutMessage'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.signOut'),
        style: 'destructive',
        onPress: async () => {
          closeAccountModal();
          await logout();
          router.replace('/login');
        },
      },
    ]);
  };

  const handleSubmitChangeEmail = async () => {
    const trimmedEmail = formEmail.trim().toLowerCase();
    if (!trimmedEmail || !trimmedEmail.includes('@')) {
      setFormError(t('login.emailRequired'));
      return;
    }
    setFormLoading(true);
    setFormError('');
    try {
      const result = await userApi.changeEmail(
        trimmedEmail,
        user?.auth_provider === 'google' ? undefined : formCurrentPwd,
      );
      await updateUser({ email: result.user.email });
      closeAccountModal();
      Alert.alert('✓', t('account.emailUpdated'));
    } catch (e: any) {
      setFormError(e?.response?.data?.detail ?? t('common.error'));
    } finally {
      setFormLoading(false);
    }
  };

  const handleSubmitChangePassword = async () => {
    if (formNewPwd.length < 8) {
      setFormError(t('login.passwordMinLength'));
      return;
    }
    if (formNewPwd !== formConfirmPwd) {
      setFormError(t('account.passwordsMustMatch'));
      return;
    }
    setFormLoading(true);
    setFormError('');
    try {
      await userApi.changePassword(formCurrentPwd, formNewPwd);
      closeAccountModal();
      Alert.alert('✓', t('account.passwordUpdated'));
    } catch (e: any) {
      setFormError(e?.response?.data?.detail ?? t('common.error'));
    } finally {
      setFormLoading(false);
    }
  };

  const handleDeleteAccount = () => {
    const isGoogle = user?.auth_provider === 'google';
    const doDelete = async (password?: string) => {
      try {
        await userApi.deleteAccount(password);
        closeAccountModal();
        await logout();
        router.replace('/login');
      } catch (e: any) {
        Alert.alert(t('common.error'), e?.response?.data?.detail ?? t('common.error'));
      }
    };

    if (isGoogle) {
      Alert.alert(t('alerts.deleteAccountTitle'), t('alerts.deleteAccountMessage'), [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('common.delete'), style: 'destructive', onPress: () => doDelete() },
      ]);
    } else if (Platform.OS === 'ios') {
      Alert.prompt(
        t('alerts.deleteAccountTitle'),
        t('alerts.deleteAccountMessage'),
        [
          { text: t('common.cancel'), style: 'cancel' },
          {
            text: t('common.delete'),
            style: 'destructive',
            onPress: (pwd) => { if (pwd) doDelete(pwd); },
          },
        ],
        'secure-text',
      );
    } else {
      // Android: confirm-only (already authenticated)
      Alert.alert(t('alerts.deleteAccountTitle'), t('alerts.deleteAccountMessage'), [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('common.delete'), style: 'destructive', onPress: () => doDelete(formCurrentPwd || undefined) },
      ]);
    }
  };

  const handleDownloadData = async () => {
    try {
      const jsonData = await userApi.exportData();
      await Share.share({
        title: 'memory-ai-export.json',
        message: jsonData,
      });
    } catch (e: any) {
      Alert.alert(t('common.error'), t('privacy.exportError'));
    }
  };

  const handleDeleteAllData = () => {
    const isGoogle = user?.auth_provider === 'google';
    const doDeleteData = async (password?: string) => {
      try {
        await userApi.deleteAllMemories(password);
        setTotalMemories(0);
        setHeatmapData(Array(28).fill(0));
        setWeeklyInsight(null);
        setActiveModal(null);
        Alert.alert('✓', t('privacy.dataDeleted'));
      } catch (e: any) {
        Alert.alert(t('common.error'), e?.response?.data?.detail ?? t('common.error'));
      }
    };

    if (isGoogle) {
      Alert.alert(t('alerts.deleteDataTitle'), t('alerts.deleteDataMessage'), [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('common.delete'), style: 'destructive', onPress: () => doDeleteData() },
      ]);
    } else if (Platform.OS === 'ios') {
      Alert.prompt(
        t('alerts.deleteDataTitle'),
        t('alerts.deleteDataMessage'),
        [
          { text: t('common.cancel'), style: 'cancel' },
          {
            text: t('common.delete'),
            style: 'destructive',
            onPress: (pwd) => { if (pwd) doDeleteData(pwd); },
          },
        ],
        'secure-text',
      );
    } else {
      Alert.alert(t('alerts.deleteDataTitle'), t('alerts.deleteDataMessage'), [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('common.delete'), style: 'destructive', onPress: () => doDeleteData(undefined) },
      ]);
    }
  };

  const handleContactSupport = () => {
    Linking.openURL('mailto:support@memory-ai.app?subject=Memory%20AI%20Support');
  };

  const handleLanguageSelect = async (lang: SupportedLanguage) => {
    await setLanguage(lang);
    setActiveModal(null);
  };

  return (
    <SafeAreaView style={[s.container, { backgroundColor: colors.bg }]} edges={['top']}>
      {/* ── Header ── */}
      <View style={[s.profileHeader, { borderBottomColor: colors.border }]}>
        <ScreenHeader
          eyebrow={t('profile.eyebrow')}
          title={user?.name?.split(' ')[0] ?? user?.email?.split('@')[0] ?? 'You'}
          titleSize={30}
          paddingHorizontal={16}
        />
      </View>

      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={(
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.accent}
          />
        )}
      >
        {/* Stats Row */}
        <View style={p.statsRow}>
          <View style={[p.statBox, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
            <Text style={[p.statVal, { color: colors.textPrimary }]}>{totalMemories}</Text>
            <Text style={[p.statLabel, { color: colors.textMuted }]}>{t('profile.totalMemories')}</Text>
          </View>
          <View style={[p.statBox, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
            <Text style={[p.statVal, { color: colors.textPrimary }]}>{streak}🔥</Text>
            <Text style={[p.statLabel, { color: colors.textMuted }]}>{t('home.statsStreak')}</Text>
          </View>
          <View style={[p.statBox, { backgroundColor: colors.accentLight, borderColor: colors.recallBannerBorder }]}>
            <Text style={[p.statVal, { color: colors.accent }]}>
              {recallRate !== null ? `${recallRate}%` : '—'}
            </Text>
            <Text style={[p.statLabel, { color: colors.accent }]}>{t('profile.recallRate')}</Text>
          </View>
        </View>

        <View style={p.quickActionsWrap}>
          <Text style={[p.quickActionsLabel, { color: colors.textMuted }]}>{t('profile.quickActions')}</Text>
          <View style={p.quickActionsRow}>
            <TouchableOpacity
              style={[p.quickActionBtn, { backgroundColor: colors.cardBg, borderColor: colors.border }]}
              onPress={() => router.push('/(tabs)/recall')}
              activeOpacity={0.75}
            >
              <Text style={[p.quickActionText, { color: colors.textPrimary }]}>{t('profile.goToRecall')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[p.quickActionBtn, { backgroundColor: colors.cardBg, borderColor: colors.border }]}
              onPress={() => router.push('/dismissed')}
              activeOpacity={0.75}
            >
              <Text style={[p.quickActionText, { color: colors.textPrimary }]}>{t('profile.openDismissed')}</Text>
            </TouchableOpacity>
          </View>
          <Text style={[p.updatedText, { color: colors.textMuted }]}>
            {t('profile.lastUpdated', { time: lastUpdatedAt ? lastUpdatedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—' })}
          </Text>
        </View>

        {/* Weekly Insight Card */}
        {weeklyInsight && <WeeklyInsightCard insight={weeklyInsight} colors={colors} isDark={isDark} t={t} />}

        {/* Compact Heatmap */}
        <CompactHeatmap data={heatmapData} colors={colors} isDark={isDark} t={t} />

        {/* AI Features Card */}
        <View style={[s.card, s.settingsGroup, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
          <PreferenceToggleRow
            icon={<Sparkles size={22} color={colors.textSecondary} strokeWidth={2.5} />}
            label={t('profile.recall.label')}
            description={t('profile.recall.description')}
            value={preferences?.ai_recall_enabled ?? true}
            onToggle={(value) => updatePreferences({ ai_recall_enabled: value })}
          />
          {preferences?.ai_recall_enabled && (
            <View style={[s.infoBox, { backgroundColor: colors.inputBg }]}>
              <Info size={14} color={colors.textSecondary} style={{ marginTop: 2 }} />
              <Text style={[s.infoText, { color: colors.textTertiary }]}>{t('profile.recall.info')}</Text>
            </View>
          )}

          {/* Auto-categorization toggle */}
          <PreferenceToggleRow
            icon={<FolderOpen size={22} color={colors.textSecondary} strokeWidth={2.5} />}
            label={t('profile.autoCategory.label')}
            description={t('profile.autoCategory.description')}
            value={preferences?.auto_categorize ?? true}
            onToggle={(value) => updatePreferences({ auto_categorize: value })}
            showTopBorder
          />

          {/* Auto-summarize toggle */}
          <PreferenceToggleRow
            icon={<Zap size={22} color={colors.textSecondary} strokeWidth={2.5} />}
            label={t('profile.autoSummarize.label')}
            description={t('profile.autoSummarize.description')}
            value={preferences?.auto_summarize ?? true}
            onToggle={(value) => updatePreferences({ auto_summarize: value })}
            showTopBorder
          />

          {/* Streaming responses toggle */}
          <PreferenceToggleRow
            icon={<Zap size={22} color={colors.textSecondary} strokeWidth={2.5} />}
            label={t('profile.streamingResponses.label')}
            description={t('profile.streamingResponses.description')}
            value={preferences?.streaming_responses ?? true}
            onToggle={(value) => updatePreferences({ streaming_responses: value })}
            showTopBorder
          />
        </View>

        {/* Menu */}
        <View style={[s.card, s.settingsGroup, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
          <TouchableOpacity style={[s.menuItem, s.menuItemBorder, { borderBottomColor: colors.border }]} onPress={() => setActiveModal('account')} activeOpacity={0.7}>
            <View style={s.menuText}>
              <Text style={[s.menuTitle, { color: colors.textPrimary }]}>{t('profile.menu.account.title')}</Text>
              <Text style={[s.menuSubtitle, { color: colors.textMuted }]}>{t('profile.menu.account.subtitle')}</Text>
            </View>
            <ChevronRight size={16} color={colors.textMuted} />
          </TouchableOpacity>

          <TouchableOpacity style={[s.menuItem, s.menuItemBorder, { borderBottomColor: colors.border }]} onPress={() => setActiveModal('privacy')} activeOpacity={0.7}>
            <View style={s.menuText}>
              <Text style={[s.menuTitle, { color: colors.textPrimary }]}>{t('profile.menu.privacy.title')}</Text>
              <Text style={[s.menuSubtitle, { color: colors.textMuted }]}>{t('profile.menu.privacy.subtitle')}</Text>
            </View>
            <ChevronRight size={16} color={colors.textMuted} />
          </TouchableOpacity>

          <TouchableOpacity style={[s.menuItem, s.menuItemBorder, { borderBottomColor: colors.border }]} onPress={() => setActiveModal('language')} activeOpacity={0.7}>
            <View style={s.menuText}>
              <Text style={[s.menuTitle, { color: colors.textPrimary }]}>{t('language.title')}</Text>
              <Text style={[s.menuSubtitle, { color: colors.textMuted }]}>{language === 'vi' ? t('language.vi') : t('language.en')}</Text>
            </View>
            <Globe size={16} color={colors.textMuted} />
          </TouchableOpacity>

          <TouchableOpacity style={[s.menuItem, s.menuItemBorder, { borderBottomColor: colors.border }]} onPress={() => setActiveModal('appearance')} activeOpacity={0.7}>
            <View style={s.menuText}>
              <Text style={[s.menuTitle, { color: colors.textPrimary }]}>{t('appearance.title')}</Text>
              <Text style={[s.menuSubtitle, { color: colors.textMuted }]}>
                {themeMode === 'dark' ? t('appearance.dark') : themeMode === 'light' ? t('appearance.light') : t('appearance.auto')}
              </Text>
            </View>
            <Palette size={16} color={colors.textMuted} />
          </TouchableOpacity>

          <TouchableOpacity style={s.menuItem} onPress={() => setActiveModal('about')} activeOpacity={0.7}>
            <View style={s.menuText}>
              <Text style={[s.menuTitle, { color: colors.textPrimary }]}>{t('profile.menu.about.title')}</Text>
              <Text style={[s.menuSubtitle, { color: colors.textMuted }]}>{t('profile.menu.about.subtitle')}</Text>
            </View>
            <ChevronRight size={16} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        {/* Dismissed */}
        <TouchableOpacity style={[s.dismissedBtn, { backgroundColor: colors.cardBg, borderColor: colors.border }]} activeOpacity={0.7} onPress={() => router.push('/dismissed')}>
          <Archive size={16} color={colors.textMuted} />
          <Text style={[s.dismissedText, { color: colors.textMuted }]}>{t('profile.dismissed')}</Text>
          {dismissedCount > 0 && (
            <View style={[s.dismissedBadge, { backgroundColor: colors.accent }]}>
              <Text style={[s.dismissedBadgeText, { color: '#fff' }]}>
                {dismissedCount > 9 ? '+9' : String(dismissedCount)}
              </Text>
            </View>
          )}
          <ChevronRight size={14} color={colors.textMuted} />
        </TouchableOpacity>

        <Text style={[s.tagline, { color: colors.textMuted }]}>{t('profile.tagline')}</Text>
      </ScrollView>

      {/* Account Modal */}
      <BottomSheetModal visible={activeModal === 'account'} onClose={closeAccountModal} title={
        accountSubView === 'changeEmail' ? t('account.changeEmailTitle') :
        accountSubView === 'changePassword' ? t('account.changePasswordTitle') :
        t('account.title')
      }>
        {accountSubView === 'main' && (
          <>
            <View style={m.section}>
              <InfoRow icon={<Mail size={20} color={colors.accent} />} label={t('account.email')} value={user?.email ?? '—'} />
              <ActionButton label={t('account.changeEmail')} onPress={() => { setFormError(''); setAccountSubView('changeEmail'); }} />
            </View>
            <SectionDivider />
            <View style={m.section}>
              {user?.auth_provider === 'google' ? (
                <View style={[m.infoNote, { backgroundColor: colors.accentSubtle }]}>
                  <Text style={[m.infoNoteText, { color: colors.textSecondary }]}>{t('account.googleNoPassword')}</Text>
                </View>
              ) : (
                <>
                  <InfoRow icon={<Lock size={20} color={colors.accent} />} label={t('account.password')} value="••••••••" />
                  <ActionButton label={t('account.changePassword')} onPress={() => { setFormError(''); setAccountSubView('changePassword'); }} />
                </>
              )}
            </View>
            <SectionDivider />
            <View style={m.section}>
              <TouchableOpacity style={[r.actionBtn, { backgroundColor: colors.inputBg }]} onPress={handleLogout} activeOpacity={0.7}>
                <LogOut size={16} color={colors.brandAccent} style={{ marginRight: 6 }} />
                <Text style={[s.signOutText, { color: colors.brandAccent }]}>{t('account.signOut')}</Text>
              </TouchableOpacity>
            </View>
            <SectionDivider />
            <View style={m.section}>
              <View style={[m.warningBox, { backgroundColor: colors.errorBg }]}><Text style={[m.warningText, { color: colors.errorText }]}>{t('account.deleteWarning')}</Text></View>
              <ActionButton label={t('account.deleteAccount')} icon={<Trash2 size={16} color={colors.error} style={{ marginRight: 6 }} />} variant="danger" onPress={handleDeleteAccount} />
            </View>
          </>
        )}

        {accountSubView === 'changeEmail' && (
          <View style={m.section}>
            <TouchableOpacity style={m.backRow} onPress={() => { setAccountSubView('main'); setFormError(''); }} activeOpacity={0.7}>
              <ArrowLeft size={16} color={colors.accent} />
              <Text style={[m.backText, { color: colors.accent }]}>{t('common.back')}</Text>
            </TouchableOpacity>
            <Text style={[m.fieldLabel, { color: colors.textMuted }]}>{t('account.newEmail')}</Text>
            <TextInput
              style={[m.textInput, { backgroundColor: colors.inputBg, color: colors.textPrimary, borderColor: colors.border }]}
              value={formEmail}
              onChangeText={setFormEmail}
              placeholder={t('login.emailPlaceholder')}
              placeholderTextColor={colors.textMuted}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
            {user?.auth_provider !== 'google' && (
              <>
                <Text style={[m.fieldLabel, { color: colors.textMuted, marginTop: 12 }]}>{t('account.confirmWithPassword')}</Text>
                <View style={m.pwdRow}>
                  <TextInput
                    style={[m.textInputPwd, { backgroundColor: colors.inputBg, color: colors.textPrimary, borderColor: colors.border }]}
                    value={formCurrentPwd}
                    onChangeText={setFormCurrentPwd}
                    placeholder={t('account.currentPassword')}
                    placeholderTextColor={colors.textMuted}
                    secureTextEntry={!showCurrentPwd}
                    autoCapitalize="none"
                  />
                  <TouchableOpacity style={m.eyeBtn} onPress={() => setShowCurrentPwd(v => !v)} activeOpacity={0.7}>
                    {showCurrentPwd ? <EyeOff size={18} color={colors.textMuted} /> : <Eye size={18} color={colors.textMuted} />}
                  </TouchableOpacity>
                </View>
              </>
            )}
            {!!formError && <Text style={[m.formError, { color: colors.error }]}>{formError}</Text>}
            <TouchableOpacity
              style={[m.submitBtn, { backgroundColor: colors.accent }, formLoading && { opacity: 0.6 }]}
              onPress={handleSubmitChangeEmail}
              disabled={formLoading}
              activeOpacity={0.8}
            >
              <Text style={m.submitBtnText}>{formLoading ? '…' : t('account.changeEmail')}</Text>
            </TouchableOpacity>
          </View>
        )}

        {accountSubView === 'changePassword' && (
          <View style={m.section}>
            <TouchableOpacity style={m.backRow} onPress={() => { setAccountSubView('main'); setFormError(''); }} activeOpacity={0.7}>
              <ArrowLeft size={16} color={colors.accent} />
              <Text style={[m.backText, { color: colors.accent }]}>{t('common.back')}</Text>
            </TouchableOpacity>
            <Text style={[m.fieldLabel, { color: colors.textMuted }]}>{t('account.currentPassword')}</Text>
            <View style={m.pwdRow}>
              <TextInput
                style={[m.textInputPwd, { backgroundColor: colors.inputBg, color: colors.textPrimary, borderColor: colors.border }]}
                value={formCurrentPwd}
                onChangeText={setFormCurrentPwd}
                placeholder={t('account.currentPassword')}
                placeholderTextColor={colors.textMuted}
                secureTextEntry={!showCurrentPwd}
                autoCapitalize="none"
              />
              <TouchableOpacity style={m.eyeBtn} onPress={() => setShowCurrentPwd(v => !v)} activeOpacity={0.7}>
                {showCurrentPwd ? <EyeOff size={18} color={colors.textMuted} /> : <Eye size={18} color={colors.textMuted} />}
              </TouchableOpacity>
            </View>
            <Text style={[m.fieldLabel, { color: colors.textMuted, marginTop: 12 }]}>{t('account.newPassword')}</Text>
            <View style={m.pwdRow}>
              <TextInput
                style={[m.textInputPwd, { backgroundColor: colors.inputBg, color: colors.textPrimary, borderColor: colors.border }]}
                value={formNewPwd}
                onChangeText={setFormNewPwd}
                placeholder={t('account.newPassword')}
                placeholderTextColor={colors.textMuted}
                secureTextEntry={!showNewPwd}
                autoCapitalize="none"
              />
              <TouchableOpacity style={m.eyeBtn} onPress={() => setShowNewPwd(v => !v)} activeOpacity={0.7}>
                {showNewPwd ? <EyeOff size={18} color={colors.textMuted} /> : <Eye size={18} color={colors.textMuted} />}
              </TouchableOpacity>
            </View>
            <Text style={[m.fieldLabel, { color: colors.textMuted, marginTop: 12 }]}>{t('account.confirmNewPassword')}</Text>
            <View style={m.pwdRow}>
              <TextInput
                style={[m.textInputPwd, { backgroundColor: colors.inputBg, color: colors.textPrimary, borderColor: colors.border }]}
                value={formConfirmPwd}
                onChangeText={setFormConfirmPwd}
                placeholder={t('account.confirmNewPassword')}
                placeholderTextColor={colors.textMuted}
                secureTextEntry={!showConfirmPwd}
                autoCapitalize="none"
              />
              <TouchableOpacity style={m.eyeBtn} onPress={() => setShowConfirmPwd(v => !v)} activeOpacity={0.7}>
                {showConfirmPwd ? <EyeOff size={18} color={colors.textMuted} /> : <Eye size={18} color={colors.textMuted} />}
              </TouchableOpacity>
            </View>
            {!!formError && <Text style={[m.formError, { color: colors.error }]}>{formError}</Text>}
            <TouchableOpacity
              style={[m.submitBtn, { backgroundColor: colors.accent }, formLoading && { opacity: 0.6 }]}
              onPress={handleSubmitChangePassword}
              disabled={formLoading}
              activeOpacity={0.8}
            >
              <Text style={m.submitBtnText}>{formLoading ? '…' : t('account.changePassword')}</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={m.bottomPad} />
      </BottomSheetModal>

      {/* Privacy Modal */}
      <BottomSheetModal visible={activeModal === 'privacy'} onClose={() => setActiveModal(null)} title={t('privacy.title')}>
        <View style={m.section}>
          <View style={r.row}>
            <View style={[r.iconWrap, { backgroundColor: colors.accentSubtle }]}><Shield size={20} color={colors.accent} /></View>
            <View style={r.rowText}>
              <Text style={[r.rowValue, { color: colors.textPrimary }]}>{t('privacy.dataProtected')}</Text>
              <Text style={[r.rowLabel, { marginTop: 4, color: colors.textMuted }]}>{t('privacy.dataProtectedDesc')}</Text>
            </View>
          </View>
        </View>
        <SectionDivider />
        <View style={m.section}>
          <Text style={[m.sectionTitle, { color: colors.textTertiary }]}>{t('privacy.dataStorage')}</Text>
          <View style={[m.bulletCard, { backgroundColor: colors.accentSubtle }]}>
            <BulletPoint text={t('privacy.storagePoint1')} />
            <BulletPoint text={t('privacy.storagePoint2')} />
            <BulletPoint text={t('privacy.storagePoint3')} />
          </View>
        </View>
        <SectionDivider />
        <View style={m.section}>
          <ActionButton label={t('privacy.downloadData')} icon={<Download size={16} color={colors.accent} style={{ marginRight: 6 }} />} variant="accent" onPress={handleDownloadData} />
        </View>
        <SectionDivider />
        <View style={m.section}>
          <ExternalLinkButton label={t('privacy.privacyPolicy')} url="https://memoriai.app/privacy" />
        </View>
        <SectionDivider />
        <View style={m.section}>
          <View style={[m.warningBox, { backgroundColor: colors.errorBg }]}><Text style={[m.warningText, { color: colors.errorText }]}>{t('privacy.deleteDataWarning')}</Text></View>
          <ActionButton label={t('privacy.deleteAllData')} icon={<Trash2 size={16} color={colors.error} style={{ marginRight: 6 }} />} variant="danger" onPress={handleDeleteAllData} />
        </View>
        <View style={m.bottomPad} />
      </BottomSheetModal>

      {/* About Modal */}
      <BottomSheetModal visible={activeModal === 'about'} onClose={() => setActiveModal(null)} title={t('about.title')}>
        <View style={[m.section, m.centeredSection]}>
          <View style={[m.appIcon, { backgroundColor: colors.accentSubtle }]}><Sparkles size={40} color={colors.accent} strokeWidth={2} /></View>
          <Text style={[m.appName, { color: colors.textPrimary }]}>AI Living Memory</Text>
          <Text style={[m.appVersion, { color: colors.textMuted }]}>{t('about.version')}</Text>
          <Text style={[m.appDesc, { color: colors.textTertiary }]}>{t('about.description')}</Text>
        </View>
        <SectionDivider />
        <View style={m.section}>
          <Text style={[m.sectionTitle, { color: colors.textTertiary }]}>{t('about.philosophy')}</Text>
          <View style={[m.bulletCard, { backgroundColor: colors.accentSubtle }]}>
            <BulletPoint text={t('about.philosophyPoint1')} />
            <BulletPoint text={t('about.philosophyPoint2')} />
            <BulletPoint text={t('about.philosophyPoint3')} />
          </View>
        </View>
        <SectionDivider />
        <View style={[m.section, { gap: 10 }]}>
          <ExternalLinkButton label={t('about.terms')} url="https://memoriai.app/terms" />
          <ExternalLinkButton label={t('about.privacyPolicy')} url="https://memoriai.app/privacy" />
        </View>
        <SectionDivider />
        <View style={m.section}>
          <ActionButton label={t('about.contactSupport')} icon={<MessageCircle size={16} color={colors.accent} style={{ marginRight: 6 }} />} variant="accent" onPress={handleContactSupport} />
        </View>
        <SectionDivider />
        <View style={[m.section, m.centeredSection]}>
          <Text style={[m.credits, { color: colors.textMuted }]}>{t('about.credits')}</Text>
        </View>
        <View style={m.bottomPad} />
      </BottomSheetModal>

      {/* Appearance Modal */}
      <BottomSheetModal visible={activeModal === 'appearance'} onClose={() => setActiveModal(null)} title={t('appearance.title')}>
        <View style={m.section}>
          {([
            { key: 'auto' as ThemeMode, label: t('appearance.auto'), desc: t('appearance.autoDesc'), emoji: '📱' },
            { key: 'light' as ThemeMode, label: t('appearance.light'), desc: t('appearance.lightDesc'), emoji: '☀️' },
            { key: 'dark' as ThemeMode, label: t('appearance.dark'), desc: t('appearance.darkDesc'), emoji: '🌙' },
          ]).map((opt) => (
            <TouchableOpacity
              key={opt.key}
              style={[m.langOption, { backgroundColor: colors.subtleBg }, themeMode === opt.key && [m.langOptionActive, { borderColor: colors.accent, backgroundColor: colors.accentSubtle }]]}
              onPress={() => {
                updatePreferences({ theme_mode: opt.key });
                setActiveModal(null);
              }}
              activeOpacity={0.7}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: 10 }}>
                <Text style={{ fontSize: 20 }}>{opt.emoji}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[m.langLabel, { color: colors.textSecondary }, themeMode === opt.key && [m.langLabelActive, { color: colors.accent }]]}>{opt.label}</Text>
                  <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>{opt.desc}</Text>
                </View>
              </View>
              {themeMode === opt.key && <View style={[m.langCheck, { backgroundColor: colors.accent }]} />}
            </TouchableOpacity>
          ))}
        </View>
        <View style={m.bottomPad} />
      </BottomSheetModal>

      {/* Language Modal */}
      <BottomSheetModal visible={activeModal === 'language'} onClose={() => setActiveModal(null)} title={t('language.title')}>
        <View style={m.section}>
          <TouchableOpacity style={[m.langOption, { backgroundColor: colors.subtleBg }, language === 'en' && [m.langOptionActive, { borderColor: colors.accent, backgroundColor: colors.accentSubtle }]]} onPress={() => handleLanguageSelect('en')} activeOpacity={0.7}>
            <Text style={[m.langLabel, { color: colors.textSecondary }, language === 'en' && [m.langLabelActive, { color: colors.accent }]]}>🇺🇸  {t('language.en')}</Text>
            {language === 'en' && <View style={[m.langCheck, { backgroundColor: colors.accent }]} />}
          </TouchableOpacity>
          <TouchableOpacity style={[m.langOption, { backgroundColor: colors.subtleBg }, language === 'vi' && [m.langOptionActive, { borderColor: colors.accent, backgroundColor: colors.accentSubtle }]]} onPress={() => handleLanguageSelect('vi')} activeOpacity={0.7}>
            <Text style={[m.langLabel, { color: colors.textSecondary }, language === 'vi' && [m.langLabelActive, { color: colors.accent }]]}>🇻🇳  {t('language.vi')}</Text>
            {language === 'vi' && <View style={[m.langCheck, { backgroundColor: colors.accent }]} />}
          </TouchableOpacity>
        </View>
        <View style={m.bottomPad} />
      </BottomSheetModal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  profileHeader: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingBottom: 4,
  },
  settingsGroup: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
    marginHorizontal: 16,
    marginBottom: 12,
  },
  signOutText: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 15,
  },
  scroll: { flex: 1 },
  scrollContent: { paddingTop: 16, paddingBottom: 120 },
  card: {
    borderRadius: 20, borderWidth: 1,
    marginBottom: 12, overflow: 'hidden',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4 },
      android: { elevation: 2 },
    }),
  },
  recallRow: { flexDirection: 'row', alignItems: 'flex-start', padding: 20, gap: 14 },
  recallIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  recallTextWrap: { flex: 1 },
  recallLabel: { fontSize: 15, fontWeight: '600', marginBottom: 2 },
  recallDesc: { fontSize: 13, lineHeight: 18 },
  toggleControlWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  toggleStatePill: {
    minHeight: 24,
    minWidth: 42,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  toggleStateText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.35,
  },
  toggleSwitch: {
    transform: [{ scaleX: 0.95 }, { scaleY: 0.95 }],
  },
  infoBox: { flexDirection: 'row', borderRadius: 14, padding: 14, marginHorizontal: 16, marginBottom: 16, gap: 10 },
  infoText: { flex: 1, fontSize: 13, lineHeight: 19 },
  menuCard: {},
  menuItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16 },
  menuItemBorder: { borderBottomWidth: StyleSheet.hairlineWidth },
  menuText: { flex: 1 },
  menuTitle: { fontSize: 15, fontWeight: '600', marginBottom: 2 },
  menuSubtitle: { fontSize: 13 },
  dismissedBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 16, borderWidth: 1, paddingVertical: 14, marginBottom: 12, marginHorizontal: 16 },
  dismissedText: { fontSize: 14, fontWeight: '500' },
  dismissedBadge: { borderRadius: 10, minWidth: 20, height: 20, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  dismissedBadgeText: { fontSize: 11, fontWeight: '700' },
  tagline: { textAlign: 'center', fontSize: 14, lineHeight: 21, paddingTop: 24, paddingBottom: 8 },
});

const sh = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '88%', overflow: 'hidden',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.12, shadowRadius: 12 },
      android: { elevation: 12 },
    }),
  },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: StyleSheet.hairlineWidth },
  sheetTitle: { fontSize: 17, fontWeight: '600' },
  closeBtn: { borderRadius: 14, padding: 6 },
  sheetScroll: { flexGrow: 0 },
});

const m = StyleSheet.create({
  section: { padding: 20 },
  centeredSection: { alignItems: 'center' },
  sectionTitle: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 },
  warningBox: { borderRadius: 14, padding: 14, marginBottom: 12 },
  warningText: { fontSize: 14, lineHeight: 20 },
  bulletCard: { borderRadius: 14, padding: 14, gap: 10 },
  appIcon: { width: 72, height: 72, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  appName: { fontSize: 20, fontWeight: '600', marginBottom: 4 },
  appVersion: { fontSize: 12, marginBottom: 10 },
  appDesc: { fontSize: 14, lineHeight: 21, textAlign: 'center', maxWidth: 280 },
  credits: { fontSize: 12, lineHeight: 18, textAlign: 'center' },
  bottomPad: { height: 40 },
  langOption: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, paddingHorizontal: 16, borderRadius: 14, marginBottom: 10, borderWidth: 1.5, borderColor: 'transparent' },
  langOptionActive: {},
  langLabel: { fontSize: 15 },
  langLabelActive: { fontWeight: '600' },
  langCheck: { width: 10, height: 10, borderRadius: 5 },
  // Inline form styles
  backRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 20 },
  backText: { fontSize: 14, fontWeight: '600' },
  fieldLabel: { fontSize: 12, fontWeight: '600', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.4 },
  textInput: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  pwdRow: { flexDirection: 'row', alignItems: 'center' },
  textInputPwd: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    paddingRight: 44,
  },
  eyeBtn: { position: 'absolute', right: 12, padding: 4 },
  formError: { fontSize: 13, marginTop: 8, lineHeight: 18 },
  submitBtn: { borderRadius: 999, paddingVertical: 14, alignItems: 'center', marginTop: 20 },
  submitBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  infoNote: { borderRadius: 12, padding: 12 },
  infoNoteText: { fontSize: 13, lineHeight: 19 },
});

const r = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 12 },
  iconWrap: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  rowText: { flex: 1 },
  rowLabel: { fontSize: 12 },
  rowValue: { fontSize: 15, fontWeight: '600' },
  actionBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 13, borderRadius: 999 },
  actionBtnText: { fontSize: 14, fontWeight: '600' },
  externalBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 13, paddingHorizontal: 16, borderRadius: 999 },
  externalBtnText: { fontSize: 14, fontWeight: '600' },
  divider: { height: StyleSheet.hairlineWidth },
  bullet: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  bulletDot: { width: 6, height: 6, borderRadius: 3, marginTop: 7 },
  bulletText: { flex: 1, fontSize: 14, lineHeight: 20 },
});

const p = StyleSheet.create({
  quickActionsWrap: { marginHorizontal: 16, marginBottom: 10 },
  quickActionsLabel: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 12,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  quickActionsRow: { flexDirection: 'row', gap: 8 },
  quickActionBtn: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 10,
    alignItems: 'center',
  },
  quickActionText: { fontFamily: 'DMSans_500Medium', fontSize: 13 },
  updatedText: { fontFamily: 'DMSans_400Regular', fontSize: 11, marginTop: 8 },
  statsRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginBottom: 12 },
  statBox: { flex: 1, borderRadius: 14, borderWidth: 1, paddingVertical: 10, alignItems: 'center' },
  statVal: { fontSize: 18, fontWeight: '700', lineHeight: 22 },
  statLabel: { fontSize: 10, marginTop: 2 },
  insightCard: { marginHorizontal: 16, marginBottom: 10, borderRadius: 14, padding: 12, borderWidth: 1.5 },
  insightLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5, marginBottom: 6 },
  insightText: { fontSize: 13, lineHeight: 19 },
  topicChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  topicChip: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  topicChipText: { fontSize: 11, fontWeight: '600' },
  heatmapCard: { marginHorizontal: 16, marginBottom: 10, borderRadius: 14, borderWidth: 1, padding: 12 },
  heatmapLabel: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  heatmapGrid: { flexDirection: 'row', gap: 3 },
  heatmapCol: { flexDirection: 'column', gap: 3 },
  heatmapCell: { width: 14, height: 14, borderRadius: 3 },
  heatmapSummary: { fontSize: 11, marginTop: 8 },
  heatmapNoData: { fontSize: 11, marginTop: 8 },
  settingsList: { marginHorizontal: 16, borderRadius: 14, borderWidth: 1, overflow: 'hidden', marginBottom: 16 },
  settingsItemRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderBottomWidth: 1 },
  settingsIcon: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  settingsText: { flex: 1, fontSize: 13, fontWeight: '500' },
});
