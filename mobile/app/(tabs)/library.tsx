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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { memoriesApi, categoriesApi, Memory as ApiMemory, Category } from '../../services/api';
import { useTheme } from '../../constants/ThemeContext';
import { useSettingsStore } from '../../store/settingsStore';
import { SimpleMarkdown } from '../../components/SimpleMarkdown';

type FilterType = 'all' | 'text' | 'voice' | 'link' | 'photo';

interface Memory {
  id: string;
  content: string;
  type: 'text' | 'link' | 'voice' | 'photo';
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

const TYPE_ICON: Record<Memory['type'], string> = {
  text: '📝',
  voice: '🎤',
  link: '🔗',
  photo: '📷',
};

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

const TYPE_DOT_COLOR: Record<Memory['type'], string> = {
  text: '#6366F1',
  voice: '#10B981',
  link: '#F59E0B',
  photo: '#EC4899',
};

function MemoryListItem({ memory }: { memory: Memory }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const dotColor = TYPE_DOT_COLOR[memory.type];
  return (
    <TouchableOpacity
      style={styles.memoryItem}
      onPress={() => router.push(`/memory/${memory.id}`)}
      activeOpacity={0.6}
    >
      {/* Thin left color bar as type indicator */}
      <View style={[styles.typeBar, { backgroundColor: dotColor }]} />

      <View style={styles.memoryContent}>
        <Text style={[styles.memoryText, { color: colors.textPrimary }]} numberOfLines={2}>
          {memory.content}
        </Text>
        <View style={styles.memoryMeta}>
          <Text style={[styles.memoryTypeLabel, { color: dotColor }]}>{TYPE_ICON[memory.type]}</Text>
          <Text style={[styles.memoryDot, { color: colors.border }]}>·</Text>
          <Text style={[styles.memoryDate, { color: colors.textMuted }]}>{formatDate(memory.createdAt, t)}</Text>
        </View>
      </View>

      <Text style={[styles.chevron, { color: colors.border }]}>›</Text>
    </TouchableOpacity>
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
  const [searchResults, setSearchResults] = useState<Memory[] | null>(null);
  const [searchSummary, setSearchSummary] = useState<string | null>(null);
  const [summaryStreaming, setSummaryStreaming] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [searching, setSearching] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
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

  const loadMemories = useCallback(async () => {
    try {
      const params: { limit: number; offset: number; category_id?: string } = { limit: 100, offset: 0 };
      if (selectedCategory) {
        params.category_id = selectedCategory;
      }
      const response = await memoriesApi.list(params);
      const mapped: Memory[] = response.map((item: ApiMemory) => ({
        id: item.id,
        content: item.ai_summary || item.content,
        type: item.type,
        createdAt: new Date(item.created_at),
        aiSummary: item.ai_summary,
        categoryId: item.category_id,
        categoryName: item.category_name,
        categoryIcon: item.category_icon,
        categoryColor: item.category_color,
      }));
      setAllMemories(mapped);
    } catch {
      setAllMemories(mockMemories);
    } finally {
      setLoading(false);
    }
  }, [selectedCategory]);

  // Load categories once
  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  // Reload whenever this tab comes into focus (e.g., after creating a new memory)
  useFocusEffect(
    useCallback(() => {
      loadMemories();
    }, [loadMemories])
  );

  // Also reload when selectedCategory changes while screen is already focused
  useEffect(() => {
    loadMemories();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const counts = useMemo(() => ({
    all: allMemories.length,
    text: allMemories.filter((m) => m.type === 'text').length,
    voice: allMemories.filter((m) => m.type === 'voice').length,
    link: allMemories.filter((m) => m.type === 'link').length,
    photo: allMemories.filter((m) => m.type === 'photo').length,
  }), [allMemories]);

  const memories = useMemo(() => {
    const source = searchResults ?? allMemories;
    if (filter === 'all') return source;
    return source.filter((m) => m.type === filter);
  }, [allMemories, searchResults, filter]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadMemories();
    setRefreshing(false);
  };

  const FILTERS: { key: FilterType; label: string }[] = [
    { key: 'all', label: `${t('library.filterAll')}  ${counts.all}` },
    { key: 'text', label: `📝  ${counts.text}` },
    { key: 'voice', label: `🎤  ${counts.voice}` },
    { key: 'link', label: `🔗  ${counts.link}` },
    { key: 'photo', label: `📷  ${counts.photo}` },
  ];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]} edges={['top']}>

      {/* ── Header ── */}
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>{t('library.title')}</Text>
      </View>

      {/* ── Search bar + Category filter button ── */}
      <View style={styles.searchBarRow}>
        <View style={[styles.searchInputWrap, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
          <Text style={styles.searchMagnifier}>🔍</Text>
          <TextInput
            style={[styles.searchInput, { color: colors.textPrimary }]}
            placeholder={t('library.searchPlaceholder')}
            placeholderTextColor={colors.textMuted}
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
              <Text style={styles.clearBtnText}>×</Text>
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
          {FILTERS.map(({ key, label }) => (
            <TouchableOpacity
              key={key}
              style={[styles.chip, { backgroundColor: colors.cardBg, borderColor: colors.border }, filter === key && { backgroundColor: colors.accent, borderColor: colors.accent }]}
              onPress={() => setFilter(key)}
              activeOpacity={0.7}
            >
              <Text style={[styles.chipText, { color: colors.textSecondary }, filter === key && styles.chipTextActive]}>
                {label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* ── AI Insight card (shown after search + while streaming) ── */}
      {hasSearched && (searchSummary != null || summaryStreaming) && (
        <View style={[styles.insightCard, { backgroundColor: colors.cardBg, borderColor: colors.accent }]}>
          <Text style={styles.insightIcon}>✨</Text>
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
        data={memories}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <MemoryListItem memory={item} />}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.textSecondary} />}
        showsVerticalScrollIndicator={false}
        ItemSeparatorComponent={() => <View style={[styles.separator, { backgroundColor: colors.border }]} />}
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
                  !selectedCategory && { backgroundColor: 'rgba(99,102,241,0.08)' },
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
                      isSelected && { backgroundColor: 'rgba(99,102,241,0.08)' },
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.5,
  },


  // ── Search bar row ──────────────────────────────────────
  searchBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginBottom: 12,
    gap: 10,
  },
  searchInputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
    borderRadius: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
  },
  searchMagnifier: {
    fontSize: 15,
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 0,
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
    height: 34,
    paddingHorizontal: 14,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '500',
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
  insightIcon: {
    fontSize: 16,
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
    fontSize: 14,
    lineHeight: 20,
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
    paddingHorizontal: 20,
    paddingBottom: 40,
    flexGrow: 1,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 15,
  },

  // ── Row item ────────────────────────────────────────────
  memoryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingRight: 4,
    gap: 12,
  },
  typeBar: {
    width: 3,
    height: 36,
    borderRadius: 2,
    flexShrink: 0,
  },
  memoryContent: {
    flex: 1,
  },
  memoryText: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 3,
  },
  memoryMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'nowrap',
  },
  memoryTypeLabel: {
    fontSize: 13,
  },
  memoryDot: {
    fontSize: 12,
    marginHorizontal: 5,
  },
  memoryDate: {
    fontSize: 12,
  },
  categoryLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  chevron: {
    fontSize: 20,
    marginLeft: 6,
    flexShrink: 0,
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
    fontSize: 16,
    fontWeight: '500',
  },
  emptyClear: {
    marginTop: 10,
    fontSize: 14,
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
    fontWeight: '500',
  },
});

