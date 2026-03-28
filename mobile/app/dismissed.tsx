import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';
import { memoriesApi, Memory as ApiMemory } from '../services/api';
import { useTheme } from '../constants/ThemeContext';

const TYPE_ICON: Record<string, string> = { text: '📝', voice: '🎤', link: '🔗', photo: '📷' };

function formatDate(date: Date, t: Function) {
  const diff = Date.now() - date.getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return t('common.today');
  if (days === 1) return t('common.yesterday');
  if (days < 7) return t('common.daysAgo', { count: days });
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

interface DismissedItem {
  id: string;
  type: string;
  content: string;
  aiSummary?: string;
  deletedAt: Date;
}

const PAGE_SIZE = 40;

export default function DismissedScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [items, setItems] = useState<DismissedItem[]>([]);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const loadDismissedRef = React.useRef<(reset?: boolean) => Promise<void>>(async () => {});

  const loadDismissed = useCallback(async (reset: boolean = true) => {
    if (!reset && (loading || loadingMore || !hasMore)) return;

    const nextOffset = reset ? 0 : offset;

    if (reset) {
      setLoading(true);
    } else {
      setLoadingMore(true);
    }

    try {
      const response = await memoriesApi.listDismissed({ limit: PAGE_SIZE, offset: nextOffset });
      const mapped: DismissedItem[] = response.memories.map((m: ApiMemory) => ({
        id: m.id,
        type: m.type,
        content: m.ai_summary || m.content,
        aiSummary: m.ai_summary,
        deletedAt: new Date(m.updated_at),
      }));

      if (reset) {
        setItems(mapped);
      } else {
        setItems((prev) => {
          const dedup = new Map(prev.map((m) => [m.id, m]));
          mapped.forEach((m) => dedup.set(m.id, m));
          return Array.from(dedup.values());
        });
      }

      setOffset(response.next_offset ?? (nextOffset + mapped.length));
      setHasMore(response.has_more);
    } catch {
      // no-op
      setHasMore(false);
    } finally {
      if (reset) {
        setLoading(false);
      } else {
        setLoadingMore(false);
      }
    }
  }, [hasMore, loading, loadingMore, offset]);

  React.useEffect(() => {
    loadDismissedRef.current = loadDismissed;
  }, [loadDismissed]);

  useFocusEffect(
    useCallback(() => {
      setOffset(0);
      setHasMore(true);
      loadDismissedRef.current(true);
    }, [])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    setOffset(0);
    setHasMore(true);
    await loadDismissed(true);
    setRefreshing(false);
  };

  const handleLoadMore = useCallback(() => {
    if (loading || loadingMore || !hasMore) return;
    loadDismissed(false);
  }, [hasMore, loadDismissed, loading, loadingMore]);

  const handleRestore = (id: string) => {
    Alert.alert(t('dismissed.restoreTitle'), t('dismissed.restoreMessage'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('dismissed.restore'),
        onPress: async () => {
          try {
            await memoriesApi.restore(id);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            setItems((prev) => prev.filter((item) => item.id !== id));
          } catch {
            Alert.alert(t('common.error'), t('dismissed.restoreFailed'));
          }
        },
      },
    ]);
  };

  const handlePermanentDelete = (id: string) => {
    Alert.alert(t('dismissed.permanentTitle'), t('dismissed.permanentMessage'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          try {
            await memoriesApi.permanentDelete(id);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            setItems((prev) => prev.filter((item) => item.id !== id));
          } catch {
            Alert.alert(t('common.error'), t('dismissed.deleteFailed'));
          }
        },
      },
    ]);
  };

  const renderItem = ({ item }: { item: DismissedItem }) => (
    <View style={[styles.card, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
      <View style={styles.cardTop}>
        <View style={styles.typeRow}>
          <Text style={styles.typeIcon}>{TYPE_ICON[item.type] || '📝'}</Text>
          <Text style={[styles.dateText, { color: colors.textMuted }]}>{formatDate(item.deletedAt, t)}</Text>
        </View>
        <Text style={[styles.contentText, { color: colors.textPrimary }]} numberOfLines={3}>
          {item.content}
        </Text>
      </View>
      <View style={[styles.cardActions, { borderTopColor: colors.border }]}>
        <TouchableOpacity
          style={[styles.restoreBtn, { borderRightColor: colors.border }]}
          onPress={() => handleRestore(item.id)}
          activeOpacity={0.7}
        >
          <Text style={[styles.restoreBtnText, { color: colors.accent }]}>{t('dismissed.restore')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.deleteBtn}
          onPress={() => handlePermanentDelete(item.id)}
          activeOpacity={0.7}
        >
          <Text style={[styles.deleteBtnText, { color: colors.error }]}>{t('dismissed.permanentDelete')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={[styles.backBtn, { backgroundColor: colors.inputBg }]}>
          <Text style={[styles.backIcon, { color: colors.textSecondary }]}>‹</Text>
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.textPrimary }]}>{t('dismissed.title')}</Text>
        <View style={[styles.backBtn, { backgroundColor: 'transparent' }]} />
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      ) : items.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.emptyIcon}>🗑️</Text>
          <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>{t('dismissed.empty')}</Text>
          <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>{t('dismissed.emptySubtitle')}</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.35}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
          }
          showsVerticalScrollIndicator={false}
          ListFooterComponent={
            loadingMore ? (
              <View style={styles.loadMoreWrap}>
                <ActivityIndicator size="small" color={colors.accent} />
              </View>
            ) : null
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  backIcon: { fontSize: 24, marginTop: -2 },
  title: { fontSize: 17, fontWeight: '600' },

  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontWeight: '600', marginBottom: 8 },
  emptySubtitle: { fontSize: 14, textAlign: 'center', lineHeight: 20 },

  list: { padding: 16, gap: 12 },
  loadMoreWrap: {
    paddingTop: 6,
    paddingBottom: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },

  card: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  cardTop: { padding: 16 },
  typeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  typeIcon: { fontSize: 16 },
  dateText: { fontSize: 12 },
  contentText: { fontSize: 15, lineHeight: 22 },

  cardActions: {
    flexDirection: 'row',
    borderTopWidth: 1,
  },
  restoreBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRightWidth: 1,
  },
  restoreBtnText: { fontSize: 14, fontWeight: '600' },
  deleteBtn: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  deleteBtnText: { fontSize: 14, fontWeight: '600' },
});
