import React, { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ScrollView,
  TextInput,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Modal,
  Pressable,
  Image,
  PanResponder,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { memoriesApi, categoriesApi, Memory as ApiMemory, Category } from '../../services/api';
import { useTheme, ThemeColors } from '../../constants/ThemeContext';
import { useSettingsStore } from '../../store/settingsStore';
import { useRecallBadgeStore } from '../../store/recallBadgeStore';
import { SimpleMarkdown } from '../../components/SimpleMarkdown';
import { buildMemoryTypeCounts, filterMemoriesByType } from '../../utils/memoryOps';
import { FileText, Mic, Link2, Image as ImageIcon, Search, Sparkles, X } from 'lucide-react-native';
import { ScreenHeader } from '../../components/ScreenHeader';
import { MemoryCard, type MemoryCardMemory } from '../../components/MemoryCard';

type FilterType = 'all' | 'text' | 'voice' | 'link' | 'photo';
const PAGE_SIZE = 40;

interface Memory {
  id: string;
  content: string;
  type: 'text' | 'link' | 'voice' | 'photo';
  imageUrl?: string;
  thumbnailUrl?: string;
  linkPreviewUrl?: string;
  sourceUrl?: string;
  createdAt: Date;
  aiSummary?: string;
  categoryId?: string;
  categoryName?: string;
  categoryIcon?: string;
  categoryColor?: string;
}

const mockMemories: Memory[] = [
  {
    id: '1',
    content: 'Meeting notes: Discuss product launch timeline with the team.',
    type: 'text',
    createdAt: new Date(Date.now() - 86400000),
  },
  {
    id: '2',
    content: 'Voice memo about project ideas and brainstorming session',
    type: 'voice',
    createdAt: new Date(Date.now() - 172800000),
  },
  {
    id: '3',
    content: 'https://react-native.dev/docs/components-and-apis',
    type: 'link',
    createdAt: new Date(Date.now() - 259200000),
  },
  {
    id: '4',
    content: 'Remember to review the quarterly report before Friday meeting',
    type: 'text',
    createdAt: new Date(Date.now() - 345600000),
  },
];

const TYPE_META: Record<Memory['type'], { icon: React.ComponentType<any> }> = {
  text: { icon: FileText },
  voice: { icon: Mic },
  link: { icon: Link2 },
  photo: { icon: ImageIcon },
};

// ── Date grouping utilities ──────────────────────────────────────────────────

type ListItem =
  | { type: 'separator'; label: string; key: string }
  | { type: 'memory'; data: Memory; key: string };

function getDateLabel(date: Date): string {
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'Hôm nay';
  if (diffDays === 1) return 'Hôm qua';
  return date.toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'numeric' });
}

function groupMemoriesByDate(memories: Memory[]): ListItem[] {
  const items: ListItem[] = [];
  let lastLabel = '';
  for (const mem of memories) {
    const label = getDateLabel(mem.createdAt);
    if (label !== lastLabel) {
      items.push({ type: 'separator', label, key: `sep-${label}-${mem.id}` });
      lastLabel = label;
    }
    items.push({ type: 'memory', data: mem, key: mem.id });
  }
  return items;
}

// Theme-aware type colors are resolved inside MemoryListItem via `colors.typeBgXxx`

// Map English system category names → i18n keys so they translate regardless of language.
// Keys match SYSTEM_CATEGORIES in backend/app/models/category.py
const SYSTEM_CATEGORY_I18N: Record<string, string> = {
  Work: 'categories.Work',
  Personal: 'categories.Personal',
  Ideas: 'categories.Ideas',
  Tasks: 'categories.Tasks',
  Research: 'categories.Research',
  Entertainment: 'categories.Entertainment',
  Health: 'categories.Health',
  Finance: 'categories.Finance',
  Travel: 'categories.Travel',
  Recipes: 'categories.Recipes',
};

/** Returns translated display name for a category.
 *  For system categories the name is always stored in English;
 *  for user-created categories the original name is returned. */
function getCategoryDisplayName(name: string, t: Function): string {
  const key = SYSTEM_CATEGORY_I18N[name];
  return key ? (t(key as any) as string) : name;
}

function formatDate(date: Date, t: Function) {
  const diff = Date.now() - date.getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return t('common.today');
  if (days === 1) return t('common.yesterday');
  if (days < 7) return t('common.daysAgo', { count: days });
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function isRenderableMediaUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const url = value.trim();
  return /^(https?:\/\/|file:\/\/|content:\/\/|data:image\/|\/)/i.test(url);
}

function pickPreviewUrl(metadata?: Record<string, any>): string | undefined {
  if (!metadata) return undefined;
  const candidates = [
    metadata.thumbnail_url,
    metadata.preview_image_url,
    metadata.preview_image,
    metadata.image_url,
    metadata.og_image,
    metadata.favicon_url,
  ];
  const first = candidates.find((v) => isRenderableMediaUrl(v));
  return first as string | undefined;
}

function pickLinkSourceUrl(item: ApiMemory): string | undefined {
  if (item.type !== 'link') return undefined;
  const value =
    item.metadata?.original_url ||
    item.metadata?.source_url ||
    item.metadata?.canonical_url ||
    item.content;
  return typeof value === 'string' && /^https?:\/\//i.test(value) ? value : undefined;
}

function getDomain(url?: string): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./i, '');
  } catch {
    return null;
  }
}

// ── DateSeparator ────────────────────────────────────────────────────────────

function DateSeparator({ label, colors }: { label: string; colors: ThemeColors }) {
  return (
    <Text style={[styles.dateSep, { color: colors.textMuted }]}>{label}</Text>
  );
}

// ── SwipeableMemoryCard ──────────────────────────────────────────────────────

function SwipeableMemoryCard({
  memory,
  colors,
  onDelete,
  children,
}: {
  memory: Memory;
  colors: ThemeColors;
  onDelete: (id: string) => void;
  children: React.ReactNode;
}) {
  const translateX = useRef(new Animated.Value(0)).current;
  const SWIPE_THRESHOLD = 80;

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gs) =>
        Math.abs(gs.dx) > 10 && Math.abs(gs.dy) < Math.abs(gs.dx),
      onPanResponderMove: (_, gs) => {
        translateX.setValue(gs.dx);
      },
      onPanResponderRelease: (_, gs) => {
        if (gs.dx < -SWIPE_THRESHOLD) {
          // Swipe left → pin to recall queue
          Animated.spring(translateX, { toValue: 0, useNativeDriver: true }).start();
          const store = useRecallBadgeStore.getState();
          store.setCount(store.count + 1);
        } else if (gs.dx > SWIPE_THRESHOLD) {
          // Swipe right → delete
          onDelete(memory.id);
        } else {
          Animated.spring(translateX, { toValue: 0, useNativeDriver: true }).start();
        }
      },
    }),
  ).current;

  return (
    <Animated.View
      style={{ transform: [{ translateX }] }}
      {...panResponder.panHandlers}
    >
      {children}
    </Animated.View>
  );
}

export default function LibraryScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { preferences } = useSettingsStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<FilterType>('all');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [categoryModalVisible, setCategoryModalVisible] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [allMemories, setAllMemories] = useState<Memory[]>([]);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [searchResults, setSearchResults] = useState<Memory[] | null>(null);
  const [searchSummary, setSearchSummary] = useState<string | null>(null);
  const [summaryStreaming, setSummaryStreaming] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [searching, setSearching] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const categoryEffectInitialized = useRef(false);
  const loadMemoriesRef = useRef<(reset?: boolean) => Promise<void>>(async () => { });
  // Tracks whether a streaming search is still in-flight so we can cancel on re-search
  const streamAbortRef = useRef<{ aborted: boolean }>({ aborted: false });

  const loadCategories = useCallback(async () => {
    try {
      const cats = await categoriesApi.list(true);
      setCategories(cats);
    } catch {
      // ignore
    }
  }, []);

  const loadMemories = useCallback(async (reset: boolean = true) => {
    if (!reset && (loading || loadingMore || !hasMore)) return;

    const nextOffset = reset ? 0 : offset;

    if (reset) {
      setLoading(true);
    } else {
      setLoadingMore(true);
    }

    try {
      const params: { limit: number; offset: number; category_id?: string } = {
        limit: PAGE_SIZE,
        offset: nextOffset,
      };
      if (selectedCategory) {
        params.category_id = selectedCategory;
      }
      const response = await memoriesApi.list(params);
      const mapped: Memory[] = response.memories.map((item: ApiMemory) => ({
        id: item.id,
        content: item.ai_summary || item.content,
        type: item.type,
        imageUrl: isRenderableMediaUrl(item.image_url)
          ? item.image_url
          : isRenderableMediaUrl(item.metadata?.image_url)
            ? item.metadata?.image_url
            : undefined,
        thumbnailUrl: isRenderableMediaUrl(item.metadata?.thumbnail_url)
          ? item.metadata?.thumbnail_url
          : isRenderableMediaUrl(item.image_url)
            ? item.image_url
            : undefined,
        linkPreviewUrl: pickPreviewUrl(item.metadata),
        sourceUrl: pickLinkSourceUrl(item),
        createdAt: new Date(item.created_at),
        aiSummary: item.ai_summary,
        categoryId: item.category_id,
        categoryName: item.category_name,
        categoryIcon: item.category_icon,
        categoryColor: item.category_color,
      }));

      if (reset) {
        setAllMemories(mapped);
      } else {
        setAllMemories((prev) => {
          const dedup = new Map(prev.map((m) => [m.id, m]));
          mapped.forEach((m) => dedup.set(m.id, m));
          return Array.from(dedup.values());
        });
      }

      setOffset(response.next_offset ?? (nextOffset + mapped.length));
      setHasMore(response.has_more);
    } catch {
      if (reset) {
        setAllMemories(mockMemories);
      }
      setHasMore(false);
    } finally {
      if (reset) {
        setLoading(false);
      } else {
        setLoadingMore(false);
      }
    }
  }, [hasMore, loading, loadingMore, offset, selectedCategory]);

  useEffect(() => {
    loadMemoriesRef.current = loadMemories;
  }, [loadMemories]);

  // Load categories once
  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  // Reload whenever this tab comes into focus (e.g., after creating a new memory)
  useFocusEffect(
    useCallback(() => {
      setSearchResults(null);
      setSearchSummary(null);
      setSummaryStreaming(false);
      setHasSearched(false);
      setOffset(0);
      setHasMore(true);
      loadMemoriesRef.current(true);
    }, [])
  );

  // Also reload when selectedCategory changes while screen is already focused
  useEffect(() => {
    if (!categoryEffectInitialized.current) {
      categoryEffectInitialized.current = true;
      return;
    }
    setOffset(0);
    setHasMore(true);
    loadMemoriesRef.current(true);
  }, [selectedCategory]);

  // performSearch — called on Enter press or when category changes while a query is active
  const performSearch = useCallback(async (query: string, catId: string | null) => {
    if (!query.trim()) {
      setSearchResults(null);
      setSearchSummary(null);
      setSummaryStreaming(false);
      setHasSearched(false);
      setSearching(false);
      return;
    }

    // Abort any previous stream
    streamAbortRef.current = { aborted: false };
    const thisAbort = streamAbortRef.current;

    setHasSearched(true);
    setSearching(true);
    setSearchSummary(null);
    setSummaryStreaming(false);

    const useStreaming = preferences?.streaming_responses !== false; // default true

    const mapResult = (item: ApiMemory): Memory => ({
      id: item.id,
      content: item.ai_summary || item.content,
      type: item.type,
      imageUrl: isRenderableMediaUrl(item.image_url)
        ? item.image_url
        : isRenderableMediaUrl(item.metadata?.image_url)
          ? item.metadata?.image_url
          : undefined,
      thumbnailUrl: isRenderableMediaUrl(item.metadata?.thumbnail_url)
        ? item.metadata?.thumbnail_url
        : isRenderableMediaUrl(item.image_url)
          ? item.image_url
          : undefined,
      linkPreviewUrl: pickPreviewUrl(item.metadata),
      sourceUrl: pickLinkSourceUrl(item),
      createdAt: new Date(item.created_at),
      aiSummary: item.ai_summary,
      categoryId: item.category_id,
      categoryName: item.category_name,
      categoryIcon: item.category_icon,
      categoryColor: item.category_color,
    });

    if (useStreaming) {
      // ── Streaming path ─────────────────────────────────────────────────
      await memoriesApi.searchStream(
        query.trim(),
        { category_id: catId ?? undefined },
        (results, _total) => {
          if (thisAbort.aborted) return;
          setSearchResults(results.map(mapResult as any));
          setSearching(false);
          setSummaryStreaming(true);
        },
        (token) => {
          if (thisAbort.aborted) return;
          setSearchSummary((prev) => (prev ?? '') + token);
        },
        () => {
          if (thisAbort.aborted) return;
          setSummaryStreaming(false);
        },
        (_err) => {
          if (thisAbort.aborted) return;
          setSummaryStreaming(false);
          setSearching(false);
        },
      );
    } else {
      // ── Non-streaming path ─────────────────────────────────────────────
      try {
        const data = await memoriesApi.search(query.trim(), {
          category_id: catId ?? undefined,
          with_summary: true,
        });
        if (thisAbort.aborted) return;
        setSearchResults(data.results.map(mapResult as any));
        setSearchSummary(data.ai_summary ?? null);
      } catch {
        if (!thisAbort.aborted) {
          setSearchResults(null);
          setSearchSummary(null);
        }
      } finally {
        if (!thisAbort.aborted) setSearching(false);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preferences?.streaming_responses]);

  // Text change — just updates input state, no auto-search
  const handleSearchChange = useCallback((text: string) => {
    setSearchQuery(text);
    if (!text.trim()) {
      streamAbortRef.current = { aborted: true };
      setSearchResults(null);
      setSearchSummary(null);
      setSummaryStreaming(false);
      setHasSearched(false);
    }
  }, []);

  // Triggered when user presses the Return / Search key
  const handleSubmitSearch = useCallback(() => {
    performSearch(searchQuery, selectedCategory);
  }, [performSearch, searchQuery, selectedCategory]);

  // Re-run search when category is changed and a query is already active
  useEffect(() => {
    if (hasSearched && searchQuery.trim()) {
      performSearch(searchQuery, selectedCategory);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCategory]);

  const counts = useMemo(() => buildMemoryTypeCounts(allMemories), [allMemories]);

  const memories = useMemo(() => {
    const source = searchResults ?? allMemories;
    return filterMemoriesByType(source, filter);
  }, [allMemories, searchResults, filter]);

  const listData = useMemo(
    () => groupMemoriesByDate(memories),
    [memories],
  );

  const handleDelete = useCallback((id: string) => {
    setAllMemories((prev) => prev.filter((m) => m.id !== id));
    setSearchResults((prev) => prev ? prev.filter((m) => m.id !== id) : null);
    try {
      memoriesApi.delete(id);
    } catch {
      // best-effort
    }
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    setOffset(0);
    setHasMore(true);
    await loadMemories(true);
    setRefreshing(false);
  };

  const handleLoadMore = useCallback(() => {
    if (hasSearched || searching || loading || loadingMore || !hasMore) return;
    loadMemories(false);
  }, [hasSearched, hasMore, loadMemories, loading, loadingMore, searching]);

  const renderItem = useCallback(({ item }: { item: ListItem }) => {
    if (item.type === 'separator') {
      return <DateSeparator label={item.label} colors={colors} />;
    }
    const memory = item.data;
    const mem: MemoryCardMemory = {
      id: memory.id,
      content: memory.content,
      type: memory.type,
      createdAt: memory.createdAt,
      imageUrl: memory.imageUrl,
      thumbnailUrl: memory.thumbnailUrl,
      linkPreviewUrl: memory.linkPreviewUrl,
      sourceUrl: memory.sourceUrl,
      aiSummary: memory.aiSummary,
    };
    return (
      <SwipeableMemoryCard memory={memory} colors={colors} onDelete={handleDelete}>
        <View style={styles.cardWrapper}>
          <MemoryCard
            memory={mem}
            timeAgo={formatDate(memory.createdAt, t)}
            onPress={() => router.push({ pathname: '/memory/[id]', params: { id: memory.id } })}
          />
        </View>
      </SwipeableMemoryCard>
    );
  }, [colors, handleDelete, t]);

  const FILTERS: { key: FilterType; label: string; icon?: React.ComponentType<any> }[] = [
    { key: 'all', label: `${t('library.filterAll')}  ${counts.all}` },
    { key: 'text', label: String(counts.text), icon: FileText },
    { key: 'voice', label: String(counts.voice), icon: Mic },
    { key: 'link', label: String(counts.link), icon: Link2 },
    { key: 'photo', label: String(counts.photo), icon: ImageIcon },
  ];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]} edges={['top']}>

      {/* ── Header ── */}
      <ScreenHeader
        eyebrow={t('library.eyebrow', { count: memories.length })}
        title={t('library.title')}
        titleSize={30}
        paddingHorizontal={16}
      />

      {/* ── Search bar + Category filter button ── */}
      <View style={styles.searchBarRow}>
        <View style={[styles.searchInputWrap, {
          backgroundColor: colors.cardBg,
          borderColor: colors.border,
          borderWidth: 1,
          borderRadius: 10,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.04,
          shadowRadius: 3,
          elevation: 1,
        }]}>
          <Search size={15} color={colors.textMuted} strokeWidth={2.2} />
          <TextInput
            style={[styles.searchInput, { color: colors.textPrimary }]}
            placeholder={t('library.searchPlaceholder')}
            placeholderTextColor={colors.textPlaceholder}
            value={searchQuery}
            onChangeText={handleSearchChange}
            onSubmitEditing={handleSubmitSearch}
            returnKeyType="search"
            blurOnSubmit={false}
          />
          {searching && <ActivityIndicator size="small" color={colors.accent} style={{ marginRight: 6 }} />}
          {!searching && searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => {
                streamAbortRef.current = { aborted: true };
                setSearchQuery('');
                setSearchResults(null);
                setSearchSummary(null);
                setSummaryStreaming(false);
                setHasSearched(false);
              }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={[styles.clearBtn, { backgroundColor: colors.textMuted }]}
            >
              <X size={11} color="#FFFFFF" strokeWidth={2.6} />
            </TouchableOpacity>
          )}
        </View>

        {/* Category filter pill */}
        <TouchableOpacity
          style={[
            styles.catFilterBtn,
            { backgroundColor: colors.cardBg, borderColor: selectedCategory ? colors.accent : colors.border },
          ]}
          onPress={() => setCategoryModalVisible(true)}
          activeOpacity={0.7}
        >
          <Text style={styles.catFilterIcon}>
            {selectedCategory
              ? (categories.find((c) => c.id === selectedCategory)?.icon ?? '📂')
              : '📂'}
          </Text>
          {!selectedCategory && (
            <Text style={[styles.catFilterChevron, { color: colors.textMuted }]}>▾</Text>
          )}
          {selectedCategory && (
            <TouchableOpacity
              onPress={(e) => { e.stopPropagation(); setSelectedCategory(null); }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={[styles.catFilterChevron, { color: colors.textMuted }]}>×</Text>
            </TouchableOpacity>
          )}
        </TouchableOpacity>
      </View>

      {/* ── Filter chips (type) — hidden during active search ── */}
      {!hasSearched && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterRow}
          contentContainerStyle={styles.filterContent}
        >
          {FILTERS.map(({ key, label, icon }) => (
            <TouchableOpacity
              key={key}
              style={filter === key
                ? [styles.chip, styles.chipActive, { backgroundColor: colors.brandAccentLight, borderColor: colors.brandAccentLight }]
                : [styles.chip, { backgroundColor: colors.cardBg, borderColor: colors.border }]}
              onPress={() => setFilter(key)}
              activeOpacity={0.7}
            >
              <View style={styles.chipInner}>
                {icon ? (
                  React.createElement(icon, {
                    size: 14,
                    color: filter === key ? colors.brandAccent : colors.textMuted,
                    strokeWidth: 2.5,
                  })
                ) : null}
                <Text style={filter === key
                  ? [styles.chipText, { color: colors.brandAccent }]
                  : [styles.chipText, { color: colors.textMuted }]}>
                  {label}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* ── AI Insight card (shown after search + while streaming) ── */}
      {hasSearched && (searchSummary != null || summaryStreaming) && (
        <View style={[styles.insightCard, { backgroundColor: colors.cardBg, borderColor: colors.accent }]}>
          <View style={[styles.insightIconWrap, { backgroundColor: colors.accentSubtle }]}>
            <Sparkles size={13} color={colors.accent} strokeWidth={2.5} />
          </View>
          <View style={{ flex: 1 }}>
            <View style={styles.insightHeader}>
              <Text style={[styles.insightLabel, { color: colors.accent }]}>{t('library.aiInsight')}</Text>
              {summaryStreaming && (
                <ActivityIndicator size="small" color={colors.accent} style={{ marginLeft: 6 }} />
              )}
            </View>
            <SimpleMarkdown
              content={searchSummary ?? ''}
              textColor={colors.textPrimary}
              colors={colors}
              fontSize={14}
              lineHeight={21}
            />
          </View>
        </View>
      )}

      {/* ── Search result count (when searching is complete) ── */}
      {hasSearched && !searching && searchResults != null && (
        <Text style={[styles.resultCount, { color: colors.textMuted }]}>
          {t('library.searchResultCount', { count: memories.length })}
        </Text>
      )}

      {/* ── List ── */}
      <FlatList
        style={styles.list}
        contentContainerStyle={styles.listContent}
        data={listData}
        keyExtractor={(item) => item.key}
        renderItem={renderItem}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.35}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.textSecondary} />}
        showsVerticalScrollIndicator={false}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListFooterComponent={
          !hasSearched && loadingMore ? (
            <View style={styles.loadMoreWrap}>
              <ActivityIndicator size="small" color={colors.textSecondary} />
            </View>
          ) : null
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>{loading ? '⏳' : '📭'}</Text>
            <Text style={[styles.emptyTitle, { color: colors.textSecondary }]}>{loading ? t('library.loading') : t('library.empty')}</Text>
            {!!searchQuery && (
              <TouchableOpacity onPress={() => {
                streamAbortRef.current = { aborted: true };
                setSearchQuery(''); setSearchResults(null); setSearchSummary(null);
                setSummaryStreaming(false); setHasSearched(false);
              }}>
                <Text style={[styles.emptyClear, { color: colors.accent }]}>{t('library.clearSearch')}</Text>
              </TouchableOpacity>
            )}
          </View>
        }
      />

      {/* ── Category picker Modal ── */}
      <Modal
        visible={categoryModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setCategoryModalVisible(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setCategoryModalVisible(false)}>
          <Pressable style={[styles.modalSheet, { backgroundColor: colors.bg }]} onPress={() => { }}>
            {/* Handle bar */}
            <View style={[styles.modalHandle, { backgroundColor: colors.border }]} />

            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>{t('library.filterCategory')}</Text>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* "All categories" option */}
              <TouchableOpacity
                style={[
                  styles.modalRow,
                  { borderColor: colors.border },
                  !selectedCategory && { backgroundColor: colors.accentSubtle },
                ]}
                onPress={() => { setSelectedCategory(null); setCategoryModalVisible(false); }}
                activeOpacity={0.7}
              >
                <Text style={styles.modalRowIcon}>📂</Text>
                <Text style={[styles.modalRowText, { color: !selectedCategory ? colors.accent : colors.textPrimary }]}>
                  {t('library.allCategories')}
                </Text>
                {!selectedCategory && <Text style={{ color: colors.accent, fontSize: 16 }}>✓</Text>}
              </TouchableOpacity>

              {categories.map((cat) => {
                const isSelected = selectedCategory === cat.id;
                return (
                  <TouchableOpacity
                    key={cat.id}
                    style={[
                      styles.modalRow,
                      { borderColor: colors.border },
                      isSelected && { backgroundColor: colors.accentSubtle },
                    ]}
                    onPress={() => { setSelectedCategory(isSelected ? null : cat.id); setCategoryModalVisible(false); }}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.modalRowIcon}>{cat.icon}</Text>
                    <Text style={[styles.modalRowText, { color: isSelected ? (cat.color || colors.accent) : colors.textPrimary }]}>
                      {getCategoryDisplayName(cat.name, t)}
                    </Text>
                    {isSelected && <Text style={{ color: cat.color || colors.accent, fontSize: 16 }}>✓</Text>}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  // ── Layout ──────────────────────────────────────────────
  container: {
    flex: 1,
  },

  // ── Header ──────────────────────────────────────────────
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: {
    fontSize: 26,
    fontWeight: '600',
    marginBottom: 3,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
  },


  // ── Search bar row ──────────────────────────────────────
  searchBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 12,
    gap: 10,
  },
  searchInputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 9,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontFamily: 'DMSans_400Regular',
    fontSize: 14,
    fontStyle: 'italic',
  },
  clearBtn: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 4,
  },
  clearBtnText: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '700',
    lineHeight: 14,
  },
  // Category filter button (sits to the right of the search bar)
  catFilterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    gap: 4,
  },
  catFilterIcon: {
    fontSize: 17,
  },
  catFilterChevron: {
    fontSize: 14,
    fontWeight: '600',
  },

  // ── Filter chips ────────────────────────────────────────
  filterRow: {
    flexGrow: 0,
    flexShrink: 0,
  },
  filterContent: {
    paddingHorizontal: 20,
    paddingBottom: 10,
    gap: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  chip: {
    borderRadius: 100,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  chipActive: {},
  chipInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  chipText: {
    fontFamily: 'DMSans_600SemiBold',
    fontSize: 11,
  },
  chipTextActive: {
    color: '#FFFFFF',
  },

  // ── AI Insight card ─────────────────────────────────────
  insightCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginHorizontal: 20,
    marginBottom: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    gap: 10,
  },
  insightIconWrap: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  insightHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  insightLabel: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  insightText: {
    fontSize: 15,
    lineHeight: 22,
  },

  // ── Date separator ──────────────────────────────────────
  dateSep: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
  },

  // ── Result count ────────────────────────────────────────
  resultCount: {
    fontSize: 12,
    paddingHorizontal: 20,
    marginBottom: 6,
  },

  // ── List ────────────────────────────────────────────────
  list: {
    flex: 1,
  },
  listContent: {
    paddingBottom: 40,
    flexGrow: 1,
  },
  cardWrapper: {
    paddingHorizontal: 16,
  },
  loadMoreWrap: {
    paddingTop: 6,
    paddingBottom: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  separator: {
    height: 8,
  },

  // ── Row item ────────────────────────────────────────────
  memoryItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
    gap: 10,
  },
  mediaWrap: {
    width: 58,
    height: 58,
    borderRadius: 12,
    overflow: 'hidden',
    flexShrink: 0,
  },
  mediaThumb: {
    width: '100%',
    height: '100%',
  },
  mediaFallback: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  memoryContent: {
    flex: 1,
    minHeight: 58,
  },
  memoryText: {
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '400',
    marginBottom: 6,
  },
  memoryMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'nowrap',
  },
  metaTypeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  memoryDot: {
    fontSize: 12,
    marginHorizontal: 5,
  },
  memoryDate: {
    fontSize: 12,
  },
  domainInline: {
    fontSize: 12,
    flexShrink: 1,
  },
  previewIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginLeft: 6,
  },
  categoryLabel: {
    fontSize: 12,
    fontWeight: '500',
  },

  // ── Empty state ─────────────────────────────────────────
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
  },
  emptyIcon: {
    fontSize: 40,
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '600',
  },
  emptyClear: {
    marginTop: 10,
    fontSize: 15,
    fontWeight: '600',
  },

  // ── Category picker Modal ────────────────────────────────
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 40,
    maxHeight: '70%',
  },
  modalHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '600',
    marginBottom: 14,
  },
  modalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  modalRowIcon: {
    fontSize: 20,
    width: 28,
    textAlign: 'center',
  },
  modalRowText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '400',
  },
});

