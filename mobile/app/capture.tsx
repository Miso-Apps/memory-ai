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
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Audio } from 'expo-av';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { memoriesApi, storageApi } from '../services/api';
import { useTheme } from '../constants/ThemeContext';
import { useSettingsStore } from '../store/settingsStore';
import { optimizeImage, OPTIMIZED_RECORDING_OPTIONS } from '../utils/mediaOptimizer';
import {
  FileText,
  Mic,
  Link2,
  Image as ImageIcon,
  X,
} from 'lucide-react-native';

const SANS_FONT = Platform.select({ ios: 'System', android: 'sans-serif', default: 'System' });

type CaptureMode = 'text' | 'voice' | 'link' | 'photo';


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

const TEXT_WARN_THRESHOLD = 300;

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

function BottomModeBar({
  mode,
  onSelect,
}: {
  mode: CaptureMode;
  onSelect: (m: CaptureMode) => void;
}) {
  const { t } = useTranslation();
  const { colors, isDark } = useTheme();

  return (
    <View style={[modeBarStyles.wrap, { backgroundColor: colors.captureBg }]}>
      <View style={[modeBarStyles.barShell, { backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : colors.captureCard, borderColor: colors.captureBorder }]}> 
        {MODE_DEFINITIONS.map(({ key }) => {
          const active = key === mode;
          const Icon = MODE_META[key].icon;
          return (
            <TouchableOpacity
              key={key}
              style={[
                modeBarStyles.slot,
                active && {
                  backgroundColor: colors.captureAccent,
                  borderColor: colors.captureAccent,
                  borderRadius: 12,
                },
                !active && { opacity: 0.75 },
              ]}
              onPress={() => { onSelect(key); Haptics.selectionAsync(); }}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={t(MODE_META[key].labelKey)}
            >
              <Icon
                size={17}
                color={active ? colors.captureBg : colors.captureMuted}
                strokeWidth={active ? 2.4 : 2.1}
              />
              <Text style={[
                modeBarStyles.modeTabText,
                { color: active ? colors.captureBg : colors.captureMuted },
              ]}>
                {t(MODE_META[key].navLabelKey)}
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
    paddingTop: 4,
    paddingBottom: 12,
  },
  barShell: {
    flexDirection: 'row',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    padding: 5,
    gap: 3,
  },
  slot: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 7,
    paddingHorizontal: 3,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  modeTabText: {
    fontFamily: 'DMSans_600SemiBold',
    fontSize: 9,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 2,
  },
});

interface VoiceData {
  audioUrl: string | null;
  transcription: string | null;
  recorded: boolean;
  isUploading: boolean;
}

interface VoiceWidgetProps {
  status: 'idle' | 'recording' | 'uploading' | 'done';
  duration: number;
  transcription: string | null;
  onStop: () => void;
  onDiscard: () => void;
}

function VoiceWidget({ status, duration, transcription, onStop, onDiscard }: VoiceWidgetProps) {
  const { colors } = useTheme();
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
        <Text style={[widgetStyles.recTime, { color: colors.captureMuted }]}>Processing…</Text>
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
        <TouchableOpacity
          style={[imageStyles.pickCard, { borderColor: colors.border, backgroundColor: colors.cardBg }]}
          onPress={handlePickImage}
          activeOpacity={0.8}
        >
          <View style={[imageStyles.pickIconWell, { backgroundColor: colors.accentLight }]}>
            <Text style={imageStyles.pickEmoji}>📷</Text>
          </View>
          <Text style={[imageStyles.pickLabel, { color: colors.brandAccent }]}>{t('capture.chooseImage')}</Text>
          <Text style={[imageStyles.pickSub, { color: colors.textMuted }]}>
            {t('capture.chooseImageSub')}
          </Text>
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
  pickCard: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 36,
    borderRadius: 22,
    borderWidth: 2,
    borderStyle: 'dashed',
    gap: 10,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
  },
  pickIconWell: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickEmoji: {
    fontSize: 28,
  },
  pickLabel: {
    fontSize: 16,
    fontWeight: '600',
    fontFamily: SANS_FONT,
  },
  pickSub: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
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
  const { colors, isDark } = useTheme();
  const params = useLocalSearchParams<{ mode?: string }>();
  const preferences = useSettingsStore((s) => s.preferences);
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
  const [voiceStatus, setVoiceStatus] = useState<'idle' | 'recording' | 'uploading' | 'done'>('idle');
  const [voiceDuration, setVoiceDuration] = useState(0);
  const [voiceData, setVoiceData] = useState<VoiceData>({
    audioUrl: null, transcription: null, recorded: false, isUploading: false,
  });
  const recordingRef = useRef<Audio.Recording | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [imageData, setImageData] = useState<ImageUploadData>({
    imageUrl: null,
    thumbnailUrl: null,
    description: null,
    picked: false,
    isUploading: false,
  });
  const [photoNote, setPhotoNote] = useState('');
  const [linkVisible, setLinkVisible] = useState(false);
  const [linkContent, setLinkContent] = useState('');
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
    setContent(clipboardUrl);
    setMode('link');
    dismissClipboard();
  };
  // ── End clipboard detection ──

  // ── Voice recording (lifted state) ──
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
      setVoiceStatus('recording');
      setVoiceDuration(0);
      timerRef.current = setInterval(() => setVoiceDuration((d) => d + 1), 1000);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch (err) {
      Alert.alert(t('capture.recordingError'), t('capture.recordingErrorMessage'));
      console.error('startVoiceRecording error:', err);
    }
  };

  const stopVoiceRecording = async () => {
    if (!recordingRef.current) return;
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    setVoiceStatus('uploading');
    try {
      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      recordingRef.current = null;
      if (!uri) throw new Error('No recording URI');
      const result = await storageApi.uploadAudio(uri);
      const tx = result.transcription || null;
      setVoiceStatus('done');
      setVoiceData({ audioUrl: result.audio_url || null, transcription: tx, recorded: true, isUploading: false });
    } catch (err) {
      console.error('stopVoiceRecording error:', err);
      setVoiceStatus('done');
      setVoiceData({ audioUrl: null, transcription: null, recorded: true, isUploading: false });
    }
  };

  const discardVoice = () => {
    if (voiceStatus === 'uploading') return;
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    recordingRef.current?.stopAndUnloadAsync().catch(() => {});
    recordingRef.current = null;
    setVoiceStatus('idle');
    setVoiceDuration(0);
    setVoiceData({ audioUrl: null, transcription: null, recorded: false, isUploading: false });
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      recordingRef.current?.stopAndUnloadAsync().catch(() => {});
    };
  }, []);
  // ── End voice recording ──

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
      if (handleDuplicateLinkError(error)) return;
      Alert.alert(t('capture.error'), t('capture.saveFailed'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => router.back();

  const isVoiceReady = voiceStatus === 'done' && voiceData.recorded;
  const isImageReady = imageData.picked && !imageData.isUploading && (!!imageData.imageUrl || !!imageData.thumbnailUrl);
  const canSave =
    content.trim().length > 0 ||
    isVoiceReady ||
    (isImageReady) ||
    (linkVisible && /^https?:\/\/.+/i.test(linkContent.trim()));

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.captureBg }]} edges={['top', 'bottom']}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* ── Header ── */}
        <View style={[styles.header, { borderBottomColor: colors.captureBorder, backgroundColor: colors.captureBg }]}>
          <TouchableOpacity
            onPress={handleCancel}
            style={styles.closeBtn}
            activeOpacity={0.7}
          >
            <X size={20} color={colors.captureMuted} strokeWidth={2.2} />
          </TouchableOpacity>

          <View style={styles.titleWrap}>
            <Text style={[styles.title, { color: colors.captureText }]}>
              {t('capture.title')}
            </Text>
          </View>

          <TouchableOpacity
            onPress={handleSave}
            disabled={!canSave || isSaving}
            style={styles.saveBtn}
            activeOpacity={0.85}
          >
            {isSaving ? (
              <ActivityIndicator color={colors.captureAccent} size="small" />
            ) : (
              <Text style={[styles.saveBtnText, { color: canSave && !isSaving ? colors.captureAccent : colors.captureMuted }]}>{t('capture.save')}</Text>
            )}
          </TouchableOpacity>
        </View>

        {mode === 'text' || mode === 'link' ? (
          <View style={styles.composerScreenWrap}>
            <View style={[styles.inputCard, {
              backgroundColor: colors.captureCard,
              borderColor: colors.captureBorder,
              borderWidth: 1,
            }]}>
              {/* ── Composer header (text mode) ── */}
              {mode === 'text' && (
                <View style={styles.composerHeaderRow}>
                  <View style={[styles.composerBadge, { backgroundColor: 'rgba(232,132,74,0.15)' }]}>
                    <FileText size={16} color={colors.captureAccent} strokeWidth={2.3} />
                  </View>
                  <Text style={[styles.composerHeaderLabel, { color: colors.captureMuted }]}>
                    {t('capture.modeTextDesc')}
                  </Text>
                </View>
              )}
              <TextInput
                style={[styles.composerInput, {
                  color: colors.captureText,
                  fontFamily: 'DMSans_400Regular',
                  fontSize: 16,
                }]}
                placeholder={mode === 'text' ? t('capture.textPlaceholder') : t('capture.linkPlaceholder')}
                placeholderTextColor={colors.captureMuted}
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
              {mode === 'link' && clipboardUrl ? (
                <Animated.View
                  style={[styles.clipInCard, {
                    opacity: clipOpacity,
                    backgroundColor: colors.subtleBg,
                    borderColor: colors.captureBorder,
                  }]}
                >
                  <View style={styles.clipInCardLeft}>
                    <Link2 size={13} color={colors.brandAccent} strokeWidth={2.4} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.clipTitle, { color: colors.captureMuted }]}>{t('capture.clipboardDetected')}</Text>
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
                      <Text style={[styles.clipDismiss, { color: colors.captureMuted }]}>✕</Text>
                    </TouchableOpacity>
                  </View>
                </Animated.View>
              ) : null}
              {mode === 'text' && (
                <View>
                  <View style={[styles.inputDivider, { borderColor: colors.captureBorder }]} />
                  <View style={styles.composerFooterRow}>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.hintsScroll}
                      style={styles.composerHintsScroll}
                    >
                      {HINT_CHIPS.map((chip) => (
                        <TouchableOpacity
                          key={chip.labelKey}
                          onPress={() => {
                            const label = t(chip.labelKey);
                            setContent((prev) => (prev ? `${label} ${prev}` : `${label} `));
                          }}
                          style={[styles.hintChip, {
                            backgroundColor: 'rgba(232,132,74,0.18)',
                            borderColor: 'rgba(232,132,74,0.5)',
                          }]}
                        >
                          <Text style={[styles.hintChipText, { color: colors.captureAccent }]}>{t(chip.labelKey)}</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                    {content.length > 0 && (
                      <Text style={[styles.charCounter, {
                        color: content.length > TEXT_WARN_THRESHOLD ? colors.warning : colors.captureMuted,
                      }]}>
                        {content.length}
                      </Text>
                    )}
                  </View>
                  <Text style={[styles.aiHint, { color: colors.captureMuted }]}>
                    AI sẽ tóm tắt sau khi lưu
                  </Text>
                </View>
              )}
            </View>
          </View>
        ) : mode === 'voice' ? (
          <View style={styles.modePanel}>
            <VoiceWidget
              status={voiceStatus}
              duration={voiceDuration}
              transcription={voiceData.transcription}
              onStop={stopVoiceRecording}
              onDiscard={discardVoice}
            />
          </View>
        ) : (
          /* Photo */
          <View style={styles.modePanel}>
            <ImageUpload onImageData={(data) => { setImageData(data); if (!data.picked) setPhotoNote(''); }} />
            {imageData.picked && !imageData.isUploading && (
              <TextInput
                style={[styles.photoNoteInput, { color: colors.captureText, backgroundColor: colors.captureCard, borderColor: colors.captureBorder }]}
                placeholder={t('capture.photoNotePlaceholder')}
                placeholderTextColor={colors.captureMuted}
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
    justifyContent: 'center',
  },
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
  },

  // ── Composer (text / link) ──
  composerScreenWrap: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 14,
  },
  inputCard: {
    borderRadius: 22,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07,
    shadowRadius: 18,
    elevation: 3,
    flex: 1,
  },
  composerInput: {
    fontSize: 16,
    lineHeight: 26,
    minHeight: 120,
    fontFamily: SANS_FONT,
  },
  inputDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    marginVertical: 10,
  },

  // ── Composer header ──
  composerHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },
  composerBadge: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  composerHeaderLabel: {
    fontSize: 13,
    fontFamily: 'DMSans_500Medium',
  },

  // ── Composer footer (hints + char counter) ──
  composerHintsScroll: { flex: 1 },
  composerFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 2,
  },
  charCounter: {
    fontSize: 12,
    fontFamily: SANS_FONT,
    fontWeight: '500',
    minWidth: 32,
    textAlign: 'right',
    paddingLeft: 8,
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

  // ── Clipboard banner (in-card) ──
  clipInCard: {
    borderRadius: 12,
    borderWidth: 1.5,
    padding: 10,
    marginTop: 10,
    gap: 6,
  },
  clipInCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
    gap: 6,
    flexDirection: 'row',
    paddingVertical: 2,
  },
  hintChip: {
    borderRadius: 100,
    borderWidth: 1.5,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  hintChipText: {
    fontFamily: 'DMSans_600SemiBold',
    fontSize: 12,
    fontWeight: '600',
  },

  // ── AI hint ──
  aiHint: {
    fontSize: 11,
    opacity: 0.7,
    marginTop: 6,
    paddingHorizontal: 2,
    fontFamily: SANS_FONT,
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
