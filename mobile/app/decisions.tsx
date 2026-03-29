import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, router } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { decisionsApi, Decision } from '../services/api';
import { useTheme } from '../constants/ThemeContext';

type DecisionStatusFilter = 'open' | 'reviewed' | 'archived';

function formatDateLabel(value?: string | null): string {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

export default function DecisionsScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();

  const [filter, setFilter] = useState<DecisionStatusFilter>('open');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [items, setItems] = useState<Decision[]>([]);

  const [title, setTitle] = useState('');
  const [rationale, setRationale] = useState('');
  const [expectedOutcome, setExpectedOutcome] = useState('');
  const [revisitAt, setRevisitAt] = useState('');

  const loadDecisions = useCallback(async (nextFilter?: DecisionStatusFilter) => {
    const status = nextFilter ?? filter;
    try {
      setLoading(true);
      const result = await decisionsApi.list({ status, limit: 50 });
      setItems(result.items || []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useFocusEffect(
    useCallback(() => {
      void loadDecisions();
    }, [loadDecisions])
  );

  const canCreate = useMemo(() => title.trim().length > 0 && !saving, [title, saving]);

  const handleCreate = useCallback(async () => {
    if (!title.trim()) return;

    let revisitIso: string | undefined;
    if (revisitAt.trim()) {
      const parsed = new Date(revisitAt.trim());
      if (Number.isNaN(parsed.getTime())) {
        Alert.alert(t('common.error'), t('decision.invalidRevisitAt'));
        return;
      }
      revisitIso = parsed.toISOString();
    }

    try {
      setSaving(true);
      await decisionsApi.create({
        title: title.trim(),
        rationale: rationale.trim() || undefined,
        expected_outcome: expectedOutcome.trim() || undefined,
        revisit_at: revisitIso,
      });
      setTitle('');
      setRationale('');
      setExpectedOutcome('');
      setRevisitAt('');
      await loadDecisions('open');
      setFilter('open');
    } catch {
      Alert.alert(t('common.error'), t('decision.createFailed'));
    } finally {
      setSaving(false);
    }
  }, [expectedOutcome, loadDecisions, rationale, revisitAt, t, title]);

  const handleReview = useCallback(async (id: string, status: 'reviewed' | 'archived') => {
    try {
      setReviewingId(id);
      await decisionsApi.review(id, status);
      await loadDecisions();
    } catch {
      Alert.alert(t('common.error'), t('decision.updateFailed'));
    } finally {
      setReviewingId(null);
    }
  }, [loadDecisions, t]);

  const statusLabel = useCallback((status: Decision['status']) => {
    if (status === 'open') return t('decision.statusOpen');
    if (status === 'reviewed') return t('decision.statusReviewed');
    return t('decision.statusArchived');
  }, [t]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]} edges={['top', 'bottom']}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}> 
        <TouchableOpacity
          style={[styles.headerBtn, { backgroundColor: colors.inputBg }]}
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <ChevronLeft size={20} color={colors.textSecondary} strokeWidth={2.4} />
        </TouchableOpacity>
        <View style={styles.headerTextWrap}>
          <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>{t('decision.title')}</Text>
          <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>{t('decision.subtitle')}</Text>
        </View>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={[styles.card, { backgroundColor: colors.cardBg, borderColor: colors.border }]}> 
          <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>{t('decision.create')}</Text>

          <TextInput
            style={[styles.input, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.inputBg }]}
            placeholder={t('decision.titlePlaceholder')}
            placeholderTextColor={colors.textPlaceholder}
            value={title}
            onChangeText={setTitle}
          />

          <TextInput
            style={[styles.input, styles.multiline, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.inputBg }]}
            placeholder={t('decision.rationalePlaceholder')}
            placeholderTextColor={colors.textPlaceholder}
            multiline
            value={rationale}
            onChangeText={setRationale}
          />

          <TextInput
            style={[styles.input, styles.multiline, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.inputBg }]}
            placeholder={t('decision.expectedOutcomePlaceholder')}
            placeholderTextColor={colors.textPlaceholder}
            multiline
            value={expectedOutcome}
            onChangeText={setExpectedOutcome}
          />

          <TextInput
            style={[styles.input, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.inputBg }]}
            placeholder={t('decision.revisitAtPlaceholder')}
            placeholderTextColor={colors.textPlaceholder}
            value={revisitAt}
            onChangeText={setRevisitAt}
          />

          <TouchableOpacity
            style={[styles.createBtn, { backgroundColor: canCreate ? colors.accent : colors.inputBg }]}
            onPress={() => void handleCreate()}
            disabled={!canCreate}
            activeOpacity={0.75}
          >
            {saving ? (
              <ActivityIndicator size="small" color={colors.buttonText} />
            ) : (
              <Text style={[styles.createBtnText, { color: canCreate ? colors.buttonText : colors.textMuted }]}>{t('decision.create')}</Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.filterRow}>
          {(['open', 'reviewed', 'archived'] as DecisionStatusFilter[]).map((value) => (
            <TouchableOpacity
              key={value}
              style={[
                styles.filterChip,
                {
                  borderColor: filter === value ? colors.accent : colors.border,
                  backgroundColor: filter === value ? colors.accentLight : colors.cardBg,
                },
              ]}
              onPress={() => {
                setFilter(value);
                void loadDecisions(value);
              }}
              activeOpacity={0.75}
            >
              <Text style={[styles.filterChipText, { color: filter === value ? colors.accent : colors.textSecondary }]}> 
                {statusLabel(value)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="small" color={colors.accent} />
            <Text style={[styles.loadingText, { color: colors.textMuted }]}>{t('insights.loading')}</Text>
          </View>
        ) : items.length === 0 ? (
          <View style={[styles.emptyWrap, { borderColor: colors.border, backgroundColor: colors.cardBg }]}> 
            <Text style={[styles.emptyText, { color: colors.textMuted }]}>{t('decision.empty')}</Text>
          </View>
        ) : (
          <View style={styles.listWrap}>
            {items.map((item) => (
              <View key={item.id} style={[styles.itemCard, { borderColor: colors.border, backgroundColor: colors.cardBg }]}> 
                <View style={styles.itemTop}>
                  <Text style={[styles.itemTitle, { color: colors.textPrimary }]}>{item.title}</Text>
                  <View style={[styles.badge, { backgroundColor: colors.accentLight }]}> 
                    <Text style={[styles.badgeText, { color: colors.accent }]}>{statusLabel(item.status)}</Text>
                  </View>
                </View>

                {item.rationale ? (
                  <Text style={[styles.itemBody, { color: colors.textSecondary }]}>{item.rationale}</Text>
                ) : null}

                {item.expected_outcome ? (
                  <Text style={[styles.itemHint, { color: colors.textMuted }]}>
                    {t('decision.expectedOutcome')}: {item.expected_outcome}
                  </Text>
                ) : null}

                <Text style={[styles.itemHint, { color: colors.textMuted }]}>
                  {t('decision.revisitAt')}: {formatDateLabel(item.revisit_at)}
                </Text>

                {item.status === 'open' ? (
                  <View style={styles.itemActions}>
                    <TouchableOpacity
                      style={[styles.actionBtn, { backgroundColor: colors.accent }]}
                      onPress={() => void handleReview(item.id, 'reviewed')}
                      disabled={reviewingId === item.id}
                      activeOpacity={0.75}
                    >
                      <Text style={[styles.actionBtnText, { color: colors.buttonText }]}>{t('decision.markReviewed')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.actionBtn, { backgroundColor: colors.inputBg, borderColor: colors.border, borderWidth: 1 }]}
                      onPress={() => void handleReview(item.id, 'archived')}
                      disabled={reviewingId === item.id}
                      activeOpacity={0.75}
                    >
                      <Text style={[styles.actionBtnText, { color: colors.textSecondary }]}>{t('decision.statusArchived')}</Text>
                    </TouchableOpacity>
                  </View>
                ) : null}
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderBottomWidth: 1,
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  headerBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTextWrap: { flex: 1 },
  headerTitle: { fontSize: 20, fontWeight: '700' },
  headerSubtitle: { fontSize: 13, marginTop: 2 },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 120, gap: 12 },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    gap: 10,
  },
  cardTitle: { fontSize: 15, fontWeight: '600' },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  multiline: {
    minHeight: 76,
    textAlignVertical: 'top',
  },
  createBtn: {
    borderRadius: 12,
    minHeight: 42,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  createBtnText: { fontSize: 14, fontWeight: '600' },
  filterRow: { flexDirection: 'row', gap: 8 },
  filterChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  filterChipText: { fontSize: 12, fontWeight: '600' },
  loadingWrap: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 24 },
  loadingText: { fontSize: 13 },
  emptyWrap: {
    borderWidth: 1,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 22,
    paddingHorizontal: 12,
  },
  emptyText: { fontSize: 14 },
  listWrap: { gap: 10 },
  itemCard: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    gap: 8,
  },
  itemTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 },
  itemTitle: { flex: 1, fontSize: 15, fontWeight: '600' },
  badge: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  itemBody: { fontSize: 13, lineHeight: 19 },
  itemHint: { fontSize: 12, lineHeight: 18 },
  itemActions: { flexDirection: 'row', gap: 8, marginTop: 4 },
  actionBtn: {
    flex: 1,
    minHeight: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnText: { fontSize: 12, fontWeight: '600' },
});
