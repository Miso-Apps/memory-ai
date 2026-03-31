import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Brain, CircleAlert } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MessageCircle } from 'lucide-react-native';
import { useTheme } from '../../constants/ThemeContext';
import { ThemeColors } from '../../constants/ThemeContext';
import { aiApi, RadarItem } from '../../services/api';
import { ScreenHeader } from '../../components/ScreenHeader';
import { useRecallBadgeStore } from '../../store/recallBadgeStore';

const REASON_LABELS: Record<string, string> = {
  category_match: 'Bạn hay nghĩ về điều này',
  voice_recap: 'Voice note chưa nghe lại',
  link_revisit: 'Link chưa xem lại',
  recently_saved: 'Vừa lưu gần đây',
  user_pinned: 'Bạn đánh dấu để nhớ lại',
  on_this_day: 'Đúng ngày này năm trước',
  not_viewed: 'Chưa xem lại',
};

function getReasonLabel(reasonCode: string): string {
  return REASON_LABELS[reasonCode] ?? 'Gợi ý nhớ lại';
}

function FeaturedRecallCard({
  item,
  onOpen,
  onDismiss,
  colors,
}: {
  item: RadarItem;
  onOpen: () => void;
  onDismiss: () => void;
  colors: ThemeColors;
}) {
  const reasonLabel = getReasonLabel(item.reason_code);
  const title = item.memory.ai_summary ?? item.memory.content;
  const preview = title.length > 80 ? title.slice(0, 80) + '…' : title;
  const confidence = Math.round(item.confidence * 100);

  return (
    <LinearGradient
      colors={['#FFF3E8', '#FFE5CB']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.featuredCard}
    >
      <View style={styles.featuredReason}>
        <View style={[styles.reasonDot, { backgroundColor: colors.accent }]} />
        <Text style={[styles.reasonLabel, { color: colors.accent }]}>
          {reasonLabel.toUpperCase()}
        </Text>
      </View>
      <Text style={[styles.featuredTitle, { color: colors.textPrimary }]}>
        {preview}
      </Text>
      <Text style={[styles.featuredMeta, { color: colors.textMuted }]}>
        {item.memory.type === 'voice' ? '🎤' : '📝'} {item.memory.category_name ?? 'Chưa phân loại'}
      </Text>

      <View style={styles.confRow}>
        <View style={[styles.confBarBg, { backgroundColor: 'rgba(194,96,10,0.12)' }]}>
          <View
            style={[
              styles.confBarFill,
              { backgroundColor: colors.accent, width: `${confidence}%` as any },
            ]}
          />
        </View>
        <Text style={[styles.confLabel, { color: colors.textMuted }]}>
          {confidence}% liên quan
        </Text>
      </View>

      <View style={styles.featuredActions}>
        <TouchableOpacity
          style={[styles.btnPrimary, { backgroundColor: colors.textPrimary }]}
          onPress={onOpen}
          activeOpacity={0.85}
        >
          <Text style={styles.btnPrimaryText}>Xem lại</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.btnSecondary, {
            backgroundColor: 'rgba(44,24,16,0.07)',
            borderColor: 'rgba(44,24,16,0.12)',
          }]}
          onPress={onDismiss}
          activeOpacity={0.7}
        >
          <Text style={[styles.btnSecondaryText, { color: colors.textTertiary }]}>Bỏ qua</Text>
        </TouchableOpacity>
      </View>
    </LinearGradient>
  );
}

function AIChatEntry({ colors, onPress }: { colors: ThemeColors; onPress: () => void }) {
  return (
    <TouchableOpacity
      style={[styles.chatEntry, { backgroundColor: colors.textPrimary }]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <MessageCircle size={16} color="rgba(245,239,232,0.6)" strokeWidth={1.8} />
      <Text style={styles.chatEntryText}>
        Hỏi AI:{' '}
        <Text style={styles.chatEntryPrompt}>"Tôi đang nghĩ về gì nhiều nhất?"</Text>
      </Text>
      <Text style={styles.chatEntryArrow}>→</Text>
    </TouchableOpacity>
  );
}

export default function RecallScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const [items, setItems] = useState<RadarItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadRadar = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      setError(null);
      const response = await aiApi.getRadar(6);
      setItems(response.items || []);
      useRecallBadgeStore.getState().setCount(response.items?.length ?? 0);

      // Fire-and-forget served events for feed analytics.
      for (const item of response.items || []) {
        aiApi.trackRadarEvent({
          memory_id: item.memory.id,
          event_type: 'served',
          reason_code: item.reason_code,
          confidence: item.confidence,
          context: { screen: 'recall' },
        }).catch(() => undefined);
      }
    } catch {
      setError(t('recall.loadFailed'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [t]);

  useEffect(() => {
    loadRadar();
  }, [loadRadar]);

  const onOpen = useCallback(async (item: RadarItem) => {
    aiApi.trackRadarEvent({
      memory_id: item.memory.id,
      event_type: 'opened',
      reason_code: item.reason_code,
      confidence: item.confidence,
      context: { screen: 'recall' },
    }).catch(() => undefined);
    router.push({
      pathname: '/memory/[id]',
      params: { id: item.memory.id },
    });
  }, [router]);

  const onDismiss = useCallback(async (item: RadarItem) => {
    setItems((prev) => {
      const next = prev.filter((x) => x.memory.id !== item.memory.id);
      useRecallBadgeStore.getState().setCount(next.length);
      return next;
    });
    aiApi.trackRadarEvent({
      memory_id: item.memory.id,
      event_type: 'dismissed',
      reason_code: item.reason_code,
      confidence: item.confidence,
      context: { screen: 'recall' },
    }).catch(() => undefined);
  }, []);

  const isEmpty = useMemo(() => !loading && items.length === 0 && !error, [loading, items.length, error]);

  const featured = items[0];
  const secondary = items.slice(1);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadRadar(true)}
            tintColor={colors.textSecondary}
          />
        }
      >
        <ScreenHeader
          title={t('recall.title')}
          subtitle={t('recall.subtitle')}
          titleSize={30}
          paddingHorizontal={16}
        />

        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="small" color={colors.textSecondary} />
            <Text style={[styles.loadingText, { color: colors.textSecondary }]}>{t('recall.loading')}</Text>
          </View>
        ) : null}

        {error ? (
          <View style={styles.errorWrap}>
            <View style={[styles.inlineStatusIcon, { backgroundColor: colors.warningBg }]}>
              <CircleAlert size={14} color={colors.warning} strokeWidth={2.4} />
            </View>
            <Text style={[styles.errorText, { color: colors.textSecondary }]}>{error}</Text>
            <Pressable
              onPress={() => loadRadar(true)}
              style={[styles.retryButton, { borderColor: colors.border, backgroundColor: colors.inputBg }]}
            >
              <Text style={[styles.retryButtonText, { color: colors.textPrimary }]}>{t('recall.retry')}</Text>
            </Pressable>
          </View>
        ) : null}

        {!loading && !error && items.length > 0 ? (
          <>
            <Text style={[styles.countLine, { color: colors.textMuted }]}>
              {items.length} gợi ý hôm nay
            </Text>

            {featured && (
              <FeaturedRecallCard
                item={featured}
                onOpen={() => onOpen(featured)}
                onDismiss={() => onDismiss(featured)}
                colors={colors}
              />
            )}

            {secondary.length > 0 && (
              <>
                <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>Chưa xem lại</Text>
                {secondary.map((item) => (
                  <TouchableOpacity
                    key={item.memory.id}
                    style={[styles.secondaryCard, { backgroundColor: colors.cardBg, borderColor: colors.border }]}
                    onPress={() => onOpen(item)}
                    activeOpacity={0.8}
                  >
                    <View style={styles.secondaryBody}>
                      <Text style={[styles.secondaryTitle, { color: colors.textPrimary }]} numberOfLines={1}>
                        {item.memory.ai_summary ?? item.memory.content}
                      </Text>
                      <Text style={[styles.secondaryMeta, { color: colors.textMuted }]}>
                        {getReasonLabel(item.reason_code)}
                      </Text>
                    </View>
                    <Text style={[styles.openBtn, { color: colors.accent }]}>Mở →</Text>
                  </TouchableOpacity>
                ))}
              </>
            )}

            <AIChatEntry
              colors={colors}
              onPress={() => router.push('/chat')}
            />
          </>
        ) : null}

        {isEmpty ? (
          <View style={styles.emptyState}>
            <View style={[styles.emptyIcon, { backgroundColor: colors.inputBg }]}>
              <Brain size={28} color={colors.textMuted} strokeWidth={2.2} />
            </View>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              {t('recall.empty')}
            </Text>
            <Pressable
              onPress={() => loadRadar(true)}
              style={[styles.retryButton, { borderColor: colors.border, backgroundColor: colors.inputBg }]}
            >
              <Text style={[styles.retryButtonText, { color: colors.textPrimary }]}>{t('recall.refresh')}</Text>
            </Pressable>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    paddingBottom: 32,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingBottom: 128,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  emptyText: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 260,
  },
  loadingWrap: {
    paddingTop: 32,
    alignItems: 'center',
    gap: 8,
  },
  loadingText: {
    fontSize: 14,
  },
  errorWrap: {
    paddingHorizontal: 20,
    paddingTop: 28,
    alignItems: 'center',
    gap: 12,
  },
  inlineStatusIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    fontSize: 14,
    textAlign: 'center',
  },
  retryButton: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  retryButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
  featuredCard: {
    marginHorizontal: 16, marginBottom: 12, borderRadius: 18,
    padding: 16, borderWidth: 1.5, borderColor: '#F0C89A',
  },
  featuredReason: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  reasonDot: { width: 5, height: 5, borderRadius: 3 },
  reasonLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 0.4 },
  featuredTitle: { fontSize: 16, fontWeight: '700', lineHeight: 22, marginBottom: 4 },
  featuredMeta: { fontSize: 11, marginBottom: 10 },
  confRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  confBarBg: { flex: 1, height: 3, borderRadius: 2, overflow: 'hidden' },
  confBarFill: { height: 3, borderRadius: 2 },
  confLabel: { fontSize: 10 },
  featuredActions: { flexDirection: 'row', gap: 8 },
  btnPrimary: {
    flex: 2, borderRadius: 10, paddingVertical: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  btnPrimaryText: { fontSize: 13, fontWeight: '600', color: '#FFFFFF' },
  btnSecondary: {
    flex: 1, borderRadius: 10, paddingVertical: 10,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1,
  },
  btnSecondaryText: { fontSize: 13 },
  countLine: { fontSize: 12, paddingHorizontal: 16, marginBottom: 10 },
  sectionLabel: {
    fontSize: 10, fontWeight: '700', textTransform: 'uppercase',
    letterSpacing: 0.5, paddingHorizontal: 16, marginBottom: 6,
  },
  secondaryCard: {
    marginHorizontal: 16, marginBottom: 6, borderRadius: 14,
    borderWidth: 1, padding: 11, flexDirection: 'row', alignItems: 'center', gap: 10,
  },
  secondaryBody: { flex: 1 },
  secondaryTitle: { fontSize: 13, fontWeight: '600' },
  secondaryMeta: { fontSize: 10, marginTop: 2 },
  openBtn: { fontSize: 11, fontWeight: '600' },
  chatEntry: {
    marginHorizontal: 16, marginTop: 8, borderRadius: 14,
    padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10,
  },
  chatEntryText: { flex: 1, fontSize: 12, color: 'rgba(245,239,232,0.7)' },
  chatEntryPrompt: { color: '#F5EFE8', fontWeight: '600' },
  chatEntryArrow: { fontSize: 12, color: '#FFE5CB' },
});
