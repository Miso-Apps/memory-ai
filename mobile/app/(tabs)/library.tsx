import React, { useMemo, useState, useCallback, useRef, useEffect } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { memoriesApi, categoriesApi, Memory as ApiMemory, Category } from '../../services/api';
import { useTheme } from '../../constants/ThemeContext';

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
  Work:          'categories.Work',
  Personal:      'categories.Personal',
  Ideas:         'categories.Ideas',
  Tasks:         'categories.Tasks',
  Research:      'categories.Research',
  Entertainment: 'categories.Entertainment',
  Health:        'categories.Health',
  Finance:       'categories.Finance',
  Travel:        'categories.Travel',
  Recipes:       'categories.Recipes',
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
          {memory.categoryName && (
            <>
              <Text style={[styles.memoryDot, { color: colors.border }]}>·</Text>
              <Text style={[styles.categoryLabel, { color: memory.categoryColor || colors.textMuted }]}>
                {memory.categoryIcon} {getCategoryDisplayName(memory.categoryName, t)}
              </Text>
            </>
          )}
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
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<FilterType>('all');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [allMemories, setAllMemories] = useState<Memory[]>([]);
  const [searchResults, setSearchResults] = useState<Memory[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  // Debounced semantic search
  const handleSearchChange = useCallback((text: string) => {
    setSearchQuery(text);
    if (searchTimer.current) clearTimeout(searchTimer.current);

    if (!text.trim()) {
      setSearchResults(null);
      setSearching(false);
      return;
    }

    setSearching(true);
    searchTimer.current = setTimeout(async () => {
      try {
        const data = await memoriesApi.search(text.trim());
        const mapped: Memory[] = data.results.map((item: ApiMemory) => ({
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
        setSearchResults(mapped);
      } catch {
        // Fallback to local filter
        setSearchResults(null);
      } finally {
        setSearching(false);
      }
    }, 400);
  }, []);

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
    { key: 'all',   label: `${t('library.filterAll')}  ${counts.all}` },
    { key: 'text',  label: `📝  ${counts.text}` },
    { key: 'voice', label: `🎤  ${counts.voice}` },
    { key: 'link',  label: `🔗  ${counts.link}` },
    { key: 'photo', label: `📷  ${counts.photo}` },
  ];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]} edges={['top']}>

      {/* ── Header ── */}
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>{t('library.title')}</Text>
      </View>

      {/* ── Search ── */}
      <View style={[styles.searchRow, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
        <Text style={styles.searchMagnifier}>🔍</Text>
        <TextInput
          style={[styles.searchInput, { color: colors.textPrimary }]}
          placeholder={t('library.searchPlaceholder')}
          placeholderTextColor={colors.textMuted}
          value={searchQuery}
          onChangeText={handleSearchChange}
          returnKeyType="search"
          clearButtonMode="while-editing"
        />
        {searching && <ActivityIndicator size="small" color={colors.accent} />}
      </View>

      {/* ── Filter chips (type) ── */}
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

      {/* ── Category chips ── */}
      {categories.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.categoryRow}
          contentContainerStyle={styles.filterContent}
        >
          <TouchableOpacity
            style={[styles.categoryChip, { backgroundColor: colors.cardBg, borderColor: colors.border }, !selectedCategory && { backgroundColor: 'rgba(99, 102, 241, 0.1)', borderColor: colors.accent }]}
            onPress={() => setSelectedCategory(null)}
            activeOpacity={0.7}
          >
            <Text style={styles.categoryChipIcon}>📂</Text>
            <Text style={[styles.categoryChipText, { color: colors.textSecondary }, !selectedCategory && { color: colors.accent }]}>
              {t('library.allCategories')}
            </Text>
          </TouchableOpacity>
          {categories.map((cat) => (
            <TouchableOpacity
              key={cat.id}
              style={[
                styles.categoryChip, { backgroundColor: colors.cardBg, borderColor: colors.border },
                selectedCategory === cat.id && { backgroundColor: 'rgba(99, 102, 241, 0.1)', borderColor: cat.color },
              ]}
              onPress={() => setSelectedCategory(selectedCategory === cat.id ? null : cat.id)}
              activeOpacity={0.7}
            >
              <Text style={styles.categoryChipIcon}>{cat.icon}</Text>
              <Text style={[
                styles.categoryChipText, { color: colors.textSecondary },
                selectedCategory === cat.id && { color: cat.color },
              ]}>
                {getCategoryDisplayName(cat.name, t)}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
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
              <TouchableOpacity onPress={() => { setSearchQuery(''); setSearchResults(null); }}>
                <Text style={[styles.emptyClear, { color: colors.accent }]}>{t('library.clearSearch')}</Text>
              </TouchableOpacity>
            )}
          </View>
        }
      />
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


  // ── Search ──────────────────────────────────────────────
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginBottom: 12,
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
    marginLeft: 15,          // edge-to-edge; only slight inset from bar
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

  // ── Category chips ──────────────────────────────────────
  categoryRow: {
    flexGrow: 0,
    flexShrink: 0,
    marginBottom: 8,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 30,
    paddingHorizontal: 10,
    borderRadius: 15,
    borderWidth: 1,
    gap: 4,
  },
  categoryChipIcon: {
    fontSize: 12,
  },
  categoryChipText: {
    fontSize: 12,
    fontWeight: '500',
  },

});

