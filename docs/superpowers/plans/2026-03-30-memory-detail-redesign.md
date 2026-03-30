# Memory Detail Screen Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign `mobile/app/memory/[id].tsx` to use editorial hierarchy — cleaner header, pull-quote AI summary, and a type-adaptive primary action bar.

**Architecture:** All changes are confined to `mobile/app/memory/[id].tsx`. The `AudioPlayer` sub-component gains a forwarded ref so its `togglePlayback` function can be called from the action bar. All new styles use existing `ThemeColors` tokens — no new tokens needed.

**Tech Stack:** React Native, Expo, TypeScript, `expo-av` (audio), `expo-web-browser` (links), `lucide-react-native` (icons), DM Sans font family (400/500/600/700 weights only).

**Spec:** `docs/superpowers/specs/2026-03-30-memory-detail-redesign.md`

---

## File Map

| File | Change |
|------|--------|
| `mobile/app/memory/[id].tsx` | All visual changes — header, AI summary, actions, AudioPlayer ref |

---

## Task 1: Fix hardcoded color tokens in AI summary card

The current AI summary card uses hardcoded `rgba(197,106,58,...)` values instead of theme tokens.

**Files:**
- Modify: `mobile/app/memory/[id].tsx`

- [ ] **Step 1: Replace hardcoded colors with theme tokens**

Find this block (around line 449–464):

```tsx
{memory?.aiSummary ? (
  <View style={[
    styles.aiSummaryCard,
    {
      backgroundColor: 'rgba(197,106,58,0.06)',
      borderColor: 'rgba(197,106,58,0.14)',
    },
  ]}>
```

Replace with:

```tsx
{memory?.aiSummary ? (
  <View style={[
    styles.aiSummaryCard,
    {
      backgroundColor: colors.brandAccentLight,
      borderColor: 'rgba(184,92,32,0.14)',
    },
  ]}>
```

- [ ] **Step 2: Commit**

```bash
git add mobile/app/memory/[id].tsx
git commit -m "fix: replace hardcoded AI card colors with theme tokens"
```

---

## Task 2: Redesign the detail header

Replace the stacked header (back link → eyebrow → title → meta row) with a two-zone layout: nav row (back + share icon) and identity row (type badge + date), then the title.

**Files:**
- Modify: `mobile/app/memory/[id].tsx`

- [ ] **Step 1: Add `Share` to the import from lucide-react-native**

Find the existing import:

```tsx
import { ChevronRight, Folder } from 'lucide-react-native';
```

Replace with:

```tsx
import { ChevronRight, Folder, Share2 } from 'lucide-react-native';
```

- [ ] **Step 2: Replace the header JSX**

Find the entire `{/* ── Header ── */}` block (lines 402–440):

```tsx
      {/* ── Header ── */}
      <View style={[styles.detailHeader, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={[styles.backLink, { color: colors.brandAccent }]}>
            {t('memory.backToLibrary')}
          </Text>
        </TouchableOpacity>
        {memory ? (
          <>
            <Text style={[styles.dateEyebrow, { color: colors.brandAccent }]}>
              {new Date(memory.createdAt).toLocaleDateString(undefined, {
                weekday: 'long', month: 'long', day: 'numeric',
              }).toUpperCase()}
            </Text>
            <Text
              style={{
                fontFamily: 'DMSans_700Bold',
                fontSize: 22,
                letterSpacing: -0.3,
                lineHeight: 28,
                color: colors.textPrimary,
                marginBottom: 6,
              }}
            >
              {deriveTitle(memory.aiSummary, memory.content)}
            </Text>
            <View style={styles.metaRow}>
              <View style={[styles.typeChip, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
                <Text style={[styles.typeChipText, { color: colors.textMuted }]}>
                  {memory.type?.toLowerCase()}
                </Text>
              </View>
              <Text style={[styles.metaTime, { color: colors.textMuted }]}>
                {formatRelativeDate(memory.createdAt, t)}
              </Text>
            </View>
          </>
        ) : null}
      </View>
```

Replace with:

```tsx
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
```

- [ ] **Step 3: Replace header styles**

In `StyleSheet.create({...})`, find and replace the following style blocks:

Remove these styles:
```tsx
  backLink: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 12,
    marginBottom: 14,
  },
  dateEyebrow: {
    fontFamily: 'DMSans_600SemiBold',
    fontSize: 10,
    letterSpacing: 1,
    marginBottom: 8,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  typeChip: {
    borderRadius: 100,
    borderWidth: 1,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  typeChipText: {
    fontFamily: 'DMSans_600SemiBold',
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  metaTime: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 11,
  },
```

Add these styles in their place:
```tsx
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
```

- [ ] **Step 4: Commit**

```bash
git add mobile/app/memory/[id].tsx
git commit -m "feat: redesign memory detail header — nav row, type badge, cleaner title"
```

---

## Task 3: Convert AI summary to pull-quote style

Replace the floating rounded card with a left-border pull-quote.

**Files:**
- Modify: `mobile/app/memory/[id].tsx`

- [ ] **Step 1: Replace AI summary JSX**

Find the AI summary card in the ScrollView (around line 449):

```tsx
        {/* AI Summary card */}
        {memory?.aiSummary ? (
          <View style={[
            styles.aiSummaryCard,
            {
              backgroundColor: colors.brandAccentLight,
              borderColor: 'rgba(184,92,32,0.14)',
            },
          ]}>
            <Text style={[styles.aiSummaryLabel, { color: colors.brandAccent }]}>
              {t('memory.aiSummaryLabel')}
            </Text>
            <Text style={[styles.aiSummaryText, { color: colors.textSecondary }]}>
              {memory.aiSummary}
            </Text>
          </View>
        ) : null}
```

Replace with:

```tsx
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
```

- [ ] **Step 2: Replace AI summary styles**

In `StyleSheet.create({...})`, find and remove:

```tsx
  // AI Summary card
  aiSummaryCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginHorizontal: 20,
    marginTop: 16,
  },
  aiSummaryLabel: {
    fontFamily: 'DMSans_600SemiBold',
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  aiSummaryText: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 13,
    fontStyle: 'italic',
    lineHeight: 20,
  },
```

Add in their place:

```tsx
  // AI Summary — pull-quote
  pullQuote: {
    borderLeftWidth: 3,
    borderRadius: 0,
    borderTopRightRadius: 10,
    borderBottomRightRadius: 10,
    paddingVertical: 10,
    paddingLeft: 14,
    paddingRight: 12,
    marginBottom: 0,
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
```

- [ ] **Step 3: Remove the "ORIGINAL" section label**

Find this block inside the content section (around line 487–490):

```tsx
            {memory.aiSummary && (
              <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>{t('memory.original')}</Text>
            )}
```

Delete those three lines entirely (the label is redundant now that the divider separates the pull-quote from the body).

- [ ] **Step 4: Commit**

```bash
git add mobile/app/memory/[id].tsx
git commit -m "feat: convert AI summary to pull-quote style"
```

---

## Task 4: Expose AudioPlayer's togglePlayback via ref

The voice memory primary CTA needs to call `togglePlayback` on `AudioPlayer` from outside the component.

**Files:**
- Modify: `mobile/app/memory/[id].tsx`

- [ ] **Step 1: Add AudioPlayerHandle type and convert AudioPlayer to forwardRef**

Find the `AudioPlayer` component definition (line 113):

```tsx
const AudioPlayer = React.memo(function AudioPlayer({
  audioUrl,
  audioDuration,
}: {
  audioUrl?: string;
  audioDuration?: number;
}) {
```

Replace with:

```tsx
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
```

- [ ] **Step 2: Add useImperativeHandle inside AudioPlayer**

Find this line inside `AudioPlayer` (after the state declarations, before the cleanup `useEffect`):

```tsx
  // Cleanup on unmount
  useEffect(() => {
```

Insert before it:

```tsx
  React.useImperativeHandle(ref, () => ({
    togglePlayback,
  }));

```

- [ ] **Step 3: Close the forwardRef wrapper**

Find the closing of the `AudioPlayer` component (the `});` after the return):

```tsx
});
```

The component currently ends with `});` (closing `React.memo`). Since we added `forwardRef`, the closing now needs two `})`:

Find the last line of `AudioPlayer`:
```tsx
});
```

Replace with:
```tsx
}));
```

- [ ] **Step 4: Add the audioPlayerRef in MemoryDetailScreen**

In `MemoryDetailScreen`, find the existing state declarations (around line 275):

```tsx
  const [isEditing, setIsEditing] = useState(false);
```

Add below it:

```tsx
  const audioPlayerRef = useRef<AudioPlayerHandle>(null);
```

- [ ] **Step 5: Pass the ref to AudioPlayer in JSX**

Find the AudioPlayer usage (around line 534):

```tsx
        {memory.type === 'voice' && (
          <AudioPlayer audioUrl={memory.audioUrl} audioDuration={memory.audioDuration} />
        )}
```

Replace with:

```tsx
        {memory.type === 'voice' && (
          <AudioPlayer ref={audioPlayerRef} audioUrl={memory.audioUrl} audioDuration={memory.audioDuration} />
        )}
```

- [ ] **Step 6: Commit**

```bash
git add mobile/app/memory/[id].tsx
git commit -m "feat: expose AudioPlayer togglePlayback via forwardRef"
```

---

## Task 5: Replace the action bar with type-adaptive layout

Replace the three equal-weight text buttons with a primary CTA (type-adaptive) + secondary row.

**Files:**
- Modify: `mobile/app/memory/[id].tsx`

- [ ] **Step 1: Replace the action bar JSX**

Find the entire `{/* ── Bottom actions ── */}` block (lines 622–639):

```tsx
      {/* ── Bottom actions ── */}
      <View style={[styles.actionRow, { borderTopColor: colors.border }]}>
        <TouchableOpacity style={[styles.actionBtn, { borderColor: colors.border }]} onPress={() => setIsEditing(true)} activeOpacity={0.7}>
          <Text style={[styles.actionBtnText, { color: colors.textSecondary }]}>
            {t('memory.actionEdit')}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.actionBtn, { borderColor: colors.border }]} onPress={handleShare} activeOpacity={0.7}>
          <Text style={[styles.actionBtnText, { color: colors.textSecondary }]}>
            {t('memory.actionShare')}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.actionBtn, { borderColor: 'rgba(197,106,58,0.25)' }]} activeOpacity={0.7}>
          <Text style={[styles.actionBtnText, { color: colors.brandAccent }]}>
            {t('memory.actionReflect')}
          </Text>
        </TouchableOpacity>
      </View>
```

Replace with:

```tsx
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
```

- [ ] **Step 2: Replace action bar styles**

In `StyleSheet.create({...})`, find and remove:

```tsx
  // Action row
  actionRow: {
    flexDirection: 'row',
    gap: 8,
    padding: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  actionBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  actionBtnText: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 13,
  },
```

Add in their place:

```tsx
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
```

- [ ] **Step 3: Add missing i18n keys**

The action bar uses `t('memory.actionPlay')` and `t('memory.actionOpenLink')`. Check if they exist:

```bash
grep -r "actionPlay\|actionOpenLink" mobile/
```

If not found, add them to `mobile/i18n/en.json` (and any other locale files) under the `memory` key:

```json
"actionPlay": "▶ Play recording",
"actionOpenLink": "↗ Open link",
"actionReflect": "✦ Reflect on this memory"
```

(Update `actionReflect` text in existing locales if the current value differs.)

- [ ] **Step 4: Commit**

```bash
git add mobile/app/memory/[id].tsx mobile/i18n/
git commit -m "feat: type-adaptive action bar — primary CTA + secondary row"
```

---

## Task 6: Update Connected Ideas section typography

Minor typography fix — use the theme font family on the section title.

**Files:**
- Modify: `mobile/app/memory/[id].tsx`

- [ ] **Step 1: Add fontFamily to relatedTitle style**

In `StyleSheet.create({...})`, find:

```tsx
  relatedTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 10,
  },
```

Replace with:

```tsx
  relatedTitle: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 14,
    marginBottom: 10,
  },
```

- [ ] **Step 2: Commit**

```bash
git add mobile/app/memory/[id].tsx
git commit -m "feat: apply DMSans_700Bold to Connected Ideas section title"
```

---

## Verification

After all tasks, do a manual check in the Expo Go simulator/device:

- [ ] Open a **text** memory — header shows type badge + date, pull-quote AI summary, "✦ Reflect" primary button
- [ ] Open a **voice** memory — "▶ Play recording" primary button actually starts playback
- [ ] Open a **link** memory — "↗ Open link" primary button opens the browser
- [ ] Open a **photo** memory — photo + AI description render, "✦ Reflect" primary button shows
- [ ] Verify dark mode — all new styles use tokens, no white flashes or wrong colors
- [ ] Tap share icon in header → share sheet opens
