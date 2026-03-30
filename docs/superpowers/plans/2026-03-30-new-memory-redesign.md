# New Memory Screen Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign `mobile/app/capture.tsx` to feel playful, warm, and expressive — replacing the generic Twitter-style composer with a floating input card, color-coded chips, emoji mode bar, and personality in the header.

**Architecture:** All changes are isolated to one file (`mobile/app/capture.tsx`). No new components, no new files. Logic (save, API, clipboard, voice, image) is untouched — only JSX structure and styles change.

**Tech Stack:** React Native, Expo, TypeScript, `expo-haptics`, `lucide-react-native` (mode bar switches from Lucide to emoji)

---

## Files

- Modify: `mobile/app/capture.tsx` (all tasks)

---

### Task 1: Header — brain emoji + lowercase title, remove mode pill

**Files:**
- Modify: `mobile/app/capture.tsx`

- [ ] **Step 1: Update the title in the header JSX**

Find the `<View style={styles.titleWrap}>` block (~line 783) and replace it:

```tsx
<View style={styles.titleWrap}>
  <Text style={[styles.title, { color: colors.textPrimary }]}>
    🧠 {t('capture.title').toLowerCase()}
  </Text>
</View>
```

- [ ] **Step 2: Remove the mode pill block**

Delete this entire block (~lines 833–839):

```tsx
<View style={styles.modePillWrap}>
  <View style={[styles.modePill, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
    <ActiveModeIcon size={14} color={colors.textSecondary} strokeWidth={2.4} />
    <Text style={[styles.modePillText, { color: colors.textSecondary }]}>{t(modeMeta.labelKey)}</Text>
  </View>
</View>
```

Also remove the `ActiveModeIcon` and `modeMeta` variables from `CaptureScreen` (~line 764–765) since they're no longer needed:

```tsx
// DELETE these two lines:
const modeMeta = MODE_META[mode];
const ActiveModeIcon = modeMeta.icon;
```

- [ ] **Step 3: Remove the now-unused style entries**

In the `StyleSheet.create({...})` at the bottom, delete these style entries:

```tsx
// DELETE:
modePillWrap: {
  marginHorizontal: 16,
  marginTop: 10,
},
modePill: {
  borderWidth: StyleSheet.hairlineWidth,
  borderRadius: 999,
  alignSelf: 'flex-start',
  minHeight: 32,
  paddingHorizontal: 10,
  paddingVertical: 6,
  flexDirection: 'row',
  alignItems: 'center',
  gap: 6,
},
modePillText: {
  fontSize: 12,
  fontWeight: '600',
  fontFamily: SANS_FONT,
},
```

- [ ] **Step 4: Verify the app runs**

```bash
cd mobile && npx expo start --ios
```

Open the capture screen. Check: header shows "🧠 new memory", no mode pill badge below header. Cancel and Save still work.

- [ ] **Step 5: Commit**

```bash
git add mobile/app/capture.tsx
git commit -m "feat(capture): add brain emoji header, lowercase title, remove mode pill"
```

---

### Task 2: Replace avatar/composer row with floating input card

**Files:**
- Modify: `mobile/app/capture.tsx`

- [ ] **Step 1: Remove avatar-related variables**

In `CaptureScreen` (~lines 762–763), delete:

```tsx
// DELETE:
const initials = getInitials(user?.name, user?.email);
const displayName = user?.name?.trim() || user?.email?.split('@')[0] || 'You';
```

Also delete the `getInitials` function at the top of the file (~lines 41–49):

```tsx
// DELETE the entire function:
function getInitials(name?: string, email?: string): string {
  if (name) {
    const parts = name.trim().split(' ');
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return name[0].toUpperCase();
  }
  if (email) return email[0].toUpperCase();
  return '?';
}
```

- [ ] **Step 2: Replace the composer JSX with a floating card**

Find the `{mode === 'text' || mode === 'link' ? (` block (~line 830). Replace the entire `<View style={styles.composerScreenWrap}>` subtree (ends just before `): mode === 'voice' ?`) with:

```tsx
<View style={styles.composerScreenWrap}>
  <View style={[styles.inputCard, { backgroundColor: colors.cardBg }]}>
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
    <View style={[styles.inputDivider, { borderColor: '#f2d5b8' }]} />
    {mode === 'text' && (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.hintsScroll}
      >
        {HINT_CHIPS.map((chip) => (
          <TouchableOpacity
            key={chip.labelKey}
            onPress={() => setContent((prev) => (prev ? `${t(chip.labelKey)} ${prev}` : `${t(chip.labelKey)} `))}
            style={[styles.hintChip, { backgroundColor: chip.bg, borderColor: chip.border }]}
          >
            <Text style={[styles.hintChipText, { color: chip.text }]}>{t(chip.labelKey)}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    )}
  </View>
</View>
```

- [ ] **Step 3: Add HINT_CHIPS constant**

After `MODE_DEFINITIONS` (~line 93), add:

```tsx
const HINT_CHIPS: { labelKey: string; bg: string; border: string; text: string }[] = [
  { labelKey: 'capture.hintIdea',         bg: '#fff8f2', border: '#f5dfc8', text: '#c47a3a' },
  { labelKey: 'capture.hintMeeting',      bg: '#f2f8ff', border: '#d0e8ff', text: '#4a7ab5' },
  { labelKey: 'capture.hintDecision',     bg: '#f0fff4', border: '#b8e8c8', text: '#2e7d52' },
  { labelKey: 'capture.hintConversation', bg: '#fff0f8', border: '#f0c0dc', text: '#a0456a' },
  { labelKey: 'capture.hintLearning',     bg: '#f5f0ff', border: '#d8c8f8', text: '#6a4ab5' },
];
```

- [ ] **Step 4: Replace the composer styles**

In `StyleSheet.create`, delete these entries:

```tsx
// DELETE:
composerRow: { ... },
avatar: { ... },
avatarText: { ... },
authorName: { ... },
```

And replace/add these entries:

```tsx
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
  fontSize: 15,
  lineHeight: 24,
  minHeight: 80,
  fontFamily: SANS_FONT,
},
inputDivider: {
  borderTopWidth: 1.5,
  borderStyle: 'dashed',
  marginVertical: 12,
},
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
  fontFamily: 'DMSans_400Regular',
  fontSize: 12,
  fontWeight: '600',
},
```

- [ ] **Step 5: Verify text and link modes**

```bash
cd mobile && npx expo start --ios
```

- Text mode: input floats in a white card, no avatar/name, dashed divider above color-coded chips. Tapping a chip prepends it to the text.
- Link mode: same card, no chips visible, error message still shows on invalid URL.

- [ ] **Step 6: Commit**

```bash
git add mobile/app/capture.tsx
git commit -m "feat(capture): floating input card, color-coded hint chips, remove avatar"
```

---

### Task 3: Redesign mode bar — emoji slots, warm shell, active fill

**Files:**
- Modify: `mobile/app/capture.tsx`

- [ ] **Step 1: Add MODE_EMOJI map**

After the `MODE_DEFINITIONS` array (~line 93), add:

```tsx
const MODE_EMOJI: Record<CaptureMode, string> = {
  text: '✍️',
  voice: '🎤',
  link: '🔗',
  photo: '📷',
};
```

- [ ] **Step 2: Replace the BottomModeBar component**

Replace the entire `BottomModeBar` function and its `modeBarStyles` with:

```tsx
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
    <View style={[modeBarStyles.wrap, { backgroundColor: colors.bg }]}>
      <View style={modeBarStyles.barShell}>
        {MODE_DEFINITIONS.map(({ key }) => {
          const active = key === mode;
          return (
            <TouchableOpacity
              key={key}
              style={[
                modeBarStyles.slot,
                active && { backgroundColor: colors.brandAccent, borderRadius: 12 },
              ]}
              onPress={() => { onSelect(key); Haptics.selectionAsync(); }}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={t(MODE_META[key].labelKey)}
            >
              <Text style={modeBarStyles.emoji}>{MODE_EMOJI[key]}</Text>
              <Text style={[
                modeBarStyles.modeTabText,
                { color: active ? '#FFFFFF' : colors.textMuted },
                !active && { opacity: 0.45 },
              ]}>
                {t(MODE_META[key].labelKey)}
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
    backgroundColor: '#efe9df',
    borderRadius: 16,
    padding: 5,
    gap: 3,
  },
  slot: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 7,
    paddingHorizontal: 3,
  },
  emoji: {
    fontSize: 18,
  },
  modeTabText: {
    fontFamily: 'DMSans_600SemiBold',
    fontSize: 9,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 2,
  },
});
```

- [ ] **Step 3: Remove unused Lucide imports from the top of the file**

The mode bar no longer uses `FileText`, `Mic`, `Link2`, or `Image as ImageIcon` for the bar (they're still used in `ImageUpload` and elsewhere — check before removing). Remove only what's truly unused after this change.

Check: `Link2` is still used in the clipboard banner JSX. `ImageIcon` (`Image as ImageIcon`) is still used in `ImageUpload`. `Mic` is still used in `VoiceRecorder`. `FileText` is only in `MODE_META` — it's still referenced there but no longer rendered. Leave it in `MODE_META` (removing it would require restructuring that map).

No imports need removing. Proceed.

- [ ] **Step 4: Verify mode bar**

```bash
cd mobile && npx expo start --ios
```

Mode bar shows ✍️/🎤/🔗/📷 with labels. Tapping each mode switches correctly. Active mode shows white text on amber background. Inactive modes are faded.

- [ ] **Step 5: Commit**

```bash
git add mobile/app/capture.tsx
git commit -m "feat(capture): emoji mode bar with warm shell and active fill"
```

---

### Task 4: Voice mode — warm mic button and styled transcription card

**Files:**
- Modify: `mobile/app/capture.tsx`

- [ ] **Step 1: Update VoiceRecorder JSX**

Replace the `return (` block inside `VoiceRecorder` with:

```tsx
return (
  <View style={voiceStyles.container}>
    {/* Pulse rings + button */}
    <View style={voiceStyles.btnWrap}>
      {/* Static outer rings for warmth */}
      <View style={[voiceStyles.staticRingOuter, { borderColor: 'rgba(201,125,58,0.12)' }]} />
      <View style={[voiceStyles.staticRingInner, { borderColor: 'rgba(201,125,58,0.22)' }]} />
      {/* Animated pulse ring when recording */}
      {isRecording && (
        <Animated.View
          style={[voiceStyles.pulseRing, { borderColor: colors.error, transform: [{ scale: pulseAnim }] }]}
        />
      )}
      <TouchableOpacity
        style={[
          voiceStyles.btn,
          {
            backgroundColor: isRecording ? colors.error : colors.brandAccent,
          },
        ]}
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

    {/* Transcription card */}
    <View style={[voiceStyles.txCard, { backgroundColor: colors.cardBg }]}>
      <Text style={[voiceStyles.txLabel, { color: colors.textMuted }]}>{t('capture.modeVoice')}</Text>
      <Text style={[
        voiceStyles.txText,
        { color: status === 'done' && transcription ? colors.textPrimary : colors.textPlaceholder },
        !transcription && { fontStyle: 'italic' },
      ]}>
        {transcription ?? t('capture.tapToRecord')}
      </Text>
    </View>
  </View>
);
```

- [ ] **Step 2: Update voiceStyles**

Replace `voiceStyles` with:

```tsx
const voiceStyles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 24 },
  btnWrap: { alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  staticRingOuter: {
    position: 'absolute',
    width: 148,
    height: 148,
    borderRadius: 74,
    borderWidth: 2,
  },
  staticRingInner: {
    position: 'absolute',
    width: 128,
    height: 128,
    borderRadius: 64,
    borderWidth: 2,
  },
  pulseRing: {
    position: 'absolute',
    width: 136,
    height: 136,
    borderRadius: 68,
    borderWidth: 3,
    opacity: 0.45,
  },
  btn: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#c97d3a',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 10,
  },
  stopSquare: { width: 28, height: 28, backgroundColor: '#FFF', borderRadius: 4 },
  statusText: { fontSize: 15, fontWeight: '500', textAlign: 'center', marginBottom: 4 },
  hintText: { fontSize: 13, textAlign: 'center', marginBottom: 16 },
  txCard: {
    marginTop: 16,
    padding: 16,
    borderRadius: 18,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
  },
  txLabel: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 6 },
  txText: { fontSize: 14, lineHeight: 21 },
});
```

- [ ] **Step 3: Verify voice mode**

```bash
cd mobile && npx expo start --ios
```

Voice mode: two soft amber rings around mic button. Button is amber (not grey). Transcription area is a white card below. Recording still works end-to-end.

- [ ] **Step 4: Commit**

```bash
git add mobile/app/capture.tsx
git commit -m "feat(capture): warm voice mode — amber rings, brandAccent mic, transcription card"
```

---

### Task 5: Link mode — clipboard banner inside card

**Files:**
- Modify: `mobile/app/capture.tsx`

Right now the clipboard banner renders above all modes as a separate `Animated.View`. The new design integrates it inside the link mode's white input card only.

- [ ] **Step 1: Remove the global clipboard banner JSX**

Delete this block (~lines 804–828):

```tsx
{/* ── Clipboard URL Banner ── */}
{clipboardUrl && (
  <Animated.View style={[styles.clipBanner, { opacity: clipOpacity, backgroundColor: colors.cardBg, borderColor: colors.accentMid }]}>
    ...
  </Animated.View>
)}
```

- [ ] **Step 2: Add clipboard banner inside the link mode card**

In the `inputCard` JSX from Task 2, after the `TextInput` and before the `inputDivider`, add a conditional clipboard suggestion for link mode:

```tsx
{mode === 'link' && linkError ? (
  <Text style={[styles.errorText, { color: colors.error }]}>{linkError}</Text>
) : null}
{mode === 'link' && clipboardUrl ? (
  <Animated.View
    style={[styles.clipInCard, {
      opacity: clipOpacity,
      backgroundColor: colors.subtleBg,
      borderColor: '#f5dfc8',
    }]}
  >
    <View style={styles.clipInCardLeft}>
      <Link2 size={13} color={colors.brandAccent} strokeWidth={2.4} />
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
) : null}
```

- [ ] **Step 3: Add new style entries, remove old banner styles**

Delete from `StyleSheet.create`:

```tsx
// DELETE:
clipBanner: { ... },
clipBannerLeft: { ... },
clipIconWrap: { ... },
```

Add:

```tsx
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
```

Keep the existing `clipTitle`, `clipUrl`, `clipActions`, `clipSaveBtn`, `clipSaveText`, `clipUseBtn`, `clipUseText`, `clipDismiss` styles — they are reused.

- [ ] **Step 4: Verify link mode clipboard behavior**

```bash
cd mobile && npx expo start --ios
```

- Copy a URL to clipboard, open capture screen in link mode: clipboard suggestion appears inside the card, not above.
- "Quick Save" saves and navigates back. "Use" fills the input. ✕ dismisses.
- In text/voice/photo modes: no clipboard banner appears (this is intentional — URLs aren't relevant in those modes).

- [ ] **Step 5: Commit**

```bash
git add mobile/app/capture.tsx
git commit -m "feat(capture): integrate clipboard banner inside link mode card"
```

---

### Task 6: Photo mode — dashed picker card with friendly copy

**Files:**
- Modify: `mobile/app/capture.tsx`

- [ ] **Step 1: Update ImageUpload empty state JSX**

Find the `if (!pickedUri)` return block inside `ImageUpload` (~lines 436–448). Replace it with:

```tsx
if (!pickedUri) {
  return (
    <View style={imageStyles.emptyContainer}>
      <TouchableOpacity
        style={[imageStyles.pickCard, { borderColor: colors.border, backgroundColor: colors.cardBg }]}
        onPress={handlePickImage}
        activeOpacity={0.8}
      >
        <View style={[imageStyles.pickIconWell, { backgroundColor: '#fff8f2' }]}>
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
```

- [ ] **Step 2: Update imageStyles for the empty state**

Replace the `emptyContainer`, `pickButton`, `pickIconWrap`, `pickLabel`, `pickSub` entries in `imageStyles`:

```tsx
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
```

- [ ] **Step 3: Verify photo mode**

```bash
cd mobile && npx expo start --ios
```

Photo mode empty state: white dashed card, 📷 emoji in amber icon well, picker label, friendly subtitle. Tapping opens the image picker. Post-pick image preview is unchanged.

- [ ] **Step 4: Commit**

```bash
git add mobile/app/capture.tsx
git commit -m "feat(capture): photo mode dashed picker card with emoji icon well"
```

---

### Task 7: Final visual pass — verify all modes end-to-end

- [ ] **Step 1: Full manual verification**

```bash
cd mobile && npx expo start --ios
```

Check each mode:

| Mode | What to verify |
|------|----------------|
| Text | Floating white card, dashed divider, 5 color-coded chips, header shows 🧠, mode bar ✍️ active amber |
| Voice | Two static amber rings, amber mic button, transcription card below, recording/stop/upload flow |
| Link | URL input in card, clipboard banner inside card (if URL in clipboard), no banner in other modes |
| Photo | Dashed card with 📷 emoji well, image preview unchanged after picking |
| All | Cancel navigates back, Save saves and shows ✓ overlay then navigates back |

- [ ] **Step 2: Dark mode check**

Toggle device to dark mode. Check that `colors.cardBg`, `colors.bg`, and `colors.textPrimary` all resolve correctly (they come from `ThemeContext` — no hardcoded values were introduced except the hint chip colors and the mode bar shell `#efe9df`).

Note: `#efe9df` (mode bar shell) and the 5 hint chip color pairs are hardcoded warm values. They work well on the light theme. On dark theme the mode bar shell (`#efe9df`) will still appear as a warm sand — intentional, as dark theme uses `#1c1814` bg so the contrast is fine. The hint chips may look bright on dark — acceptable for now.

- [ ] **Step 3: Commit (if any fixes were made during verification)**

```bash
git add mobile/app/capture.tsx
git commit -m "fix(capture): visual pass fixes"
```
