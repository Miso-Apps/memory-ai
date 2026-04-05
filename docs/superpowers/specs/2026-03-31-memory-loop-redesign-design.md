# DukiAI Memory — The Memory Loop Redesign

**Date:** 2026-03-31
**Status:** Approved
**Scope:** Full app UI/UX/CX redesign — mobile (React Native + Expo)

---

## 1. Design Philosophy

### The Memory Loop
The entire app is designed around one core loop:

```
Lưu (Capture) → Kho (Store) → Nhắc (Recall) → Lưu lại (Re-capture)
```

Every screen has a CTA leading to the next step in the loop. The user always knows where they are. Recall is not a feature — it is the destination every saved memory is moving toward.

### Visual Direction: Threads × Anthropic
- **From Threads:** Line SVG icons (no fill, no emoji), no tab labels, active state = filled icon + 4px dot indicator, FAB = dark circle
- **From Anthropic:** Warm cream background `#FBF7F2`, amber/brown accent palette, typography-forward, intelligent tone
- **Combined:** Clean and minimal but emotionally warm — feels like a personal journal, not a productivity tool

### Color Palette

| Token | Value | Usage |
|-------|-------|-------|
| `cream` | `#FBF7F2` | App background |
| `warm-border` | `#E8DDD0` | Card borders, dividers |
| `accent` | `#C2600A` | Primary CTA, active states, Recall highlights |
| `accent-light` | `#FFF3E8` | Card backgrounds, stat highlights |
| `accent-mid` | `#FFE5CB` | Gradient end, chip backgrounds |
| `text-dark` | `#2C1810` | Headings, primary text, FAB, filled icons |
| `text-mid` | `#8B5E3C` | Body text, descriptions |
| `text-muted` | `#B89080` | Metadata, placeholders, inactive icons |
| `badge-red` | `#E8442A` | Notification badge (Nhắc tab only) |
| `dm-bg` | `#1C1108` | Capture modal dark background |
| `dm-accent` | `#E8844A` | Capture modal accent (lighter for dark bg) |

---

## 2. Navigation Structure

**Tab bar:** Home | Kho | [FAB] | Nhắc | Tôi

### Rules
- No text labels under tabs — icon only
- Active tab: filled SVG icon + 4px amber dot below
- Inactive tabs: stroke-only SVG icons, `text-muted` color
- FAB: 46×46 dark circle `#2C1810`, centered, elevated 22px above tab bar, box-shadow `0 4px 18px rgba(44,24,16,0.22)`
- **Nhắc tab only** has a notification badge (9px red dot `#E8442A`, white border)
- Badge shows count of unreviewed recall suggestions

### Tab Icons (SVG, stroke-width 1.6 inactive / 2.2 active)
- Home: house path
- Kho: 4-square grid
- FAB: plus cross
- Nhắc: bell with clapper
- Tôi: person (circle head + body arc)

---

## 3. Screen Designs

### 3.1 Home Screen

**Purpose:** "Bản đồ ký ức" — user opens app and in 3 seconds knows: streak status, how many recalls are waiting, what they saved recently.

**Layout (top to bottom):**
1. **Status bar** — system time
2. **Header** — time-aware greeting ("Buổi sáng, [Name] ☀️") + date in Vietnamese + avatar circle
3. **Stats row** — 3 pills:
   - Tuần này (count)
   - Streak (N🔥)
   - Nhắc mới (count) — amber background `accent-light`, amber text — tapping navigates to Nhắc tab
4. **Recall Banner** — gradient `FFF3E8 → FFE5CB`, border `#F0C89A`, border-radius 16:
   - Label: "🔔 Nhắc lại hôm nay" + red badge count
   - Title: top recall topic name
   - Subtitle: "Đã lưu N lần trong X tuần qua"
   - CTA: "Xem ngay →" (accent color, taps to Nhắc tab)
   - Hidden when no recall suggestions exist
5. **Section: Gần đây** — label + "Xem kho" link
   - 2–3 compact memory cards: type icon + title + meta (time · category)
   - Tapping a card → Memory Detail screen
6. **On This Day** — card shown only if memories exist from same date 1/2/3 years ago:
   - Header: "📅 Ngày này năm ngoái"
   - Bullet list of memory titles

**CX Intent:** Recall banner is the emotional hook — not a tab button, but a content block with context. The user feels pulled toward it by curiosity ("what am I being reminded of?"), not navigation obligation.

---

### 3.2 Capture Modal

**Purpose:** Save a memory in under 10 seconds. Dark overlay enforces focus.

**Trigger:** FAB tap → bottom sheet slides up with backdrop dimming

**Layout:**
1. **Handle bar** — 36×4px pill, `rgba(255,255,255,0.18)`, for swipe-to-dismiss
2. **Top bar** — Huỷ (left, muted) | "Lưu nhanh" (center, bold white) | Lưu (right, `dm-accent`, disabled until content entered)
3. **Mode bar** — 4 tabs in rounded container:
   - Text · Voice · Link · Ảnh
   - SVG icons + label, no emoji
   - Active: `dm-accent` background
4. **Content area** (varies by mode):
   - **Text:** textarea with character counter (N/500), `dm-card` background
   - **Voice:** centered timer + waveform bars animation + stop button (square icon)
   - **Link:** URL input + OG preview card after URL detected
   - **Ảnh:** image picker grid
5. **Hint chips** (Text mode): auto-suggest category chips below input. First chip pre-selected based on user's most-used category (client-side, no AI call needed on open). AI classification runs after save and may update the category in the background — no blocking. User can re-select at any time. Options: 💡 Ý tưởng · 📋 Meeting · ⚡ Quyết định · 📖 Học · 💬 Hội thoại
6. **Toolbar** — attach file icon + photo icon (left) | "AI sẽ tóm tắt sau khi lưu" hint (right, muted)

**Dark Palette (Capture only):**
- Background: `#1C1108` (warm dark brown, not pure black)
- Card/input: `rgba(255,255,255,0.06)` with `rgba(255,255,255,0.10)` border
- Text: `#F5EFE8`
- Muted: `rgba(245,239,232,0.45)`
- Accent: `#E8844A` (lighter amber for dark background legibility)

**CX Intent:** Context switch from whatever app the user was in. Dark = focus. "AI sẽ tóm tắt sau khi lưu" sets expectation without blocking — save first, AI processes in background.

---

### 3.3 Kho Screen

**Purpose:** Browse and find memories. The feeling: "Tôi lưu nhiều thứ thế này à."

**Layout (top to bottom):**
1. **Header** — "Kho" title + filter icon + search icon (both as 32px circle buttons)
2. **Search bar** — always visible (not behind icon tap):
   - Placeholder: "Tìm theo từ khoá hoặc ý nghĩa…" — hints semantic capability
3. **Filter pills** — horizontal scroll: Tất cả · Text · Voice · Link · Ảnh
   - Active: `#2C1810` background, white text
   - Uses small SVG icons in pills, not emoji
4. **Memory list** — grouped by date separator ("Hôm nay", "Hôm qua", "Thứ 2, 28/3"):
   - **Text card:** type icon (amber bg) + title + 2-line AI summary + meta (time · category tag)
   - **Voice card:** mic icon (blue bg) + title + 2-line transcription summary + duration + category
   - **Link card:** OG thumbnail image (full width top) + title + domain · category
   - **Photo card:** thumbnail right-aligned + title + caption summary

**Swipe interactions:**
- Swipe left → "Nhắc lại sau" action (pins memory to Recall queue, amber bg)
- Swipe right → Delete (with confirmation)

**CX Intent:** Swipe-to-recall is the critical bridge between Kho and Nhắc. Users who discover their own memories and want to revisit them can self-nominate into the Recall feed.

---

### 3.4 Nhắc Screen ⭐ Core USP

**Purpose:** The payoff of the Memory Loop. The "Ồ đúng rồi!" moment.

**Layout:**
1. **Header** — "Nhắc lại" title + AI chat icon button (dark circle, top right) → opens AI chat bottom sheet
2. **Count line** — "N gợi ý hôm nay" (muted text)
3. **Featured recall card** (gradient `#FFF3E8 → #FFE5CB`, 1.5px border `#F0C89A`, border-radius 18):
   - Reason label: specific trigger text (e.g., "Bạn hay nghĩ về điều này", "Chưa xem lại 2 tuần", "Ngày này năm ngoái")
   - Title: memory/topic name (large, 700 weight)
   - Summary: 2-line AI synthesis
   - Meta: "📝 N ghi chú liên quan · [Category]"
   - Confidence bar: thin 3px bar with % label ("85% liên quan") — transparency signal
   - Actions:
     - "Xem lại" — dark `#2C1810` bg, white text, flex:2 (dominant)
     - "Bỏ qua" — `rgba(44,24,16,0.07)` bg, muted text, flex:1 (recessive)
4. **Section: "Chưa xem lại"** — compact list cards:
   - Title + meta (days since last viewed)
   - "Mở →" link (accent color)
5. **AI chat entry** — dark card `#2C1810`:
   - Chat icon + sample prompt "Hỏi AI: 'Tôi đang nghĩ về gì nhiều nhất?'"
   - Arrow → opens AI chat

**Reason labels by trigger type:**

| Trigger | Label | Backend requirement |
|---------|-------|---------------------|
| Repeated topic (≥3 saves in 2 weeks) | "Bạn hay nghĩ về điều này" | **New logic** — group by category/semantic cluster, count saves per topic per 14-day window |
| Not viewed in >7 days | "Chưa xem lại N ngày" | Existing — `last_viewed_at` field already tracked |
| On This Day | "Đúng ngày này N năm trước" | Existing — `created_at` date match |
| User swipe-to-recall from Kho | "Bạn đánh dấu để nhớ lại" | **New** — add `user_pinned` flag to RadarEvent |
| High semantic cluster | "Liên quan đến ký ức gần đây" | Existing — pgvector cosine similarity |

**CX Intent:** CTA asymmetry is intentional — "Xem lại" must visually dominate. Confidence bar prevents black-box trust erosion (Risk 2 in strategy). Reason label must be specific enough to trigger curiosity ("Oh, that thing I keep thinking about").

---

### 3.5 Tôi Screen

**Purpose:** User identity through the lens of their memories. Insight before config.

**Layout:**
1. **Header** — "Tôi" + settings gear icon (top right)
2. **Profile row** — avatar + name + "Thành viên từ [month] · N ký ức"
3. **Stats row** — 3 boxes:
   - Tổng cộng (total memory count)
   - Streak (N🔥)
   - **Recall Rate %** (amber bg, amber text) = memories reviewed / total suggestions shown
4. **Weekly Insight card** (gradient amber):
   - Label: "📊 Insight tuần này"
   - AI text: "Bạn đang suy nghĩ nhiều về [Topic] và [Topic]. Đã lưu N ký ức, nhiều hơn X% so với tuần trước."
   - Topic frequency chips: "[Topic] ×N"
5. **Activity heatmap** (compact, 4 weeks × 7 days):
   - Warm palette: `#E8DDD0` (0) → `#F0C89A` (low) → `#C2600A` (high)
   - Not green/GitHub — matches app palette
6. **Settings list** (3 items):
   - 🔔 Cài đặt nhắc nhở → notification preferences screen
   - ☀️ Giao diện → theme settings
   - 🔒 Tài khoản & bảo mật → auth settings

**Recall Rate metric:** New metric not in current app. Calculated as: `(recall_events where action='opened') / (total radar_events where action='served')` over rolling 30 days. Shown as percentage. Gamifies recall behavior without badges or points — intrinsic motivation.

**CX Intent:** Insight and heatmap come before settings because they deliver emotional value. The user sees themselves — "I think about Product a lot." Settings are functional, not the reason they visit this tab.

---

## 4. Memory Detail Screen

Existing screen, keep structure, apply new visual language:
- Warm cream background
- Card border `#E8DDD0`
- Category tag in accent amber
- "Related memories" section uses semantic search, shows 2-3 compact cards
- "Nhắc lại sau" button at bottom → adds to Recall queue (same as swipe-to-recall in Kho)

---

## 5. AI Chat Screen (accessible from Nhắc tab)

Opens as dark bottom sheet from Nhắc header icon. Not a tab — contextual tool.

- Dark theme matching Capture modal (`#1C1108`)
- Sample prompts on empty state: "Tôi đang nghĩ về gì nhiều nhất?" / "Tóm tắt tuần này" / "Ký ức nào tôi chưa nhớ lại?"
- Streams responses (SSE already supported in backend)
- Close = swipe down

---

## 6. CX Flow Summary

### First-time user (empty state)
- Nhắc tab shows illustration + "Lưu vài ký ức đầu tiên để nhận gợi ý" — no empty feed, guided onboarding
- Recall Banner on Home hidden until ≥1 suggestion exists
- Stats show 0 gracefully

### Returning user (Day 7+)
- Opens app → Home Recall Banner shows top topic → taps → Nhắc tab
- Featured card triggers "Ồ đúng rồi!" → taps "Xem lại" → Memory Detail
- From Detail → "Nhắc lại sau" another related memory → back to loop

### Power user behavior
- Uses swipe-to-recall in Kho to self-curate recall queue
- Checks Recall Rate in Tôi tab
- Uses AI chat from Nhắc: "What have I been thinking about this week?"

---

## 7. Component Changes from Current App

| Component | Current | New |
|-----------|---------|-----|
| Tab icons | Emoji in rounded squares | SVG line icons, no containers |
| Tab labels | Text below icons | No labels, dot indicator only |
| Active tab | Colored background box | Filled icon + amber dot |
| FAB | Amber circle | Dark brown circle `#2C1810` |
| Capture modal | Light background | Dark bottom sheet `#1C1108` |
| Mode switcher | Emoji tabs | SVG icon + text tabs |
| Recall screen | Hidden, no tab | Visible tab with badge |
| Insights | Dedicated tab | Moved into Tôi screen |
| Heatmap | Green palette | Warm amber palette |
| Recall card | Basic card | Featured hero card with confidence bar |
| New: Recall Rate | Not present | Stat in Tôi screen |
| New: Swipe-to-recall | Not present | Left swipe in Kho |
| New: AI chat entry | Hidden | Entry point in Nhắc tab |

---

## 8. Out of Scope (this redesign)

- Share extension (iOS App Extension / Android Share Intent) — separate project
- Push notifications wiring — separate project
- Widget (home screen) — Phase 3
- Calendar/Task integration — Phase 3
- Pattern detection engine improvements — separate backend project
