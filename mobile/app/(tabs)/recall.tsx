import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../constants/ThemeContext';
import { aiApi, RadarItem } from '../../services/api';

function pickPreviewUrl(item: RadarItem): string | undefined {
  const metadata = item.memory.metadata ?? {};
  const candidates = [
    metadata.thumbnail_url,
    metadata.preview_image_url,
    item.memory.image_url,
    metadata.image_url,
    metadata.og_image,
  ];
  return candidates.find((v) => typeof v === 'string' && /^(https?:\/\/|file:\/\/|content:\/\/|\/)/i.test(v)) as string | undefined;
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
    setItems((prev) => prev.filter((x) => x.memory.id !== item.memory.id));
    aiApi.trackRadarEvent({
      memory_id: item.memory.id,
      event_type: 'dismissed',
      reason_code: item.reason_code,
      confidence: item.confidence,
      context: { screen: 'recall' },
    }).catch(() => undefined);
  }, []);

  const isEmpty = useMemo(() => !loading && items.length === 0 && !error, [loading, items.length, error]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>{t('recall.title')}</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            {t('recall.subtitle')}
          </Text>
        </View>

        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="small" color={colors.textSecondary} />
            <Text style={[styles.loadingText, { color: colors.textSecondary }]}>{t('recall.loading')}</Text>
          </View>
        ) : null}

        {error ? (
          <View style={styles.errorWrap}>
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
          <View style={styles.cardsWrap}>
            {items.map((item) => (
              <View key={item.memory.id} style={[styles.card, { borderColor: colors.border, backgroundColor: colors.inputBg }]}>
                <View style={styles.cardTopRow}>
                  <View style={styles.cardTopContent}>
                    <Text style={[styles.cardReason, { color: colors.textPrimary }]}>{item.reason}</Text>
                    <Text style={[styles.cardContent, { color: colors.textSecondary }]} numberOfLines={3}>
                      {item.memory.ai_summary || item.memory.transcription || item.memory.content}
                    </Text>
                  </View>
                  {pickPreviewUrl(item) ? (
                    <Image source={{ uri: pickPreviewUrl(item)! }} style={styles.cardThumb} resizeMode="cover" />
                  ) : null}
                </View>
                <Text style={[styles.cardHint, { color: colors.textSecondary }]}>{item.action_hint}</Text>
                <Text style={[styles.confidence, { color: colors.textSecondary }]}>
                  {t('recall.confidence', { value: item.confidence })}
                </Text>

                <View style={styles.cardActions}>
                  <Pressable
                    onPress={() => onDismiss(item)}
                    style={[styles.actionButton, { borderColor: colors.border }]}
                  >
                    <Text style={[styles.actionButtonText, { color: colors.textSecondary }]}>{t('recall.dismiss')}</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => onOpen(item)}
                    style={[styles.actionButtonPrimary, { backgroundColor: colors.accent }]}
                  >
                    <Text style={styles.actionButtonPrimaryText}>{t('recall.open')}</Text>
                  </Pressable>
                </View>
              </View>
            ))}

            <Pressable
              onPress={() => loadRadar(true)}
              disabled={refreshing}
              style={[styles.refreshButton, { borderColor: colors.border }]}
            >
              <Text style={[styles.refreshButtonText, { color: colors.textSecondary }]}>
                {refreshing ? t('recall.refreshing') : t('recall.refresh')}
              </Text>
            </Pressable>
          </View>
        ) : null}

        {isEmpty ? (
          <View style={styles.emptyState}>
            <View style={[styles.emptyIcon, { backgroundColor: colors.inputBg }]}>
              <View style={[styles.emptyIconInner, { backgroundColor: colors.border }]} />
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
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: {
    fontSize: 27,
    fontWeight: '600',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
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
  emptyIconInner: {
    width: 48,
    height: 48,
    borderRadius: 24,
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
  cardsWrap: {
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 12,
  },
  card: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
  },
  cardTopRow: {
    flexDirection: 'row',
    gap: 10,
  },
  cardTopContent: {
    flex: 1,
  },
  cardThumb: {
    width: 56,
    height: 56,
    borderRadius: 12,
  },
  cardReason: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 8,
  },
  cardContent: {
    fontSize: 15,
    lineHeight: 22,
  },
  cardHint: {
    fontSize: 12,
    lineHeight: 18,
    marginTop: 8,
  },
  confidence: {
    fontSize: 12,
    marginTop: 8,
  },
  cardActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  actionButton: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  actionButtonPrimary: {
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  actionButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  actionButtonPrimaryText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  refreshButton: {
    alignSelf: 'center',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginTop: 2,
    marginBottom: 20,
  },
  refreshButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
});
