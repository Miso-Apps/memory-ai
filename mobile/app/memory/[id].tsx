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
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Audio } from 'expo-av';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';
import { memoriesApi, insightsApi, RelatedMemory } from '../../services/api';
import { useTheme } from '../../constants/ThemeContext';
import { ChevronRight, Folder, Share2 } from 'lucide-react-native';

interface Memory {
  id: string;
  type: 'text' | 'link' | 'voice' | 'photo';
  content: string;
  audioUrl?: string;
  imageUrl?: string;
  thumbnailUrl?: string;
  linkPreviewUrl?: string;
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
  const first = candidates.find((v) => typeof v === 'string' && /^https?:\/\//i.test(v));
  return first as string | undefined;
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

function deriveTitle(aiSummary?: string, content?: string): string {
  if (aiSummary) {
    const firstSentence = aiSummary.split(/[.!?]/)[0].trim();
    if (firstSentence.length > 0 && firstSentence.length <= 60) return firstSentence;
  }
  if (content) {
    const words = content.trim().split(/\s+/).slice(0, 6).join(' ');
    return words.length > 0 ? words : content.slice(0, 40);
  }
  return '';
}

const TYPE_CONFIG: Record<string, { icon: string; labelKey: string; color: string }> = {
  text: { icon: '📝', labelKey: 'memory.typeText', color: '#5B7FA6' },
  voice: { icon: '🎤', labelKey: 'memory.typeVoice', color: '#C2410C' },
  link: { icon: '🔗', labelKey: 'memory.typeLink', color: '#2D7D63' },
  photo: { icon: '📷', labelKey: 'memory.typePhoto', color: '#B45309' },
};

// ─── Audio Player ───────────────────────────────────────────────────────────
interface AudioPlayerHandle {
  togglePlayback: () => void;
}

const AudioPlayer = React.memo(React.forwardRef<AudioPlayerHandle, {
  audioUrl?: string;
  audioDuration?: number;
}>(function AudioPlayer({
  audioUrl,
  audioDuration,
}, ref) {
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

  const togglePlayback = useCallback(async () => {
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
  }, [audioUrl, onPlaybackStatus, t]);

  React.useImperativeHandle(ref, () => ({
    togglePlayback,
  }), [togglePlayback]);

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
}));

// ─── Inline Edit Panel ─────────────────────────────────────────────────────
const EditPanel = React.memo(function EditPanel({
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
});



// ─── Main Screen ─────────────────────────────────────────────────────────────
export default function MemoryDetailScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [memory, setMemory] = useState<Memory | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingRelated, setLoadingRelated] = useState(false);
  const [related, setRelated] = useState<RelatedMemory[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const audioPlayerRef = useRef<AudioPlayerHandle>(null);

  useEffect(() => {
    loadMemory();
  }, [id]);

  const loadMemory = async () => {
    try {
      const response = await memoriesApi.get(id!);
      const mappedMemory: Memory = {
        id: response.id,
        type: response.type,
        content: response.content,
        audioUrl: response.audio_url,
        imageUrl: response.image_url,
        thumbnailUrl: response.metadata?.thumbnail_url || undefined,
        linkPreviewUrl: response.type === 'link' ? pickPreviewUrl(response.metadata) : undefined,
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
      };
      setMemory(mappedMemory);

      setLoadingRelated(true);
      insightsApi
        .getRelated(response.id, 5)
        .then((res) => {
          const filtered = (res.related || []).filter((item: RelatedMemory) => item.id !== response.id);
          setRelated(filtered.slice(0, 5));
        })
        .catch(() => {
          setRelated([]);
        })
        .finally(() => {
          setLoadingRelated(false);
        });

      // Mark as viewed
      memoriesApi.markViewed(response.id).catch(() => { });
    } catch {
      // no-op
    } finally {
      setLoading(false);
    }
  };

  const handleClose = useCallback(() => {
    router.back();
  }, []);

  const handleShare = useCallback(async () => {
    if (!memory) return;
    try {
      await Share.share({
        message: memory.aiSummary
          ? `${memory.aiSummary}\n\n${t('memory.viaApp')}`
          : `${memory.content}\n\n${t('memory.viaApp')}`,
      });
    } catch { }
  }, [memory, t]);

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

  const openRelatedMemory = useCallback((relatedMemoryId: string) => {
    router.push({
      pathname: '/memory/[id]',
      params: { id: relatedMemoryId },
    });
  }, []);

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

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]} edges={['top', 'bottom']}>
      {/* ── Header ── */}
      <View style={[styles.detailHeader, { borderBottomColor: colors.border }]}>
        {/* Nav row */}
        <View style={styles.navRow}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={[styles.backLink, { color: colors.brandAccent }]}>
              {'‹ '}{t('memory.backToLibrary')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleShare} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Share2 size={18} color={colors.textMuted} strokeWidth={2} />
          </TouchableOpacity>
        </View>
        {/* Identity row */}
        <View style={styles.eyebrowRow}>
          <View style={[styles.typeBadge, { backgroundColor: colors.brandAccentLight, borderColor: 'rgba(184,92,32,0.22)' }]}>
            <Text style={[styles.typeBadgeText, { color: colors.brandAccent }]}>
              {TYPE_CONFIG[memory.type]?.icon} {memory.type?.toUpperCase()}
            </Text>
          </View>
          <Text style={[styles.eyebrowDate, { color: colors.textMuted }]}>
            {new Date(memory.createdAt).toLocaleDateString(undefined, {
              weekday: 'short', month: 'short', day: 'numeric',
            })} · {formatRelativeDate(memory.createdAt, t)}
          </Text>
        </View>
        {/* Title */}
        <Text style={[styles.detailTitle, { color: colors.textPrimary }]}>
          {deriveTitle(memory.aiSummary, memory.content)}
        </Text>
      </View>

      {/* ── Content ────────────────────────────────────────── */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* AI Summary — pull-quote */}
        {memory?.aiSummary ? (
          <>
            <View style={[styles.pullQuote, { backgroundColor: colors.brandAccentLight, borderLeftColor: colors.brandAccent }]}>
              <Text style={[styles.pullQuoteLabel, { color: colors.brandAccent }]}>
                {t('memory.aiSummaryLabel')}
              </Text>
              <Text style={[styles.pullQuoteText, { color: colors.textSecondary }]}>
                {memory.aiSummary}
              </Text>
            </View>
            <View style={[styles.sectionDivider, { backgroundColor: colors.border }]} />
          </>
        ) : null}

        {/* Photo image */}
        {memory.type === 'photo' && (memory.thumbnailUrl || memory.imageUrl) && (
          <View style={styles.photoSection}>
            <Image
              source={{ uri: memory.thumbnailUrl || memory.imageUrl }}
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

        {/* Original content — skip for voice (transcription section below covers it) */}
        {memory.type !== 'voice' && (
          <View style={styles.contentSection}>
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
                  {memory.linkPreviewUrl ? (
                    <Image
                      source={{ uri: memory.linkPreviewUrl }}
                      style={[styles.linkThumb, { backgroundColor: colors.cardBg }]}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={[styles.linkThumbFallback, { backgroundColor: colors.typeBgLink }]}>
                      <Text style={styles.linkIcon}>🔗</Text>
                    </View>
                  )}

                  <View style={styles.linkCardLeft}>
                    <Text style={[styles.linkMetaLabel, { color: colors.textMuted }]}>{t('memory.linkPreview')}</Text>
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
        )}

        {/* Audio player */}
        {memory.type === 'voice' && (
          <AudioPlayer ref={audioPlayerRef} audioUrl={memory.audioUrl} audioDuration={memory.audioDuration} />
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

        {/* Connected Ideas */}
        {(loadingRelated || related.length > 0) && (
          <View style={[styles.relatedSection, { borderTopColor: colors.border }]}>
            <Text style={[styles.relatedTitle, { color: colors.textPrimary }]}>{t('memory.relatedMemories')}</Text>

            {loadingRelated ? (
              <View style={styles.relatedLoadingRow}>
                <ActivityIndicator size="small" color={colors.textSecondary} />
                <Text style={[styles.relatedLoadingText, { color: colors.textSecondary }]}>{t('memory.loadingRelated')}</Text>
              </View>
            ) : (
              <View style={styles.relatedList}>
                {related.map((item) => {
                  const typeConf = TYPE_CONFIG[item.type] || TYPE_CONFIG.text;
                  const score = item.similarity != null ? `${Math.round(item.similarity * 100)}% ${t('memory.match')}` : t('memory.relatedViaCategory');
                  const preview = (item.content || '').trim();
                  const relatedAt = formatRelativeDate(new Date(item.created_at), t);
                  return (
                    <TouchableOpacity
                      key={item.id}
                      style={[styles.relatedItem, { backgroundColor: colors.inputBg, borderColor: colors.border }]}
                      onPress={() => openRelatedMemory(item.id)}
                      activeOpacity={0.75}
                    >
                      <View style={[styles.relatedTypeDot, { backgroundColor: `${typeConf.color}22` }]}>
                        <Text style={styles.relatedTypeEmoji}>{typeConf.icon}</Text>
                      </View>
                      <View style={styles.relatedBody}>
                        <Text style={[styles.relatedPreview, { color: colors.textPrimary }]} numberOfLines={2}>
                          {preview}
                        </Text>
                        <View style={styles.relatedMetaRow}>
                          <Text style={[styles.relatedMeta, { color: colors.textSecondary }]}>
                            {score}
                          </Text>
                          <Text style={[styles.relatedMetaDot, { color: colors.textMuted }]}>•</Text>
                          <Text style={[styles.relatedMeta, { color: colors.textMuted }]}>{relatedAt}</Text>
                        </View>
                        {item.category_name ? (
                          <View
                            style={[
                              styles.relatedCategoryPill,
                              { backgroundColor: `${item.category_color || '#6B7280'}18` },
                            ]}
                          >
                            {item.category_icon ? (
                              <Text style={styles.relatedCategoryIcon}>{item.category_icon}</Text>
                            ) : (
                              <Folder size={11} color={item.category_color || '#6B7280'} strokeWidth={2} />
                            )}
                            <Text
                              style={[
                                styles.relatedCategoryText,
                                { color: item.category_color || '#6B7280' },
                              ]}
                            >
                              {item.category_name}
                            </Text>
                          </View>
                        ) : null}
                      </View>
                      <ChevronRight size={16} color={colors.textMuted} strokeWidth={2.2} />
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* ── Bottom actions ── */}
      <View style={[styles.actionBar, { borderTopColor: colors.border }]}>
        {/* Primary CTA — adapts by type */}
        <TouchableOpacity
          style={[styles.primaryActionBtn, { backgroundColor: colors.brandAccent }]}
          onPress={() => {
            if (memory.type === 'voice') {
              audioPlayerRef.current?.togglePlayback();
            } else if (memory.type === 'link') {
              WebBrowser.openBrowserAsync(memory.content, {
                dismissButtonStyle: 'close',
                presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN,
                controlsColor: '#6366F1',
              }).catch(() => {});
            }
            // text/photo: Reflect — no-op until reflect flow is built
          }}
          activeOpacity={0.8}
        >
          <Text style={styles.primaryActionBtnText}>
            {memory.type === 'voice'
              ? t('memory.actionPlay')
              : memory.type === 'link'
              ? t('memory.actionOpenLink')
              : t('memory.actionReflect')}
          </Text>
        </TouchableOpacity>
        {/* Secondary row */}
        <View style={styles.secondaryActionRow}>
          {memory.type === 'text' || memory.type === 'photo' ? (
            <>
              <TouchableOpacity
                style={[styles.secondaryActionBtn, { borderColor: colors.border }]}
                onPress={() => setIsEditing(true)}
                activeOpacity={0.7}
              >
                <Text style={[styles.secondaryActionBtnText, { color: colors.textSecondary }]}>
                  {t('memory.actionEdit')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.secondaryActionBtn, { borderColor: colors.border }]}
                onPress={handleShare}
                activeOpacity={0.7}
              >
                <Text style={[styles.secondaryActionBtnText, { color: colors.textSecondary }]}>
                  {t('memory.actionShare')}
                </Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <TouchableOpacity
                style={[styles.secondaryActionBtn, { borderColor: colors.border }]}
                activeOpacity={0.7}
              >
                <Text style={[styles.secondaryActionBtnText, { color: colors.textSecondary }]}>
                  {t('memory.actionReflect')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.secondaryActionBtn, { borderColor: colors.border }]}
                onPress={handleShare}
                activeOpacity={0.7}
              >
                <Text style={[styles.secondaryActionBtnText, { color: colors.textSecondary }]}>
                  {t('memory.actionShare')}
                </Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { fontSize: 16, marginTop: 12 },

  // Detail Header
  detailHeader: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  backLink: {
    fontFamily: 'DMSans_600SemiBold',
    fontSize: 13,
  },
  eyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginBottom: 6,
  },
  typeBadge: {
    borderRadius: 4,
    borderWidth: 1,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  typeBadgeText: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 9,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  eyebrowDate: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 11,
  },
  detailTitle: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 20,
    letterSpacing: -0.4,
    lineHeight: 26,
  },

  // Scroll
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingVertical: 16 },

  // AI Summary — pull-quote
  pullQuote: {
    borderLeftWidth: 3,
    borderTopRightRadius: 10,
    borderBottomRightRadius: 10,
    paddingVertical: 10,
    paddingLeft: 14,
    paddingRight: 12,
  },
  pullQuoteLabel: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 9,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  pullQuoteText: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 13,
    fontStyle: 'italic',
    lineHeight: 20,
  },
  sectionDivider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: 12,
  },
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
    gap: 10,
  },
  linkCardLeft: { flex: 1, gap: 3 },
  linkMetaLabel: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.45,
  },
  linkThumb: {
    width: 56,
    height: 56,
    borderRadius: 10,
  },
  linkThumbFallback: {
    width: 56,
    height: 56,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
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
    height: 220,
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

  // Related memories
  relatedSection: {
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: 1,
  },
  relatedTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 10,
  },
  relatedLoadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  relatedLoadingText: {
    fontSize: 13,
  },
  relatedList: {
    gap: 8,
  },
  relatedItem: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
  },
  relatedTypeDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  relatedTypeEmoji: {
    fontSize: 12,
  },
  relatedBody: {
    flex: 1,
    gap: 4,
  },
  relatedPreview: {
    fontSize: 13,
    lineHeight: 19,
  },
  relatedMeta: {
    fontSize: 12,
  },
  relatedMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  relatedMetaDot: {
    fontSize: 11,
  },
  relatedCategoryPill: {
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
    gap: 4,
  },
  relatedCategoryIcon: {
    fontSize: 10,
  },
  relatedCategoryText: {
    fontSize: 10,
    fontWeight: '600',
  },
  relatedChevron: {
    fontSize: 18,
    paddingTop: 2,
  },

  // Action bar
  actionBar: {
    padding: 12,
    paddingBottom: 14,
    gap: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  primaryActionBtn: {
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryActionBtnText: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 15,
    color: '#FFFFFF',
    letterSpacing: 0.1,
  },
  secondaryActionRow: {
    flexDirection: 'row',
    gap: 8,
  },
  secondaryActionBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 9,
    borderWidth: 1,
  },
  secondaryActionBtnText: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 13,
  },

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
