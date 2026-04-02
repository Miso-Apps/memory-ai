import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  Animated,
  Image,
  ScrollView,
  AccessibilityInfo,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as ExpoClipboard from 'expo-clipboard';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Audio } from 'expo-av';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { memoriesApi, storageApi } from '../services/api';
import { useTheme } from '../constants/ThemeContext';
import { optimizeImage, OPTIMIZED_RECORDING_OPTIONS } from '../utils/mediaOptimizer';
import {
  Mic,
  Link2,
  Image as ImageIcon,
  X,
  Lock,
} from 'lucide-react-native';
import { useAuthStore } from '../store/authStore';

const SANS_FONT = Platform.select({ ios: 'System', android: 'sans-serif', default: 'System' });

function getHttpStatus(error: unknown): number | undefined {
  if (!error || typeof error !== 'object') return undefined;
  const maybeError = error as { response?: { status?: unknown } };
  const status = maybeError.response?.status;
  return typeof status === 'number' ? status : undefined;
}

function getExistingMemoryId(error: unknown): string | undefined {
  if (!error || typeof error !== 'object') return undefined;
  const maybeError = error as {
    response?: { data?: { existing_memory_id?: unknown } };
  };
  const value = maybeError.response?.data?.existing_memory_id;
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}


const HINT_CHIPS: {
  labelKey: string;
  bg: string;
  border: string;
  text: string;
  darkBg: string;
  darkBorder: string;
  darkText: string;
}[] = [
    {
      labelKey: 'capture.hintIdea',
      bg: '#fff8f2',
      border: '#f5dfc8',
      text: '#c47a3a',
      darkBg: 'rgba(184,92,32,0.16)',
      darkBorder: 'rgba(184,92,32,0.28)',
      darkText: '#f0b182',
    },
    {
      labelKey: 'capture.hintMeeting',
      bg: '#f2f8ff',
      border: '#d0e8ff',
      text: '#4a7ab5',
      darkBg: 'rgba(73,115,163,0.22)',
      darkBorder: 'rgba(123,168,222,0.32)',
      darkText: '#b9d8ff',
    },
    {
      labelKey: 'capture.hintDecision',
      bg: '#f0fff4',
      border: '#b8e8c8',
      text: '#2e7d52',
      darkBg: 'rgba(53,120,84,0.22)',
      darkBorder: 'rgba(93,171,129,0.34)',
      darkText: '#a7e5c1',
    },
    {
      labelKey: 'capture.hintConversation',
      bg: '#fff0f8',
      border: '#f0c0dc',
      text: '#a0456a',
      darkBg: 'rgba(132,65,97,0.26)',
      darkBorder: 'rgba(191,114,153,0.34)',
      darkText: '#ebb3ce',
    },
    {
      labelKey: 'capture.hintLearning',
      bg: '#f5f0ff',
      border: '#d8c8f8',
      text: '#6a4ab5',
      darkBg: 'rgba(100,79,155,0.24)',
      darkBorder: 'rgba(145,120,208,0.34)',
      darkText: '#cab8f7',
    },
  ];

interface VoiceData {
  audioUrl: string | null;
  transcription: string | null;
  recorded: boolean;
  isUploading: boolean;
}

// ── Block types ──────────────────────────────────────────────────────────────

export type LocalBlockType = 'text' | 'image' | 'voice' | 'link';

export interface TextBlock {
  id: string;
  type: 'text';
  content: string;
}

export interface ImageBlock {
  id: string;
  type: 'image';
  imageUrl: string | null;
  thumbnailUrl: string | null;
  description: string | null;
  caption: string;
  uploading: boolean;
}

export interface VoiceBlock {
  id: string;
  type: 'voice';
  audioUrl: string | null;
  transcription: string | null;
  duration: number;
}

export interface LinkBlock {
  id: string;
  type: 'link';
  url: string;
  error: string;
}

export type LocalBlock = TextBlock | ImageBlock | VoiceBlock | LinkBlock;

function genId(): string {
  return Math.random().toString(36).slice(2, 11);
}

// ── End block types ───────────────────────────────────────────────────────────

interface VoiceWidgetProps {
  status: 'idle' | 'recording' | 'uploading' | 'done';
  duration: number;
  transcription: string | null;
  onStop: () => void;
  onDiscard: () => void;
}

function VoiceWidget({ status, duration, transcription, onStop, onDiscard }: VoiceWidgetProps) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pulseRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    if (status === 'recording') {
      pulseRef.current = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.08, duration: 600, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        ])
      );
      pulseRef.current.start();
    } else {
      pulseRef.current?.stop();
      Animated.timing(pulseAnim, { toValue: 1, duration: 150, useNativeDriver: true }).start();
    }
    return () => { pulseRef.current?.stop(); };
  }, [status]);

  const fmtDuration = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  if (status === 'idle') return null;

  if (status === 'recording') {
    return (
      <View style={[widgetStyles.voiceCard, { backgroundColor: 'rgba(232,132,74,0.08)', borderColor: 'rgba(232,132,74,0.25)' }]}>
        <Animated.View style={[widgetStyles.recDot, { transform: [{ scale: pulseAnim }], backgroundColor: colors.error }]} />
        <View style={widgetStyles.waveform}>
          {[6, 14, 18, 10, 16, 8, 20, 12, 14, 6, 18, 10].map((h, i) => (
            <View key={i} style={[widgetStyles.wbar, { height: h, backgroundColor: colors.captureAccent }]} />
          ))}
        </View>
        <Text style={[widgetStyles.recTime, { color: colors.captureAccent }]}>{fmtDuration(duration)}</Text>
        <TouchableOpacity style={[widgetStyles.stopBtn, { backgroundColor: colors.captureAccent }]} onPress={onStop}>
          <View style={widgetStyles.stopSquare} />
        </TouchableOpacity>
      </View>
    );
  }

  if (status === 'uploading') {
    return (
      <View style={[widgetStyles.voiceCard, { backgroundColor: 'rgba(232,132,74,0.08)', borderColor: 'rgba(232,132,74,0.25)' }]}>
        <ActivityIndicator size="small" color={colors.captureAccent} />
        <Text style={[widgetStyles.recTime, { color: colors.captureMuted }]}>{t('capture.processingAudio')}</Text>
      </View>
    );
  }

  // done — show pill
  return (
    <View style={[widgetStyles.pill, { backgroundColor: 'rgba(232,132,74,0.10)', borderColor: 'rgba(232,132,74,0.35)' }]}>
      <Mic size={12} color={colors.captureAccent} strokeWidth={2.2} />
      <Text style={[widgetStyles.pillText, { color: colors.captureAccent }]}>
        {transcription ? transcription.slice(0, 40) + (transcription.length > 40 ? '…' : '') : fmtDuration(duration)}
      </Text>
      <TouchableOpacity onPress={onDiscard} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <X size={12} color={colors.captureMuted} strokeWidth={2.2} />
      </TouchableOpacity>
    </View>
  );
}

const widgetStyles = StyleSheet.create({
  voiceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
    marginTop: 8,
  },
  recDot: {
    width: 8, height: 8, borderRadius: 4,
  },
  waveform: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    height: 20,
  },
  wbar: {
    width: 3, borderRadius: 2, opacity: 0.75,
  },
  recTime: {
    fontSize: 12, fontWeight: '600', fontFamily: Platform.select({ ios: 'System', android: 'sans-serif' }),
  },
  stopBtn: {
    width: 22, height: 22, borderRadius: 11,
    alignItems: 'center', justifyContent: 'center',
  },
  stopSquare: {
    width: 8, height: 8, backgroundColor: '#fff', borderRadius: 2,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  pillText: {
    fontSize: 11, fontWeight: '500',
    fontFamily: Platform.select({ ios: 'System', android: 'sans-serif' }),
    maxWidth: 180,
  },
});

// ── Image Upload Component ─────────────────────────────────────────────────
interface ImageUploadData {
  imageUrl: string | null;
  thumbnailUrl: string | null;
  description: string | null;
  picked: boolean;
  isUploading: boolean;
}

interface ImageWidgetProps {
  imageData: ImageUploadData;
  onDiscard: () => void;
}

function ImageWidget({ imageData, onDiscard }: ImageWidgetProps) {
  const { colors } = useTheme();
  const { t } = useTranslation();

  if (!imageData.picked && !imageData.isUploading) return null;

  if (imageData.isUploading) {
    return (
      <View style={[imgWidgetStyles.thumb, { backgroundColor: colors.captureCard, borderColor: colors.captureBorder }]}>
        <ActivityIndicator color={colors.captureAccent} />
        <Text style={[imgWidgetStyles.uploadingText, { color: colors.captureMuted }]}>{t('capture.analyzingImage')}</Text>
      </View>
    );
  }

  const uri = imageData.thumbnailUrl || imageData.imageUrl;
  if (!uri) return null;

  return (
    <View style={imgWidgetStyles.thumbWrap}>
      <Image source={{ uri }} style={imgWidgetStyles.thumb} resizeMode="cover" />
      <TouchableOpacity style={imgWidgetStyles.removeBtn} onPress={onDiscard} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <X size={12} color="#fff" strokeWidth={2.5} />
      </TouchableOpacity>
    </View>
  );
}

const imgWidgetStyles = StyleSheet.create({
  thumbWrap: {
    marginTop: 10,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
    alignSelf: 'flex-start',
  },
  thumb: {
    width: 200,
    height: 130,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  uploadingText: {
    fontSize: 12,
    marginTop: 6,
    fontFamily: Platform.select({ ios: 'System', android: 'sans-serif' }),
  },
  removeBtn: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

// ── Block widget components ───────────────────────────────────────────────────

interface VoiceBlockWidgetProps {
  block: VoiceBlock;
  onRemove: () => void;
}

function VoiceBlockWidget({ block, onRemove }: VoiceBlockWidgetProps) {
  const { colors } = useTheme();
  const fmtDuration = (s: number) =>
    `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  return (
    <View style={[widgetStyles.pill, { backgroundColor: 'rgba(232,132,74,0.10)', borderColor: 'rgba(232,132,74,0.35)', marginTop: 8 }]}>
      <Mic size={12} color={colors.captureAccent} strokeWidth={2.2} />
      <Text style={[widgetStyles.pillText, { color: colors.captureAccent }]}>
        {block.transcription
          ? block.transcription.slice(0, 40) + (block.transcription.length > 40 ? '…' : '')
          : fmtDuration(block.duration)}
      </Text>
      <TouchableOpacity onPress={onRemove} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <X size={12} color={colors.captureMuted} strokeWidth={2.2} />
      </TouchableOpacity>
    </View>
  );
}

interface ImageBlockWidgetProps {
  block: ImageBlock;
  onRemove: () => void;
  onChangeCaption: (v: string) => void;
}

function ImageBlockWidget({ block, onRemove, onChangeCaption }: ImageBlockWidgetProps) {
  const { colors } = useTheme();
  const { t } = useTranslation();

  if (block.uploading) {
    return (
      <View style={[imgWidgetStyles.thumb, { backgroundColor: colors.captureCard, borderColor: colors.captureBorder, marginTop: 10 }]}>
        <ActivityIndicator color={colors.captureAccent} />
        <Text style={[imgWidgetStyles.uploadingText, { color: colors.captureMuted }]}>{t('capture.analyzingImage')}</Text>
      </View>
    );
  }

  const uri = block.thumbnailUrl || block.imageUrl;
  if (!uri) return null;

  return (
    <View style={{ marginTop: 10 }}>
      <View style={imgWidgetStyles.thumbWrap}>
        <Image source={{ uri }} style={imgWidgetStyles.thumb} resizeMode="cover" />
        <TouchableOpacity style={imgWidgetStyles.removeBtn} onPress={onRemove} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <X size={12} color="#fff" strokeWidth={2.5} />
        </TouchableOpacity>
      </View>
      {!!block.description && (
        <Text style={[{ marginTop: 5, fontSize: 12, lineHeight: 17, fontStyle: 'italic' }, { color: colors.captureMuted, fontFamily: 'DMSans_400Regular' }]} numberOfLines={2}>
          {block.description}
        </Text>
      )}
      <TextInput
        style={[{ marginTop: 6, minHeight: 60, fontSize: 14, lineHeight: 20, borderRadius: 10, padding: 10, borderWidth: 1, textAlignVertical: 'top' }, { color: colors.captureText, borderColor: colors.captureBorder, fontFamily: 'DMSans_400Regular' }]}
        placeholder={t('capture.imageCaptionPlaceholder')}
        placeholderTextColor={colors.captureMuted}
        multiline
        value={block.caption}
        onChangeText={onChangeCaption}
        textAlignVertical="top"
      />
    </View>
  );
}

interface LinkBlockWidgetProps {
  block: LinkBlock;
  onChangeUrl: (v: string) => void;
  onRemove: () => void;
}

function LinkBlockWidget({ block, onChangeUrl, onRemove }: LinkBlockWidgetProps) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  return (
    <View style={{ marginTop: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <TextInput
          style={[{ flex: 1, fontSize: 15, lineHeight: 22, borderRadius: 10, padding: 10, borderWidth: 1 }, { color: colors.captureText, borderColor: block.error ? colors.error : colors.captureBorder, fontFamily: 'DMSans_400Regular' }]}
          placeholder={t('capture.linkBlockPlaceholder')}
          placeholderTextColor={colors.captureMuted}
          value={block.url}
          onChangeText={onChangeUrl}
          keyboardType="url"
          autoCapitalize="none"
          autoCorrect={false}
        />
        <TouchableOpacity onPress={onRemove} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <X size={16} color={colors.captureMuted} strokeWidth={2} />
        </TouchableOpacity>
      </View>
      {!!block.error && (
        <Text style={{ fontSize: 12, marginTop: 4, color: colors.error }}>{block.error}</Text>
      )}
    </View>
  );
}

interface TextBlockWidgetProps {
  block: TextBlock;
  isFirst: boolean;
  onChange: (v: string) => void;
}

function TextBlockWidget({ block, isFirst, onChange }: TextBlockWidgetProps) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  return (
    <TextInput
      style={[{ fontSize: 15, lineHeight: 24, minHeight: 48 }, { color: colors.captureText, fontFamily: 'DMSans_400Regular' }]}
      placeholder={isFirst ? t('capture.composerPlaceholder') : t('capture.textBlockPlaceholder')}
      placeholderTextColor={colors.captureMuted}
      multiline
      autoFocus={isFirst}
      value={block.content}
      onChangeText={onChange}
      textAlignVertical="top"
      autoCapitalize="sentences"
      autoCorrect
    />
  );
}

// ── End block widget components ───────────────────────────────────────────────

interface ComposerRowProps {
  blocks: LocalBlock[];
  onUpdateBlock: (id: string, patch: Partial<LocalBlock>) => void;
  onRemoveBlock: (id: string) => void;
  onSelectHint: (label: string) => void;
  recordingStatus: 'idle' | 'recording' | 'uploading';
  recordingDuration: number;
  onStartRecording: () => void;
  onStopRecording: () => void;
  clipboardUrl: string | null;
  clipOpacity: Animated.Value;
  clipSaving: boolean;
  onQuickSaveLink: () => void;
  onUseClipboardUrl: () => void;
  onDismissClipboard: () => void;
  onAddImage: () => void;
  onAddLink: () => void;
  username: string;
}

function ComposerRow({
  blocks, onUpdateBlock, onRemoveBlock, onSelectHint,
  recordingStatus, recordingDuration,
  onStartRecording, onStopRecording,
  clipboardUrl, clipOpacity, clipSaving, onQuickSaveLink, onUseClipboardUrl, onDismissClipboard,
  onAddImage, onAddLink,
  username,
}: ComposerRowProps) {
  const { t } = useTranslation();
  const { colors, isDark } = useTheme();

  const initial = username.charAt(0).toUpperCase();
  const isRecording = recordingStatus === 'recording' || recordingStatus === 'uploading';
  const hasVoice = blocks.some((b) => b.type === 'voice');
  const hasImage = blocks.some((b) => b.type === 'image');
  const hasLink = blocks.some((b) => b.type === 'link');
  const showChips = blocks.length === 0;

  return (
    <View style={composerStyles.row}>

      {/* ── Avatar column ── */}
      <View style={composerStyles.avatarCol}>
        <LinearGradient
          colors={['#F2B67E', '#C2600A']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={composerStyles.avatarCircle}
        >
          <Text style={composerStyles.avatarInitial}>{initial}</Text>
        </LinearGradient>
        {/* Thread line + node dot */}
        <View style={composerStyles.threadWrapper}>
          <View style={[composerStyles.threadLine, { backgroundColor: isDark ? 'rgba(232,132,74,0.2)' : 'rgba(194,96,10,0.12)' }]} />
          <View style={[composerStyles.threadNode, { backgroundColor: colors.captureAccent }]} />
          <View style={[composerStyles.threadLineFlex, { backgroundColor: isDark ? 'rgba(232,132,74,0.1)' : 'rgba(194,96,10,0.07)' }]} />
        </View>
      </View>

      {/* ── Content column ── */}
      <View style={composerStyles.contentCol}>

        {/* Author row */}
        <View style={composerStyles.authorRow}>
          <Text style={[composerStyles.authorName, { color: colors.captureText }]}>{username}</Text>
          <Text style={[composerStyles.authorTime, { color: colors.captureMuted }]}>{t('capture.justNow')}</Text>
        </View>

        {/* Block list */}
        {blocks.map((block, idx) => {
          if (block.type === 'text') {
            return (
              <TextBlockWidget
                key={block.id}
                block={block}
                isFirst={idx === 0}
                onChange={(v) => onUpdateBlock(block.id, { content: v } as Partial<TextBlock>)}
              />
            );
          }
          if (block.type === 'image') {
            return (
              <ImageBlockWidget
                key={block.id}
                block={block}
                onRemove={() => onRemoveBlock(block.id)}
                onChangeCaption={(v) => onUpdateBlock(block.id, { caption: v } as Partial<ImageBlock>)}
              />
            );
          }
          if (block.type === 'voice') {
            return (
              <VoiceBlockWidget
                key={block.id}
                block={block}
                onRemove={() => onRemoveBlock(block.id)}
              />
            );
          }
          if (block.type === 'link') {
            return (
              <LinkBlockWidget
                key={block.id}
                block={block}
                onChangeUrl={(v) => onUpdateBlock(block.id, { url: v, error: '' } as Partial<LinkBlock>)}
                onRemove={() => onRemoveBlock(block.id)}
              />
            );
          }
          return null;
        })}

        {/* Hint chips — visible when empty */}
        {showChips && <HintChips onSelect={onSelectHint} />}

        {/* Recording in-progress pill */}
        {isRecording && (
          <View style={[widgetStyles.pill, { backgroundColor: 'rgba(232,132,74,0.10)', borderColor: 'rgba(232,132,74,0.35)', marginTop: 8 }]}>
            <Mic size={12} color={colors.captureAccent} strokeWidth={2.2} />
            <Text style={[widgetStyles.pillText, { color: colors.captureAccent }]}>
              {recordingStatus === 'uploading'
                ? t('capture.voiceBlockUploading')
                : `${t('capture.voiceBlockRecording')} ${Math.floor(recordingDuration / 60)}:${String(recordingDuration % 60).padStart(2, '0')}`}
            </Text>
            {recordingStatus === 'recording' && (
              <TouchableOpacity onPress={onStopRecording} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <X size={12} color={colors.captureMuted} strokeWidth={2.2} />
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Clipboard URL banner */}
        {clipboardUrl ? (
          <Animated.View style={[composerStyles.clipCard, { opacity: clipOpacity, backgroundColor: colors.subtleBg, borderColor: colors.captureBorder }]}>
            <View style={composerStyles.clipLeft}>
              <Link2 size={13} color={colors.brandAccent} strokeWidth={2.4} />
              <View style={{ flex: 1 }}>
                <Text style={[composerStyles.clipTitle, { color: colors.captureMuted }]}>{t('capture.clipboardDetected')}</Text>
                <Text style={[composerStyles.clipUrl, { color: colors.brandAccent }]} numberOfLines={1}>{clipboardUrl}</Text>
              </View>
            </View>
            <View style={composerStyles.clipActions}>
              <TouchableOpacity onPress={onQuickSaveLink} disabled={clipSaving} style={[composerStyles.clipSaveBtn, { backgroundColor: colors.brandAccent }]}>
                {clipSaving ? <ActivityIndicator color="#FFF" size="small" /> : <Text style={composerStyles.clipSaveText}>{t('capture.quickSave')}</Text>}
              </TouchableOpacity>
              <TouchableOpacity onPress={onUseClipboardUrl} style={[composerStyles.clipUseBtn, { borderColor: colors.brandAccent }]}>
                <Text style={[composerStyles.clipUseText, { color: colors.brandAccent }]}>{t('capture.useLink')}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={onDismissClipboard} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <X size={14} color={colors.captureMuted} strokeWidth={2.2} />
              </TouchableOpacity>
            </View>
          </Animated.View>
        ) : null}

        {/* ── Attachment icon row ── */}
        <View style={[composerStyles.attachmentDivider, { borderTopColor: colors.captureBorder }]}>
          <View style={composerStyles.attachmentRow}>
            <TouchableOpacity
              onPress={onAddImage}
              disabled={isRecording}
              style={{ opacity: isRecording ? 0.3 : 1 }}
              accessibilityRole="button"
              accessibilityLabel={t('capture.toolbarImageA11y')}
            >
              <ImageIcon size={20} color={hasImage ? colors.captureAccent : colors.captureMuted} strokeWidth={1.8} />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={isRecording ? onStopRecording : onStartRecording}
              accessibilityRole="button"
              accessibilityLabel={t('capture.toolbarVoiceA11y')}
            >
              <Mic size={20} color={isRecording || hasVoice ? colors.captureAccent : colors.captureMuted} strokeWidth={isRecording ? 2.4 : 1.8} />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={onAddLink}
              disabled={isRecording}
              style={{ opacity: isRecording ? 0.3 : 1 }}
              accessibilityRole="button"
              accessibilityLabel={t('capture.toolbarLinkA11y')}
            >
              <Link2 size={20} color={hasLink ? colors.captureAccent : colors.captureMuted} strokeWidth={hasLink ? 2.4 : 1.8} />
            </TouchableOpacity>
          </View>
        </View>

      </View>
    </View>
  );
}

const composerStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    alignItems: 'flex-start',
  },
  // ── Avatar column ──
  avatarCol: {
    width: 50,
    alignItems: 'center',
    flexShrink: 0,
  },
  avatarCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 18,
    color: '#fff',
  },
  threadWrapper: {
    alignItems: 'center',
    marginTop: 4,
    height: 56,
  },
  threadLine: {
    width: 2,
    height: 18,
    borderRadius: 1,
  },
  threadNode: {
    width: 8,
    height: 8,
    borderRadius: 4,
    opacity: 0.65,
  },
  threadLineFlex: {
    width: 2,
    height: 30,
    borderRadius: 1,
    marginTop: 4,
  },
  // ── Content column ──
  contentCol: {
    flex: 1,
    paddingTop: 2,
    paddingLeft: 4,
    flexShrink: 1,
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    marginBottom: 8,
  },
  authorName: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 15,
  },
  authorTime: {
    fontSize: 12,
    fontFamily: 'DMSans_400Regular',
  },
  input: {
    fontSize: 15,
    lineHeight: 24,
    minHeight: 48,
  },
  photoNote: {
    marginTop: 10,
    minHeight: 60,
    fontSize: 14,
    lineHeight: 20,
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    textAlignVertical: 'top',
  },
  linkInputWrapper: {
    marginTop: 8,
  },
  linkInput: {
    fontSize: 15,
    lineHeight: 22,
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
  },
  linkError: {
    fontSize: 12,
    marginTop: 4,
  },
  clipCard: {
    borderRadius: 12,
    borderWidth: 1.5,
    padding: 10,
    marginTop: 10,
    gap: 6,
  },
  clipLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  clipTitle: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    fontFamily: 'DMSans_600SemiBold',
  },
  clipUrl: {
    fontSize: 12,
    marginTop: 2,
    fontFamily: 'DMSans_400Regular',
  },
  clipActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  clipSaveBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  clipSaveText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '600',
  },
  clipUseBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
  },
  clipUseText: {
    fontSize: 12,
    fontWeight: '600',
  },
  // ── Inline attachment row ──
  attachmentDivider: {
    marginTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 10,
  },
  attachmentRow: {
    flexDirection: 'row',
    gap: 20,
    alignItems: 'center',
  },
});

function HintChips({ onSelect, embedded = false }: { onSelect: (label: string) => void; embedded?: boolean }) {
  const { t } = useTranslation();
  const { colors, isDark } = useTheme();

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={hintStyles.scroll}
      style={[hintStyles.container, !embedded && { backgroundColor: colors.captureBg }]}
    >
      {HINT_CHIPS.map((chip) => (
        <TouchableOpacity
          key={chip.labelKey}
          onPress={() => onSelect(t(chip.labelKey))}
          style={[
            hintStyles.chip,
            {
              backgroundColor: isDark ? chip.darkBg : chip.bg,
              borderColor: isDark ? chip.darkBorder : chip.border,
            },
          ]}
          activeOpacity={0.75}
          accessibilityRole="button"
          accessibilityLabel={t(chip.labelKey)}
        >
          <Text style={[hintStyles.chipText, { color: isDark ? chip.darkText : chip.text }]}>{t(chip.labelKey)}</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

const hintStyles = StyleSheet.create({
  container: {
    flexShrink: 0,
    height: 36,
    marginTop: 6,
  },
  scroll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 2,
    paddingBottom: 2,
    paddingTop: 2,
  },
  chip: {
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chipText: {
    fontSize: 12,
    fontFamily: 'DMSans_500Medium',
  },
});

export default function CaptureScreen() {
  const { t } = useTranslation();
  const { colors, isDark } = useTheme();
  const { user } = useAuthStore();
  const params = useLocalSearchParams<{ mode?: string }>();
  const [blocks, setBlocks] = useState<LocalBlock[]>([{ id: genId(), type: 'text', content: '' }]);
  const username = user?.name || user?.email?.split('@')[0] || 'me';
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const successOpacity = useRef(new Animated.Value(0)).current;
  const successScale = useRef(new Animated.Value(0.8)).current;
  const recordingRef = useRef<Audio.Recording | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [recordingStatus, setRecordingStatus] = useState<'idle' | 'recording' | 'uploading'>('idle');
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [reduceMotionEnabled, setReduceMotionEnabled] = useState(false);

  // ── Block helpers ──
  const addBlock = (block: LocalBlock) => setBlocks((prev) => [...prev, block]);
  const removeBlock = (id: string) => setBlocks((prev) => prev.filter((b) => b.id !== id));
  const updateBlock = (id: string, patch: Partial<LocalBlock>) =>
    setBlocks((prev) => prev.map((b) => (b.id === id ? ({ ...b, ...patch } as LocalBlock) : b)));

  // ── Smart clipboard detection ──
  const [clipboardUrl, setClipboardUrl] = useState<string | null>(null);
  const [clipSaving, setClipSaving] = useState(false);
  const clipOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    (async () => {
      try {
        const clip = await ExpoClipboard.getStringAsync();
        if (clip && /^https?:\/\/.+/i.test(clip.trim())) {
          setClipboardUrl(clip.trim());
          if (reduceMotionEnabled) {
            clipOpacity.setValue(1);
          } else {
            Animated.timing(clipOpacity, { toValue: 1, duration: 180, useNativeDriver: true }).start();
          }
        }
      } catch { }
    })();
  }, [reduceMotionEnabled]);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        if (mounted) setReduceMotionEnabled(enabled);
      })
      .catch(() => {
        if (mounted) setReduceMotionEnabled(false);
      });

    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', (enabled) => {
      setReduceMotionEnabled(enabled);
    });

    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);

  const fadeOutClipboard = (onEnd?: () => void) => {
    if (reduceMotionEnabled) {
      clipOpacity.setValue(0);
      onEnd?.();
      return;
    }
    Animated.timing(clipOpacity, { toValue: 0, duration: 140, useNativeDriver: true }).start(() => {
      onEnd?.();
    });
  };

  const handleQuickSaveLink = async () => {
    if (!clipboardUrl) return;
    setClipSaving(true);
    try {
      await memoriesApi.create({ type: 'link', content: clipboardUrl });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      fadeOutClipboard(() => {
        setClipboardUrl(null);
      });
      router.back();
    } catch (error) {
      if (handleDuplicateLinkError(error)) return;
      Alert.alert(t('capture.error'), t('capture.linkSaveFailed'));
    } finally {
      setClipSaving(false);
    }
  };

  const dismissClipboard = () => {
    fadeOutClipboard(() => {
      setClipboardUrl(null);
    });
  };

  const useClipboardUrl = () => {
    if (!clipboardUrl) return;
    addBlock({ id: genId(), type: 'link', url: clipboardUrl, error: '' });
    dismissClipboard();
  };
  // ── End clipboard detection ──

  // ── Deep-link mode bootstrap ──
  useEffect(() => {
    if (params.mode === 'link') addBlock({ id: genId(), type: 'link', url: '', error: '' });
    if (params.mode === 'voice') startVoiceRecording();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // mount-only
  // ── End deep-link mode bootstrap ──

  // ── Voice recording ──
  const startVoiceRecording = async () => {
    try {
      const { status: permStatus } = await Audio.requestPermissionsAsync();
      if (permStatus !== 'granted') {
        Alert.alert(t('capture.permissionRequired'), t('capture.microphonePermission'));
        return;
      }
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording } = await Audio.Recording.createAsync(OPTIMIZED_RECORDING_OPTIONS);
      recordingRef.current = recording;
      setRecordingStatus('recording');
      setRecordingDuration(0);
      timerRef.current = setInterval(() => setRecordingDuration((d) => d + 1), 1000);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch (err) {
      Alert.alert(t('capture.recordingError'), t('capture.recordingErrorMessage'));
      console.error('startVoiceRecording error:', err);
    }
  };

  const stopVoiceRecording = async () => {
    if (!recordingRef.current) return;
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    const finalDuration = recordingDuration;
    setRecordingStatus('uploading');
    try {
      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      recordingRef.current = null;
      if (!uri) throw new Error('No recording URI');
      const result = await storageApi.uploadAudio(uri);
      const blockId = genId();
      addBlock({
        id: blockId,
        type: 'voice',
        audioUrl: result.audio_url || null,
        transcription: result.transcription || null,
        duration: finalDuration,
      });
      setBlocks((prev) => {
        const last = prev[prev.length - 1];
        if (last?.type === 'text' && last.content === '') return prev;
        return [...prev, { id: genId(), type: 'text', content: '' }];
      });
    } catch (err) {
      console.error('stopVoiceRecording error:', err);
    } finally {
      setRecordingStatus('idle');
      setRecordingDuration(0);
    }
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      recordingRef.current?.stopAndUnloadAsync().catch(() => { });
    };
  }, []);
  // ── End voice recording ──

  // ── Image pick/upload ──
  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(t('capture.permissionRequired'), t('capture.photoLibraryPermission'));
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 1,
    });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    let optimizedUri = asset.uri;
    try {
      const optimized = await optimizeImage(asset.uri);
      optimizedUri = optimized.uri;
    } catch (err) {
      console.warn('Image optimization failed, uploading original:', err);
    }
    const blockId = genId();
    addBlock({ id: blockId, type: 'image', imageUrl: null, thumbnailUrl: null, description: null, caption: '', uploading: true });
    try {
      const uploadResult = await storageApi.uploadImage(optimizedUri);
      updateBlock(blockId, {
        imageUrl: uploadResult.image_url ?? null,
        thumbnailUrl: uploadResult.thumbnail_url ?? null,
        description: uploadResult.description ?? null,
        uploading: false,
      } as Partial<ImageBlock>);
      setBlocks((prev) => {
        const last = prev[prev.length - 1];
        if (last?.type === 'text' && last.content === '') return prev;
        return [...prev, { id: genId(), type: 'text', content: '' }];
      });
    } catch (err) {
      console.error('Image upload error:', err);
      removeBlock(blockId);
      Alert.alert(t('capture.error'), t('capture.saveFailed'));
    }
  };

  const handleAddLink = () => {
    addBlock({ id: genId(), type: 'link', url: '', error: '' });
    setBlocks((prev) => {
      const last = prev[prev.length - 1];
      if (last?.type === 'text' && last.content === '') return prev;
      return [...prev, { id: genId(), type: 'text', content: '' }];
    });
  };
  // ── End image pick/upload ──

  const handleDuplicateLinkError = (error: unknown): boolean => {
    if (getHttpStatus(error) !== 409) return false;
    const existingId = getExistingMemoryId(error);
    Alert.alert(
      t('capture.linkAlreadyExistsTitle'),
      t('capture.linkAlreadyExistsMessage'),
      [
        { text: t('common.close'), style: 'cancel' },
        {
          text: t('capture.openExistingMemory'),
          onPress: () => {
            if (typeof existingId === 'string' && existingId.length > 0) {
              router.push(`/memory/${existingId}`);
            }
          },
        },
      ],
    );
    return true;
  };

  const handleSave = async () => {
    // Validate link blocks
    const linkBlocks = blocks.filter((b): b is LinkBlock => b.type === 'link');
    for (const lb of linkBlocks) {
      if (!lb.url.trim()) {
        updateBlock(lb.id, { error: t('capture.linkError') } as Partial<LinkBlock>);
        return;
      }
      if (!/^https?:\/\/.+/i.test(lb.url.trim())) {
        updateBlock(lb.id, { error: t('capture.linkError') } as Partial<LinkBlock>);
        return;
      }
    }

    setIsSaving(true);
    try {
      await _doSave();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSaveSuccess(true);
      if (reduceMotionEnabled) {
        successOpacity.setValue(1);
        successScale.setValue(1);
        setTimeout(() => router.back(), 600);
      } else {
        Animated.parallel([
          Animated.timing(successOpacity, { toValue: 1, duration: 180, useNativeDriver: true }),
          Animated.spring(successScale, { toValue: 1, friction: 6, useNativeDriver: true }),
        ]).start(() => {
          setTimeout(() => router.back(), 600);
        });
      }
    } catch (error) {
      console.error('Failed to save:', error);
      if (handleDuplicateLinkError(error)) return;
      Alert.alert(t('capture.error'), t('capture.saveFailed'));
    } finally {
      setIsSaving(false);
    }
  };

  const _doSave = async () => {
    const nonEmptyBlocks = blocks.filter((b) => {
      if (b.type === 'text') return b.content.trim().length > 0;
      if (b.type === 'image') return !b.uploading && !!b.imageUrl;
      if (b.type === 'voice') return !!b.audioUrl;
      if (b.type === 'link') return /^https?:\/\/.+/i.test(b.url.trim());
      return false;
    });

    // Single-type backwards-compatible routing
    if (nonEmptyBlocks.length === 1) {
      const b = nonEmptyBlocks[0];
      if (b.type === 'voice') {
        await memoriesApi.create({
          type: 'voice',
          content: b.transcription || t('capture.voiceNote'),
          transcription: b.transcription ?? undefined,
          audio_url: b.audioUrl ?? undefined,
        });
        return;
      }
      if (b.type === 'image') {
        await memoriesApi.create({
          type: 'photo',
          content: b.description || b.caption.trim() || t('capture.imageNote'),
          image_url: b.imageUrl ?? undefined,
          metadata: b.thumbnailUrl ? { thumbnail_url: b.thumbnailUrl, user_note: b.caption.trim() || undefined } : (b.caption.trim() ? { user_note: b.caption.trim() } : undefined),
        });
        return;
      }
      if (b.type === 'link') {
        await memoriesApi.create({ type: 'link', content: b.url.trim() });
        return;
      }
      if (b.type === 'text') {
        await memoriesApi.create({ type: 'text', content: b.content.trim() });
        return;
      }
    }

    // Multi-block: save as rich
    const apiBlocks = nonEmptyBlocks.map((b, i) => {
      if (b.type === 'text') return { type: 'text' as const, order_index: i, content: b.content.trim() };
      if (b.type === 'image') return { type: 'image' as const, order_index: i, image_url: b.imageUrl, thumbnail_url: b.thumbnailUrl, caption: b.caption || b.description || undefined };
      if (b.type === 'voice') return { type: 'voice' as const, order_index: i, audio_url: b.audioUrl, transcription: b.transcription, duration: b.duration };
      // link
      const lb = b as LinkBlock;
      return { type: 'link' as const, order_index: i, url: lb.url.trim() };
    });
    const textContent = nonEmptyBlocks
      .filter((b): b is TextBlock => b.type === 'text')
      .map((b) => b.content.trim())
      .join(' ')
      .slice(0, 500);
    await memoriesApi.create({ type: 'rich', content: textContent, blocks: apiBlocks });
  };

  const canSave = blocks.some((b) => {
    if (b.type === 'text') return b.content.trim().length > 0;
    if (b.type === 'image') return !b.uploading && !!b.imageUrl;
    if (b.type === 'voice') return !!b.audioUrl;
    if (b.type === 'link') return /^https?:\/\/.+/i.test(b.url.trim());
    return false;
  });

  const totalChars = blocks
    .filter((b): b is TextBlock => b.type === 'text')
    .reduce((s, b) => s + b.content.length, 0);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.captureBg }]} edges={['top', 'bottom']}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: colors.captureBorder, backgroundColor: colors.captureBg }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.cancelBtn} activeOpacity={0.7}>
            <Text style={[styles.cancelText, { color: colors.captureMuted }]}>{t('capture.cancel')}</Text>
          </TouchableOpacity>

          <Text style={[styles.title, { color: colors.captureText }]}>{t('capture.title')}</Text>

          <TouchableOpacity
            onPress={handleSave}
            disabled={!canSave || isSaving}
            style={[styles.saveBtn, { opacity: canSave && !isSaving ? 1 : 0.55 }]}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={canSave && !isSaving ? ['#F2B67E', '#C2600A'] : [colors.captureCard, colors.captureCard]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.saveBtnGradient}
            >
              {isSaving ? (
                <ActivityIndicator color={canSave ? '#fff' : colors.captureMuted} size="small" />
              ) : (
                <Text style={[styles.saveBtnText, { color: canSave && !isSaving ? '#fff' : colors.captureMuted }]}>
                  {t('capture.save')}
                </Text>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* Composer */}
        <ScrollView
          style={{ flex: 1 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ flexGrow: 1 }}
        >
          <ComposerRow
            blocks={blocks}
            onUpdateBlock={updateBlock}
            onRemoveBlock={removeBlock}
            onSelectHint={(label) => {
              const firstText = blocks.find((b): b is TextBlock => b.type === 'text');
              if (firstText) {
                updateBlock(firstText.id, { content: firstText.content ? `${label} ${firstText.content}` : `${label} ` } as Partial<TextBlock>);
              } else {
                addBlock({ id: genId(), type: 'text', content: `${label} ` });
              }
            }}
            recordingStatus={recordingStatus}
            recordingDuration={recordingDuration}
            onStartRecording={startVoiceRecording}
            onStopRecording={stopVoiceRecording}
            clipboardUrl={clipboardUrl}
            clipOpacity={clipOpacity}
            clipSaving={clipSaving}
            onQuickSaveLink={handleQuickSaveLink}
            onUseClipboardUrl={useClipboardUrl}
            onDismissClipboard={dismissClipboard}
            onAddImage={pickImage}
            onAddLink={handleAddLink}
            username={username}
          />
        </ScrollView>

        {/* Bottom bar: privacy signal + char count */}
        <View style={[styles.bottomBar, { backgroundColor: colors.captureBg, borderTopColor: colors.captureBorder }]}>
          <View style={styles.bottomBarLeft}>
            <Lock size={13} color={colors.captureMuted} strokeWidth={2} />
            <Text style={[styles.bottomBarText, { color: colors.captureMuted }]}>{t('capture.alwaysPrivate')}</Text>
          </View>
          <Text style={[styles.charCount, { color: totalChars > 450 ? colors.warning : colors.captureBorder }]}>
            {500 - totalChars}
          </Text>
        </View>
      </KeyboardAvoidingView>

      {/* Success overlay */}
      {saveSuccess && (
        <Animated.View style={[styles.successOverlay, { opacity: successOpacity }]} pointerEvents="none">
          <Animated.View style={[styles.successBubble, { transform: [{ scale: successScale }] }]}>
            <Text style={styles.successIcon}>✓</Text>
            <Text style={styles.successText}>{t('capture.saved')}</Text>
          </Animated.View>
        </Animated.View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  keyboardView: { flex: 1 },

  // ── Header ──
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  cancelBtn: {
    minWidth: 64,
    alignItems: 'flex-start',
    justifyContent: 'center',
    paddingVertical: 6,
  },
  cancelText: {
    fontSize: 15,
    fontFamily: Platform.select({ ios: 'System', android: 'sans-serif' }),
  },
  title: { fontSize: 17, fontWeight: '600', fontFamily: SANS_FONT },
  saveBtn: {
    minWidth: 64,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
  },
  saveBtnGradient: {
    minWidth: 64,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  saveBtnText: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 14,
  },
  headingBlock: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 4,
  },
  headingTitle: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 20,
    letterSpacing: -0.3,
  },
  headingSub: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 13,
    marginTop: 4,
    lineHeight: 18,
  },

  // ── Bottom bar ──
  bottomBar: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  bottomBarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  bottomBarText: {
    fontSize: 13,
    fontFamily: 'DMSans_400Regular',
  },
  charCount: {
    fontSize: 12,
    fontWeight: '600',
    fontFamily: Platform.select({ ios: 'System', android: 'sans-serif' }),
  },

  // ── Success overlay ──
  successOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 999,
  },
  successBubble: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#111111',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  successIcon: { fontSize: 36, color: '#FFF', fontWeight: '700' },
  successText: { fontSize: 13, color: '#FFF', fontWeight: '600', fontFamily: SANS_FONT },
});
