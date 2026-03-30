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
import * as ExpoClipboard from 'expo-clipboard';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Audio } from 'expo-av';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { memoriesApi, storageApi } from '../services/api';
import { useTheme } from '../constants/ThemeContext';
import { useSettingsStore } from '../store/settingsStore';
import { useAuthStore } from '../store/authStore';
import { optimizeImage, OPTIMIZED_RECORDING_OPTIONS } from '../utils/mediaOptimizer';
import {
  FileText,
  Mic,
  Link2,
  Image as ImageIcon,
} from 'lucide-react-native';

const SANS_FONT = Platform.select({ ios: 'System', android: 'sans-serif', default: 'System' });

type CaptureMode = 'text' | 'voice' | 'link' | 'photo';

// ── Avatar initials helper ─────────────────────────────────────────────────
function getInitials(name?: string, email?: string): string {
  if (name) {
    const parts = name.trim().split(' ');
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return name[0].toUpperCase();
  }
  if (email) return email[0].toUpperCase();
  return '?';
}

const MODE_META: Record<CaptureMode, {
  labelKey: string;
  navLabelKey: string;
  descKey: string;
  hintKey: string;
  icon: typeof FileText;
}> = {
  text: {
    labelKey: 'capture.modeText',
    navLabelKey: 'capture.modeTextNav',
    descKey: 'capture.modeTextDesc',
    hintKey: 'capture.smartHintText',
    icon: FileText,
  },
  voice: {
    labelKey: 'capture.modeVoice',
    navLabelKey: 'capture.modeVoiceNav',
    descKey: 'capture.modeVoiceDesc',
    hintKey: 'capture.smartHintVoice',
    icon: Mic,
  },
  link: {
    labelKey: 'capture.modeLink',
    navLabelKey: 'capture.modeLinkNav',
    descKey: 'capture.modeLinkDesc',
    hintKey: 'capture.smartHintLink',
    icon: Link2,
  },
  photo: {
    labelKey: 'capture.modePhoto',
    navLabelKey: 'capture.modePhotoNav',
    descKey: 'capture.modePhotoDesc',
    hintKey: 'capture.smartHintPhoto',
    icon: ImageIcon,
  },
};

const MODE_DEFINITIONS: { key: CaptureMode }[] = [
  { key: 'text' },
  { key: 'voice' },
  { key: 'link' },
  { key: 'photo' },
];

function BottomModeBar({
  mode,
  onSelect,
}: {
  mode: CaptureMode;
  onSelect: (m: CaptureMode) => void;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();

  return (
    <View style={[modeBarStyles.wrap, { borderTopColor: colors.border, backgroundColor: colors.bg }]}>
      <View style={[modeBarStyles.barShell, { backgroundColor: colors.inputBg, borderColor: colors.border }]}> 
        {MODE_DEFINITIONS.map(({ key }) => {
          const modeMeta = MODE_META[key];
          const Icon = modeMeta.icon;
          const active = key === mode;

          return (
            <TouchableOpacity
              key={key}
              style={modeBarStyles.chipHitArea}
              onPress={() => { onSelect(key); Haptics.selectionAsync(); }}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={t(modeMeta.labelKey)}
            >
              {active ? (
                <View style={[modeBarStyles.chipActive, { backgroundColor: colors.brandAccentLight, borderColor: `rgba(184, 92, 32, 0.25)` }]}>
                  <Icon size={17} color={colors.brandAccent} strokeWidth={2.5} />
                </View>
              ) : (
                <View style={[modeBarStyles.chipInactive, { borderColor: colors.border }]}>
                  <Icon size={17} color={colors.textMuted} strokeWidth={2.4} />
                </View>
              )}
              <Text style={[modeBarStyles.modeTabText, { color: active ? colors.brandAccent : colors.textMuted }]}>
                {t(modeMeta.labelKey)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const modeBarStyles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  barShell: {
    flexDirection: 'row',
    borderWidth: 0,
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: 4,
    gap: 10,
    justifyContent: 'space-between',
  },
  chipHitArea: {
    flex: 1,
    alignItems: 'center',
    flexDirection: 'column',
  },
  chipActive: {
    width: 44,
    height: 44,
    borderRadius: 22,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  chipInactive: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeTabText: {
    fontFamily: 'DMSans_600SemiBold',
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 3,
  },
});

interface VoiceData {
  audioUrl: string | null;
  transcription: string | null;
  recorded: boolean;
  isUploading: boolean;
}

interface VoiceRecorderProps {
  onVoiceData: (data: VoiceData) => void;
}

function VoiceRecorder({ onVoiceData }: VoiceRecorderProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [status, setStatus] = useState<'idle' | 'recording' | 'uploading' | 'done'>('idle');
  const [transcription, setTranscription] = useState<string | null>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const recordingRef = useRef<Audio.Recording | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pulseRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (recordingRef.current) recordingRef.current.stopAndUnloadAsync().catch(() => { });
      pulseRef.current?.stop();
    };
  }, []);

  useEffect(() => {
    if (isRecording) {
      pulseRef.current = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.14, duration: 700, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
        ])
      );
      pulseRef.current.start();
    } else {
      pulseRef.current?.stop();
      Animated.timing(pulseAnim, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    }
  }, [isRecording]);

  const startRecording = async () => {
    try {
      const { status: permStatus } = await Audio.requestPermissionsAsync();
      if (permStatus !== 'granted') {
        Alert.alert(t('capture.permissionRequired'), t('capture.microphonePermission'));
        return;
      }
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording } = await Audio.Recording.createAsync(OPTIMIZED_RECORDING_OPTIONS);
      recordingRef.current = recording;
      setIsRecording(true);
      setStatus('recording');
      setDuration(0);
      timerRef.current = setInterval(() => setDuration((d) => d + 1), 1000);
    } catch (err) {
      Alert.alert(t('capture.recordingError'), t('capture.recordingErrorMessage'));
      console.error('startRecording error:', err);
    }
  };

  const stopRecording = async () => {
    if (!recordingRef.current) return;
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    setIsRecording(false);
    setStatus('uploading');
    onVoiceData({ audioUrl: null, transcription: null, recorded: false, isUploading: true });
    try {
      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      recordingRef.current = null;
      if (!uri) throw new Error('No recording URI');
      const result = await storageApi.uploadAudio(uri);
      const tx = result.transcription || null;
      setTranscription(tx);
      setStatus('done');
      onVoiceData({ audioUrl: result.audio_url || null, transcription: tx, recorded: true, isUploading: false });
    } catch (err) {
      console.error('stopRecording / upload error:', err);
      setStatus('done');
      onVoiceData({ audioUrl: null, transcription: null, recorded: true, isUploading: false });
    }
  };

  const fmtDuration = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  return (
    <View style={voiceStyles.container}>
      {/* Pulse ring + button */}
      <View style={voiceStyles.btnWrap}>
        {isRecording && (
          <Animated.View
            style={[voiceStyles.pulseRing, { borderColor: colors.error, transform: [{ scale: pulseAnim }] }]}
          />
        )}
        <TouchableOpacity
          style={[voiceStyles.btn, { backgroundColor: isRecording ? colors.error : colors.accent }]}
          onPress={isRecording ? stopRecording : startRecording}
          activeOpacity={0.85}
          disabled={status === 'uploading'}
        >
          {status === 'uploading' ? (
            <ActivityIndicator color="#FFF" size="large" />
          ) : isRecording ? (
            <View style={voiceStyles.stopSquare} />
          ) : (
            <Mic size={38} color="#FFFFFF" strokeWidth={2.4} />
          )}
        </TouchableOpacity>
      </View>

      <Text style={[voiceStyles.statusText, { color: colors.textPrimary }]}>
        {status === 'idle' && t('capture.tapToRecord')}
        {status === 'recording' && `${t('capture.recording')} ${fmtDuration(duration)}`}
        {status === 'uploading' && t('capture.processingAudio')}
        {status === 'done' && (transcription ? t('capture.transcriptionReady') : t('capture.recordingSaved'))}
      </Text>
      {status === 'recording' && (
        <Text style={[voiceStyles.hintText, { color: colors.textMuted }]}>{t('capture.tapToStop')}</Text>
      )}
      {status === 'done' && transcription && (
        <View style={[voiceStyles.txBox, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
          <Text style={[voiceStyles.txLabel, { color: colors.textMuted }]}>{t('capture.modeVoice')}</Text>
          <Text style={[voiceStyles.txText, { color: colors.textPrimary }]}>{transcription}</Text>
        </View>
      )}
    </View>
  );
}

const voiceStyles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 40 },
  btnWrap: { alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  pulseRing: {
    position: 'absolute',
    width: 136,
    height: 136,
    borderRadius: 68,
    borderWidth: 3,
    opacity: 0.45,
  },
  btn: {
    width: 116,
    height: 116,
    borderRadius: 58,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 18,
    elevation: 10,
  },
  stopSquare: { width: 30, height: 30, backgroundColor: '#FFF', borderRadius: 4 },
  micEmoji: { fontSize: 42 },
  statusText: { fontSize: 16, fontWeight: '500', textAlign: 'center' },
  hintText: { marginTop: 6, fontSize: 13, textAlign: 'center' },
  txBox: { marginTop: 20, padding: 16, borderRadius: 16, borderWidth: 1, maxWidth: '100%' },
  txLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  txText: { fontSize: 15, lineHeight: 22 },
});

// ── Image Upload Component ─────────────────────────────────────────────────
interface ImageUploadData {
  imageUrl: string | null;
  thumbnailUrl: string | null;
  description: string | null;
  picked: boolean;
  isUploading: boolean;
}

interface ImageUploadProps {
  onImageData: (data: ImageUploadData) => void;
}

function ImageUpload({ onImageData }: ImageUploadProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [pickedUri, setPickedUri] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [description, setDescription] = useState<string | null>(null);

  const handlePickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(t('capture.permissionRequired'), t('capture.photoLibraryPermission'));
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 1, // full quality — we compress via optimizeImage below
    });

    if (result.canceled || !result.assets?.[0]) return;

    const asset = result.assets[0];

    // ── Compress & resize before upload ──────────────────────────────────
    let optimizedUri = asset.uri;
    try {
      const optimized = await optimizeImage(asset.uri);
      optimizedUri = optimized.uri;
    } catch (err) {
      console.warn('Image optimization failed, uploading original:', err);
    }

    setPickedUri(optimizedUri);
    setDescription(null);
    setIsUploading(true);
    onImageData({ imageUrl: null, thumbnailUrl: null, description: null, picked: false, isUploading: true });

    try {
      const uploadResult = await storageApi.uploadImage(optimizedUri);
      const desc = uploadResult.description ?? null;
      setDescription(desc);
      setIsUploading(false);
      onImageData({
        imageUrl: uploadResult.image_url ?? null,
        thumbnailUrl: uploadResult.thumbnail_url ?? null,
        description: desc,
        picked: true,
        isUploading: false,
      });
    } catch (err) {
      console.error('Image upload / analysis error:', err);
      setIsUploading(false);
      Alert.alert(t('capture.error'), t('capture.saveFailed'));
      onImageData({ imageUrl: null, thumbnailUrl: null, description: null, picked: false, isUploading: false });
    }
  };

  const handleClear = () => {
    setPickedUri(null);
    setDescription(null);
    onImageData({ imageUrl: null, thumbnailUrl: null, description: null, picked: false, isUploading: false });
  };

  // Empty state — show picker button
  if (!pickedUri) {
    return (
      <View style={imageStyles.emptyContainer}>
        <TouchableOpacity style={[imageStyles.pickButton, { borderColor: colors.border }]} onPress={handlePickImage} activeOpacity={0.8}>
          <View style={[imageStyles.pickIconWrap, { backgroundColor: colors.accentSubtle }]}> 
            <ImageIcon size={28} color={colors.accent} strokeWidth={2.4} />
          </View>
          <Text style={[imageStyles.pickLabel, { color: colors.accent }]}>{t('capture.chooseImage')}</Text>
          <Text style={[imageStyles.pickSub, { color: colors.textMuted }]}>{t('capture.chooseImageSub')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Image selected — show preview + analysis result
  return (
    <ScrollView style={imageStyles.scroll} showsVerticalScrollIndicator={false}>
      <View style={imageStyles.previewContainer}>
        <Image source={{ uri: pickedUri }} style={imageStyles.preview} resizeMode="cover" />
        {isUploading ? (
          <View style={imageStyles.uploadingOverlay}>
            <ActivityIndicator color="#FFFFFF" size="large" />
            <Text style={imageStyles.uploadingText}>{t('capture.analyzingImage')}</Text>
          </View>
        ) : (
          <TouchableOpacity style={imageStyles.clearBtn} onPress={handleClear}>
            <Text style={imageStyles.clearBtnText}>✕  {t('capture.changeImage')}</Text>
          </TouchableOpacity>
        )}
      </View>

      {!isUploading && (
        <View style={[imageStyles.analysisBox, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
          <Text style={[imageStyles.analysisLabel, { color: colors.textMuted }]}>{t('capture.imageAnalysis')}</Text>
          <Text style={[imageStyles.analysisText, { color: colors.textPrimary }]}>
            {description ?? t('capture.imageAnalysisFailed')}
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

const imageStyles = StyleSheet.create({
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickButton: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderStyle: 'dashed',
    gap: 10,
    width: '100%',
  },
  pickIconWrap: {
    width: 58,
    height: 58,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickLabel: {
    fontSize: 17,
    fontWeight: '600',
    fontFamily: SANS_FONT,
  },
  pickSub: {
    fontSize: 14,
    textAlign: 'center',
    fontFamily: SANS_FONT,
  },
  scroll: {
    flex: 1,
  },
  previewContainer: {
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
  },
  preview: {
    width: '100%',
    height: 260,
  },
  uploadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  uploadingText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '500',
    fontFamily: SANS_FONT,
  },
  clearBtn: {
    position: 'absolute',
    bottom: 12,
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  clearBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    fontFamily: SANS_FONT,
  },
  analysisBox: {
    marginTop: 16,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  analysisLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 8,
    fontFamily: SANS_FONT,
  },
  analysisText: {
    fontSize: 15,
    lineHeight: 22,
    fontFamily: SANS_FONT,
  },
});
// ── End Image Upload ──────────────────────────────────────────────────────────

export default function CaptureScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const params = useLocalSearchParams<{ mode?: string }>();
  const preferences = useSettingsStore((s) => s.preferences);
  const user = useAuthStore((s) => s.user);

  // Smart default: explicit param > user preference > 'text'
  const resolveInitialMode = (): CaptureMode => {
    const validModes: CaptureMode[] = ['text', 'voice', 'link', 'photo'];
    if (params.mode && validModes.includes(params.mode as CaptureMode)) return params.mode as CaptureMode;
    if (preferences?.default_capture_type && validModes.includes(preferences.default_capture_type)) return preferences.default_capture_type;
    return 'text';
  };
  const [mode, setMode] = useState<CaptureMode>(resolveInitialMode());
  const [content, setContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const successOpacity = useRef(new Animated.Value(0)).current;
  const successScale = useRef(new Animated.Value(0.8)).current;
  const [linkError, setLinkError] = useState('');
  const [voiceData, setVoiceData] = useState<VoiceData>({
    audioUrl: null,
    transcription: null,
    recorded: false,
    isUploading: false,
  });
  const [imageData, setImageData] = useState<ImageUploadData>({
    imageUrl: null,
    thumbnailUrl: null,
    description: null,
    picked: false,
    isUploading: false,
  });
  const [photoNote, setPhotoNote] = useState('');
  const [reduceMotionEnabled, setReduceMotionEnabled] = useState(false);

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
    } catch {
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
    setContent(clipboardUrl);
    setMode('link');
    dismissClipboard();
  };
  // ── End clipboard detection ──

  const handleSave = async () => {
    // --- Link validation ---
    if (mode === 'link') {
      const url = content.trim();
      if (!url) return;
      if (!/^https?:\/\/.+/i.test(url)) {
        setLinkError(t('capture.linkError'));
        return;
      }
      setLinkError('');
    }

    if (!content.trim() && mode !== 'voice' && mode !== 'photo') return;

    setIsSaving(true);
    try {
      if (mode === 'voice') {
        await memoriesApi.create({
          type: 'voice',
          content: voiceData.transcription || t('capture.voiceNote'),
          transcription: voiceData.transcription ?? undefined,
          audio_url: voiceData.audioUrl ?? undefined,
        });
      } else if (mode === 'photo') {
        const photoMetadata: Record<string, any> = {};
        if (photoNote.trim()) photoMetadata.user_note = photoNote.trim();
        if (imageData.thumbnailUrl) photoMetadata.thumbnail_url = imageData.thumbnailUrl;

        await memoriesApi.create({
          type: 'photo',
          content: imageData.description || t('capture.imageNote'),
          image_url: imageData.imageUrl ?? undefined,
          metadata: Object.keys(photoMetadata).length > 0 ? photoMetadata : undefined,
        });
      } else {
        await memoriesApi.create({ type: mode, content: content.trim() });
      }
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
      Alert.alert(t('capture.error'), t('capture.saveFailed'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => router.back();

  const isVoiceReady = voiceData.recorded && !voiceData.isUploading;
  const isImageReady = imageData.picked && !imageData.isUploading && (!!imageData.imageUrl || !!imageData.thumbnailUrl);
  const canSave =
    mode === 'voice' ? isVoiceReady :
      mode === 'photo' ? isImageReady :
        content.trim().length > 0;

  const initials = getInitials(user?.name, user?.email);
  const displayName = user?.name?.trim() || user?.email?.split('@')[0] || 'You';
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* ── Header (LinkedIn-style) ── */}
        <View style={[styles.header, { borderBottomColor: colors.border, backgroundColor: colors.bg }]}>
          <TouchableOpacity
            onPress={handleCancel}
            style={styles.closeBtn}
            activeOpacity={0.7}
          >
            <Text style={[styles.closeBtnText, { color: colors.textSecondary }]}>{t('common.cancel')}</Text>
          </TouchableOpacity>

          <View style={styles.titleWrap}>
            <Text style={[styles.title, { color: colors.textPrimary }]}>
              🧠 {t('capture.title').toLowerCase()}
            </Text>
          </View>

          <TouchableOpacity
            onPress={handleSave}
            disabled={!canSave || isSaving}
            style={[
              styles.saveBtn,
              { backgroundColor: colors.brandAccent, opacity: canSave && !isSaving ? 1 : 0.38 },
            ]}
            activeOpacity={0.85}
          >
            {isSaving ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.saveBtnText}>{t('capture.save')}</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* ── Clipboard URL Banner ── */}
        {clipboardUrl && (
          <Animated.View style={[styles.clipBanner, { opacity: clipOpacity, backgroundColor: colors.cardBg, borderColor: colors.accentMid }]}>
            <View style={styles.clipBannerLeft}>
              <View style={[styles.clipIconWrap, { borderColor: colors.textMuted }]}> 
                <Link2 size={14} color={colors.brandAccent} strokeWidth={2.4} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.clipTitle, { color: colors.textMuted }]}>{t('capture.clipboardDetected')}</Text>
                <Text style={[styles.clipUrl, { color: colors.brandAccent }]} numberOfLines={1}>{clipboardUrl}</Text>
              </View>
            </View>
            <View style={styles.clipActions}>
              <TouchableOpacity onPress={handleQuickSaveLink} disabled={clipSaving} style={[styles.clipSaveBtn, { backgroundColor: colors.brandAccent }]}> 
                {clipSaving ? <ActivityIndicator color="#FFF" size="small" /> : <Text style={styles.clipSaveText}>{t('capture.quickSave')}</Text>}
              </TouchableOpacity>
              <TouchableOpacity onPress={useClipboardUrl} style={[styles.clipUseBtn, { borderColor: colors.brandAccent }]}> 
                <Text style={[styles.clipUseText, { color: colors.brandAccent }]}>{t('capture.useLink')}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={dismissClipboard} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Text style={[styles.clipDismiss, { color: colors.textMuted }]}>✕</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        )}

        {mode === 'text' || mode === 'link' ? (
          /* Threads-like composer */
          <View style={styles.composerScreenWrap}>
              <View style={[styles.composerRow, { borderColor: colors.border }]}> 
              <View style={[styles.avatar, { backgroundColor: colors.inputBg, borderColor: colors.border }]}> 
                <Text style={[styles.avatarText, { color: colors.textPrimary }]}>{initials}</Text>
              </View>
              <View style={styles.inputWrap}>
                <Text style={[styles.authorName, { color: colors.textPrimary }]}>{displayName}</Text>
                <TextInput
                  style={[styles.composerInput, {
                    color: colors.textPrimary,
                    fontFamily: 'DMSans_400Regular',
                    fontSize: 15,
                  }]}
                  placeholder={mode === 'text' ? t('capture.textPlaceholder') : t('capture.linkPlaceholder')}
                  placeholderTextColor={colors.textPlaceholder}
                  multiline={mode === 'text'}
                  autoFocus
                  value={content}
                  onChangeText={(v) => { setContent(v); if (mode === 'link' && linkError) setLinkError(''); }}
                  textAlignVertical="top"
                  keyboardType={mode === 'link' ? 'url' : 'default'}
                  autoCapitalize={mode === 'link' ? 'none' : 'sentences'}
                  autoCorrect={mode !== 'link'}
                />
                {mode === 'link' && linkError ? (
                  <Text style={[styles.errorText, { color: colors.error }]}>{linkError}</Text>
                ) : null}
              </View>
            </View>

            {/* Quick-tag hints */}
            {mode === 'text' && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.hintsScroll}
              >
                {[
                  t('capture.hintIdea'),
                  t('capture.hintMeeting'),
                  t('capture.hintDecision'),
                  t('capture.hintConversation'),
                  t('capture.hintLearning'),
                ].map((hint) => (
                  <TouchableOpacity
                    key={hint}
                    onPress={() => {
                      setContent((prev) => (prev ? `${hint} ${prev}` : `${hint} `));
                    }}
                    style={[styles.hintChip, { borderColor: colors.border }]}
                  >
                    <Text style={[styles.hintChipText, { color: colors.textMuted }]}>{hint}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </View>
        ) : mode === 'voice' ? (
          <View style={styles.modePanel}>
            <VoiceRecorder onVoiceData={setVoiceData} />
          </View>
        ) : (
          /* Photo */
          <View style={styles.modePanel}>
            <ImageUpload onImageData={(data) => { setImageData(data); if (!data.picked) setPhotoNote(''); }} />
            {imageData.picked && !imageData.isUploading && (
              <TextInput
                style={[styles.photoNoteInput, { color: colors.textPrimary, backgroundColor: colors.inputBg, borderColor: colors.border }]}
                placeholder={t('capture.photoNotePlaceholder')}
                placeholderTextColor={colors.textMuted}
                multiline
                value={photoNote}
                onChangeText={setPhotoNote}
                textAlignVertical="top"
              />
            )}
          </View>
        )}

        {/* ── Bottom mode bar ── */}
        <BottomModeBar
          mode={mode}
          onSelect={(m) => { setMode(m); setContent(''); setLinkError(''); }}
        />
      </KeyboardAvoidingView>

      {/* ── Success overlay ── */}
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
  closeBtn: {
    minWidth: 56,
    minHeight: 32,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  closeBtnText: { fontSize: 14, fontWeight: '500', fontFamily: SANS_FONT },
  titleWrap: {
    alignItems: 'center',
  },
  title: { fontSize: 17, fontWeight: '600', fontFamily: SANS_FONT },
  saveBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    paddingVertical: 7,
    paddingHorizontal: 16,
    minWidth: 56,
    minHeight: 32,
  },
  saveBtnText: {
    fontFamily: 'DMSans_600SemiBold',
    fontSize: 15,
    color: '#FFFFFF',
  },

  // ── Composer (text / link) ──
  composerScreenWrap: {
    flex: 1,
  },
  composerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginHorizontal: 16,
    marginTop: 10,
    paddingHorizontal: 4,
    paddingTop: 4,
    paddingBottom: 8,
    gap: 12,
    minHeight: 180,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  avatarText: { fontSize: 16, fontWeight: '700', fontFamily: SANS_FONT },
  inputWrap: { flex: 1 },
  authorName: {
    fontSize: 15,
    fontWeight: '600',
    marginTop: 2,
    marginBottom: 8,
    fontFamily: SANS_FONT,
  },
  composerInput: {
    fontSize: 16,
    lineHeight: 24,
    minHeight: 140,
    fontFamily: SANS_FONT,
  },
  errorText: { marginTop: 6, fontSize: 13, fontFamily: SANS_FONT },

  // ── Voice / Photo panel ──
  modePanel: { flex: 1, paddingHorizontal: 20, paddingTop: 12 },
  photoNoteInput: {
    marginTop: 14,
    minHeight: 80,
    fontSize: 15,
    lineHeight: 22,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    textAlignVertical: 'top',
    fontFamily: SANS_FONT,
  },

  // ── Clipboard banner ──
  clipBanner: {
    marginHorizontal: 16,
    marginTop: 10,
    padding: 12,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  clipBannerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  clipIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 9,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clipTitle: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4, fontFamily: SANS_FONT },
  clipUrl: { fontSize: 12, marginTop: 2, fontFamily: SANS_FONT },
  clipActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  clipSaveBtn: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8 },
  clipSaveText: { color: '#FFF', fontSize: 12, fontWeight: '600', fontFamily: SANS_FONT },
  clipUseBtn: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8, borderWidth: 1 },
  clipUseText: { fontSize: 12, fontWeight: '600', fontFamily: SANS_FONT },
  clipDismiss: { fontSize: 16, paddingLeft: 4, fontFamily: SANS_FONT },

  // ── Quick-tag hints ──
  hintsScroll: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
    flexDirection: 'row',
  },
  hintChip: {
    borderRadius: 100,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  hintChipText: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 12,
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
