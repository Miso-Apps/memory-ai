# New Memory Capture Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the 4-tab mode switcher in `capture.tsx` with a Threads-style unified composer — avatar, freeform text input, inline attachments (voice/image/link), and a bottom toolbar.

**Architecture:** All changes are in `mobile/app/capture.tsx`. Voice recording state is lifted to `CaptureScreen` so the toolbar mic button can trigger it directly. Voice and image become inline attachment widgets in the composer column instead of full-screen panels. The `BottomModeBar` is replaced with a `BottomToolbar`. No backend changes.

**Tech Stack:** React Native, Expo, TypeScript, Zustand (`useAuthStore` for user initials), Lucide icons, `expo-av`, `expo-image-picker`, `expo-haptics`

---

## File Map

| File | Change |
|---|---|
| `mobile/app/capture.tsx` | Major refactor — all tasks below |
| `mobile/i18n/locales/en.ts` | Add 2 new keys |
| `mobile/i18n/locales/vi.ts` | Add 2 new keys (Vietnamese) |

---

## Task 1: Add i18n keys

**Files:**
- Modify: `mobile/i18n/locales/en.ts`
- Modify: `mobile/i18n/locales/vi.ts`

- [ ] **Step 1: Add keys to `en.ts`**

Open `mobile/i18n/locales/en.ts`. Find the `capture:` block. Add two keys after `textPlaceholder`:

```ts
    textPlaceholder: "What's on your mind?",
    // add these two:
    composerPlaceholder: "What's on your mind?",
    linkInputPlaceholder: 'Paste a URL…',
```

> Note: `textPlaceholder` already exists and is kept. `composerPlaceholder` is the new unified field placeholder. `linkInputPlaceholder` replaces `linkPlaceholder` for the inline link field.

- [ ] **Step 2: Add keys to `vi.ts`**

Open `mobile/i18n/locales/vi.ts`. Find the `capture:` block. Add the same two keys in the same position:

```ts
    textPlaceholder: 'Bạn đang nghĩ gì?',
    // add these two:
    composerPlaceholder: 'Bạn đang nghĩ gì?',
    linkInputPlaceholder: 'Dán URL…',
```

- [ ] **Step 3: Verify i18n parity**

```bash
cd mobile && npm run i18n:check
```

Expected: no missing key errors.

- [ ] **Step 4: Commit**

```bash
git add mobile/i18n/locales/en.ts mobile/i18n/locales/vi.ts
git commit -m "feat(capture): add i18n keys for unified composer"
```

---

## Task 2: Lift voice state to CaptureScreen

Currently `VoiceRecorder` owns all recording state internally. The toolbar mic button (Task 5) needs to trigger recording from outside the component, so we lift state up.

**Files:**
- Modify: `mobile/app/capture.tsx`

- [ ] **Step 1: Replace the `VoiceData` interface and `VoiceRecorder` component**

In `capture.tsx`, delete the entire `VoiceRecorder` function (lines ~254–447) and `voiceStyles` StyleSheet (lines ~394–447), and the `VoiceRecorderProps` interface.

Replace with this inline-render component that takes all state as props:

```tsx
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
```

- [ ] **Step 2: Add voice state + logic to `CaptureScreen`**

In `CaptureScreen`, replace the existing `voiceData` state and add recording state:

```tsx
// Remove:
// const [voiceData, setVoiceData] = useState<VoiceData>({ ... });

// Add these instead:
const [voiceStatus, setVoiceStatus] = useState<'idle' | 'recording' | 'uploading' | 'done'>('idle');
const [voiceDuration, setVoiceDuration] = useState(0);
const [voiceData, setVoiceData] = useState<VoiceData>({
  audioUrl: null, transcription: null, recorded: false, isUploading: false,
});
const recordingRef = useRef<Audio.Recording | null>(null);
const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
```

- [ ] **Step 3: Add `startRecording` and `stopRecording` to `CaptureScreen`**

Add these two functions inside `CaptureScreen` (after the state declarations):

```tsx
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
  if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  recordingRef.current?.stopAndUnloadAsync().catch(() => {});
  recordingRef.current = null;
  setVoiceStatus('idle');
  setVoiceDuration(0);
  setVoiceData({ audioUrl: null, transcription: null, recorded: false, isUploading: false });
};
```

- [ ] **Step 4: Add cleanup effect for recording**

Add a `useEffect` cleanup in `CaptureScreen` (near the other `useEffect` blocks):

```tsx
useEffect(() => {
  return () => {
    if (timerRef.current) clearInterval(timerRef.current);
    recordingRef.current?.stopAndUnloadAsync().catch(() => {});
  };
}, []);
```

- [ ] **Step 5: Update `canSave` to use new voice state** *(also add `linkVisible`/`linkContent` state here — they'll be used in Task 6 render but declared early)*

Add the two state variables alongside canSave:

```tsx
const [linkVisible, setLinkVisible] = useState(false);
const [linkContent, setLinkContent] = useState('');
```

Then:

Replace the existing `canSave` calculation:

```tsx
// Remove old:
// const isVoiceReady = voiceData.recorded && !voiceData.isUploading;

// Replace with:
const isVoiceReady = voiceStatus === 'done' && voiceData.recorded;

const canSave =
  content.trim().length > 0 ||
  isVoiceReady ||
  (imageData.picked && !imageData.isUploading && (!!imageData.imageUrl || !!imageData.thumbnailUrl)) ||
  (linkVisible && /^https?:\/\/.+/i.test(linkContent.trim()));
```

- [ ] **Step 6: Verify type-check**

```bash
cd mobile && npm run type-check
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add mobile/app/capture.tsx
git commit -m "refactor(capture): lift voice state to CaptureScreen, add VoiceWidget"
```

---

## Task 3: Inline image attachment widget

Replace the full-screen `ImageUpload` component with a compact inline version.

**Files:**
- Modify: `mobile/app/capture.tsx`

- [ ] **Step 1: Delete `ImageUpload` and `imageStyles`**

Delete the entire `ImageUpload` function and `imageStyles` StyleSheet (~lines 462–677).

- [ ] **Step 2: Add `ImageWidget` component**

Add this new component in its place:

```tsx
interface ImageWidgetProps {
  imageData: ImageUploadData;
  onPick: () => void;
  onDiscard: () => void;
}

function ImageWidget({ imageData, onDiscard }: Omit<ImageWidgetProps, 'onPick'>) {
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
```

- [ ] **Step 3: Add `pickImage` function to `CaptureScreen`**

The toolbar image button needs to trigger picking. Add this function in `CaptureScreen`:

```tsx
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
  setImageData({ imageUrl: null, thumbnailUrl: null, description: null, picked: false, isUploading: true });
  try {
    const uploadResult = await storageApi.uploadImage(optimizedUri);
    setImageData({
      imageUrl: uploadResult.image_url ?? null,
      thumbnailUrl: uploadResult.thumbnail_url ?? null,
      description: uploadResult.description ?? null,
      picked: true,
      isUploading: false,
    });
  } catch (err) {
    console.error('Image upload error:', err);
    setImageData({ imageUrl: null, thumbnailUrl: null, description: null, picked: false, isUploading: false });
    Alert.alert(t('capture.error'), t('capture.saveFailed'));
  }
};

const discardImage = () => {
  setImageData({ imageUrl: null, thumbnailUrl: null, description: null, picked: false, isUploading: false });
  setPhotoNote('');
};
```

- [ ] **Step 4: Verify type-check**

```bash
cd mobile && npm run type-check
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add mobile/app/capture.tsx
git commit -m "refactor(capture): replace ImageUpload with inline ImageWidget"
```

---

## Task 4: Build the ComposerRow

**Files:**
- Modify: `mobile/app/capture.tsx`

- [ ] **Step 1: Add `useAuthStore` import**

At the top of `capture.tsx`, add the import:

```tsx
import { useAuthStore } from '../store/authStore';
```

- [ ] **Step 2: Add `ComposerRow` component**

Add this component after `ImageWidget`:

```tsx
interface ComposerRowProps {
  content: string;
  onChangeContent: (v: string) => void;
  voiceStatus: 'idle' | 'recording' | 'uploading' | 'done';
  voiceDuration: number;
  voiceTranscription: string | null;
  onStopVoice: () => void;
  onDiscardVoice: () => void;
  imageData: ImageUploadData;
  onDiscardImage: () => void;
  linkVisible: boolean;
  linkContent: string;
  onChangeLinkContent: (v: string) => void;
  linkError: string;
  clipboardUrl: string | null;
  clipOpacity: Animated.Value;
  clipSaving: boolean;
  onQuickSaveLink: () => void;
  onUseClipboardUrl: () => void;
  onDismissClipboard: () => void;
  photoNote: string;
  onChangePhotoNote: (v: string) => void;
  reduceMotionEnabled: boolean;
}

function ComposerRow({
  content, onChangeContent,
  voiceStatus, voiceDuration, voiceTranscription, onStopVoice, onDiscardVoice,
  imageData, onDiscardImage,
  linkVisible, linkContent, onChangeLinkContent, linkError,
  clipboardUrl, clipOpacity, clipSaving, onQuickSaveLink, onUseClipboardUrl, onDismissClipboard,
  photoNote, onChangePhotoNote,
  reduceMotionEnabled,
}: ComposerRowProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const user = useAuthStore((s) => s.user);
  const initial = (user?.name?.charAt(0) || user?.email?.charAt(0) || 'M').toUpperCase();
  const SANS = Platform.select({ ios: 'System', android: 'sans-serif', default: 'System' }) as string;

  return (
    <View style={composerStyles.row}>
      {/* Avatar column */}
      <View style={composerStyles.avatarCol}>
        <View style={[composerStyles.avatar, { backgroundColor: colors.captureAccent }]}>
          <Text style={composerStyles.avatarText}>{initial}</Text>
        </View>
        <View style={[composerStyles.threadLine, { backgroundColor: colors.captureBorder }]} />
      </View>

      {/* Content column */}
      <View style={composerStyles.contentCol}>
        <Text style={[composerStyles.username, { color: colors.captureText }]}>
          {user?.name || user?.email?.split('@')[0] || 'me'}
        </Text>

        {/* Main text input */}
        <TextInput
          style={[composerStyles.input, { color: colors.captureText, fontFamily: 'DMSans_400Regular' }]}
          placeholder={t('capture.composerPlaceholder')}
          placeholderTextColor={colors.captureMuted}
          multiline
          autoFocus
          value={content}
          onChangeText={onChangeContent}
          textAlignVertical="top"
          autoCapitalize="sentences"
          autoCorrect
        />

        {/* Voice widget */}
        <VoiceWidget
          status={voiceStatus}
          duration={voiceDuration}
          transcription={voiceTranscription}
          onStop={onStopVoice}
          onDiscard={onDiscardVoice}
        />

        {/* Image widget */}
        <ImageWidget imageData={imageData} onDiscard={onDiscardImage} />

        {/* Optional photo note when image picked */}
        {imageData.picked && !imageData.isUploading && (
          <TextInput
            style={[composerStyles.photoNote, { color: colors.captureText, borderColor: colors.captureBorder, fontFamily: 'DMSans_400Regular' }]}
            placeholder={t('capture.photoNotePlaceholder')}
            placeholderTextColor={colors.captureMuted}
            multiline
            value={photoNote}
            onChangeText={onChangePhotoNote}
            textAlignVertical="top"
          />
        )}

        {/* Inline link input */}
        {linkVisible && (
          <View style={{ marginTop: 8 }}>
            <TextInput
              style={[composerStyles.linkInput, { color: colors.captureText, borderColor: linkError ? colors.error : colors.captureBorder, fontFamily: 'DMSans_400Regular' }]}
              placeholder={t('capture.linkInputPlaceholder')}
              placeholderTextColor={colors.captureMuted}
              value={linkContent}
              onChangeText={(v) => { onChangeLinkContent(v); }}
              keyboardType="url"
              autoCapitalize="none"
              autoCorrect={false}
            />
            {!!linkError && (
              <Text style={[composerStyles.linkError, { color: colors.error }]}>{linkError}</Text>
            )}
          </View>
        )}

        {/* Clipboard URL banner */}
        {(linkVisible || !linkVisible) && clipboardUrl ? (
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
      </View>
    </View>
  );
}

const composerStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 12,
    flex: 1,
  },
  avatarCol: {
    width: 38,
    alignItems: 'center',
    flexShrink: 0,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },
  threadLine: {
    width: 1.5,
    flex: 1,
    marginTop: 6,
    borderRadius: 1,
    opacity: 0.3,
  },
  contentCol: {
    flex: 1,
    paddingBottom: 12,
  },
  username: {
    fontSize: 14,
    fontWeight: '700',
    marginTop: 8,
    marginBottom: 4,
  },
  input: {
    fontSize: 15,
    lineHeight: 23,
    minHeight: 40,
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
  },
  clipUrl: {
    fontSize: 12,
    marginTop: 2,
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
});
```

- [ ] **Step 3: Verify type-check**

```bash
cd mobile && npm run type-check
```

Expected: no errors (ComposerRow not yet used in the render, that's fine).

- [ ] **Step 4: Commit**

```bash
git add mobile/app/capture.tsx
git commit -m "feat(capture): add ComposerRow component with inline attachments"
```

---

## Task 5: BottomToolbar + HintChips

Replace `BottomModeBar` with the new toolbar and hint chips.

**Files:**
- Modify: `mobile/app/capture.tsx`

- [ ] **Step 1: Delete `BottomModeBar`, `modeBarStyles`, `MODE_META`, `MODE_DEFINITIONS`**

Delete:
- `BottomModeBar` function component (~lines 160–211)
- `modeBarStyles` StyleSheet (~lines 213–241)
- `MODE_META` constant (~lines 42–77)
- `MODE_DEFINITIONS` constant (~lines 79–84)
- `CaptureMode` type alias (`type CaptureMode = 'text' | 'voice' | 'link' | 'photo';`)

- [ ] **Step 2: Add `BottomToolbar` component**

```tsx
interface BottomToolbarProps {
  isRecording: boolean;
  hasImage: boolean;
  hasLink: boolean;
  charCount: number;
  onMic: () => void;
  onImage: () => void;
  onLink: () => void;
}

function BottomToolbar({ isRecording, hasImage, hasLink, charCount, onMic, onImage, onLink }: BottomToolbarProps) {
  const { colors } = useTheme();
  const MAX_CHARS = 500;
  const remaining = MAX_CHARS - charCount;

  return (
    <View style={[toolbarStyles.wrap, { borderTopColor: colors.captureBorder, backgroundColor: colors.captureBg }]}>
      <TouchableOpacity
        onPress={onMic}
        style={toolbarStyles.toolBtn}
        activeOpacity={0.7}
        disabled={hasImage}
        accessibilityLabel="Record voice"
      >
        <Mic
          size={22}
          color={isRecording ? colors.captureAccent : hasImage ? colors.captureBorder : colors.captureMuted}
          strokeWidth={isRecording ? 2.4 : 1.8}
        />
      </TouchableOpacity>

      <TouchableOpacity
        onPress={onImage}
        style={toolbarStyles.toolBtn}
        activeOpacity={0.7}
        disabled={isRecording || hasImage}
        accessibilityLabel="Attach image"
      >
        <ImageIcon
          size={22}
          color={isRecording || hasImage ? colors.captureBorder : colors.captureMuted}
          strokeWidth={1.8}
        />
      </TouchableOpacity>

      <TouchableOpacity
        onPress={onLink}
        style={toolbarStyles.toolBtn}
        activeOpacity={0.7}
        disabled={isRecording}
        accessibilityLabel="Add link"
      >
        <Link2
          size={22}
          color={hasLink ? colors.captureAccent : isRecording ? colors.captureBorder : colors.captureMuted}
          strokeWidth={hasLink ? 2.4 : 1.8}
        />
      </TouchableOpacity>

      <Text style={[
        toolbarStyles.charCount,
        { color: remaining < 50 ? colors.warning : colors.captureBorder },
      ]}>
        {remaining}
      </Text>
    </View>
  );
}

const toolbarStyles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 4,
  },
  toolBtn: {
    padding: 6,
    borderRadius: 8,
  },
  charCount: {
    marginLeft: 'auto',
    fontSize: 12,
    fontWeight: '600',
    minWidth: 32,
    textAlign: 'right',
    fontFamily: Platform.select({ ios: 'System', android: 'sans-serif' }),
  },
});
```

- [ ] **Step 3: Add `HintChips` component**

```tsx
function HintChips({ onSelect }: { onSelect: (label: string) => void }) {
  const { t } = useTranslation();
  const { colors } = useTheme();

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={hintStyles.scroll}
      style={[hintStyles.container, { backgroundColor: colors.captureBg }]}
    >
      {HINT_CHIPS.map((chip) => (
        <TouchableOpacity
          key={chip.labelKey}
          onPress={() => onSelect(t(chip.labelKey))}
          style={[hintStyles.chip, { backgroundColor: colors.captureCard, borderColor: colors.captureBorder }]}
          activeOpacity={0.75}
        >
          <Text style={[hintStyles.chipText, { color: colors.captureMuted }]}>{t(chip.labelKey)}</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

const hintStyles = StyleSheet.create({
  container: {
    flexShrink: 0,
  },
  scroll: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 16,
    paddingBottom: 14,
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
```

- [ ] **Step 4: Verify type-check**

```bash
cd mobile && npm run type-check
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add mobile/app/capture.tsx
git commit -m "feat(capture): add BottomToolbar and HintChips components"
```

---

## Task 6: Rewrite CaptureScreen render

Wire everything together — replace the old conditional mode panels with `ComposerRow`, `BottomToolbar`, and `HintChips`.

**Files:**
- Modify: `mobile/app/capture.tsx`

- [ ] **Step 1: Update `useClipboardUrl` to use `linkContent`**

> `linkVisible` and `linkContent` were already added in Task 2 Step 5.

Replace the existing `useClipboardUrl` function:

```tsx
const useClipboardUrl = () => {
  if (!clipboardUrl) return;
  setLinkContent(clipboardUrl);
  setLinkVisible(true);
  dismissClipboard();
};
```

- [ ] **Step 3: Update link validation in `handleSave`**

In `handleSave`, replace the link validation block:

```tsx
// Remove the old mode === 'link' check, replace with:
if (linkVisible && linkContent.trim()) {
  const url = linkContent.trim();
  if (!/^https?:\/\/.+/i.test(url)) {
    setLinkError(t('capture.linkError'));
    return;
  }
  setLinkError('');
}
```

Also update the save API call to handle the link case. Replace the existing `if (mode === 'voice') ... else if (mode === 'photo') ... else` block:

```tsx
if (voiceStatus === 'done' && voiceData.recorded) {
  await memoriesApi.create({
    type: 'voice',
    content: voiceData.transcription || t('capture.voiceNote'),
    transcription: voiceData.transcription ?? undefined,
    audio_url: voiceData.audioUrl ?? undefined,
  });
} else if (imageData.picked && imageData.imageUrl) {
  const photoMetadata: Record<string, unknown> = {};
  if (photoNote.trim()) photoMetadata.user_note = photoNote.trim();
  if (imageData.thumbnailUrl) photoMetadata.thumbnail_url = imageData.thumbnailUrl;
  await memoriesApi.create({
    type: 'photo',
    content: imageData.description || t('capture.imageNote'),
    image_url: imageData.imageUrl,
    metadata: Object.keys(photoMetadata).length > 0 ? photoMetadata : undefined,
  });
} else if (linkVisible && linkContent.trim()) {
  await memoriesApi.create({ type: 'link', content: linkContent.trim() });
} else {
  await memoriesApi.create({ type: 'text', content: content.trim() });
}
```

- [ ] **Step 4: Remove the old `mode` state and resolver**

Delete:
- `const [mode, setMode] = useState<CaptureMode>(resolveInitialMode());`
- `const resolveInitialMode = (): CaptureMode => { ... };`
- The `params.mode` logic (or keep it to set `linkVisible` if `params.mode === 'link'`)

If you want to keep deep-link support for `?mode=link`, replace with:

```tsx
useEffect(() => {
  if (params.mode === 'link') setLinkVisible(true);
  if (params.mode === 'voice') startVoiceRecording();
}, []);
```

- [ ] **Step 5: Replace the entire JSX render body**

Replace everything between `return (` and the closing `);` in `CaptureScreen` with:

```tsx
return (
  <SafeAreaView style={[styles.container, { backgroundColor: colors.captureBg }]} edges={['top', 'bottom']}>
    <StatusBar style={isDark ? 'light' : 'dark'} />
    <KeyboardAvoidingView
      style={styles.keyboardView}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.captureBorder, backgroundColor: colors.captureBg }]}>
        <TouchableOpacity onPress={handleCancel} style={styles.cancelBtn} activeOpacity={0.7}>
          <Text style={[styles.cancelText, { color: colors.captureMuted }]}>{t('capture.cancel')}</Text>
        </TouchableOpacity>

        <Text style={[styles.title, { color: colors.captureText }]}>{t('capture.title')}</Text>

        <TouchableOpacity
          onPress={handleSave}
          disabled={!canSave || isSaving}
          style={[styles.saveBtn, { backgroundColor: canSave && !isSaving ? '#fff' : colors.captureCard }]}
          activeOpacity={0.85}
        >
          {isSaving ? (
            <ActivityIndicator color={canSave ? '#000' : colors.captureMuted} size="small" />
          ) : (
            <Text style={[styles.saveBtnText, { color: canSave && !isSaving ? '#000' : colors.captureMuted }]}>
              {t('capture.save')}
            </Text>
          )}
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
          content={content}
          onChangeContent={setContent}
          voiceStatus={voiceStatus}
          voiceDuration={voiceDuration}
          voiceTranscription={voiceData.transcription}
          onStopVoice={stopVoiceRecording}
          onDiscardVoice={discardVoice}
          imageData={imageData}
          onDiscardImage={discardImage}
          linkVisible={linkVisible}
          linkContent={linkContent}
          onChangeLinkContent={(v) => { setLinkContent(v); if (linkError) setLinkError(''); }}
          linkError={linkError}
          clipboardUrl={clipboardUrl}
          clipOpacity={clipOpacity}
          clipSaving={clipSaving}
          onQuickSaveLink={handleQuickSaveLink}
          onUseClipboardUrl={useClipboardUrl}
          onDismissClipboard={dismissClipboard}
          photoNote={photoNote}
          onChangePhotoNote={setPhotoNote}
          reduceMotionEnabled={reduceMotionEnabled}
        />
      </ScrollView>

      {/* Toolbar */}
      <BottomToolbar
        isRecording={voiceStatus === 'recording' || voiceStatus === 'uploading'}
        hasImage={imageData.picked}
        hasLink={linkVisible}
        charCount={content.length}
        onMic={() => {
          if (voiceStatus === 'recording') {
            stopVoiceRecording();
          } else if (voiceStatus === 'idle') {
            startVoiceRecording();
          }
        }}
        onImage={pickImage}
        onLink={() => {
          setLinkVisible((v) => !v);
          setLinkError('');
        }}
      />

      {/* Hint chips — visible only when empty */}
      {content.length === 0 && voiceStatus === 'idle' && !imageData.picked && !linkVisible && (
        <HintChips
          onSelect={(label) => setContent((prev) => (prev ? `${label} ${prev}` : `${label} `))}
        />
      )}
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
```

- [ ] **Step 6: Update `styles` for the new header**

In the `styles` StyleSheet at the bottom of the file, replace `closeBtn`, `titleWrap`, `saveBtn`, `saveBtnText` with:

```tsx
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
saveBtn: {
  minWidth: 56,
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: 20,
  paddingVertical: 7,
  paddingHorizontal: 16,
},
saveBtnText: {
  fontFamily: 'DMSans_700Bold',
  fontSize: 14,
},
```

Also remove `composerScreenWrap`, `inputCard`, `composerInput`, `composerHeaderRow`, `composerBadge`, `composerHeaderLabel`, `composerHintsScroll`, `composerFooterRow`, `charCounter`, `errorText`, `modePanel`, `photoNoteInput`, `inputDivider`, `aiHint` from `styles` — they are replaced by the new component-level stylesheets.

- [ ] **Step 7: Remove unused imports**

Remove from the import list at the top:
- `FileText` (no longer used — replaced by `ImageIcon` already present)
- Any other icon no longer referenced

Keep: `Mic`, `Link2`, `Image as ImageIcon`, `X`

- [ ] **Step 8: Full validation**

```bash
cd mobile && npm run type-check && npm run lint
```

Expected: no errors or warnings.

- [ ] **Step 9: i18n check**

```bash
cd mobile && npm run i18n:check
```

Expected: no missing keys.

- [ ] **Step 10: Commit**

```bash
git add mobile/app/capture.tsx
git commit -m "feat(capture): threads-style unified composer — replace mode tabs"
```

---

## Task 7: Final cleanup and smoke test

- [ ] **Step 1: Remove dead code**

Search `capture.tsx` for any remaining references to:
- `mode` variable (should be gone)
- `modeBarStyles` (should be gone)
- `MODE_META` / `MODE_DEFINITIONS` (should be gone)
- `VoiceRecorderProps` / `VoiceRecorder` (should be gone)
- `imageStyles` (should be gone)
- `SANS_FONT` — kept if still used in `widgetStyles`, otherwise remove

Fix any remaining references.

- [ ] **Step 2: Run all checks**

```bash
cd mobile && npm run type-check && npm run lint && npm run i18n:check
```

Expected: all pass with zero errors.

- [ ] **Step 3: Manual smoke test on iOS simulator**

```bash
cd mobile && npm run ios
```

Verify:
- [ ] Screen opens from FAB (+) button
- [ ] Avatar shows user initial, username shows
- [ ] Text input auto-focuses, placeholder shows, typing enables Save button
- [ ] Tap mic → recording starts, waveform card appears, timer counts up
- [ ] Tap stop square → pill appears with duration
- [ ] Tap X on voice pill → discards, back to idle
- [ ] Tap image icon → picker opens, thumbnail appears inline
- [ ] Tap X on image → removed
- [ ] Tap link icon → inline URL input appears, tap again → hides
- [ ] Paste a URL → validation runs on Save, error shows for invalid URL
- [ ] Hint chips visible on empty state, hidden when typing
- [ ] Save → success overlay → navigates back
- [ ] Clipboard URL detection still shows banner

- [ ] **Step 4: Final commit**

```bash
git add mobile/app/capture.tsx
git commit -m "chore(capture): remove dead code after redesign"
```
