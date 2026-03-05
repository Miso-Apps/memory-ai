import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Share,
  TextInput,
  ActivityIndicator,
  Image,
} from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as Clipboard from 'expo-clipboard';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Audio } from 'expo-av';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';
import { memoriesApi } from '../../services/api';
import { useTheme } from '../../constants/ThemeContext';

interface Memory {
  id: string;
  type: 'text' | 'link' | 'voice' | 'photo';
  content: string;
  audioUrl?: string;
  imageUrl?: string;
  userNote?: string;
  aiSummary?: string;
  transcription?: string;
  audioDuration?: number;
  categoryId?: string;
  categoryName?: string;
  categoryIcon?: string;
  categoryColor?: string;
  createdAt: Date;
  updatedAt: Date;
}

function formatRelativeDate(date: Date, t: Function): string {
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return t('common.justNow');
  if (mins < 60) return t('common.minutesAgo', { count: mins });
  const hours = Math.floor(mins / 60);
  if (hours < 24) return t('common.hoursAgo', { count: hours });
  const days = Math.floor(hours / 24);
  if (days === 1) return t('common.yesterday');
  if (days < 7) return t('common.daysAgo', { count: days });
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined,
  });
}

function formatFullDate(date: Date): string {
  return date.toLocaleDateString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatTime(ms: number): string {
  const totalSecs = Math.floor(ms / 1000);
  const mins = Math.floor(totalSecs / 60);
  const secs = totalSecs % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

const TYPE_CONFIG: Record<string, { icon: string; labelKey: string; color: string }> = {
  text: { icon: '📝', labelKey: 'memory.typeText', color: '#3B82F6' },
  voice: { icon: '🎤', labelKey: 'memory.typeVoice', color: '#8B5CF6' },
  link: { icon: '🔗', labelKey: 'memory.typeLink', color: '#10B981' },
  photo: { icon: '📷', labelKey: 'memory.typePhoto', color: '#F59E0B' },
};

// ─── Audio Player ───────────────────────────────────────────────────────────
function AudioPlayer({
  audioUrl,
  audioDuration,
}: {
  audioUrl?: string;
  audioDuration?: number;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const soundRef = useRef<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [positionMs, setPositionMs] = useState(0);
  const [durationMs, setDurationMs] = useState((audioDuration ?? 0) * 1000);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      soundRef.current?.unloadAsync().catch(() => { });
    };
  }, []);

  const onPlaybackStatus = useCallback((status: any) => {
    if (!status.isLoaded) return;
    setPositionMs(status.positionMillis ?? 0);
    if (status.durationMillis) setDurationMs(status.durationMillis);
    setIsPlaying(status.isPlaying ?? false);
    if (status.didJustFinish) {
      setIsPlaying(false);
      setPositionMs(0);
    }
  }, []);

  const togglePlayback = async () => {
    if (!audioUrl) {
      Alert.alert(t('memory.noAudioAlert'), t('memory.noAudioMessage'));
      return;
    }
    try {
      if (!soundRef.current) {
        setIsLoading(true);
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: true,
        });
        const { sound } = await Audio.Sound.createAsync(
          { uri: audioUrl },
          { shouldPlay: true },
          onPlaybackStatus
        );
        soundRef.current = sound;
        setIsLoading(false);
        return;
      }
      const status = await soundRef.current.getStatusAsync();
      if (!status.isLoaded) return;
      if (status.isPlaying) {
        await soundRef.current.pauseAsync();
      } else {
        if (status.positionMillis >= (status.durationMillis ?? 0) - 100) {
          await soundRef.current.setPositionAsync(0);
        }
        await soundRef.current.playAsync();
      }
    } catch (err) {
      setIsLoading(false);
      Alert.alert(t('memory.playbackError'), t('memory.playbackErrorMessage'));
      console.error('AudioPlayer error:', err);
    }
  };

  const progressRatio = durationMs > 0 ? positionMs / durationMs : 0;

  return (
    <View style={[styles.audioPlayer, { backgroundColor: colors.inputBg }]}>
      <TouchableOpacity
        style={[styles.playButton, { backgroundColor: colors.accent }]}
        onPress={togglePlayback}
        activeOpacity={0.8}
        disabled={isLoading}
      >
        {isLoading ? (
          <ActivityIndicator color="#FFFFFF" size="small" />
        ) : (
          <Text style={styles.playIcon}>{isPlaying ? '⏸' : '▶'}</Text>
        )}
      </TouchableOpacity>

      <View style={styles.audioProgressWrapper}>
        <View style={[styles.audioProgressTrack, { backgroundColor: colors.border }]}>
          <View
            style={[
              styles.audioProgressFill, { backgroundColor: colors.accent },
              { width: `${Math.max(0, Math.min(100, Math.round(progressRatio * 100)))}%` },
            ]}
          />
        </View>
        <View style={styles.audioTimeRow}>
          <Text style={[styles.audioTimeText, { color: colors.textSecondary }]}>{formatTime(positionMs)}</Text>
          <Text style={[styles.audioTimeText, { color: colors.textSecondary }]}>{formatTime(durationMs)}</Text>
        </View>
      </View>
    </View>
  );
}

// ─── Inline Edit Panel ─────────────────────────────────────────────────────
function EditPanel({
  memory,
  onSave,
  onCancel,
}: {
  memory: Memory;
  onSave: (content: string) => Promise<void>;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [content, setContent] = useState(memory.content);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!content.trim()) return;
    setSaving(true);
    await onSave(content.trim());
    setSaving(false);
  };

  return (
    <View style={styles.editPanel}>
      <View style={[styles.editHeader, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={onCancel}>
          <Text style={[styles.editCancel, { color: colors.textSecondary }]}>{t('common.cancel')}</Text>
        </TouchableOpacity>
        <Text style={[styles.editTitle, { color: colors.textPrimary }]}>{t('memory.editTitle')}</Text>
        <TouchableOpacity onPress={handleSave} disabled={saving || !content.trim()}>
          <Text style={[styles.editSave, { color: colors.accent }, (!content.trim() || saving) && { color: colors.textMuted }]}>
            {saving ? t('memory.savingEdit') : t('memory.saveEdit')}
          </Text>
        </TouchableOpacity>
      </View>
      <TextInput
        style={[styles.editInput, { color: colors.textPrimary }]}
        value={content}
        onChangeText={setContent}
        multiline
        autoFocus
        textAlignVertical="top"
        placeholder={t('memory.contentPlaceholder')}
        placeholderTextColor={colors.textPlaceholder}
      />
    </View>
  );
}



// ─── Main Screen ─────────────────────────────────────────────────────────────
export default function MemoryDetailScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [memory, setMemory] = useState<Memory | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    loadMemory();
  }, [id]);

  const loadMemory = async () => {
    try {
      const response = await memoriesApi.get(id!);
      setMemory({
        id: response.id,
        type: response.type,
        content: response.content,
        audioUrl: response.audio_url,
        imageUrl: response.image_url,
        userNote: response.metadata?.user_note || undefined,
        aiSummary: response.ai_summary,
        transcription: response.transcription,
        audioDuration: response.audio_duration,
        categoryId: response.category_id,
        categoryName: response.category_name,
        categoryIcon: response.category_icon,
        categoryColor: response.category_color,
        createdAt: new Date(response.created_at),
        updatedAt: new Date(response.updated_at),
      });
      // Mark as viewed
      memoriesApi.markViewed(response.id).catch(() => { });
    } catch {
      // no-op
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => router.back();

  const handleDelete = () => {
    Alert.alert(t('memory.deleteTitle'), t('memory.deleteMessage'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('memory.dismiss'),
        style: 'destructive',
        onPress: async () => {
          try { await memoriesApi.delete(id!); } catch { }
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          router.back();
        },
      },
    ]);
  };

  const handleShare = async () => {
    if (!memory) return;
    try {
      await Share.share({
        message: memory.aiSummary
          ? `${memory.aiSummary}\n\n${t('memory.viaApp')}`
          : `${memory.content}\n\n${t('memory.viaApp')}`,
      });
    } catch { }
  };

  const handleCopy = async () => {
    if (!memory) return;
    const text = memory.aiSummary || memory.content;
    await Clipboard.setStringAsync(text);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleEditSave = async (newContent: string) => {
    if (!memory) return;
    try {
      const updated = await memoriesApi.update(memory.id, { content: newContent });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setMemory((prev) =>
        prev ? { ...prev, content: updated.content, updatedAt: new Date(updated.updated_at) } : prev
      );
      setIsEditing(false);
    } catch {
      Alert.alert(t('common.error'), t('memory.saveFailed'));
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]} edges={['top', 'bottom']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={[styles.loadingText, { color: colors.textMuted }]}>{t('library.loading')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!memory) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]} edges={['top', 'bottom']}>
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { color: colors.textMuted }]}>{t('memory.notFound')}</Text>
          <TouchableOpacity onPress={handleClose} style={{ marginTop: 16 }}>
            <Text style={{ color: colors.accent, fontSize: 16 }}>{t('memory.goBack')}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (isEditing) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]} edges={['top', 'bottom']}>
        <EditPanel memory={memory} onSave={handleEditSave} onCancel={() => setIsEditing(false)} />
      </SafeAreaView>
    );
  }

  const typeConf = TYPE_CONFIG[memory.type] || TYPE_CONFIG.text;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]} edges={['top', 'bottom']}>
      {/* ── Header ─────────────────────────────────────────── */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={handleClose} style={[styles.headerBtn, { backgroundColor: colors.inputBg }]}>
          <Text style={[styles.headerBtnText, { color: colors.textSecondary }]}>‹</Text>
        </TouchableOpacity>
        <View style={styles.headerMeta}>
          <View style={[styles.typePill, { backgroundColor: `${typeConf.color}15` }]}>
            <Text style={styles.typePillIcon}>{typeConf.icon}</Text>
            <Text style={[styles.typePillLabel, { color: typeConf.color }]}>{t(typeConf.labelKey)}</Text>
          </View>
          {memory.categoryName && (
            <View style={[styles.categoryPill, { backgroundColor: `${memory.categoryColor || '#6B7280'}15` }]}>
              <Text style={styles.categoryPillIcon}>{memory.categoryIcon || '📁'}</Text>
              <Text style={[styles.categoryPillLabel, { color: memory.categoryColor || '#6B7280' }]}>
                {memory.categoryName}
              </Text>
            </View>
          )}
          <Text style={[styles.headerTime, { color: colors.textMuted }]}>{formatRelativeDate(memory.createdAt, t)}</Text>
        </View>
        <TouchableOpacity onPress={handleShare} style={[styles.headerBtn, { backgroundColor: colors.inputBg }]}>
          <Text style={[styles.headerBtnText, { color: colors.textSecondary }]}>↗</Text>
        </TouchableOpacity>
      </View>

      {/* ── Content ────────────────────────────────────────── */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* AI Summary card */}
        {memory.aiSummary && (
          <View style={[styles.summaryCard, { backgroundColor: colors.accentLight, borderColor: colors.accentMid }]}>
            <View style={styles.summaryHeader}>
              <Text style={[styles.summaryLabel, { color: colors.accent }]}>✨ {t('memory.aiSummary')}</Text>
            </View>
            <Text style={[styles.summaryText, { color: colors.textPrimary }]}>{memory.aiSummary}</Text>
          </View>
        )}

        {/* Photo image */}
        {memory.type === 'photo' && memory.imageUrl && (
          <View style={styles.photoSection}>
            <Image
              source={{ uri: memory.imageUrl }}
              style={[styles.photoImage, { backgroundColor: colors.inputBg }]}
              resizeMode="cover"
            />
          </View>
        )}

        {/* User note for photo memories */}
        {memory.type === 'photo' && memory.userNote && (
          <View style={[styles.userNoteSection, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
            <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>📝 {t('memory.yourNote')}</Text>
            <Text style={[styles.contentText, { color: colors.textPrimary }]}>{memory.userNote}</Text>
          </View>
        )}

        {/* Original content */}
        <View style={styles.contentSection}>
          {memory.aiSummary && (
            <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>{t('memory.original')}</Text>
          )}
          {memory.type === 'link' ? (
            <TouchableOpacity
              onPress={() => WebBrowser.openBrowserAsync(memory.content, {
                dismissButtonStyle: 'close',
                presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN,
                controlsColor: '#6366F1',
              }).catch(() => { })}
              activeOpacity={0.7}
            >
              <View style={[styles.linkCard, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
                <View style={styles.linkCardLeft}>
                  <Text style={styles.linkIcon}>🔗</Text>
                  <Text style={[styles.linkUrl, { color: colors.accent }]} numberOfLines={2}>{memory.content}</Text>
                </View>
                <View style={[styles.linkOpenBadge, { backgroundColor: colors.accentLight }]}>
                  <Text style={[styles.linkOpenText, { color: colors.accent }]}>{t('memory.openLink')}</Text>
                </View>
              </View>
            </TouchableOpacity>
          ) : memory.type === 'photo' ? (
            <View style={[styles.photoDescriptionBox, { backgroundColor: colors.accentLight, borderColor: colors.accentMid }]}>
              <Text style={[styles.photoDescriptionLabel, { color: colors.accent }]}>🤖 {t('memory.aiDescription')}</Text>
              <Text style={[styles.contentText, { color: colors.textPrimary }]}>{memory.content}</Text>
            </View>
          ) : (
            <Text style={[styles.contentText, { color: colors.textPrimary }]}>{memory.content}</Text>
          )}
        </View>

        {/* Audio player */}
        {memory.type === 'voice' && (
          <AudioPlayer audioUrl={memory.audioUrl} audioDuration={memory.audioDuration} />
        )}

        {/* Transcription */}
        {memory.type === 'voice' && memory.transcription && (
          <View style={[styles.transcriptionSection, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
            <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>{t('memory.transcription')}</Text>
            <Text style={[styles.transcriptionText, { color: colors.textSecondary }]}>{memory.transcription}</Text>
          </View>
        )}

        {/* Date info */}
        <View style={[styles.dateSection, { borderTopColor: colors.border }]}>
          <Text style={[styles.dateText, { color: colors.textMuted }]}>{formatFullDate(memory.createdAt)}</Text>
        </View>
      </ScrollView>

      {/* ── Bottom actions ─────────────────────────────────── */}
      <View style={[styles.bottomBar, { borderTopColor: colors.border, backgroundColor: colors.bg }]}>
        <TouchableOpacity style={styles.bottomAction} onPress={handleCopy} activeOpacity={0.7}>
          <Text style={styles.bottomActionIcon}>{copied ? '✓' : '📋'}</Text>
          <Text style={[styles.bottomActionLabel, { color: colors.textMuted }]}>{copied ? t('memory.copied') : t('memory.copy')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.bottomAction} onPress={() => setIsEditing(true)} activeOpacity={0.7}>
          <Text style={styles.bottomActionIcon}>✏️</Text>
          <Text style={[styles.bottomActionLabel, { color: colors.textMuted }]}>{t('memory.edit')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.bottomAction} onPress={handleShare} activeOpacity={0.7}>
          <Text style={styles.bottomActionIcon}>↗</Text>
          <Text style={[styles.bottomActionLabel, { color: colors.textMuted }]}>{t('memory.share')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.bottomAction]} onPress={handleDelete} activeOpacity={0.7}>
          <Text style={styles.bottomActionIcon}>🗑</Text>
          <Text style={[styles.bottomActionLabel, { color: colors.error }]}>{t('memory.dismiss')}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { fontSize: 16, marginTop: 12 },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  headerBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBtnText: { fontSize: 20, fontWeight: '500' },
  headerMeta: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  headerTime: { fontSize: 13 },
  typePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  typePillIcon: { fontSize: 12 },
  typePillLabel: { fontSize: 12, fontWeight: '600' },

  // Category pill
  categoryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    gap: 4,
  },
  categoryPillIcon: { fontSize: 11 },
  categoryPillLabel: { fontSize: 11, fontWeight: '600' },

  // Scroll
  scrollView: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 16 },

  // AI Summary card
  summaryCard: {
    borderRadius: 14,
    padding: 12,
    marginBottom: 14,
    borderWidth: 1,
  },
  summaryHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  summaryLabel: { fontSize: 12, fontWeight: '700' },
  summaryText: { fontSize: 15, lineHeight: 22 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },

  // Link card
  linkCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
  },
  linkCardLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  linkIcon: { fontSize: 18 },
  linkUrl: { flex: 1, fontSize: 13, lineHeight: 19 },
  linkOpenBadge: {
    borderRadius: 7,
    paddingHorizontal: 8,
    paddingVertical: 5,
    marginLeft: 8,
  },
  linkOpenText: { fontSize: 11, fontWeight: '600' },

  // Content
  contentSection: { marginBottom: 16 },
  contentText: { fontSize: 16, lineHeight: 25 },

  // Photo
  photoSection: { marginBottom: 14, borderRadius: 14, overflow: 'hidden' },
  photoImage: {
    width: '100%',
    height: 260,
    borderRadius: 14,
  },
  photoDescriptionBox: {
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    gap: 6,
  },
  photoDescriptionLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  userNoteSection: {
    marginBottom: 12,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    gap: 6,
  },

  // Audio player
  audioPlayer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    padding: 12,
    marginBottom: 14,
    gap: 10,
  },
  playButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playIcon: { fontSize: 16, color: '#FFFFFF' },
  audioProgressWrapper: { flex: 1 },
  audioProgressTrack: { height: 5, borderRadius: 3, overflow: 'hidden' },
  audioProgressFill: { height: '100%', borderRadius: 3 },
  audioTimeRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 5 },
  audioTimeText: { fontSize: 11 },

  // Transcription
  transcriptionSection: {
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
    borderWidth: 1,
  },
  transcriptionText: { fontSize: 14, lineHeight: 21 },

  // Date info
  dateSection: {
    paddingTop: 12,
    borderTopWidth: 1,
    alignItems: 'center',
  },
  dateText: { fontSize: 12 },

  // Bottom bar
  bottomBar: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
  },
  bottomAction: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
  },
  bottomActionIcon: { fontSize: 18, marginBottom: 2 },
  bottomActionLabel: { fontSize: 11, fontWeight: '500' },

  // Edit panel
  editPanel: { flex: 1 },
  editHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  editTitle: { fontSize: 17, fontWeight: '600' },
  editCancel: { fontSize: 16 },
  editSave: { fontSize: 16, fontWeight: '600' },
  editInput: {
    flex: 1,
    padding: 24,
    fontSize: 17,
    lineHeight: 26,
  },
});
