import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { aiApi, memoriesApi, Memory as ApiMemory } from '../../services/api';
import { useAuthStore } from '../../store/authStore';
import { useTheme, type ThemeColors } from '../../constants/ThemeContext';
import { LinearGradient } from 'expo-linear-gradient';
import { BarChart2, ChevronRight } from 'lucide-react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface RecallMemory {
  id: string;
  content: string;
  reason: string;
  type: 'text' | 'link' | 'voice' | 'photo';
  createdAt: Date;
}

interface ReminderMemory {
  id: string;
  content: string;
  type: 'text' | 'link' | 'voice' | 'photo';
  createdAt: Date;
  timeAgo?: string;
}

interface Stats {
  total: number;
  this_week: number;
  today: number;
  streak?: number;
}

interface Reminders {
  unreviewed: ReminderMemory[];
  revisit: ReminderMemory[];
  on_this_day: ReminderMemory[];
}

interface MemoryGroup {
  title: string;
  memories: ReminderMemory[];
}

function getGreetingKey(): 'home.greetingMorning' | 'home.greetingAfternoon' | 'home.greetingEvening' {
  const hour = new Date().getHours();
  if (hour < 12) return 'home.greetingMorning';
  if (hour < 17) return 'home.greetingAfternoon';
  return 'home.greetingEvening';
}

const TYPE_ICON: Record<string, string> = { text: '📝', voice: '🎤', link: '🔗', photo: '📷' };

function formatRelative(date: Date, t: Function): string {
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return t('common.justNow');
  if (mins < 60) return t('common.minutesAgo', { count: mins });
  const hours = Math.floor(mins / 60);
  if (hours < 24) return t('common.hoursAgo', { count: hours });
  const days = Math.floor(hours / 24);
  if (days === 1) return t('common.yesterday');
  if (days < 7) return t('common.daysAgo', { count: days });
  if (days < 30) return t('common.weeksAgo', { count: Math.floor(days / 7) });
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

// ─── Focus card: smart daily insight ──────────────────────────────────────────
function FocusCard({
  stats,
  reminders,
  t,
}: {
  stats: Stats | null;
  reminders: Reminders | null;
  t: Function;
}) {
  const unreviewedCount = reminders?.unreviewed?.length ?? 0;
  const revisitCount = reminders?.revisit?.length ?? 0;
  const streak = stats?.streak ?? 0;
  const todayCount = stats?.today ?? 0;

  let message: string;
  let actionLabel: string | null = null;
  let actionRoute: string | null = null;
  let emoji = '🎯';

  if (todayCount >= 3) {
    message = t('home.focusGreat', { count: todayCount });
    emoji = '🌟';
  } else if (unreviewedCount > 0) {
    message = t('home.focusUnreviewed', { count: unreviewedCount });
    actionLabel = t('home.seeAll');
    emoji = '📬';
  } else if (revisitCount > 0) {
    message = t('home.focusRevisit', { count: revisitCount });
    emoji = '🔁';
  } else if (streak >= 3) {
    message = t('home.focusStreak', { count: streak });
    emoji = '🔥';
  } else {
    message = t('home.focusKeepGoing');
    actionLabel = t('home.quickCapture');
    actionRoute = '/capture';
    emoji = '💡';
  }

  return (
    <View style={styles.focusCard}>
      <LinearGradient
        colors={['#6366F1', '#818CF8']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.focusGradient}
      >
        <View style={styles.focusHeader}>
          <Text style={styles.focusEmoji}>{emoji}</Text>
          <Text style={styles.focusTitle}>{t('home.focusTitle')}</Text>
        </View>
        <Text style={styles.focusMessage}>{message}</Text>
        {actionRoute && actionLabel && (
          <TouchableOpacity
            style={styles.focusAction}
            onPress={() => router.push(actionRoute as any)}
            activeOpacity={0.8}
          >
            <Text style={styles.focusActionText}>{actionLabel} →</Text>
          </TouchableOpacity>
        )}
      </LinearGradient>
    </View>
  );
}

// ─── Quick capture buttons ────────────────────────────────────────────────────
function QuickCaptureRow({ t }: { t: Function }) {
  const { colors } = useTheme();
  const actions = [
    { key: 'text', icon: '📝', label: t('home.captureText'), color: colors.typeBgText },
    { key: 'voice', icon: '🎤', label: t('home.captureVoice'), color: colors.typeBgVoice },
    { key: 'link', icon: '🔗', label: t('home.captureLink'), color: colors.typeBgLink },
    { key: 'photo', icon: '📷', label: t('home.capturePhoto'), color: colors.typeBgPhoto },
  ];
  return (
    <View style={styles.quickRow}>
      {actions.map((a) => (
        <TouchableOpacity
          key={a.key}
          style={[styles.quickBtn, { backgroundColor: a.color, borderColor: colors.border }]}
          onPress={() => router.push({ pathname: '/capture', params: { mode: a.key } })}
          activeOpacity={0.7}
        >
          <Text style={styles.quickIcon}>{a.icon}</Text>
          <Text style={[styles.quickLabel, { color: colors.textTertiary }]}>{a.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

// ─── Compact memory card ───────────────────────────────────────────────────────
function MemoryCard({ memory, subtitle, t }: { memory: ReminderMemory; subtitle?: string; t: Function }) {
  const { colors } = useTheme();
  return (
    <TouchableOpacity
      style={[styles.memCard, { backgroundColor: colors.cardBg, borderColor: colors.border }]}
      onPress={() => router.push(`/memory/${memory.id}`)}
      activeOpacity={0.7}
    >
      <View style={styles.memCardRow}>
        <View style={[styles.memCardIconWrap, { backgroundColor: memory.type === 'voice' ? colors.typeBgVoice : memory.type === 'link' ? colors.typeBgLink : memory.type === 'photo' ? colors.typeBgPhoto : colors.typeBgText }]}>
          <Text style={styles.memCardIcon}>{TYPE_ICON[memory.type]}</Text>
        </View>
        <View style={styles.memCardContent}>
          <Text style={[styles.memCardText, { color: colors.textPrimary }]} numberOfLines={2}>{memory.content}</Text>
          <Text style={[styles.memCardMeta, { color: colors.textMuted }]}>{subtitle || formatRelative(memory.createdAt, t)}</Text>
        </View>
        <Text style={[styles.memCardChevron, { color: colors.border }]}>›</Text>
      </View>
    </TouchableOpacity>
  );
}

function StatsCard({ stats, t }: { stats: Stats; t: Function }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.statsCard, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
      <View style={styles.statItem}>
        <Text style={[styles.statValue, { color: colors.textPrimary }]}>{stats.total}</Text>
        <Text style={[styles.statLabel, { color: colors.textMuted }]}>{t('home.statsTotal')}</Text>
      </View>
      <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
      <View style={styles.statItem}>
        <Text style={[styles.statValue, { color: colors.textPrimary }]}>{stats.this_week}</Text>
        <Text style={[styles.statLabel, { color: colors.textMuted }]}>{t('home.statsWeek')}</Text>
      </View>
      <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
      <View style={styles.statItem}>
        <Text style={[styles.statValue, { color: colors.textPrimary }]}>{stats.today}</Text>
        <Text style={[styles.statLabel, { color: colors.textMuted }]}>{t('home.statsToday')}</Text>
      </View>
    </View>
  );
}

// ─── Insights teaser row ──────────────────────────────────────────────────────
function InsightsTeaserCard({ stats, t }: { stats: Stats; t: Function }) {
  const { colors } = useTheme();
  const streak = stats.streak ?? 0;
  return (
    <TouchableOpacity
      style={[styles.insightsTeaser, { backgroundColor: colors.cardBg, borderColor: colors.border }]}
      onPress={() => router.push('/(tabs)/insights')}
      activeOpacity={0.8}
    >
      <View style={[styles.insightsTeaserIcon, { backgroundColor: colors.accentSubtle }]}>
        <BarChart2 size={20} color={colors.accent} strokeWidth={2} />
      </View>
      <View style={styles.insightsTeaserBody}>
        <Text style={[styles.insightsTeaserTitle, { color: colors.textPrimary }]}>
          {t('tabs.insights')}
        </Text>
        <Text style={[styles.insightsTeaserSub, { color: colors.textMuted }]}>
          {streak > 0
            ? `🔥 ${streak}-day streak · ${stats.this_week} this week`
            : `${stats.this_week} memories this week`}
        </Text>
      </View>
      <ChevronRight size={16} color={colors.textMuted} />
    </TouchableOpacity>
  );
}

function SectionHeader({ emoji, title, count, onSeeAll }: { emoji: string; title: string; count?: number; onSeeAll?: () => void }) {
  const { colors } = useTheme();
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionLeft}>
        <Text style={styles.sectionEmoji}>{emoji}</Text>
        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>{title}</Text>
        {count != null && count > 0 && (
          <View style={[styles.sectionBadge, { backgroundColor: colors.accent }]}>
            <Text style={styles.sectionBadgeText}>{count}</Text>
          </View>
        )}
      </View>
    </View>
  );
}

function EmptyState({ t }: { t: Function }) {
  const { colors } = useTheme();
  return (
    <View style={styles.emptyState}>
      <Text style={styles.emptyIcon}>💭</Text>
      <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>{t('home.noMemories')}</Text>
      <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>{t('home.noMemoriesSubtitle')}</Text>
      <TouchableOpacity
        style={[styles.emptyButton, { backgroundColor: colors.accent }]}
        onPress={() => router.push('/capture')}
      >
        <Text style={styles.emptyButtonText}>{t('home.createFirst')}</Text>
      </TouchableOpacity>
    </View>
  );
}

export default function HomeScreen() {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const [stats, setStats] = useState<Stats | null>(null);
  const [reminders, setReminders] = useState<Reminders | null>(null);
  const [recentRecall, setRecentRecall] = useState<RecallMemory[]>([]);
  const [groups, setGroups] = useState<MemoryGroup[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const mapMemory = (m: ApiMemory): ReminderMemory => ({
    id: m.id,
    content: m.ai_summary || m.content,
    type: m.type as 'text' | 'link' | 'voice' | 'photo',
    createdAt: new Date(m.created_at),
    timeAgo: (m as any).time_ago,
  });

  const loadData = async () => {
    try {
      const [statsRes, remindersRes, recallRes] = await Promise.allSettled([
        memoriesApi.stats(),
        memoriesApi.reminders(),
        aiApi.getRecall(),
      ]);

      if (statsRes.status === 'fulfilled') setStats(statsRes.value);

      if (remindersRes.status === 'fulfilled') {
        const r = remindersRes.value;
        setReminders({
          unreviewed: (r.unreviewed || []).map(mapMemory),
          revisit: (r.revisit || []).map(mapMemory),
          on_this_day: (r.on_this_day || []).map(mapMemory),
        });
      }

      if (recallRes.status === 'fulfilled') {
        const recallItems = (recallRes.value.items || []).map(
          (item: { memory: ApiMemory; reason: string }) => ({
            id: item.memory.id,
            content: item.memory.ai_summary || item.memory.content,
            reason: item.reason,
            type: item.memory.type as 'text' | 'link' | 'voice' | 'photo',
            createdAt: new Date(item.memory.created_at),
          })
        );
        setRecentRecall(recallItems);

        // Group recall memories by topic using AI
        if (recallItems.length > 1) {
          try {
            const memoryIds = recallItems.map((m: RecallMemory) => m.id);
            const groupResult = await aiApi.groupMemories(memoryIds);
            // Backend returns groups as Array<{ title, memory_ids }>
            const rawGroups = groupResult.groups || [];
            const grouped: MemoryGroup[] = rawGroups
              .map((g: { title: string; memory_ids: string[] }) => ({
                title: g.title,
                memories: (g.memory_ids || [])
                  .map((mid: string) => recallItems.find((m: RecallMemory) => m.id === mid))
                  .filter(Boolean) as ReminderMemory[],
              }))
              .filter((g: MemoryGroup) => g.memories.length > 0);
            if (grouped.length > 0) setGroups(grouped);
          } catch {
            // Grouping is optional — fall back to ungrouped
          }
        }
      }
    } catch {
      // graceful degradation
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const hasAnyContent =
    (stats?.total ?? 0) > 0 ||
    (reminders?.unreviewed?.length ?? 0) > 0 ||
    recentRecall.length > 0;

  const streak = stats?.streak ?? 0;
  const firstName = user?.name?.split(' ')[0];
  const { colors } = useTheme();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]} edges={['top']}>
      {/* Header with greeting + streak */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View style={styles.headerTextWrap}>
            <Text style={[styles.greeting, { color: colors.textPrimary }]}>
              {t(getGreetingKey())}{firstName ? `, ${firstName}` : ''} 👋
            </Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{t('home.subtitle')}</Text>
          </View>
          {streak > 0 && (
            <View style={[styles.streakBadge, { backgroundColor: colors.streakBg, borderColor: colors.streakBorder }]}>
              <Text style={styles.streakIcon}>🔥</Text>
              <Text style={[styles.streakText, { color: colors.streakText }]}>{streak}</Text>
            </View>
          )}
        </View>
      </View>

      {/* Content */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Daily Focus Card */}
        {hasAnyContent && <FocusCard stats={stats} reminders={reminders} t={t} />}

        {/* Quick Capture Row */}
        <QuickCaptureRow t={t} />

        {!hasAnyContent && !loading ? (
          <EmptyState t={t} />
        ) : (
          <>
            {/* Unreviewed memories */}
            {reminders && reminders.unreviewed.length > 0 && (
              <View style={styles.section}>
                <SectionHeader emoji="📬" title={t('home.unreviewed')} count={reminders.unreviewed.length} />
                {reminders.unreviewed.slice(0, 3).map((m) => (
                  <MemoryCard key={m.id} memory={m} subtitle={t('home.unreviewedHint')} t={t} />
                ))}
              </View>
            )}

            {/* Grouped recall (AI-powered) */}
            {groups.length > 0 ? (
              <View style={styles.section}>
                <SectionHeader emoji="🧠" title={t('home.connectedIdeas')} />
                {groups.map((group) => (
                  <View key={group.title} style={[styles.groupCard, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
                    <View style={[styles.groupHeader, { borderBottomColor: colors.border }]}>
                      <Text style={styles.groupEmoji}>✨</Text>
                      <Text style={[styles.groupTitle, { color: colors.accent }]}>{group.title}</Text>
                      <Text style={[styles.groupCount, { color: colors.textMuted }]}>
                        {t('home.memoriesCount', { count: group.memories.length })}
                      </Text>
                    </View>
                    {group.memories.map((m) => (
                      <MemoryCard key={m.id} memory={m} t={t} />
                    ))}
                  </View>
                ))}
              </View>
            ) : recentRecall.length > 0 ? (
              <View style={styles.section}>
                <SectionHeader emoji="✨" title={t('home.recentRecall')} />
                {recentRecall.map((m) => (
                  <MemoryCard key={m.id} memory={m} subtitle={m.reason} t={t} />
                ))}
              </View>
            ) : null}

            {/* Worth revisiting */}
            {reminders && reminders.revisit.length > 0 && (
              <View style={styles.section}>
                <SectionHeader emoji="🔁" title={t('home.revisit')} count={reminders.revisit.length} />
                {reminders.revisit.slice(0, 3).map((m) => (
                  <MemoryCard key={m.id} memory={m} t={t} />
                ))}
              </View>
            )}

            {/* On this day — enhanced with time context */}
            {reminders && reminders.on_this_day.length > 0 && (
              <View style={styles.section}>
                <SectionHeader emoji="📅" title={t('home.onThisDay')} />
                {reminders.on_this_day.map((m) => (
                  <MemoryCard
                    key={m.id}
                    memory={m}
                    subtitle={m.timeAgo || formatRelative(m.createdAt, t)}
                    t={t}
                  />
                ))}
              </View>
            )}

            {/* Stats + Insights teaser at bottom */}
            {stats && (
              <>
                <StatsCard stats={stats} t={t} />
                <InsightsTeaserCard stats={stats} t={t} />
              </>
            )}
          </>
        )}
      </ScrollView>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 8 },
  headerTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  headerTextWrap: { flex: 1 },
  greeting: { fontSize: 26, fontWeight: '700', marginBottom: 4 },
  subtitle: { fontSize: 14 },

  // Streak badge
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 4,
    borderWidth: 1,
  },
  streakIcon: { fontSize: 16 },
  streakText: { fontSize: 15, fontWeight: '700' },

  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 100, paddingTop: 8 },

  // Focus card
  focusCard: {
    borderRadius: 20,
    marginBottom: 16,
    overflow: 'hidden',
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 6,
  },
  focusGradient: {
    padding: 20,
    borderRadius: 20,
  },
  focusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  focusEmoji: { fontSize: 20 },
  focusTitle: { fontSize: 14, fontWeight: '600', color: 'rgba(255,255,255,0.85)', textTransform: 'uppercase', letterSpacing: 0.5 },
  focusMessage: { fontSize: 15, color: '#FFFFFF', lineHeight: 22, marginBottom: 4 },
  focusAction: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginTop: 8,
  },
  focusActionText: { fontSize: 14, fontWeight: '600', color: '#FFFFFF' },

  // Quick capture
  quickRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  quickBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 16,
    gap: 4,
    borderWidth: 1,
  },
  quickIcon: { fontSize: 20 },
  quickLabel: { fontSize: 11, fontWeight: '500' },

  // Stats
  statsCard: {
    flexDirection: 'row',
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 16,
    marginTop: 8,
    marginBottom: 20,
    alignItems: 'center',
  },
  statItem: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 22, fontWeight: '700' },
  statLabel: { fontSize: 12, marginTop: 2 },
  statDivider: { width: 1, height: 32 },

  // Sections
  section: { marginBottom: 20 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  sectionLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionEmoji: { fontSize: 18 },
  sectionTitle: { fontSize: 16, fontWeight: '600' },
  sectionBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    marginLeft: 2,
  },
  sectionBadgeText: { fontSize: 11, fontWeight: '700', color: '#fff' },

  // Group cards
  groupCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
    marginBottom: 10,
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  groupEmoji: { fontSize: 14 },
  groupTitle: { fontSize: 14, fontWeight: '600', flex: 1 },
  groupCount: { fontSize: 12 },

  // Memory cards
  memCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginBottom: 8,
  },
  memCardRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  memCardIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  memCardIcon: { fontSize: 16 },
  memCardContent: { flex: 1 },
  memCardText: { fontSize: 15, lineHeight: 21, marginBottom: 3 },
  memCardMeta: { fontSize: 12 },
  memCardChevron: { fontSize: 20 },

  // Insights teaser
  insightsTeaser: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginBottom: 20,
    gap: 12,
  },
  insightsTeaserIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  insightsTeaserBody: { flex: 1 },
  insightsTeaserTitle: { fontSize: 14, fontWeight: '600', marginBottom: 2 },
  insightsTeaserSub: { fontSize: 12 },

  // Empty
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingTop: 40,
  },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyTitle: { fontSize: 20, fontWeight: '600', marginBottom: 8, textAlign: 'center' },
  emptySubtitle: { fontSize: 15, textAlign: 'center', lineHeight: 22, marginBottom: 24 },
  emptyButton: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 24 },
  emptyButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
});
