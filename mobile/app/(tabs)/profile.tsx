import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Modal,
  Animated,
  TouchableWithoutFeedback,
  Alert,
  Linking,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { memoriesApi } from '../../services/api';
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
} from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../store/authStore';
import { useSettingsStore } from '../../store/settingsStore';
import { useTheme, type ThemeMode } from '../../constants/ThemeContext';
import type { SupportedLanguage } from '../../i18n';

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

export default function ProfileScreen() {
  const { t } = useTranslation();
  const { user, logout } = useAuthStore();
  const { language, setLanguage, preferences, loadPreferences, updatePreferences } = useSettingsStore();
  type ModalType = 'account' | 'privacy' | 'about' | 'language' | 'appearance' | 'aiFeatures' | null;
  const [activeModal, setActiveModal] = useState<ModalType>(null);
  const [dismissedCount, setDismissedCount] = useState(0);
  const { colors, isDark, mode: themeMode } = useTheme();

  // Load preferences on focus
  useEffect(() => {
    loadPreferences();
  }, []);

  useFocusEffect(
    useCallback(() => {
      memoriesApi.listDismissed({ limit: 100 })
        .then((items) => setDismissedCount(items.length))
        .catch(() => { });
    }, [])
  );

  const handleLogout = () => {
    Alert.alert(t('alerts.signOutTitle'), t('alerts.signOutMessage'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.signOut'),
        style: 'destructive',
        onPress: async () => {
          setActiveModal(null);
          await logout();
          router.replace('/login');
        },
      },
    ]);
  };

  const handleDeleteAccount = () => {
    Alert.alert(t('alerts.deleteAccountTitle'), t('alerts.deleteAccountMessage'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.delete'), style: 'destructive', onPress: () => { } },
    ]);
  };

  const handleDeleteAllData = () => {
    Alert.alert(t('alerts.deleteDataTitle'), t('alerts.deleteDataMessage'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.delete'), style: 'destructive', onPress: () => { } },
    ]);
  };

  const handleLanguageSelect = async (lang: SupportedLanguage) => {
    await setLanguage(lang);
    setActiveModal(null);
  };

  return (
    <SafeAreaView style={[s.container, { backgroundColor: colors.bg }]} edges={['top']}>
      <View style={s.header}>
        <Text style={[s.title, { color: colors.textPrimary }]}>{t('profile.title')}</Text>
        <Text style={[s.subtitle, { color: colors.textMuted }]}>{t('profile.subtitle')}</Text>
      </View>

      <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>
        {/* AI Features Card */}
        <View style={[s.card, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
          <View style={s.recallRow}>
            <View style={[s.recallIcon, { backgroundColor: colors.accentSubtle }]}>
              <Sparkles size={22} color={colors.accent} strokeWidth={2.5} />
            </View>
            <View style={s.recallTextWrap}>
              <Text style={[s.recallLabel, { color: colors.textPrimary }]}>{t('profile.recall.label')}</Text>
              <Text style={[s.recallDesc, { color: colors.textMuted }]}>{t('profile.recall.description')}</Text>
            </View>
            <Switch
              value={preferences?.ai_recall_enabled ?? true}
              onValueChange={(value) => updatePreferences({ ai_recall_enabled: value })}
              trackColor={{ false: colors.switchTrackOff, true: '#818CF8' }}
              thumbColor={preferences?.ai_recall_enabled ? colors.accent : colors.cardBg}
            />
          </View>
          {preferences?.ai_recall_enabled && (
            <View style={[s.infoBox, { backgroundColor: colors.accentSubtle }]}>
              <Info size={14} color={colors.accent} style={{ marginTop: 2 }} />
              <Text style={[s.infoText, { color: colors.textTertiary }]}>{t('profile.recall.info')}</Text>
            </View>
          )}

          {/* Auto-categorization toggle */}
          <View style={[s.recallRow, { marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: colors.border }]}>
            <View style={[s.recallIcon, { backgroundColor: 'rgba(16,185,129,0.1)' }]}>
              <FolderOpen size={22} color="#10B981" strokeWidth={2.5} />
            </View>
            <View style={s.recallTextWrap}>
              <Text style={[s.recallLabel, { color: colors.textPrimary }]}>{t('profile.autoCategory.label')}</Text>
              <Text style={[s.recallDesc, { color: colors.textMuted }]}>{t('profile.autoCategory.description')}</Text>
            </View>
            <Switch
              value={preferences?.auto_categorize ?? true}
              onValueChange={(value) => updatePreferences({ auto_categorize: value })}
              trackColor={{ false: colors.switchTrackOff, true: '#34D399' }}
              thumbColor={preferences?.auto_categorize ? '#10B981' : colors.cardBg}
            />
          </View>

          {/* Auto-summarize toggle */}
          <View style={[s.recallRow, { marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: colors.border }]}>
            <View style={[s.recallIcon, { backgroundColor: 'rgba(245,158,11,0.1)' }]}>
              <Zap size={22} color="#F59E0B" strokeWidth={2.5} />
            </View>
            <View style={s.recallTextWrap}>
              <Text style={[s.recallLabel, { color: colors.textPrimary }]}>{t('profile.autoSummarize.label')}</Text>
              <Text style={[s.recallDesc, { color: colors.textMuted }]}>{t('profile.autoSummarize.description')}</Text>
            </View>
            <Switch
              value={preferences?.auto_summarize ?? true}
              onValueChange={(value) => updatePreferences({ auto_summarize: value })}
              trackColor={{ false: colors.switchTrackOff, true: '#FBBF24' }}
              thumbColor={preferences?.auto_summarize ? '#F59E0B' : colors.cardBg}
            />
          </View>

          {/* Streaming responses toggle */}
          <View style={[s.recallRow, { marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: colors.border }]}>
            <View style={[s.recallIcon, { backgroundColor: 'rgba(99,102,241,0.1)' }]}>
              <Zap size={22} color="#6366F1" strokeWidth={2.5} />
            </View>
            <View style={s.recallTextWrap}>
              <Text style={[s.recallLabel, { color: colors.textPrimary }]}>{t('profile.streamingResponses.label')}</Text>
              <Text style={[s.recallDesc, { color: colors.textMuted }]}>{t('profile.streamingResponses.description')}</Text>
            </View>
            <Switch
              value={preferences?.streaming_responses ?? true}
              onValueChange={(value) => updatePreferences({ streaming_responses: value })}
              trackColor={{ false: colors.switchTrackOff, true: '#818CF8' }}
              thumbColor={preferences?.streaming_responses !== false ? colors.accent : colors.cardBg}
            />
          </View>
        </View>

        {/* Menu */}
        <View style={[s.card, s.menuCard, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
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
      <BottomSheetModal visible={activeModal === 'account'} onClose={() => setActiveModal(null)} title={t('account.title')}>
        <View style={m.section}>
          <InfoRow icon={<Mail size={20} color={colors.accent} />} label={t('account.email')} value={user?.email ?? '—'} />
          <ActionButton label={t('account.changeEmail')} />
        </View>
        <SectionDivider />
        <View style={m.section}>
          <InfoRow icon={<Lock size={20} color={colors.accent} />} label={t('account.password')} value="••••••••" />
          <ActionButton label={t('account.changePassword')} />
        </View>
        <SectionDivider />
        <View style={m.section}>
          <ActionButton label={t('account.signOut')} icon={<LogOut size={16} color={colors.accent} style={{ marginRight: 6 }} />} variant="accent" onPress={handleLogout} />
        </View>
        <SectionDivider />
        <View style={m.section}>
          <View style={[m.warningBox, { backgroundColor: colors.errorBg }]}><Text style={[m.warningText, { color: colors.errorText }]}>{t('account.deleteWarning')}</Text></View>
          <ActionButton label={t('account.deleteAccount')} icon={<Trash2 size={16} color={colors.error} style={{ marginRight: 6 }} />} variant="danger" onPress={handleDeleteAccount} />
        </View>
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
          <ActionButton label={t('privacy.downloadData')} icon={<Download size={16} color={colors.accent} style={{ marginRight: 6 }} />} variant="accent" />
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
          <ActionButton label={t('about.contactSupport')} icon={<MessageCircle size={16} color={colors.accent} style={{ marginRight: 6 }} />} variant="accent" />
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
  header: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 8 },
  title: { fontSize: 26, fontWeight: '600', marginBottom: 4 },
  subtitle: { fontSize: 13 },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 120 },
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
  recallLabel: { fontSize: 15, fontWeight: '500', marginBottom: 2 },
  recallDesc: { fontSize: 13, lineHeight: 18 },
  infoBox: { flexDirection: 'row', borderRadius: 14, padding: 14, marginHorizontal: 16, marginBottom: 16, gap: 10 },
  infoText: { flex: 1, fontSize: 12, lineHeight: 18 },
  menuCard: {},
  menuItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16 },
  menuItemBorder: { borderBottomWidth: StyleSheet.hairlineWidth },
  menuText: { flex: 1 },
  menuTitle: { fontSize: 15, fontWeight: '500', marginBottom: 2 },
  menuSubtitle: { fontSize: 12 },
  dismissedBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 16, borderWidth: 1, paddingVertical: 14, marginBottom: 12 },
  dismissedText: { fontSize: 14 },
  dismissedBadge: { borderRadius: 10, minWidth: 20, height: 20, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  dismissedBadgeText: { fontSize: 11, fontWeight: '700' },
  tagline: { textAlign: 'center', fontSize: 13, lineHeight: 20, paddingTop: 24, paddingBottom: 8 },
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
  sectionTitle: { fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 },
  warningBox: { borderRadius: 14, padding: 14, marginBottom: 12 },
  warningText: { fontSize: 13, lineHeight: 18 },
  bulletCard: { borderRadius: 14, padding: 14, gap: 10 },
  appIcon: { width: 72, height: 72, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  appName: { fontSize: 20, fontWeight: '600', marginBottom: 4 },
  appVersion: { fontSize: 13, marginBottom: 10 },
  appDesc: { fontSize: 13, lineHeight: 20, textAlign: 'center', maxWidth: 280 },
  credits: { fontSize: 12, lineHeight: 18, textAlign: 'center' },
  bottomPad: { height: 40 },
  langOption: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, paddingHorizontal: 16, borderRadius: 14, marginBottom: 10, borderWidth: 1.5, borderColor: 'transparent' },
  langOptionActive: {},
  langLabel: { fontSize: 15 },
  langLabelActive: { fontWeight: '600' },
  langCheck: { width: 10, height: 10, borderRadius: 5 },
});

const r = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 12 },
  iconWrap: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  rowText: { flex: 1 },
  rowLabel: { fontSize: 12 },
  rowValue: { fontSize: 15, fontWeight: '500' },
  actionBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 13, borderRadius: 999 },
  actionBtnText: { fontSize: 14, fontWeight: '500' },
  externalBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 13, paddingHorizontal: 16, borderRadius: 999 },
  externalBtnText: { fontSize: 14, fontWeight: '500' },
  divider: { height: StyleSheet.hairlineWidth },
  bullet: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  bulletDot: { width: 6, height: 6, borderRadius: 3, marginTop: 7 },
  bulletText: { flex: 1, fontSize: 13, lineHeight: 19 },
});
