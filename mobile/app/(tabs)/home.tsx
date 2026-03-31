import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Pressable,
  RefreshControl,
  ActivityIndicator,
  Image as RNImage,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { aiApi, memoriesApi, Memory as ApiMemory } from '../../services/api';
import { useRecallBadgeStore } from '../../store/recallBadgeStore';
import { useTheme, type ThemeColors } from '../../constants/ThemeContext';
import { BrandMark } from '../../components/BrandMark';
import { ScreenHeader } from '../../components/ScreenHeader';
import { CapturePrompt } from '../../components/CapturePrompt';
import { MemoryCard as SharedMemoryCard, type MemoryCardMemory } from '../../components/MemoryCard';
import {
  ChevronRight,
  FileText,
  Mic,
  Link2,
  Image as ImageIcon,
  Sparkles,
  Inbox,
  RotateCcw,
  Brain,
  Flame,
  Plus,
  ArrowRight,
} from 'lucide-react-native';

const SANS_FONT = Platform.select({ ios: 'System', android: 'sans-serif', default: 'System' });

function getGreeting(t: (key: string) => string): { eyebrow: string; title: string } {
  const hour = new Date().getHours();
  if (hour < 12) return { eyebrow: t('home.greetingMorning'), title: t('home.titleMorning') };
  if (hour < 17) return { eyebrow: t('home.greetingAfternoon'), title: t('home.titleAfternoon') };
  return { eyebrow: t('home.greetingEvening'), title: t('home.titleEvening') };
}

interface RecallMemory {
  id: string;
  content: string;
  reason: string;
  type: 'text' | 'link' | 'voice' | 'photo';
  createdAt: Date;
  imageUrl?: string;
  thumbnailUrl?: string;
  sourceUrl?: string;
}

interface ReminderMemory {
  id: string;
  content: string;
  type: 'text' | 'link' | 'voice' | 'photo';
  createdAt: Date;
  timeAgo?: string;
  imageUrl?: string;
  thumbnailUrl?: string;
  sourceUrl?: string;
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

type MemoryType = ReminderMemory['type'];

const TYPE_META: Record<MemoryType, { icon: typeof FileText; bg: keyof ThemeColors }> = {
  text: { icon: FileText, bg: 'typeBgText' },
  voice: { icon: Mic, bg: 'typeBgVoice' },
  link: { icon: Link2, bg: 'typeBgLink' },
  photo: { icon: ImageIcon, bg: 'typeBgPhoto' },
};

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

function isRenderableMediaUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const url = value.trim();
  return /^(https?:\/\/|file:\/\/|content:\/\/|data:image\/|\/)/i.test(url);
}

function pickPreviewUrl(memory: ApiMemory): string | undefined {
  const metadata = (memory.metadata as Record<string, unknown> | undefined) ?? {};
  const candidates = [
    metadata.thumbnail_url,
    metadata.preview_image_url,
    metadata.preview_image,
    memory.image_url,
    metadata.image_url,
    metadata.og_image,
    metadata.favicon_url,
  ];

  const firstValid = candidates.find((value) => isRenderableMediaUrl(value));
  return firstValid as string | undefined;
}

function pickSourceUrl(memory: ApiMemory): string | undefined {
  const metadata = (memory.metadata as Record<string, unknown> | undefined) ?? {};
  const candidates = [
    metadata.original_url,
    metadata.source_url,
    metadata.canonical_url,
    memory.content,
  ];

  const firstValid = candidates.find(
    (value) => typeof value === 'string' && /^https?:\/\//i.test(value)
  );
  return firstValid as string | undefined;
}

function getDomainFromUrl(sourceUrl?: string): string | undefined {
  if (!sourceUrl) return undefined;
  try {
    return new URL(sourceUrl).hostname.replace(/^www\./i, '');
  } catch {
    return undefined;
  }
}

function getLinkFallbackThumbnail(sourceUrl?: string): string | undefined {
  if (!sourceUrl) return undefined;
  const encoded = encodeURIComponent(sourceUrl);
  return `https://www.google.com/s2/favicons?sz=128&domain_url=${encoded}`;
}

function SmartThumbnail({
  uri,
  type,
  style,
  accessibilityLabel,
}: {
  uri: string;
  type: MemoryType;
  style: object;
  accessibilityLabel?: string;
}) {
  const { colors } = useTheme();
  const [resizeMode, setResizeMode] = useState<'cover' | 'contain'>(type === 'link' ? 'contain' : 'cover');

  return (
    <RNImage
      source={{ uri }}
      style={[style, resizeMode === 'contain' && { backgroundColor: colors.inputBg }]}
      resizeMode={resizeMode}
      accessibilityLabel={accessibilityLabel}
      onLoad={(event) => {
        const source = (event.nativeEvent as any)?.source;
        const width = Number(source?.width ?? 0);
        const height = Number(source?.height ?? 0);
        if (!width || !height) return;

        if (type === 'photo') {
          setResizeMode('cover');
          return;
        }

        const ratio = width / height;
        setResizeMode(ratio > 1.9 || ratio < 0.62 ? 'contain' : 'cover');
      }}
    />
  );
}

// ─── Loading skeleton for cards ──────────────────────────────────────────────
function SkeletonCard() {
  const { colors } = useTheme();
  return (
    <View style={[styles.memCard, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
      <View style={styles.memCardRow}>
        <View style={[styles.memCardIconWrap, { backgroundColor: colors.inputBg }]} />
        <View style={styles.memCardContent}>
          <View style={{ width: '80%', height: 14, backgroundColor: colors.inputBg, borderRadius: 4, marginBottom: 6 }} />
          <View style={{ width: '40%', height: 11, backgroundColor: colors.inputBg, borderRadius: 4 }} />
        </View>
      </View>
    </View>
  );
}

// ─── Focus card: smart daily insight ──────────────────────────────────────────
function FocusCard({
  stats,
  reminders,
  t,
  colors,
}: {
  stats: Stats | null;
  reminders: Reminders | null;
  t: Function;
  colors: ThemeColors;
}) {
  const unreviewedCount = reminders?.unreviewed?.length ?? 0;
  const revisitCount = reminders?.revisit?.length ?? 0;
  const streak = stats?.streak ?? 0;
  const todayCount = stats?.today ?? 0;

  let message: string;
  let actionLabel: string | null = null;
  let actionRoute: string | null = null;
  let Icon = Sparkles;

  if (todayCount >= 3) {
    message = t('home.focusGreat', { count: todayCount });
    Icon = Sparkles;
  } else if (unreviewedCount > 0) {
    message = t('home.focusUnreviewed', { count: unreviewedCount });
    actionLabel = t('home.seeAll');
    actionRoute = '/(tabs)/library';
    Icon = Inbox;
  } else if (revisitCount > 0) {
    message = t('home.focusRevisit', { count: revisitCount });
    actionLabel = t('home.seeAll');
    actionRoute = '/(tabs)/recall';
    Icon = RotateCcw;
  } else if (streak >= 3) {
    message = t('home.focusStreak', { count: streak });
    Icon = Flame;
  } else {
    message = t('home.focusKeepGoing');
    actionLabel = t('home.quickCapture');
    actionRoute = '/capture';
    Icon = Plus;
  }

  const highlights = [
    { key: 'saved', label: t('home.statsTotal'), value: stats?.total ?? 0 },
    { key: 'streak', label: t('home.statsStreak'), value: streak },
  ];

  return (
    <View style={[styles.focusCard, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
      <View style={styles.focusSurface}>
        <View style={styles.focusHeader}>
          <View style={[styles.focusIconWrap, { borderColor: colors.brandAccent }]}>
            <BrandMark size={24} backgroundColor={colors.brandAccent} foregroundColor="#FFF8F2" />
          </View>
          <Text style={[styles.focusTitle, { color: colors.textSecondary }]}>{t('home.focusTitle')}</Text>
        </View>
        <Text style={[styles.focusMessage, { color: colors.textPrimary }]}>{message}</Text>
        <View style={styles.focusHighlightsRow}>
          {highlights.map((item) => (
            <View key={item.key} style={[styles.focusHighlightTile, { backgroundColor: colors.inputBg }]}>
              <Text style={[styles.focusHighlightValue, { color: colors.textPrimary }]}>{item.value}</Text>
              <Text style={[styles.focusHighlightLabel, { color: colors.textMuted }]} numberOfLines={1}>{item.label}</Text>
            </View>
          ))}
        </View>
        {actionRoute && actionLabel && (
          <Pressable
            style={({ pressed }) => [
              styles.focusAction,
              { backgroundColor: colors.brandAccent, borderColor: colors.brandAccentLight },
              pressed && { opacity: 0.8, transform: [{ scale: 0.98 }] }
            ]}
            onPress={() => router.push(actionRoute as any)}
            accessibilityRole="button"
            accessibilityLabel={`${actionLabel}. ${message}`}
            accessibilityHint={t('common.tapToOpen')}
          >
            <Text style={styles.focusActionText}>{actionLabel}</Text>
            <ArrowRight size={14} color="#FFFFFF" strokeWidth={2.5} />
          </Pressable>
        )}
      </View>
    </View>
  );
}

// ─── Quick capture buttons ────────────────────────────────────────────────────
function QuickCaptureRow({ t }: { t: Function }) {
  const actions = [
    {
      key: 'text',
      icon: FileText,
      label: t('home.captureText'),
      hint: t('home.captureTextHint'),
    },
    {
      key: 'voice',
      icon: Mic,
      label: t('home.captureVoice'),
      hint: t('home.captureVoiceHint'),
    },
    {
      key: 'link',
      icon: Link2,
      label: t('home.captureLink'),
      hint: t('home.captureLinkHint'),
    },
    {
      key: 'photo',
      icon: ImageIcon,
      label: t('home.capturePhoto'),
      hint: t('home.capturePhotoHint'),
    },
  ];
  const { colors } = useTheme();

  return (
    <View style={styles.quickRow}>
      {actions.map((a) => {
        const Icon = a.icon;
        return (
          <Pressable
            key={a.key}
            onPress={() => router.push({ pathname: '/capture', params: { mode: a.key } })}
            accessibilityRole="button"
            accessibilityLabel={`${t('home.quickCapture')}: ${a.label}`}
            accessibilityHint={a.hint}
            style={styles.quickPressable}
          >
            {({ pressed }) => (
              <View
                style={[
                  styles.quickBtn,
                  { backgroundColor: colors.cardBg, borderColor: colors.border },
                  pressed && styles.quickBtnPressed,
                ]}
              >
                <View style={[styles.quickIconWrap, { borderColor: colors.borderMed }]}>
                  <Icon size={18} color={colors.textSecondary} strokeWidth={2.4} />
                </View>
              </View>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

function ConnectedIdeaCard({ group, t }: { group: MemoryGroup; t: Function }) {
  const { colors } = useTheme();
  const previewMemories = group.memories.slice(0, 3);

  return (
    <View style={[styles.connectedCard, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
      <View style={styles.connectedHeader}>
        <View style={styles.connectedTitleWrap}>
          <Text style={[styles.connectedTitle, { color: colors.textPrimary }]} numberOfLines={1}>{group.title}</Text>
        </View>
        <Text style={[styles.connectedCountText, { color: colors.textMuted }]}>
          {t('home.memoriesCount', { count: group.memories.length })}
        </Text>
      </View>

      <View style={styles.connectedList}>
        {previewMemories.map((m) => {
          const meta = TYPE_META[m.type];
          const Icon = meta.icon;
          const thumbUri = m.thumbnailUrl || m.imageUrl;
          const hasPreviewThumb = (m.type === 'photo' || m.type === 'link') && !!thumbUri;
          const metaLabel = m.type === 'link' ? getDomainFromUrl(m.sourceUrl) : formatRelative(m.createdAt, t);

          return (
            <Pressable
              key={m.id}
              style={({ pressed }) => [
                styles.connectedMemoryRow,
                { backgroundColor: colors.inputBg, borderColor: colors.border },
                pressed && { opacity: 0.85 },
              ]}
              onPress={() => router.push(`/memory/${m.id}`)}
              accessibilityRole="button"
              accessibilityLabel={`${t('home.connectedIdeas')}: ${m.content}`}
              accessibilityHint={t('common.tapToOpen')}
            >
              {hasPreviewThumb ? (
                <SmartThumbnail uri={thumbUri!} type={m.type} style={styles.connectedThumb} />
              ) : (
                <View style={[styles.connectedIconWrap, { borderColor: colors.textMuted }]}>
                  <Icon size={14} color={colors.textPrimary} strokeWidth={2.4} />
                </View>
              )}
              <View style={styles.connectedMemoryCopy}>
                <Text style={[styles.connectedMemoryText, { color: colors.textPrimary }]} numberOfLines={1}>{m.content}</Text>
                {metaLabel ? (
                  <Text style={[styles.connectedMemoryMeta, { color: colors.textMuted }]} numberOfLines={1}>{metaLabel}</Text>
                ) : null}
              </View>
              <ArrowRight size={13} color={colors.textMuted} strokeWidth={2.6} />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function RevisitCard({ memory, t }: { memory: ReminderMemory; t: Function }) {
  const { colors } = useTheme();
  const meta = TYPE_META[memory.type];
  const Icon = meta.icon;
  const thumbUri = memory.thumbnailUrl || memory.imageUrl;
  const hasPreviewThumb = (memory.type === 'photo' || memory.type === 'link') && !!thumbUri;
  const metaLabel = memory.type === 'link'
    ? getDomainFromUrl(memory.sourceUrl)
    : formatRelative(memory.createdAt, t);

  return (
    <View style={[styles.revisitCardGradient, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
      <Pressable
        style={({ pressed }) => [styles.revisitCardInner, pressed && { opacity: 0.86 }]}
        onPress={() => router.push(`/memory/${memory.id}`)}
        accessibilityRole="button"
        accessibilityLabel={`${t('home.revisit')}: ${memory.content}`}
        accessibilityHint={t('common.tapToOpen')}
      >
        <View style={styles.revisitMemoryRow}>
          {hasPreviewThumb ? (
            <SmartThumbnail uri={thumbUri!} type={memory.type} style={styles.revisitThumb} />
          ) : (
            <View style={[styles.revisitIconWrap, { borderColor: colors.textMuted }]}>
              <Icon size={15} color={colors.textPrimary} strokeWidth={2.4} />
            </View>
          )}
          <View style={styles.revisitMemoryCopy}>
            <Text style={[styles.revisitMemoryText, { color: colors.textPrimary }]} numberOfLines={2}>{memory.content}</Text>
            {metaLabel ? (
              <Text style={[styles.revisitMemoryMeta, { color: colors.textMuted }]} numberOfLines={1}>{metaLabel}</Text>
            ) : null}
          </View>
          <ChevronRight size={16} color={colors.textMuted} strokeWidth={2.4} />
        </View>
      </Pressable>
    </View>
  );
}

function SectionHeader({
  icon,
  title,
  count,
  actionLabel,
  onAction,
}: {
  icon: React.ReactNode;
  title: string;
  count?: number;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionLeft}>
        <View style={[styles.sectionIconWrap, { borderColor: colors.textMuted }]}>{icon}</View>
        <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>{title}</Text>
        {count != null && count > 0 && (
          <Text style={[styles.sectionBadgeText, { color: colors.textMuted }]}>({count})</Text>
        )}
      </View>
      {actionLabel && onAction ? (
        <Pressable
          onPress={onAction}
          style={[styles.sectionAction, { borderColor: colors.border, backgroundColor: colors.cardBg }]}
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
        >
          <Text style={[styles.sectionActionText, { color: colors.textSecondary }]}>{actionLabel}</Text>
          <ChevronRight size={13} color={colors.textSecondary} strokeWidth={2.3} />
        </Pressable>
      ) : null}
    </View>
  );
}

function EmptyState({ t }: { t: Function }) {
  const { colors } = useTheme();
  return (
    <View style={styles.emptyState}>
      <View style={[styles.emptyIconWrap, { borderColor: colors.textMuted }]}>
        <Brain size={32} color={colors.accent} strokeWidth={2.5} />
      </View>
      <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>{t('home.noMemories')}</Text>
      <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>{t('home.noMemoriesSubtitle')}</Text>
      <Text style={[styles.emptyHint, { color: colors.textMuted }]}>{t('home.emptyStateHint')}</Text>
      <TouchableOpacity
        style={[styles.emptyButton, { backgroundColor: colors.accent }]}
        onPress={() => router.push('/capture')}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel={t('home.createFirst')}
        accessibilityHint={t('home.createFirstHint')}
      >
        <Plus size={18} color="#FFFFFF" strokeWidth={2.5} style={{ marginRight: 6 }} />
        <Text style={styles.emptyButtonText}>{t('home.createFirst')}</Text>
      </TouchableOpacity>
    </View>
  );
}

function RecallBanner({
  count,
  topTopic,
  onPress,
  colors,
}: {
  count: number;
  topTopic: string;
  onPress: () => void;
  colors: ThemeColors;
}) {
  if (count === 0) return null;
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85}>
      <LinearGradient
        colors={['#FFF3E8', '#FFE5CB']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.recallBanner}
      >
        <View style={styles.recallBannerTop}>
          <Text style={[styles.recallBannerLabel, { color: colors.accent }]}>
            🔔 Nhắc lại hôm nay
          </Text>
          <View style={[styles.recallBadge, { backgroundColor: colors.badgeRed }]}>
            <Text style={styles.recallBadgeText}>{count} mới</Text>
          </View>
        </View>
        <Text style={[styles.recallBannerTitle, { color: colors.textPrimary }]}>
          {topTopic}
        </Text>
        <Text style={[styles.recallBannerCta, { color: colors.accent }]}>
          Xem ngay →
        </Text>
      </LinearGradient>
    </TouchableOpacity>
  );
}

export default function HomeScreen() {
  const { t } = useTranslation();
  const [stats, setStats] = useState<Stats | null>(null);
  const [reminders, setReminders] = useState<Reminders | null>(null);
  const [recentRecall, setRecentRecall] = useState<RecallMemory[]>([]);
  const [groups, setGroups] = useState<MemoryGroup[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const setRecallBadgeCount = useRecallBadgeStore((s) => s.setCount);
  const recallCount = useRecallBadgeStore((s) => s.count);
  const [recallTopTopic, setRecallTopTopic] = useState('Bạn có ký ức chờ nhớ lại');

  const mapMemory = (m: ApiMemory): ReminderMemory => {
    const sourceUrl = m.type === 'link' ? pickSourceUrl(m) : undefined;
    const previewUrl = pickPreviewUrl(m);
    const metadata = (m.metadata as Record<string, unknown> | undefined) ?? {};
    const imageUrl = isRenderableMediaUrl(m.image_url)
      ? m.image_url
      : isRenderableMediaUrl(metadata.image_url)
        ? (metadata.image_url as string)
        : undefined;

    return {
      id: m.id,
      content: m.ai_summary || m.content,
      type: m.type as 'text' | 'link' | 'voice' | 'photo',
      createdAt: new Date(m.created_at),
      timeAgo: (m as any).time_ago,
      imageUrl,
      thumbnailUrl: previewUrl || imageUrl || (m.type === 'link' ? getLinkFallbackThumbnail(sourceUrl) : undefined),
      sourceUrl,
    };
  };

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
          (item: { memory: ApiMemory; reason: string }) => {
            const sourceUrl = item.memory.type === 'link' ? pickSourceUrl(item.memory) : undefined;
            const previewUrl = pickPreviewUrl(item.memory);
            const metadata = (item.memory.metadata as Record<string, unknown> | undefined) ?? {};
            const imageUrl = isRenderableMediaUrl(item.memory.image_url)
              ? item.memory.image_url
              : isRenderableMediaUrl(metadata.image_url)
                ? (metadata.image_url as string)
                : undefined;

            return {
              id: item.memory.id,
              content: item.memory.ai_summary || item.memory.content,
              reason: item.reason,
              type: item.memory.type as 'text' | 'link' | 'voice' | 'photo',
              createdAt: new Date(item.memory.created_at),
              imageUrl,
              thumbnailUrl: previewUrl || imageUrl || (item.memory.type === 'link' ? getLinkFallbackThumbnail(sourceUrl) : undefined),
              sourceUrl,
            };
          }
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

  useEffect(() => {
    aiApi.getRadar(6).then((res) => {
      const items = res.items ?? [];
      setRecallBadgeCount(items.length);
      const first = items[0];
      if (first) {
        const preview = first.memory.ai_summary ?? first.memory.content;
        setRecallTopTopic(preview.length > 50 ? preview.slice(0, 50) + '…' : preview);
      }
    }).catch(() => undefined);
  }, [setRecallBadgeCount]);

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
  const { colors } = useTheme();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]} edges={['top']}>
      {/* ── Header ── */}
      {(() => {
        const { eyebrow, title } = getGreeting(t);
        return (
          <View style={[styles.headerWrap, { borderBottomColor: colors.border }]}>
            <ScreenHeader
              eyebrow={eyebrow}
              title={title}
              titleSize={30}
              paddingHorizontal={16}
            />
            <View style={{ paddingHorizontal: 16, paddingBottom: 14 }}>
              <CapturePrompt />
            </View>
          </View>
        );
      })()}

      {/* Content */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Loading State */}
        {loading && (
          <View style={styles.loadingContainer}>
            <View style={{ marginVertical: 16 }}>
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </View>
          </View>
        )}

        {/* Loaded Content */}
        {!loading && (
          <>
            {/* Daily Focus Card */}
            {hasAnyContent && <FocusCard stats={stats} reminders={reminders} t={t} colors={colors} />}

            {/* Quick Capture Row */}
            <SectionHeader
              icon={<Plus size={14} color={colors.textSecondary} strokeWidth={2.5} />}
              title={t('home.quickCapture')}
            />
            <QuickCaptureRow t={t} />

            {!hasAnyContent ? (
              <EmptyState t={t} />
            ) : (
              <>
                {/* Unreviewed memories */}
                {reminders && reminders.unreviewed.length > 0 && (
                  <View style={styles.section}>
                    <SectionHeader
                      icon={<Inbox size={14} color={colors.textSecondary} strokeWidth={2.3} />}
                      title={t('home.sectionUnreviewed')}
                      count={reminders.unreviewed.length}
                      actionLabel={t('home.seeAll')}
                      onAction={() => router.push('/(tabs)/library')}
                    />
                    {reminders.unreviewed.slice(0, 2).map((m) => (
                      <SharedMemoryCard
                        key={m.id}
                        memory={{ id: m.id, content: m.content, type: m.type, createdAt: m.createdAt, imageUrl: m.imageUrl, thumbnailUrl: m.thumbnailUrl, sourceUrl: m.sourceUrl }}
                        timeAgo={t('home.unreviewedHint')}
                        onPress={() => router.push(`/memory/${m.id}`)}
                      />
                    ))}
                  </View>
                )}

                {/* Grouped recall (AI-powered) */}
                {groups.length > 0 ? (
                  <View style={styles.section}>
                    <SectionHeader
                      icon={<Brain size={14} color={colors.textSecondary} strokeWidth={2.3} />}
                      title={t('home.connectedIdeas')}
                    />
                    {groups.map((group) => (
                      <ConnectedIdeaCard key={group.title} group={group} t={t} />
                    ))}
                  </View>
                ) : recentRecall.length > 0 ? (
                  <View style={styles.section}>
                    <SectionHeader
                      icon={<Sparkles size={14} color={colors.textSecondary} strokeWidth={2.3} />}
                      title={t('home.sectionRecalled')}
                    />
                    {recentRecall.slice(0, 2).map((m) => (
                      <SharedMemoryCard
                        key={m.id}
                        memory={{ id: m.id, content: m.content, type: m.type, createdAt: m.createdAt, imageUrl: m.imageUrl, thumbnailUrl: m.thumbnailUrl, sourceUrl: m.sourceUrl }}
                        tag={m.reason ? t('home.recallReason') : undefined}
                        timeAgo={formatRelative(m.createdAt, t)}
                        onPress={() => router.push(`/memory/${m.id}`)}
                      />
                    ))}
                  </View>
                ) : null}

                {/* Worth revisiting */}
                {reminders && reminders.revisit.length > 0 && (
                  <View style={styles.section}>
                    <SectionHeader
                      icon={<RotateCcw size={14} color={colors.textSecondary} strokeWidth={2.3} />}
                      title={t('home.revisit')}
                      count={reminders.revisit.length}
                      actionLabel={t('home.seeAll')}
                      onAction={() => router.push('/(tabs)/recall')}
                    />
                    {reminders.revisit.slice(0, 2).map((m) => (
                      <SharedMemoryCard
                        key={m.id}
                        memory={{ id: m.id, content: m.content, type: m.type, createdAt: m.createdAt, imageUrl: m.imageUrl, thumbnailUrl: m.thumbnailUrl, sourceUrl: m.sourceUrl }}
                        timeAgo={formatRelative(m.createdAt, t)}
                        onPress={() => router.push(`/memory/${m.id}`)}
                      />
                    ))}
                  </View>
                )}

                {/* On this day */}
                {reminders && reminders.on_this_day.length > 0 && (
                  <View style={styles.section}>
                    <SectionHeader
                      icon={<RotateCcw size={14} color={colors.textSecondary} strokeWidth={2.3} />}
                      title={t('home.sectionOnThisDay')}
                      count={reminders.on_this_day.length}
                    />
                    {reminders.on_this_day.slice(0, 2).map((m) => (
                      <SharedMemoryCard
                        key={m.id}
                        memory={{ id: m.id, content: m.content, type: m.type, createdAt: m.createdAt, imageUrl: m.imageUrl, thumbnailUrl: m.thumbnailUrl, sourceUrl: m.sourceUrl }}
                        timeAgo={formatRelative(m.createdAt, t)}
                        onPress={() => router.push(`/memory/${m.id}`)}
                      />
                    ))}
                  </View>
                )}
              </>
            )}

            {/* ── Stats row ── */}
            <View style={styles.statsRow}>
              <View style={[styles.statPill, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
                <Text style={[styles.statVal, { color: colors.textPrimary }]}>
                  {stats?.this_week ?? 0}
                </Text>
                <Text style={[styles.statLabel, { color: colors.textMuted }]}>tuần này</Text>
              </View>
              <View style={[styles.statPill, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
                <Text style={[styles.statVal, { color: colors.textPrimary }]}>
                  {stats?.streak ?? 0}🔥
                </Text>
                <Text style={[styles.statLabel, { color: colors.textMuted }]}>streak</Text>
              </View>
              <TouchableOpacity
                style={[styles.statPill, { backgroundColor: colors.accentLight, borderColor: colors.recallBannerBorder }]}
                onPress={() => router.push('/(tabs)/recall')}
                activeOpacity={0.7}
              >
                <Text style={[styles.statVal, { color: colors.accent }]}>{recallCount}</Text>
                <Text style={[styles.statLabel, { color: colors.accent }]}>nhắc mới</Text>
              </TouchableOpacity>
            </View>

            {/* ── Recall Banner ── */}
            <RecallBanner
              count={recallCount}
              topTopic={recallTopTopic}
              onPress={() => router.push('/(tabs)/recall')}
              colors={colors}
            />
          </>
        )}
      </ScrollView>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerWrap: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },

  // Section label (uppercase caps style)
  sectionLabel: {
    fontFamily: 'DMSans_600SemiBold',
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 10,
    paddingHorizontal: 16,
    marginTop: 16,
  },

  // Stats row — 3-pill layout
  statsRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  statPill: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 10,
    alignItems: 'center',
  },
  statVal: {
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 22,
    fontFamily: SANS_FONT,
  },
  statLabel: {
    fontSize: 10,
    marginTop: 2,
    fontFamily: SANS_FONT,
  },
  recallBanner: {
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1.5,
    borderColor: '#F0C89A',
  },
  recallBannerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  recallBannerLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    fontFamily: SANS_FONT,
  },
  recallBadge: {
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  recallBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
    fontFamily: SANS_FONT,
  },
  recallBannerTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 6,
    lineHeight: 20,
    fontFamily: SANS_FONT,
  },
  recallBannerCta: {
    fontSize: 12,
    fontWeight: '600',
    fontFamily: SANS_FONT,
  },

  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingBottom: 120, paddingTop: 12 },
  loadingContainer: { paddingTop: 8 },

  // Focus card
  focusCard: {
    borderRadius: 18,
    marginBottom: 12,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.01,
    shadowRadius: 6,
    elevation: 0,
  },
  focusSurface: {
    padding: 16,
    borderRadius: 18,
  },
  focusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  focusIconWrap: {
    width: 26,
    height: 26,
    borderRadius: 9,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  focusTitle: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.2,
    fontFamily: SANS_FONT,
  },
  focusMessage: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 8,
    fontWeight: '400',
    fontFamily: SANS_FONT,
  },
  focusHighlightsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  focusHighlightTile: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  focusHighlightValue: {
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 18,
    fontFamily: SANS_FONT,
  },
  focusHighlightLabel: {
    fontSize: 10,
    marginTop: 3,
    fontWeight: '600',
    fontFamily: SANS_FONT,
  },
  focusAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    marginTop: 2,
  },
  focusActionText: { fontSize: 13, fontWeight: '600', color: '#FFFFFF', fontFamily: SANS_FONT },

  // Quick capture - IMPROVED: Better touch feedback and spacing
  quickRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  quickPressable: {
    flex: 1,
  },
  quickBtn: {
    minHeight: 54,
    paddingHorizontal: 0,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.01,
    shadowRadius: 6,
    elevation: 0,
  },
  quickBtnPressed: {
    transform: [{ scale: 0.98 }],
    opacity: 0.95,
  },
  quickIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Sections
  section: { marginBottom: 14 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  sectionLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionIconWrap: {
    width: 24,
    height: 24,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: { fontSize: 15, fontWeight: '600', fontFamily: SANS_FONT },
  sectionBadgeText: { fontSize: 12, fontWeight: '500', fontFamily: SANS_FONT },
  sectionAction: {
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 5,
    paddingHorizontal: 9,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  sectionActionText: {
    fontSize: 12,
    fontWeight: '600',
    fontFamily: SANS_FONT,
  },

  // Group cards
  groupCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    marginBottom: 8,
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  groupTitle: { fontSize: 14, fontWeight: '600', flex: 1 },
  groupCount: { fontSize: 11 },

  // Connected ideas redesign
  connectedCard: {
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 12,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.01,
    shadowRadius: 6,
    elevation: 0,
  },
  connectedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  connectedTitleWrap: {
    flex: 1,
  },
  connectedTitle: {
    fontSize: 15,
    fontWeight: '600',
    fontFamily: SANS_FONT,
  },
  connectedCountText: {
    fontSize: 11,
    fontWeight: '600',
    fontFamily: SANS_FONT,
  },
  connectedList: {
    gap: 10,
  },
  connectedMemoryRow: {
    minHeight: 52,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 10,
  },
  connectedIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 9,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  connectedThumb: {
    width: 30,
    height: 30,
    borderRadius: 9,
  },
  connectedMemoryText: {
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '400',
    fontFamily: SANS_FONT,
  },
  connectedMemoryCopy: {
    flex: 1,
  },
  connectedMemoryMeta: {
    fontSize: 11,
    marginTop: 2,
    fontWeight: '500',
    fontFamily: SANS_FONT,
  },

  // Worth revisiting redesign
  revisitCardGradient: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 10,
  },
  revisitCardInner: {
    borderRadius: 15,
    minHeight: 82,
    paddingHorizontal: 12,
    paddingVertical: 11,
    justifyContent: 'center',
  },
  revisitMemoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  revisitIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  revisitThumb: {
    width: 34,
    height: 34,
    borderRadius: 10,
  },
  revisitMemoryText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '400',
    fontFamily: SANS_FONT,
  },
  revisitMemoryCopy: {
    flex: 1,
  },
  revisitMemoryMeta: {
    fontSize: 11,
    marginTop: 2,
    fontWeight: '500',
    fontFamily: SANS_FONT,
  },

  // Memory cards - IMPROVED: Larger touch targets and better hierarchy
  memCard: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 10,
    minHeight: 76,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.01,
    shadowRadius: 6,
    elevation: 0,
  },
  memCardRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  memCardIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  memThumbWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
  },
  memThumb: {
    width: '100%',
    height: '100%',
  },
  memCardContent: { flex: 1 },
  memCardText: { fontSize: 15, lineHeight: 22, marginBottom: 6, fontWeight: '400', fontFamily: SANS_FONT },
  memCardMeta: { fontSize: 12, lineHeight: 18, fontWeight: '500', fontFamily: SANS_FONT },

  // Empty - IMPROVED: Better visual hierarchy and CTA
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingTop: 60,
  },
  emptyIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  emptyTitle: { fontSize: 22, fontWeight: '600', marginBottom: 8, textAlign: 'center', fontFamily: SANS_FONT },
  emptySubtitle: { fontSize: 16, textAlign: 'center', lineHeight: 24, marginBottom: 12, fontFamily: SANS_FONT },
  emptyHint: { fontSize: 14, textAlign: 'center', lineHeight: 20, marginBottom: 28, fontFamily: SANS_FONT },
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 28,
    minHeight: 52,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 0,
  },
  emptyButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600', fontFamily: SANS_FONT },
});
