import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Dimensions,
  ActivityIndicator,
  Animated,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import {
  insightsApi,
  InsightsDashboard,
  WeeklyRecap,
  StreakDetails,
} from '../../services/api';
import { useTheme } from '../../constants/ThemeContext';
import {
  BarChart3,
  CalendarDays,
  Clock3,
  FileText,
  Flame,
  Mic,
  Link2,
  Image as ImageIcon,
  PieChart,
} from 'lucide-react-native';
import { ScreenHeader } from '../../components/ScreenHeader';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const HEATMAP_CELL = 12;
const HEATMAP_GAP = 3;
const SANS_FONT = Platform.select({ ios: 'System', android: 'sans-serif', default: 'System' });

const TYPE_ICON: Record<string, React.ComponentType<any>> = {
  text: FileText,
  voice: Mic,
  link: Link2,
  photo: ImageIcon,
};

function heatmapCellColor(count: number, max: number, isDark: boolean): string {
  if (count === 0) return isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)';
  const ratio = count / Math.max(max, 1);
  if (ratio < 0.25) return 'rgba(184,92,32,0.20)';
  if (ratio < 0.5) return 'rgba(184,92,32,0.45)';
  if (ratio < 0.75) return 'rgba(184,92,32,0.70)';
  return '#b85c20';
}

function formatHour(hour: number): string {
  if (hour === 0) return '12am';
  if (hour === 12) return '12pm';
  return hour < 12 ? `${hour}am` : `${hour - 12}pm`;
}

function SectionHeader({ Icon, title }: { Icon: React.ComponentType<any>; title: string }) {
  const { colors } = useTheme();
  return (
    <View style={s.sectionHeader}>
      <View style={[s.sectionIconWrap, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
        <Icon size={13} color={colors.textSecondary} strokeWidth={2.2} />
      </View>
      <Text style={[s.sectionTitle, { color: colors.textPrimary }]}>{title}</Text>
    </View>
  );
}

// ─── Weekly Recap Card ──────────────────────────────────────────────────────
function RecapCard({ recap, t }: { recap: WeeklyRecap; t: Function }) {
  const { colors } = useTheme();

  if (!recap || recap.total_memories === 0) {
    return (
      <View style={[s.recapCard, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
        <Text style={[s.recapEmpty, { color: colors.textMuted }]}>{t('insights.noRecap')}</Text>
      </View>
    );
  }

  return (
    <View style={[s.recapCard, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
      <Text style={[s.recapLabel, { color: colors.brandAccent }]}>
        {t('insights.recapLabel').toUpperCase()}
      </Text>
      {recap.recap && (
        <Text style={[s.recapText, { color: colors.textSecondary }]}>{recap.recap}</Text>
      )}
      <View style={s.recapStats}>
        <View style={s.recapStat}>
          <Text style={[s.recapStatValue, { color: colors.textPrimary }]}>{recap.total_memories}</Text>
          <Text style={[s.recapStatLabel, { color: colors.textMuted }]}>{t('insights.memories')}</Text>
        </View>
        {recap.categories_used && recap.categories_used.length > 0 && (
          <View style={s.recapStat}>
            <Text style={[s.recapStatValue, { color: colors.textPrimary }]}>{recap.categories_used.length}</Text>
            <Text style={[s.recapStatLabel, { color: colors.textMuted }]}>{t('insights.topics')}</Text>
          </View>
        )}
        {recap.by_type && (
          <View style={s.recapStat}>
            <Text style={[s.recapStatValue, { color: colors.textPrimary }]}>{Object.keys(recap.by_type).length}</Text>
            <Text style={[s.recapStatLabel, { color: colors.textMuted }]}>{t('insights.types')}</Text>
          </View>
        )}
      </View>
      {recap.highlights && recap.highlights.length > 0 && (
        <View style={[s.recapHighlights, { borderTopColor: colors.border }]}>
          <Text style={[s.recapHighlightsTitle, { color: colors.textMuted }]}>{t('insights.highlights')}</Text>
          {recap.highlights.map((h) => (
            <TouchableOpacity
              key={h.id}
              style={s.recapHighlight}
              onPress={() => router.push(`/memory/${h.id}`)}
              activeOpacity={0.7}
            >
              {(() => {
                const Icon = TYPE_ICON[h.type] || FileText;
                return <Icon size={14} color={colors.textSecondary} strokeWidth={2.5} />;
              })()}
              <Text style={[s.recapHighlightText, { color: colors.textPrimary }]} numberOfLines={1}>{h.content}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

// ─── Stats Overview ──────────────────────────────────────────────────────────
function StatsOverview({
  dashboard,
  streaks,
  t,
}: {
  dashboard: InsightsDashboard;
  streaks: StreakDetails | null;
  t: Function;
}) {
  const { colors } = useTheme();
  const growth = dashboard.growth_percentage;
  const growthPositive = growth >= 0;

  const stats = [
    { label: t('insights.totalMemories'), value: dashboard.total_memories, emoji: '📦' },
    { label: t('insights.activeDays'), value: dashboard.active_days, emoji: '📅' },
    { label: t('insights.avgPerDay'), value: dashboard.avg_per_day, emoji: '📈' },
    { label: t('insights.longestStreak'), value: streaks?.longest_streak ?? dashboard.longest_streak, emoji: '🏆' },
  ];

  return (
    <View style={s.statsGrid}>
      {stats.map((stat, i) => (
        <View key={i} style={[s.statCard, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
          <Text style={s.statEmoji}>{stat.emoji}</Text>
          <Text style={[s.statValue, { color: colors.textPrimary }]}>{stat.value}</Text>
          <Text style={[s.statLabel, { color: colors.textMuted }]}>{stat.label}</Text>
        </View>
      ))}
    </View>
  );
}

// ─── Activity Heatmap ───────────────────────────────────────────────────────
function ActivityHeatmap({
  data,
  t,
}: {
  data: Array<{ date: string; count: number }>;
  t: Function;
}) {
  const { colors, isDark } = useTheme();

  // Fill last 30 days
  const today = new Date();
  const days: Array<{ date: string; count: number }> = [];
  const dataMap = new Map(data.map((d) => [d.date, d.count]));

  for (let i = 29; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().split('T')[0];
    days.push({ date: key, count: dataMap.get(key) || 0 });
  }

  const maxCount = Math.max(...days.map((d) => d.count), 1);

  return (
    <View style={[s.heatmapCard, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
      <View style={s.heatmapGrid}>
        {days.map((d) => (
          <View
            key={d.date}
            style={[
              s.heatmapCell,
              { backgroundColor: heatmapCellColor(d.count, maxCount, isDark) },
            ]}
          />
        ))}
      </View>
      <View style={s.heatmapLegend}>
        <Text style={[s.heatmapLabelText, { color: colors.textMuted }]}>{t('insights.less')}</Text>
        {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => (
          <View
            key={i}
            style={[
              s.heatmapLegendCell,
              {
                backgroundColor: heatmapCellColor(ratio === 0 ? 0 : ratio * maxCount, maxCount, isDark),
              },
            ]}
          />
        ))}
        <Text style={[s.heatmapLabelText, { color: colors.textMuted }]}>{t('insights.more')}</Text>
      </View>
    </View>
  );
}

// ─── Category Breakdown ─────────────────────────────────────────────────────
function CategoryBreakdown({
  data,
  t,
}: {
  data: InsightsDashboard['category_breakdown'];
  t: Function;
}) {
  const { colors } = useTheme();
  const filtered = data.filter((c) => c.name);

  if (filtered.length === 0) return null;

  return (
    <View style={[s.breakdownCard, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
      {filtered.slice(0, 6).map((cat, i) => (
        <View key={cat.category_id || i} style={s.breakdownRow}>
          <View style={s.breakdownLeft}>
            <Text style={s.breakdownIcon}>{cat.icon || '📁'}</Text>
            <Text style={[s.breakdownName, { color: colors.textPrimary }]}>{cat.name}</Text>
          </View>
          <View style={s.breakdownRight}>
            <View style={[s.breakdownBar, { backgroundColor: colors.inputBg }]}>
              <View
                style={[
                  s.breakdownBarFill,
                  {
                    backgroundColor: cat.color || colors.accent,
                    width: `${Math.max(cat.percentage, 3)}%`,
                  },
                ]}
              />
            </View>
            <Text style={[s.breakdownCount, { color: colors.textMuted }]}>{cat.count}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

// ─── Type Breakdown ──────────────────────────────────────────────────────────
function TypeBreakdown({
  data,
  t,
}: {
  data: InsightsDashboard['type_breakdown'];
  t: Function;
}) {
  const { colors } = useTheme();

  if (data.length === 0) return null;

  return (
    <View style={s.typeRow}>
      {data.map((item) => (
        <View key={item.type} style={[s.typeCard, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
          {(() => {
            const Icon = TYPE_ICON[item.type] || FileText;
            return <Icon size={18} color={colors.textSecondary} strokeWidth={2.5} />;
          })()}
          <Text style={[s.typeCount, { color: colors.textPrimary }]}>{item.count}</Text>
          <Text style={[s.typePercent, { color: colors.textMuted }]}>{item.percentage}%</Text>
        </View>
      ))}
    </View>
  );
}

// ─── Hourly Distribution (Mini Bar Chart) ────────────────────────────────────
function HourlyChart({
  data,
  peakHour,
  t,
}: {
  data: Array<{ hour: number; count: number }>;
  peakHour: number;
  t: Function;
}) {
  const { colors } = useTheme();
  const maxCount = Math.max(...data.map((d) => d.count), 1);

  // Only show key hours for readability
  const keyHours = [0, 4, 8, 12, 16, 20];

  return (
    <View style={[s.hourlyCard, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
      <View style={s.hourlyInfo}>
        <Text style={[s.hourlyPeak, { color: colors.textPrimary }]}>
          ⏰ {t('insights.peakHour')}: {formatHour(peakHour)}
        </Text>
      </View>
      <View style={s.hourlyBars}>
        {data.map((d) => {
          const height = Math.max((d.count / maxCount) * 48, 2);
          const isPeak = d.hour === peakHour;
          return (
            <View key={d.hour} style={s.hourlyBarWrap}>
              <View
                style={[
                  s.hourlyBar,
                  {
                    height,
                    backgroundColor: isPeak ? colors.accent : colors.accentLight,
                  },
                ]}
              />
            </View>
          );
        })}
      </View>
      <View style={s.hourlyLabels}>
        {keyHours.map((h) => (
          <Text key={h} style={[s.hourlyLabel, { color: colors.textMuted }]}>
            {formatHour(h)}
          </Text>
        ))}
      </View>
    </View>
  );
}

// ─── Consistency Card ───────────────────────────────────────────────────────
function ConsistencyCard({ streaks, t }: { streaks: StreakDetails; t: Function }) {
  const { colors } = useTheme();
  const rate = streaks.consistency_rate;

  let message: string;
  let emoji: string;
  if (rate >= 80) { message = t('insights.consistencyExcellent'); emoji = '🌟'; }
  else if (rate >= 50) { message = t('insights.consistencyGood'); emoji = '💪'; }
  else if (rate >= 25) { message = t('insights.consistencyBuilding'); emoji = '🌱'; }
  else { message = t('insights.consistencyStart'); emoji = '🎯'; }

  return (
    <View style={[s.consistencyCard, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
      <View style={s.consistencyHeader}>
        <Text style={s.consistencyEmoji}>{emoji}</Text>
        <View style={s.consistencyInfo}>
          <Text style={[s.consistencyTitle, { color: colors.textPrimary }]}>{t('insights.consistency')}</Text>
          <Text style={[s.consistencyRate, { color: colors.accent }]}>{rate}%</Text>
        </View>
      </View>
      <View style={[s.consistencyBar, { backgroundColor: colors.inputBg }]}>
        <View
          style={[
            s.consistencyBarFill,
            { backgroundColor: colors.accent, width: `${Math.min(rate, 100)}%` },
          ]}
        />
      </View>
      <Text style={[s.consistencyMessage, { color: colors.textSecondary }]}>{message}</Text>
      <View style={s.consistencyStats}>
        <View style={s.consistencyStat}>
          <Text style={[s.consistencyStatValue, { color: colors.textPrimary }]}>{streaks.total_active_days}</Text>
          <Text style={[s.consistencyStatLabel, { color: colors.textMuted }]}>{t('insights.activeDays')}</Text>
        </View>
        <View style={s.consistencyStat}>
          <Text style={[s.consistencyStatValue, { color: colors.textPrimary }]}>{streaks.total_days_since_start}</Text>
          <Text style={[s.consistencyStatLabel, { color: colors.textMuted }]}>{t('insights.totalDays')}</Text>
        </View>
      </View>
    </View>
  );
}

// ─── Growth Badge ────────────────────────────────────────────────────────────
function GrowthBadge({ growth, t }: { growth: number; t: Function }) {
  const { colors } = useTheme();
  const positive = growth >= 0;

  return (
    <View style={[s.growthBadge, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
      <Text style={[s.growthText, { color: positive ? colors.accent : colors.textSecondary }]}>
        {positive ? '↑' : '↓'} {Math.abs(growth)}% {t('insights.vsPrevious')}
      </Text>
    </View>
  );
}

// ─── Recap Skeleton ───────────────────────────────────────────────────────────
function RecapSkeleton() {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const pulse = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.4, duration: 900, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [pulse]);

  const Bone = ({ w, h, radius = 7, mb = 0 }: { w: number | `${number}%`; h: number; radius?: number; mb?: number }) => (
    <Animated.View
      style={[
        s.skeletonBlock,
        { width: w as any, height: h, borderRadius: radius, backgroundColor: colors.accentLight, marginBottom: mb, opacity: pulse },
      ]}
    />
  );

  return (
    <View style={[s.recapOuter, { marginBottom: 12 }]}>
      <View style={[s.recapGradient, { backgroundColor: colors.accentSubtle, borderRadius: 20 }]}>
        {/* Generating label */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 }}>
          <ActivityIndicator size="small" color={colors.accent} />
          <Text style={{ fontSize: 13, fontWeight: '500', color: colors.accent, fontFamily: SANS_FONT }}>
            {t('insights.generatingInsights', '✨ Generating insights…')}
          </Text>
        </View>
        {/* Shimmer lines */}
        <Bone w="100%" h={13} mb={10} />
        <Bone w="82%" h={13} mb={10} />
        <Bone w="64%" h={13} mb={18} />
        {/* Stat placeholders */}
        <View style={{ flexDirection: 'row', gap: 20 }}>
          <View style={{ alignItems: 'center', gap: 4 }}>
            <Bone w={36} h={24} radius={6} />
            <Bone w={52} h={10} radius={5} />
          </View>
          <View style={{ alignItems: 'center', gap: 4 }}>
            <Bone w={36} h={24} radius={6} />
            <Bone w={52} h={10} radius={5} />
          </View>
        </View>
      </View>
    </View>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────
export default function InsightsScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [dashboard, setDashboard] = useState<InsightsDashboard | null>(null);
  const [recap, setRecap] = useState<WeeklyRecap | null>(null);
  const [streaks, setStreaks] = useState<StreakDetails | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  // Fast data (no LLM) shows immediately; only skeleton for the slow recap
  const [fastLoading, setFastLoading] = useState(true);
  const [recapLoading, setRecapLoading] = useState(true);
  const [periodDays, setPeriodDays] = useState(30);

  // Load fast data (dashboard + streaks) — no LLM involvement
  const loadFast = useCallback(async (days?: number) => {
    const d = days ?? periodDays;
    try {
      const [dashRes, streakRes] = await Promise.allSettled([
        insightsApi.getDashboard(d),
        insightsApi.getStreaks(),
      ]);
      if (dashRes.status === 'fulfilled') setDashboard(dashRes.value);
      if (streakRes.status === 'fulfilled') setStreaks(streakRes.value);
    } catch {
      // graceful degradation
    } finally {
      setFastLoading(false);
    }
  }, [periodDays]);

  // Load slow data (weekly recap uses LLM) — shows skeleton while waiting
  const loadRecap = useCallback(async () => {
    setRecapLoading(true);
    try {
      const result = await insightsApi.getWeeklyRecap();
      setRecap(result);
    } catch {
      setRecap(null);
    } finally {
      setRecapLoading(false);
    }
  }, []);

  const loadAll = useCallback(() => {
    loadFast();
    loadRecap();
  }, [loadFast, loadRecap]);

  useFocusEffect(
    useCallback(() => {
      setFastLoading(true);
      setRecapLoading(true);
      loadAll();
    }, [loadAll])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.allSettled([loadFast(), loadRecap()]);
    setRefreshing(false);
  };

  const periods = [
    { days: 7, label: t('insights.period7') },
    { days: 30, label: t('insights.period30') },
    { days: 90, label: t('insights.period90') },
  ];

  const screenHeader = (
    <ScreenHeader
      eyebrow={t('insights.eyebrow', {
        month: new Date().toLocaleString('default', { month: 'long' }).toUpperCase(),
        year: new Date().getFullYear(),
      })}
      title={t('insights.title')}
      titleSize={30}
      paddingHorizontal={16}
    />
  );

  if (fastLoading) {
    return (
      <SafeAreaView style={[s.container, { backgroundColor: colors.bg }]} edges={['top']}>
        {screenHeader}
        <View style={s.loadingWrap}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={[s.loadingText, { color: colors.textMuted }]}>{t('insights.loading')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[s.container, { backgroundColor: colors.bg }]} edges={['top']}>
      {/* Header */}
      {screenHeader}

      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Period selector */}
        <View style={s.periodRow}>
          {periods.map((p) => (
            <TouchableOpacity
              key={p.days}
              style={[
                s.periodChip,
                {
                  backgroundColor: periodDays === p.days ? colors.accent : colors.inputBg,
                  borderColor: periodDays === p.days ? colors.accent : colors.border,
                },
              ]}
              onPress={() => {
                if (periodDays !== p.days) {
                  setPeriodDays(p.days);
                  setFastLoading(true);
                  loadFast(p.days);
                }
              }}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  s.periodChipText,
                  { color: periodDays === p.days ? colors.buttonText : colors.textTertiary },
                ]}
              >
                {p.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Streak + Total card */}
        {(streaks || dashboard) && (
          <View style={[
            s.streakCard,
            {
              backgroundColor: 'rgba(197,106,58,0.07)',
              borderColor: 'rgba(197,106,58,0.18)',
            },
          ]}>
            <View>
              <Text style={[s.streakValue, { color: colors.brandAccent, fontFamily: 'DMSans_600SemiBold' }]}>
                🔥 {streaks?.current_streak ?? 0}
              </Text>
              <Text style={[s.streakLabel, { color: colors.brandAccent }]}>
                {t('insights.streakLabel').toUpperCase()}
              </Text>
            </View>
            <View style={s.streakRight}>
              <Text style={[s.totalValue, { color: colors.textPrimary, fontFamily: 'DMSans_600SemiBold' }]}>
                {dashboard?.total_memories ?? 0}
              </Text>
              <Text style={[s.totalLabel, { color: colors.textMuted }]}>
                {t('insights.totalLabel').toUpperCase()}
              </Text>
            </View>
          </View>
        )}

        {/* Weekly Recap — skeleton while LLM is generating */}
        {recapLoading ? (
          <RecapSkeleton />
        ) : recap ? (
          <RecapCard recap={recap} t={t} />
        ) : null}

        {dashboard && (
          <>
            {/* Growth badge */}
            {dashboard.total_memories > 0 && (
              <GrowthBadge growth={dashboard.growth_percentage} t={t} />
            )}

            {/* Stats overview */}
            <SectionHeader Icon={BarChart3} title={t('insights.overview')} />
            <StatsOverview dashboard={dashboard} streaks={streaks} t={t} />

            {/* Activity heatmap */}
            <SectionHeader Icon={CalendarDays} title={t('insights.activity')} />
            <ActivityHeatmap data={dashboard.activity_heatmap} t={t} />

            {/* Type breakdown */}
            {dashboard.type_breakdown.length > 0 && (
              <>
                <SectionHeader Icon={FileText} title={t('insights.byType')} />
                <TypeBreakdown data={dashboard.type_breakdown} t={t} />
              </>
            )}

            {/* Category breakdown */}
            {dashboard.category_breakdown.length > 0 && (
              <>
                <SectionHeader Icon={PieChart} title={t('insights.byCategory')} />
                <CategoryBreakdown data={dashboard.category_breakdown} t={t} />
              </>
            )}

            {/* Hourly distribution */}
            {dashboard.hourly_distribution.some((h) => h.count > 0) && (
              <>
                <SectionHeader Icon={Clock3} title={t('insights.whenYouCapture')} />
                <HourlyChart
                  data={dashboard.hourly_distribution}
                  peakHour={dashboard.peak_hour}
                  t={t}
                />
              </>
            )}

            {/* Consistency */}
            {streaks && (
              <>
                <SectionHeader Icon={Flame} title={t('insights.streakConsistency')} />
                <ConsistencyCard streaks={streaks} t={t} />
              </>
            )}
          </>
        )}

        {/* Empty state */}
        {(!dashboard || dashboard.total_memories === 0) && (
          <View style={s.emptyState}>
            <Text style={s.emptyIcon}>📊</Text>
            <Text style={[s.emptyTitle, { color: colors.textPrimary }]}>
              {t('insights.empty')}
            </Text>
            <Text style={[s.emptySubtitle, { color: colors.textSecondary }]}>
              {t('insights.emptySubtitle')}
            </Text>
            <TouchableOpacity
              style={[s.emptyBtn, { backgroundColor: colors.brandAccent }]}
              onPress={() => router.push('/capture')}
            >
              <Text style={s.emptyBtnText}>{t('insights.startCapturing')}</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  container: { flex: 1 },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { fontSize: 14, fontFamily: SANS_FONT },

  // Header
  header: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 8 },
  headerTitle: { fontSize: 26, fontWeight: '600', marginBottom: 4, fontFamily: SANS_FONT },
  headerSubtitle: { fontSize: 15, fontFamily: SANS_FONT },

  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingBottom: 100, paddingTop: 8 },

  // Period selector
  periodRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  periodChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  periodChipText: { fontSize: 13, fontWeight: '500', fontFamily: SANS_FONT },

  // Section header
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 16, marginBottom: 10 },
  sectionIconWrap: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: { fontSize: 14, fontWeight: '600', fontFamily: SANS_FONT },

  // Streak card
  streakCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  streakValue: {
    fontSize: 28,
    lineHeight: 32,
  },
  streakLabel: {
    fontFamily: 'DMSans_600SemiBold',
    fontSize: 9,
    letterSpacing: 0.8,
    marginTop: 3,
    opacity: 0.7,
  },
  streakRight: {
    alignItems: 'flex-end',
  },
  totalValue: {
    fontSize: 22,
    lineHeight: 26,
  },
  totalLabel: {
    fontFamily: 'DMSans_600SemiBold',
    fontSize: 9,
    letterSpacing: 0.8,
    marginTop: 3,
  },

  // Recap card
  recapOuter: { borderRadius: 20, marginBottom: 12, overflow: 'hidden' },
  recapGradient: { padding: 20, borderRadius: 20 },
  recapCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginTop: 12,
    marginBottom: 12,
  },
  recapEmpty: { fontSize: 15, textAlign: 'center', fontFamily: SANS_FONT },
  recapHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  recapEmoji: { fontSize: 20 },
  recapLabel: {
    fontFamily: 'DMSans_600SemiBold',
    fontSize: 9,
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  recapTitle: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, fontFamily: SANS_FONT },
  recapText: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 13,
    fontStyle: 'italic',
    lineHeight: 20,
    marginBottom: 14,
  },
  recapStats: { flexDirection: 'row', gap: 20 },
  recapStat: { alignItems: 'center' },
  recapStatValue: { fontSize: 20, fontWeight: '600', fontFamily: SANS_FONT },
  recapStatLabel: { fontSize: 11, marginTop: 2, fontFamily: SANS_FONT },
  recapHighlights: { marginTop: 14, paddingTop: 11, borderTopWidth: StyleSheet.hairlineWidth },
  recapHighlightsTitle: { fontSize: 11, fontWeight: '600', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5, fontFamily: SANS_FONT },
  recapHighlight: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  recapHighlightIcon: { fontSize: 14 },
  recapHighlightText: { fontSize: 13, flex: 1, fontFamily: SANS_FONT },

  // Growth badge
  growthBadge: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    marginBottom: 8,
  },
  growthText: { fontSize: 13, fontWeight: '500', fontFamily: SANS_FONT },

  // Stats grid
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  statCard: {
    width: (SCREEN_WIDTH - 50) / 2 - 5,
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    alignItems: 'center',
    gap: 4,
  },
  statEmoji: { fontSize: 22 },
  statValue: { fontSize: 24, fontWeight: '600', fontFamily: SANS_FONT },
  statLabel: { fontSize: 11, textAlign: 'center', fontFamily: SANS_FONT },

  // Heatmap
  heatmapCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
  },
  heatmapGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: HEATMAP_GAP,
  },
  heatmapCell: {
    width: HEATMAP_CELL,
    height: HEATMAP_CELL,
    borderRadius: 3,
  },
  heatmapLegend: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
    marginTop: 10,
  },
  heatmapLegendCell: {
    width: 10,
    height: 10,
    borderRadius: 2,
  },
  heatmapLabelText: { fontSize: 10, fontFamily: SANS_FONT },

  // Category breakdown
  breakdownCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
  },
  breakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  breakdownLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  breakdownIcon: { fontSize: 16 },
  breakdownName: { fontSize: 14, fontWeight: '400', fontFamily: SANS_FONT },
  breakdownRight: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1.2 },
  breakdownBar: { flex: 1, height: 6, borderRadius: 3, overflow: 'hidden' },
  breakdownBarFill: { height: '100%', borderRadius: 3 },
  breakdownCount: { fontSize: 12, fontWeight: '500', minWidth: 24, textAlign: 'right', fontFamily: SANS_FONT },

  // Type breakdown
  typeRow: { flexDirection: 'row', gap: 8 },
  typeCard: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    alignItems: 'center',
    gap: 4,
  },
  typeIcon: { fontSize: 20 },
  typeCount: { fontSize: 18, fontWeight: '600', fontFamily: SANS_FONT },
  typePercent: { fontSize: 11, fontFamily: SANS_FONT },

  // Hourly chart
  hourlyCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
  },
  hourlyInfo: { marginBottom: 10 },
  hourlyPeak: { fontSize: 14, fontWeight: '500', fontFamily: SANS_FONT },
  hourlyBars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 50,
    gap: 1,
  },
  hourlyBarWrap: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  hourlyBar: { width: '80%', borderRadius: 2 },
  hourlyLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  hourlyLabel: { fontSize: 10, fontFamily: SANS_FONT },

  // Consistency
  consistencyCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
  },
  consistencyHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  consistencyEmoji: { fontSize: 28 },
  consistencyInfo: {},
  consistencyTitle: { fontSize: 14, fontWeight: '600', fontFamily: SANS_FONT },
  consistencyRate: { fontSize: 24, fontWeight: '600', fontFamily: SANS_FONT },
  consistencyBar: { height: 8, borderRadius: 4, overflow: 'hidden', marginBottom: 10 },
  consistencyBarFill: { height: '100%', borderRadius: 4 },
  consistencyMessage: { fontSize: 14, lineHeight: 21, marginBottom: 12, fontFamily: SANS_FONT },
  consistencyStats: { flexDirection: 'row', gap: 20 },
  consistencyStat: { alignItems: 'center' },
  consistencyStatValue: { fontSize: 18, fontWeight: '600', fontFamily: SANS_FONT },
  consistencyStatLabel: { fontSize: 11, marginTop: 2, fontFamily: SANS_FONT },

  // Empty state
  emptyState: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 32 },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyTitle: { fontSize: 20, fontWeight: '600', marginBottom: 8, textAlign: 'center', fontFamily: SANS_FONT },
  emptySubtitle: { fontSize: 14, textAlign: 'center', lineHeight: 21, marginBottom: 24, fontFamily: SANS_FONT },
  emptyBtn: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 24 },
  emptyBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600', fontFamily: SANS_FONT },

  // Skeleton
  skeletonBlock: { opacity: 0.5 },
});
