import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
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
import { aiApi, memoriesApi, insightsApi, MemoryLink, MemoryBlock, RelatedMemory } from '../../services/api';
import { useTheme } from '../../constants/ThemeContext';
import { ChevronRight, FileText, Folder, Image as ImageIcon, Link2, Mic, Pencil, Share2, Sparkles, Trash2 } from 'lucide-react-native';
import { SimpleMarkdown } from '../../components/SimpleMarkdown';

interface Memory {
  id: string;
  type: 'text' | 'link' | 'voice' | 'photo' | 'rich';
  content: string;
  audioUrl?: string;
  imageUrl?: string;
  thumbnailUrl?: string;
  linkPreviewUrl?: string;
  userNote?: string;
  aiSummary?: string;
  transcription?: string;
  audioDuration?: number;
  blocks?: MemoryBlock[] | null;
  categoryId?: string;
  categoryName?: string;
  categoryIcon?: string;
  categoryColor?: string;
  createdAt: Date;
  updatedAt: Date;
}

interface LinkedMemoryItem {
  link: MemoryLink;
  target: Memory | null;
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

const TYPE_CONFIG: Record<string, { Icon: React.ComponentType<any>; labelKey: string; color: string }> = {
  text: { Icon: FileText, labelKey: 'memory.typeText', color: '#C2600A' },
  voice: { Icon: Mic, labelKey: 'memory.typeVoice', color: '#C2600A' },
  link: { Icon: Link2, labelKey: 'memory.typeLink', color: '#C2600A' },
  photo: { Icon: ImageIcon, labelKey: 'memory.typePhoto', color: '#C2600A' },
  rich: { Icon: FileText, labelKey: 'memory.typeRich', color: '#C2600A' },
};

function parseHexColor(input?: string): { r: number; g: number; b: number } | null {
  if (!input) return null;
  const raw = input.trim().replace('#', '');
  const hex = raw.length === 3
    ? raw.split('').map((c) => c + c).join('')
    : raw;
  if (!/^[0-9a-fA-F]{6}$/.test(hex)) return null;
  return {
    r: parseInt(hex.slice(0, 2), 16),
    g: parseInt(hex.slice(2, 4), 16),
    b: parseInt(hex.slice(4, 6), 16),
  };
}

function rgbToHex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')}`;
}

function mixHex(base: string, target: string, weight: number): string {
  const a = parseHexColor(base);
  const b = parseHexColor(target);
  if (!a || !b) return base;
  const w = Math.max(0, Math.min(1, weight));
  return rgbToHex(
    a.r + (b.r - a.r) * w,
    a.g + (b.g - a.g) * w,
    a.b + (b.b - a.b) * w,
  );
}

function hexWithAlpha(input: string, alpha: number): string {
  const rgb = parseHexColor(input);
  if (!rgb) return `rgba(107,114,128,${alpha})`;
  return `rgba(${rgb.r},${rgb.g},${rgb.b},${Math.max(0, Math.min(1, alpha))})`;
}

function getCategoryTone(color: string | undefined, isDark: boolean) {
  const base = parseHexColor(color || '') ? (color as string) : '#6B7280';
  const text = isDark ? mixHex(base, '#ffffff', 0.34) : mixHex(base, '#111827', 0.2);
  const bg = hexWithAlpha(base, isDark ? 0.2 : 0.12);
  const border = hexWithAlpha(base, isDark ? 0.34 : 0.24);
  return { text, bg, border };
}

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
        style={[styles.playButton, { backgroundColor: colors.brandAccent }]}
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
              styles.audioProgressFill, { backgroundColor: colors.brandAccent },
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
  const { colors, isDark } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [memory, setMemory] = useState<Memory | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingRelated, setLoadingRelated] = useState(false);
  const [related, setRelated] = useState<RelatedMemory[]>([]);
  const [explicitLinks, setExplicitLinks] = useState<LinkedMemoryItem[]>([]);
  const [loadingLinks, setLoadingLinks] = useState(false);
  const [searchingLinkTargets, setSearchingLinkTargets] = useState(false);
  const [linkQuery, setLinkQuery] = useState('');
  const [linkTargets, setLinkTargets] = useState<Memory[]>([]);
  const [savingLinkTargetId, setSavingLinkTargetId] = useState<string | null>(null);
  const [deletingLinkTargetId, setDeletingLinkTargetId] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isReflecting, setIsReflecting] = useState(false);
  const [reflectionMarkdown, setReflectionMarkdown] = useState<string>('');
  const [showReflectionModal, setShowReflectionModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
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
        blocks: response.blocks ?? null,
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

      void loadExplicitLinks(response.id);

      // Mark as viewed
      memoriesApi.markViewed(response.id).catch(() => { });
    } catch {
      // no-op
    } finally {
      setLoading(false);
    }
  };

  const loadExplicitLinks = async (sourceMemoryId: string) => {
    try {
      setLoadingLinks(true);
      const links = await memoriesApi.listLinks(sourceMemoryId);

      const withTargets = await Promise.all(
        links.map(async (link: MemoryLink) => {
          try {
            const target = await memoriesApi.get(link.target_memory_id);
            return {
              link,
              target: {
                id: target.id,
                type: target.type,
                content: target.content,
                aiSummary: target.ai_summary,
                createdAt: new Date(target.created_at),
                updatedAt: new Date(target.updated_at),
                categoryName: target.category_name,
                categoryColor: target.category_color,
                categoryIcon: target.category_icon,
              },
            } as LinkedMemoryItem;
          } catch {
            return { link, target: null } as LinkedMemoryItem;
          }
        })
      );

      setExplicitLinks(withTargets);
    } catch {
      setExplicitLinks([]);
    } finally {
      setLoadingLinks(false);
    }
  };

  const searchLinkCandidates = async () => {
    if (!memory || !linkQuery.trim()) {
      setLinkTargets([]);
      return;
    }

    try {
      setSearchingLinkTargets(true);
      const result = await memoriesApi.list({ search: linkQuery.trim(), limit: 8 });
      const existingTargetIds = new Set(explicitLinks.map((item) => item.link.target_memory_id));
      const mapped = result.memories
        .filter((item) => item.id !== memory.id)
        .filter((item) => !existingTargetIds.has(item.id))
        .map((item) => ({
          id: item.id,
          type: item.type,
          content: item.content,
          aiSummary: item.ai_summary,
          createdAt: new Date(item.created_at),
          updatedAt: new Date(item.updated_at),
          categoryName: item.category_name,
          categoryColor: item.category_color,
          categoryIcon: item.category_icon,
        }))
        .slice(0, 6);
      setLinkTargets(mapped);
    } catch {
      setLinkTargets([]);
    } finally {
      setSearchingLinkTargets(false);
    }
  };

  const addExplicitLink = async (targetMemoryId: string) => {
    if (!memory) return;

    try {
      setSavingLinkTargetId(targetMemoryId);
      await memoriesApi.createLink(memory.id, {
        target_memory_id: targetMemoryId,
        link_type: 'explicit',
      });
      setLinkTargets((prev) => prev.filter((item) => item.id !== targetMemoryId));
      await Promise.all([loadExplicitLinks(memory.id), loadMemory()]);
      Alert.alert(t('decision.title'), t('memory.linkAdded'));
    } catch {
      Alert.alert(t('common.error'), t('memory.linkActionFailed'));
    } finally {
      setSavingLinkTargetId(null);
    }
  };

  const removeExplicitLink = async (targetMemoryId: string) => {
    if (!memory) return;

    try {
      setDeletingLinkTargetId(targetMemoryId);
      await memoriesApi.deleteLink(memory.id, targetMemoryId, 'explicit');
      await Promise.all([loadExplicitLinks(memory.id), loadMemory()]);
      Alert.alert(t('decision.title'), t('memory.linkRemoved'));
    } catch {
      Alert.alert(t('common.error'), t('memory.linkActionFailed'));
    } finally {
      setDeletingLinkTargetId(null);
    }
  };

  const handleClose = useCallback(() => {
    router.back();
  }, []);

  const handleDelete = useCallback(() => {
    if (!memory) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setShowDeleteModal(true);
  }, [memory]);

  const confirmDelete = useCallback(async () => {
    if (!memory) return;
    try {
      setShowDeleteModal(false);
      await memoriesApi.delete(memory.id);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch {
      Alert.alert(t('common.error'), t('memory.deleteFailed'));
    }
  }, [memory, t]);

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
    insightsApi
      .trackRelatedEvent({
        memory_id: relatedMemoryId,
        event_type: 'related_click',
        reason_code: 'related_memory',
        context: { source_memory_id: id },
      })
      .catch(() => undefined);

    router.push({
      pathname: '/memory/[id]',
      params: { id: relatedMemoryId },
    });
  }, [id]);

  const handleReflect = useCallback(async () => {
    if (!memory || isReflecting) return;
    setIsReflecting(true);
    try {
      const sourceText = memory.aiSummary || memory.transcription || memory.content;
      const result = await aiApi.reflect(sourceText, memory.id);
      const referencedCount = result.related_memories?.length ?? 0;
      const footer = `\n\n---\n${t('chat.memoriesReferenced', { count: referencedCount })}${result.cached ? ` • ${t('memory.cachedReflection')}` : ''}`;
      setReflectionMarkdown(`${result.insight}${footer}`);
      setShowReflectionModal(true);
    } catch {
      Alert.alert(t('common.error'), t('memory.reflectionFailed'));
    } finally {
      setIsReflecting(false);
    }
  }, [memory, isReflecting, t]);

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
              {t('memory.backToLibrary')}
            </Text>
          </TouchableOpacity>
          <View style={styles.navActions}>
            <TouchableOpacity onPress={() => setIsEditing(true)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Pencil size={17} color={colors.textMuted} strokeWidth={2} />
            </TouchableOpacity>
            <TouchableOpacity onPress={handleShare} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={{ marginLeft: 16 }}>
              <Share2 size={18} color={colors.textMuted} strokeWidth={2} />
            </TouchableOpacity>
            <TouchableOpacity onPress={handleDelete} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={{ marginLeft: 16 }}>
              <Trash2 size={18} color={colors.textMuted} strokeWidth={2} />
            </TouchableOpacity>
          </View>
        </View>
        {/* Identity row */}
        <View style={styles.eyebrowRow}>
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

        {/* Rich (mixed-media) blocks — render each block in order */}
        {memory.type === 'rich' && memory.blocks && memory.blocks.length > 0 && (
          <View style={styles.contentSection}>
            {[...memory.blocks]
              .sort((a, b) => a.order_index - b.order_index)
              .map((block, idx) => {
                if (block.type === 'text' && block.content?.trim()) {
                  return (
                    <View key={idx} style={[styles.contentCard, { backgroundColor: colors.inputBg, borderColor: colors.border, marginBottom: 10 }]}>
                      <Text style={[styles.transcriptionText, { color: colors.textSecondary }]}>{block.content}</Text>
                    </View>
                  );
                }
                if (block.type === 'image' && (block.thumbnail_url || block.image_url)) {
                  return (
                    <View key={idx} style={[styles.photoSection, { marginBottom: 10 }]}>
                      <Image
                        source={{ uri: block.thumbnail_url || block.image_url! }}
                        style={[styles.photoImage, { backgroundColor: colors.inputBg }]}
                        resizeMode="cover"
                      />
                      {!!block.caption && (
                        <Text style={[styles.transcriptionText, { color: colors.textSecondary, paddingHorizontal: 4, paddingTop: 6 }]}>
                          {block.caption}
                        </Text>
                      )}
                    </View>
                  );
                }
                if (block.type === 'voice' && block.audio_url) {
                  return (
                    <View key={idx} style={{ marginBottom: 10 }}>
                      <AudioPlayer audioUrl={block.audio_url} audioDuration={block.duration} />
                      {block.transcription ? (
                        <View style={[styles.transcriptionSection, { backgroundColor: colors.inputBg, borderColor: colors.border, marginTop: 6 }]}>
                          <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>{t('memory.transcription')}</Text>
                          <Text style={[styles.transcriptionText, { color: colors.textSecondary }]}>{block.transcription}</Text>
                        </View>
                      ) : null}
                    </View>
                  );
                }
                if (block.type === 'link' && block.url) {
                  return (
                    <TouchableOpacity
                      key={idx}
                      style={{ marginBottom: 10 }}
                      onPress={() => WebBrowser.openBrowserAsync(block.url!, {
                        dismissButtonStyle: 'close',
                        presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN,
                        controlsColor: '#6366F1',
                      }).catch(() => { })}
                      activeOpacity={0.7}
                    >
                      <View style={[styles.linkCard, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
                        <View style={[styles.linkThumbFallback, { backgroundColor: colors.typeBgLink }]}>
                          <Text style={styles.linkIcon}>🔗</Text>
                        </View>
                        <View style={styles.linkCardLeft}>
                          <Text style={[styles.linkMetaLabel, { color: colors.textMuted }]}>{t('memory.linkPreview')}</Text>
                          <Text style={[styles.linkUrl, { color: colors.accent }]} numberOfLines={2}>{block.url}</Text>
                        </View>
                        <View style={[styles.linkOpenBadge, { backgroundColor: colors.accentLight }]}>
                          <Text style={[styles.linkOpenText, { color: colors.accent }]}>{t('memory.openLink')}</Text>
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                }
                return null;
              })}
          </View>
        )}

        {/* Original content — skip for voice and rich (handled above) */}
        {memory.type !== 'voice' && memory.type !== 'rich' && (
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
              <View style={[styles.photoDescriptionBox, { backgroundColor: colors.inputBg, borderColor: colors.accentMid }]}>
                <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>{t('memory.aiDescription')}</Text>
                <Text style={[styles.transcriptionText, { color: colors.textSecondary }]}>{memory.content}</Text>
              </View>
            ) : (
              <View style={[styles.contentCard, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
                <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>{t('memory.aiTextContent')}</Text>
                <Text style={[styles.transcriptionText, { color: colors.textSecondary }]}>{memory.content}</Text>
              </View>
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
            <View style={styles.relatedTitleRow}>
              <Sparkles size={13} color={colors.textSecondary} strokeWidth={2} />
              <Text style={[styles.relatedTitle, { color: colors.textPrimary }]}>{t('memory.relatedMemories')}</Text>
            </View>

            {loadingRelated ? (
              <View style={styles.relatedLoadingRow}>
                <ActivityIndicator size="small" color={colors.textSecondary} />
                <Text style={[styles.relatedLoadingText, { color: colors.textSecondary }]}>{t('memory.loadingRelated')}</Text>
              </View>
            ) : (
              <View style={styles.relatedList}>
                {related.map((item) => {
                  const typeConf = TYPE_CONFIG[item.type] || TYPE_CONFIG.text;
                  const categoryTone = getCategoryTone(item.category_color, isDark);
                  const score = item.similarity != null ? `${Math.round(item.similarity * 100)}% ${t('memory.match')}` : t('memory.relatedViaCategory');
                  const linkType =
                    item.link_type === 'explicit'
                      ? t('memory.relatedLinkTypeExplicit')
                      : item.link_type === 'temporal'
                        ? t('memory.relatedLinkTypeTemporal')
                        : t('memory.relatedLinkTypeSemantic');
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
                        <typeConf.Icon size={14} color={typeConf.color} strokeWidth={2.2} />
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
                          <Text style={[styles.relatedMeta, { color: colors.textSecondary }]}>{linkType}</Text>
                        </View>
                      </View>
                      <ChevronRight size={16} color={colors.textMuted} strokeWidth={2.2} />
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </View>
        )}

        {/* Manual Links */}
        <View style={[styles.relatedSection, { borderTopColor: colors.border }]}>
          <Text style={[styles.relatedTitle, { color: colors.textPrimary }]}>{t('memory.manualLinksTitle')}</Text>
          <Text style={[styles.linkSectionHint, { color: colors.textSecondary }]}>{t('memory.manualLinksSubtitle')}</Text>

          <View style={styles.linkSearchRow}>
            <TextInput
              style={[styles.linkSearchInput, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.inputBg }]}
              placeholder={t('memory.searchLinkPlaceholder')}
              placeholderTextColor={colors.textPlaceholder}
              value={linkQuery}
              onChangeText={setLinkQuery}
            />
            <TouchableOpacity
              style={[styles.linkSearchBtn, { backgroundColor: colors.accent }]}
              onPress={() => void searchLinkCandidates()}
              activeOpacity={0.75}
            >
              {searchingLinkTargets ? (
                <ActivityIndicator size="small" color={colors.buttonText} />
              ) : (
                <Text style={[styles.linkSearchBtnText, { color: colors.buttonText }]}>{t('memory.searchLinkButton')}</Text>
              )}
            </TouchableOpacity>
          </View>

          {loadingLinks ? (
            <View style={styles.relatedLoadingRow}>
              <ActivityIndicator size="small" color={colors.textSecondary} />
              <Text style={[styles.relatedLoadingText, { color: colors.textSecondary }]}>{t('memory.loadingRelated')}</Text>
            </View>
          ) : explicitLinks.length === 0 ? (
            <Text style={[styles.linkEmptyText, { color: colors.textMuted }]}>{t('memory.noManualLinks')}</Text>
          ) : (
            <View style={styles.relatedList}>
              {explicitLinks.map((item) => (
                <View
                  key={item.link.id}
                  style={[styles.relatedItem, { backgroundColor: colors.inputBg, borderColor: colors.border }]}
                >
                  <View style={[styles.relatedTypeDot, { backgroundColor: `${colors.accent}20` }]}>
                    <Text>🔗</Text>
                  </View>
                  <View style={styles.relatedBody}>
                    <Text style={[styles.relatedPreview, { color: colors.textPrimary }]} numberOfLines={2}>
                      {item.target?.aiSummary || item.target?.content || item.link.target_memory_id}
                    </Text>
                    <Text style={[styles.relatedMeta, { color: colors.textMuted }]} numberOfLines={1}>
                      {item.link.explanation || item.link.target_memory_id}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.linkRemoveBtn, { borderColor: colors.border, backgroundColor: colors.cardBg }]}
                    onPress={() => void removeExplicitLink(item.link.target_memory_id)}
                    disabled={deletingLinkTargetId === item.link.target_memory_id}
                    activeOpacity={0.75}
                  >
                    {deletingLinkTargetId === item.link.target_memory_id ? (
                      <ActivityIndicator size="small" color={colors.textSecondary} />
                    ) : (
                      <Text style={[styles.linkRemoveBtnText, { color: colors.textSecondary }]}>{t('memory.removeLink')}</Text>
                    )}
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}

          {linkTargets.length > 0 && (
            <View style={styles.relatedList}>
              {linkTargets.map((target) => (
                <View
                  key={target.id}
                  style={[styles.relatedItem, { backgroundColor: colors.cardBg, borderColor: colors.border }]}
                >
                  <View style={[styles.relatedTypeDot, { backgroundColor: `${colors.accent}16` }]}>
                    <Text>➕</Text>
                  </View>
                  <View style={styles.relatedBody}>
                    <Text style={[styles.relatedPreview, { color: colors.textPrimary }]} numberOfLines={2}>
                      {target.aiSummary || target.content}
                    </Text>
                    <Text style={[styles.relatedMeta, { color: colors.textMuted }]}>{target.id}</Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.linkAddBtn, { backgroundColor: colors.accent }]}
                    onPress={() => void addExplicitLink(target.id)}
                    disabled={savingLinkTargetId === target.id}
                    activeOpacity={0.75}
                  >
                    {savingLinkTargetId === target.id ? (
                      <ActivityIndicator size="small" color={colors.buttonText} />
                    ) : (
                      <Text style={[styles.linkAddBtnText, { color: colors.buttonText }]}>{t('memory.addLink')}</Text>
                    )}
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}

          {!searchingLinkTargets && linkQuery.trim().length > 0 && linkTargets.length === 0 ? (
            <Text style={[styles.linkEmptyText, { color: colors.textMuted }]}>{t('memory.noLinkResults')}</Text>
          ) : null}
        </View>
      </ScrollView>

      {/* ── Bottom actions ── */}
      <View style={[styles.actionBar, { borderTopColor: colors.border }]}>
        {/* Primary CTA — adapts by type */}
        <TouchableOpacity
          style={[styles.primaryActionBtn, { backgroundColor: colors.brandAccent }]}
          onPress={() => {
            void handleReflect();
          }}
          disabled={isReflecting}
          activeOpacity={0.8}
        >
          {isReflecting ? (
            <View style={styles.reflectLoadingRow}>
              <ActivityIndicator size="small" color={colors.buttonText} />
              <Text style={[styles.primaryActionBtnText, { color: colors.buttonText }]}>
                {t('memory.reflecting')}
              </Text>
            </View>
          ) : (
            <Text style={[styles.primaryActionBtnText, { color: colors.buttonText }]}>
              {memory.type === 'voice'
                ? t('memory.actionReflect')
                : t('memory.actionThinkAbout')}
            </Text>
          )}
        </TouchableOpacity>
        {/* Secondary row — only shown for voice (Play button) */}
        {memory.type === 'voice' && (
          <TouchableOpacity
            style={[styles.secondaryActionBtn, { borderColor: colors.border }]}
            onPress={() => audioPlayerRef.current?.togglePlayback()}
            activeOpacity={0.7}
          >
            <Text style={[styles.secondaryActionBtnText, { color: colors.textSecondary }]}>
              {t('memory.actionPlay')}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* ── Delete Confirmation Modal ── */}
      <Modal
        visible={showDeleteModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDeleteModal(false)}
      >
        <View style={styles.deleteBackdrop}>
          <View style={[styles.deleteCard, { backgroundColor: colors.modalBg, borderColor: colors.border }]}>
            <View style={[styles.deleteIconWrap, { backgroundColor: colors.errorBg }]}>
              <Trash2 size={24} color={colors.error} strokeWidth={2} />
            </View>
            <Text style={[styles.deleteCardTitle, { color: colors.textPrimary }]}>
              {t('memory.deleteTitle')}
            </Text>
            <Text style={[styles.deleteCardMessage, { color: colors.textSecondary }]}>
              {t('memory.deleteMessage')}
            </Text>
            <View style={styles.deleteCardButtons}>
              <TouchableOpacity
                style={[styles.deleteCancelBtn, { borderColor: colors.border, backgroundColor: colors.inputBg }]}
                onPress={() => setShowDeleteModal(false)}
                activeOpacity={0.75}
              >
                <Text style={[styles.deleteCancelBtnText, { color: colors.textPrimary }]}>
                  {t('common.cancel')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.deleteConfirmBtn, { backgroundColor: colors.error }]}
                onPress={confirmDelete}
                activeOpacity={0.8}
              >
                <Text style={styles.deleteConfirmBtnText}>
                  {t('common.delete')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showReflectionModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowReflectionModal(false)}
      >
        <View style={styles.reflectionBackdrop}>
          <View style={[styles.reflectionCard, { backgroundColor: colors.modalBg, borderColor: colors.border }]}>
            <View style={[styles.reflectionHeader, { borderBottomColor: colors.border }]}>
              <Text style={[styles.reflectionTitle, { color: colors.textPrimary }]}>{t('memory.reflectionTitle')}</Text>
              <TouchableOpacity onPress={() => setShowReflectionModal(false)}>
                <Text style={[styles.reflectionClose, { color: colors.accent }]}>{t('common.close')}</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.reflectionBody} showsVerticalScrollIndicator={false}>
              <SimpleMarkdown
                content={reflectionMarkdown}
                textColor={colors.textPrimary}
                colors={colors}
              />
            </ScrollView>
          </View>
        </View>
      </Modal>
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
  navActions: {
    flexDirection: 'row',
    alignItems: 'center',
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
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  typeBadgeInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
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
    paddingVertical: 12,
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
    fontFamily: 'DMSans_600SemiBold',
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
    borderWidth: StyleSheet.hairlineWidth,
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
  contentCard: {
    borderRadius: 12,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  contentText: { fontFamily: 'DMSans_400Regular', fontSize: 16, lineHeight: 26 },

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
    borderWidth: StyleSheet.hairlineWidth,
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
    borderWidth: StyleSheet.hairlineWidth,
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
    borderWidth: StyleSheet.hairlineWidth,
  },
  transcriptionText: { fontSize: 14, lineHeight: 21 },

  // Date info
  dateSection: {
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
  },
  dateText: { fontFamily: 'DMSans_400Regular', fontSize: 12 },

  // Related memories
  relatedSection: {
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  relatedTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  relatedTitle: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 14,
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
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    padding: 10,
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
  },
  relatedTypeDot: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.06)',
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
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 8,
    paddingVertical: 3,
    gap: 4,
  },
  relatedCategoryText: {
    fontSize: 10,
    fontWeight: '600',
  },

  linkSectionHint: {
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 10,
  },
  linkSearchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  linkSearchInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
  },
  linkSearchBtn: {
    minWidth: 86,
    minHeight: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  linkSearchBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
  linkEmptyText: {
    fontSize: 12,
    lineHeight: 16,
  },
  linkAddBtn: {
    minWidth: 70,
    minHeight: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  linkAddBtnText: {
    fontSize: 11,
    fontWeight: '600',
  },
  linkRemoveBtn: {
    minWidth: 70,
    minHeight: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    borderWidth: 1,
  },
  linkRemoveBtnText: {
    fontSize: 11,
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
  reflectLoadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  reflectionBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  reflectionCard: {
    width: '100%',
    maxHeight: '78%',
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
  },
  reflectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  reflectionTitle: {
    fontFamily: 'DMSans_600SemiBold',
    fontSize: 16,
  },
  reflectionClose: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 14,
  },
  reflectionBody: {
    paddingHorizontal: 14,
    paddingVertical: 12,
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

  // Delete confirmation modal
  deleteBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
  },
  deleteCard: {
    width: '100%',
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 24,
    alignItems: 'center',
    gap: 10,
  },
  deleteIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  deleteCardTitle: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 18,
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  deleteCardMessage: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    marginBottom: 6,
  },
  deleteCardButtons: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
    marginTop: 4,
  },
  deleteCancelBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 11,
    alignItems: 'center',
    borderWidth: 1,
  },
  deleteCancelBtnText: {
    fontFamily: 'DMSans_600SemiBold',
    fontSize: 15,
  },
  deleteConfirmBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 11,
    alignItems: 'center',
  },
  deleteConfirmBtnText: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 15,
    color: '#FFFFFF',
  },

  // Edit panel
  editPanel: { flex: 1 },
  editHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
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
