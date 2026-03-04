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

type CaptureMode = 'text' | 'voice' | 'link' | 'photo';

const modeConfig: Record<CaptureMode, { icon: string; keyboardType: 'default' | 'url' }> = {
  text:  { icon: '📝', keyboardType: 'default' },
  voice: { icon: '🎤', keyboardType: 'default' },
  link:  { icon: '🔗', keyboardType: 'url' },
  photo: { icon: '📷', keyboardType: 'default' },
};

// ── Compact horizontal mode tab strip ─────────────────────────────────────
function ModeTabStrip({ mode, onSelect }: { mode: CaptureMode; onSelect: (m: CaptureMode) => void }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const modes: CaptureMode[] = ['text', 'voice', 'link', 'photo'];
  const modeLabels: Record<CaptureMode, string> = {
    text: t('capture.modeText'),
    voice: t('capture.modeVoice'),
    link: t('capture.modeLink'),
    photo: t('capture.modePhoto'),
  };
  return (
    <View style={[stripStyles.strip, { backgroundColor: colors.cardBg, borderBottomColor: colors.border }]}>
      {modes.map((m) => {
        const active = m === mode;
        return (
          <TouchableOpacity
            key={m}
            style={[stripStyles.tab, active && { backgroundColor: colors.accentLight }]}
            onPress={() => onSelect(m)}
            activeOpacity={0.7}
          >
            <Text style={stripStyles.tabIcon}>{modeConfig[m].icon}</Text>
            <Text style={[stripStyles.tabLabel, { color: active ? colors.accent : colors.textMuted }, active && { fontWeight: '600' }]}>
              {modeLabels[m]}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const stripStyles = StyleSheet.create({
  strip: { flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 8, gap: 6, borderBottomWidth: 1 },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 8, borderRadius: 10, gap: 5 },
  tabIcon: { fontSize: 16 },
  tabLabel: { fontSize: 13, fontWeight: '500' },
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

  const recordingRef = useRef<Audio.Recording | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (recordingRef.current) {
        recordingRef.current.stopAndUnloadAsync().catch(() => {});
      }
    };
  }, []);

  const startRecording = async () => {
    try {
      const { status: permStatus } = await Audio.requestPermissionsAsync();
      if (permStatus !== 'granted') {
        Alert.alert(t('capture.permissionRequired'), t('capture.microphonePermission'));
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      recordingRef.current = recording;
      setIsRecording(true);
      setStatus('recording');
      setDuration(0);

      timerRef.current = setInterval(() => {
        setDuration((d) => d + 1);
      }, 1000);
    } catch (err) {
      Alert.alert(t('capture.recordingError'), t('capture.recordingErrorMessage'));
      console.error('startRecording error:', err);
    }
  };

  const stopRecording = async () => {
    if (!recordingRef.current) return;

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

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
      onVoiceData({
        audioUrl: result.audio_url || null,
        transcription: tx,
        recorded: true,
        isUploading: false,
      });
    } catch (err) {
      console.error('stopRecording / upload error:', err);
      setStatus('done');
      // Still mark as recorded so user can save without audio_url
      onVoiceData({ audioUrl: null, transcription: null, recorded: true, isUploading: false });
    }
  };

  const handleToggle = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <View style={styles.voiceContainer}>
      <TouchableOpacity
        style={[
          styles.recordButton, { backgroundColor: colors.accent, shadowColor: colors.accent },
          isRecording && { backgroundColor: colors.error, shadowColor: colors.error },
          status === 'uploading' && { backgroundColor: colors.textSecondary, shadowColor: colors.textSecondary },
        ]}
        onPress={handleToggle}
        activeOpacity={0.8}
        disabled={status === 'uploading'}
      >
        {status === 'uploading' ? (
          <ActivityIndicator color="#FFFFFF" size="large" />
        ) : isRecording ? (
          <View style={styles.stopIcon} />
        ) : (
          <Text style={styles.micIcon}>🎤</Text>
        )}
      </TouchableOpacity>

      <Text style={[styles.recordingStatus, { color: colors.textPrimary }]}>
        {status === 'idle' && t('capture.tapToRecord')}
        {status === 'recording' && `${t('capture.recording')} ${formatDuration(duration)}`}
        {status === 'uploading' && t('capture.processingAudio')}
        {status === 'done' && (transcription ? t('capture.transcriptionReady') : t('capture.recordingSaved'))}
      </Text>

      {status === 'recording' && (
        <Text style={[styles.recordingHint, { color: colors.textMuted }]}>{t('capture.tapToStop')}</Text>
      )}

      {status === 'done' && transcription && (
        <View style={[styles.transcriptionBox, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
          <Text style={[styles.transcriptionLabel, { color: colors.textMuted }]}>{t('capture.modeVoice')}</Text>
          <Text style={[styles.transcriptionText, { color: colors.textPrimary }]}>{transcription}</Text>
        </View>
      )}
    </View>
  );
}

// ── Image Upload Component ─────────────────────────────────────────────────
interface ImageUploadData {
  imageUrl: string | null;
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
      quality: 0.85,
    });

    if (result.canceled || !result.assets?.[0]) return;

    const asset = result.assets[0];
    setPickedUri(asset.uri);
    setDescription(null);
    setIsUploading(true);
    onImageData({ imageUrl: null, description: null, picked: false, isUploading: true });

    try {
      const uploadResult = await storageApi.uploadImage(asset.uri);
      const desc = uploadResult.description ?? null;
      setDescription(desc);
      setIsUploading(false);
      onImageData({
        imageUrl: uploadResult.image_url ?? null,
        description: desc,
        picked: true,
        isUploading: false,
      });
    } catch (err) {
      console.error('Image upload / analysis error:', err);
      setIsUploading(false);
      onImageData({ imageUrl: null, description: null, picked: true, isUploading: false });
    }
  };

  const handleClear = () => {
    setPickedUri(null);
    setDescription(null);
    onImageData({ imageUrl: null, description: null, picked: false, isUploading: false });
  };

  // Empty state — show picker button
  if (!pickedUri) {
    return (
      <View style={imageStyles.emptyContainer}>
        <TouchableOpacity style={[imageStyles.pickButton, { borderColor: colors.border }]} onPress={handlePickImage} activeOpacity={0.8}>
          <Text style={imageStyles.pickIcon}>🖼️</Text>
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
  pickIcon: {
    fontSize: 48,
  },
  pickLabel: {
    fontSize: 17,
    fontWeight: '600',
  },
  pickSub: {
    fontSize: 14,
    textAlign: 'center',
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
  },
  analysisText: {
    fontSize: 15,
    lineHeight: 22,
  },
});
// ── End Image Upload ──────────────────────────────────────────────────────────

export default function CaptureScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
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
  const [voiceData, setVoiceData] = useState<VoiceData>({
    audioUrl: null,
    transcription: null,
    recorded: false,
    isUploading: false,
  });
  const [imageData, setImageData] = useState<ImageUploadData>({
    imageUrl: null,
    description: null,
    picked: false,
    isUploading: false,
  });
  const [photoNote, setPhotoNote] = useState('');

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
          Animated.timing(clipOpacity, { toValue: 1, duration: 300, useNativeDriver: true }).start();
        }
      } catch {}
    })();
  }, []);

  const handleQuickSaveLink = async () => {
    if (!clipboardUrl) return;
    setClipSaving(true);
    try {
      await memoriesApi.create({ type: 'link', content: clipboardUrl });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Animated.timing(clipOpacity, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => {
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
    Animated.timing(clipOpacity, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => {
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
        await memoriesApi.create({
          type: 'photo',
          content: imageData.description || t('capture.imageNote'),
          image_url: imageData.imageUrl ?? undefined,
          metadata: photoNote.trim() ? { user_note: photoNote.trim() } : undefined,
        });
      } else {
        await memoriesApi.create({ type: mode, content: content.trim() });
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSaveSuccess(true);
      Animated.parallel([
        Animated.timing(successOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.spring(successScale, { toValue: 1, friction: 6, useNativeDriver: true }),
      ]).start(() => {
        setTimeout(() => router.back(), 600);
      });
    } catch (error) {
      console.error('Failed to save:', error);
      Alert.alert(t('capture.error'), t('capture.saveFailed'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    router.back();
  };

  const isVoiceReady = voiceData.recorded && !voiceData.isUploading;
  const isImageReady = imageData.picked && !imageData.isUploading;
  const canSave =
    mode === 'voice'
      ? isVoiceReady
      : mode === 'photo'
      ? isImageReady
      : content.trim().length > 0;
  const config = modeConfig[mode];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: colors.border, backgroundColor: colors.cardBg }]}>
          <TouchableOpacity onPress={handleCancel} style={styles.headerButton}>
            <Text style={[styles.cancelButton, { color: colors.textSecondary }]}>{t('capture.cancel')}</Text>
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.textPrimary }]}>{t('capture.title')}</Text>
          <TouchableOpacity
            onPress={handleSave}
            disabled={!canSave || isSaving}
            style={styles.headerButton}
          >
            <Text
              style={[
                styles.saveButton, { color: colors.accent },
                (!canSave || isSaving) && { color: colors.textMuted },
              ]}
            >
              {isSaving ? t('capture.saving') : t('capture.save')}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Mode Selector — compact tab strip */}
        <ModeTabStrip
          mode={mode}
          onSelect={(m) => { setMode(m); Haptics.selectionAsync(); }}
        />

        {/* ── Clipboard URL Banner ── */}
        {clipboardUrl && (
          <Animated.View style={[styles.clipBanner, { opacity: clipOpacity, backgroundColor: colors.cardBg, borderColor: colors.accentMid }]}>
            <View style={styles.clipBannerLeft}>
              <Text style={styles.clipIcon}>🔗</Text>
              <View style={{ flex: 1 }}>
                <Text style={[styles.clipTitle, { color: colors.textMuted }]}>{t('capture.clipboardDetected')}</Text>
                <Text style={[styles.clipUrl, { color: colors.accent }]} numberOfLines={1}>{clipboardUrl}</Text>
              </View>
            </View>
            <View style={styles.clipActions}>
              <TouchableOpacity onPress={handleQuickSaveLink} disabled={clipSaving} style={[styles.clipSaveBtn, { backgroundColor: colors.accent }]}>
                {clipSaving ? (
                  <ActivityIndicator color="#FFF" size="small" />
                ) : (
                  <Text style={styles.clipSaveText}>{t('capture.quickSave')}</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity onPress={useClipboardUrl} style={[styles.clipUseBtn, { borderColor: colors.accent }]}>
                <Text style={[styles.clipUseText, { color: colors.accent }]}>{t('capture.useLink')}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={dismissClipboard} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Text style={[styles.clipDismiss, { color: colors.textMuted }]}>✕</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        )}

        {/* Content Area */}
        <View style={styles.content}>
          {mode === 'voice' ? (
            <VoiceRecorder onVoiceData={setVoiceData} />
          ) : mode === 'photo' ? (
            <>
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
            </>
          ) : (
            <>
              <TextInput
                style={[
                  styles.input, { color: colors.textPrimary },
                  mode === 'link' && [styles.inputSingleLine, { borderBottomColor: colors.border }],
                ]}
                placeholder={t(mode === 'text' ? 'capture.textPlaceholder' : 'capture.linkPlaceholder')}
                placeholderTextColor={colors.textMuted}
                multiline={mode === 'text'}
                autoFocus
                value={content}
                onChangeText={(v) => {
                  setContent(v);
                  if (mode === 'link' && linkError) setLinkError('');
                }}
                textAlignVertical="top"
                keyboardType={config.keyboardType}
                autoCapitalize={mode === 'link' ? 'none' : 'sentences'}
                autoCorrect={mode !== 'link'}
              />
              {mode === 'link' && linkError ? (
                <Text style={[styles.errorText, { color: colors.error }]}>{linkError}</Text>
              ) : null}
            </>
          )}
        </View>
      </KeyboardAvoidingView>

      {/* Success overlay */}
      {saveSuccess && (
        <Animated.View
          style={[
            styles.successOverlay,
            { opacity: successOpacity },
          ]}
          pointerEvents="none"
        >
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
  container: {
    flex: 1,
  },
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
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  successIcon: {
    fontSize: 36,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  successText: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  keyboardView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerButton: {
    minWidth: 70,
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
  },
  cancelButton: {
    fontSize: 16,
  },
  saveButton: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'right',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  input: {
    flex: 1,
    fontSize: 17,
    lineHeight: 26,
  },
  inputSingleLine: {
    flex: 0,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  photoNoteInput: {
    marginTop: 14,
    minHeight: 80,
    fontSize: 16,
    lineHeight: 24,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    textAlignVertical: 'top',
  },
  voiceContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 60,
  },
  recordButton: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  micIcon: {
    fontSize: 40,
  },
  stopIcon: {
    width: 32,
    height: 32,
    backgroundColor: '#FFFFFF',
    borderRadius: 4,
  },
  recordingStatus: {
    marginTop: 24,
    fontSize: 17,
    fontWeight: '500',
  },
  recordingHint: {
    marginTop: 8,
    fontSize: 14,
  },
  transcriptionBox: {
    marginTop: 24,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    maxWidth: '100%',
  },
  transcriptionLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  transcriptionText: {
    fontSize: 15,
    lineHeight: 22,
  },
  errorText: {
    marginTop: 6,
    fontSize: 13,
  },
  /* ── Clipboard Banner ── */
  clipBanner: {
    marginHorizontal: 16,
    marginTop: 12,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    gap: 10,
  },
  clipBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  clipIcon: {
    fontSize: 20,
  },
  clipTitle: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  clipUrl: {
    fontSize: 14,
    marginTop: 2,
  },
  clipActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  clipSaveBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  clipSaveText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  clipUseBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  clipUseText: {
    fontSize: 13,
    fontWeight: '600',
  },
  clipDismiss: {
    fontSize: 18,
    paddingLeft: 4,
  },
});
