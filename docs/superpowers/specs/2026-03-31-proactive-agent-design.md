# Proactive Memory Agent — Design Spec
**Date:** 2026-03-31
**Scope:** Backend agent system + mobile UI extensions
**Status:** Approved for implementation

---

## 1. Overview

This spec introduces a Proactive Memory Agent — a system that actively analyzes the user's memories over time, detects meaningful patterns, and initiates conversations via push notifications and an extended AI chat experience. It also adds a Synthesis Engine that lets users manually select memories from the Library and transform them into structured AI insights.

The three new capabilities:

| Capability | Trigger | Delivery |
|---|---|---|
| **Proactive Agent** (Arc, Intention Loop, Tension) | Background (event + cron) | Push notification → Chat |
| **Memory Synthesis** | User action in Library | Chat opening message |
| **Silent Goal Extraction** | Every memory save | Background only (no UI) |

---

## 2. Agent Insight Types

The agent has a repertoire of three insight types. It selects the most appropriate one based on what it detects — there is no fixed schedule per type, and the user never sees a type label in the app.

### 2.1 Intention Loop
**What it detects:** Intention language in a saved memory — phrases like "I should", "I want to", "I need to", "I'm going to", "I plan to".

**How it works:**
1. On every memory save, the Intention Extractor runs a lightweight classifier over the content.
2. If an intention is detected, it is stored silently in a new `intention` table with: `memory_id`, `extracted_text`, `created_at`, `follow_up_at` (set to `created_at + 21 days` by default).
3. The nightly job checks for intentions where `follow_up_at <= now` and the user has not been notified yet.
4. It fetches memories saved after the intention was created and runs a semantic similarity check against the intention text.
5. If related-but-unresolved: queue a notification. If the user has already acted (high semantic match to follow-through), skip.

**Notification copy pattern:**
> Title: "You said you'd follow up on this"
> Body: "N weeks ago you captured an intention about [topic]. You've saved X things since — but I don't see any follow-through yet."

### 2.2 The Arc
**What it detects:** A growing cluster of thematically related memories across a time window of 3–8 weeks, where the cluster has reached a minimum of 5 memories.

**How it works:**
1. Nightly cron clusters all user embeddings using a sliding 8-week window.
2. For each cluster that crosses the 5-memory threshold for the first time, generate a GPT-4o synthesis of the cluster.
3. Queue a notification. Mark cluster as notified to avoid re-firing.

**Notification copy pattern:**
> Title: "A theme has been building"
> Body: "Over N weeks you saved X things about [topic]. Here's where your thinking has landed."

### 2.3 Tension Detector
**What it detects:** Two memories with high semantic similarity but opposing sentiment or contradictory conclusions, saved more than 14 days apart.

**How it works:**
1. Nightly cron runs pairwise cosine similarity on recent embeddings (last 90 days).
2. For high-similarity pairs (> 0.85), run a GPT-4o mini sentiment/stance classifier.
3. If opposing stances detected: queue a notification.

**Notification copy pattern:**
> Title: "You've said two different things"
> Body: "In [month] you saved a reason to [X]. Last week you saved a reason to [Y]. You haven't resolved this."

---

## 3. Notification → Chat Flow

When the user taps a push notification:

1. App opens (or foregrounds) and navigates to `/chat`.
2. The chat screen receives a query param `?agent_insight_id=<id>`.
3. On load, if `agent_insight_id` is present, the chat screen fetches the pre-generated insight from the backend and renders it as the first assistant message (no user message above it).
4. The insight message includes:
   - The agent's analysis text
   - Source citation chips (memory type + date, tappable to open memory detail)
   - 2–3 reply suggestion chips contextual to the insight type (e.g. "Yes, still relevant" / "I actually started" / "Drop it" for Intention Loop)
5. The user can reply freely or tap a suggestion chip. Subsequent messages use the existing RAG chat pipeline, with the source memories pre-loaded as context.

**Notification delivery:** APNs (iOS) and FCM (Android) via a new `notifications` service. Frequency cap: max 1 agent notification per user per 24 hours.

---

## 4. Memory Synthesis (Library)

### 4.1 UI — Library Screen (`mobile/app/(tabs)/library.tsx`)

**Filter bar change:** Add a "✦ Synthesize" button to the right end of the existing filter chip row. Always visible, not inside the filter chips.

**Selection mode:**
- Tapping "✦ Synthesize" activates selection mode on the list.
- Each memory card shows a circular checkbox on its left edge.
- The "✦ Synthesize" button updates to show "✦ N selected" (count of selected memories).
- A bottom action bar slides up showing: "[N] memories selected" + "Synthesize →" CTA button.
- Minimum 2 memories required to enable the CTA. Below 2, the button is dimmed.
- A "Cancel" label replaces the eyebrow text in the screen header while in selection mode. Tapping it exits selection mode and clears all selections.

**On "Synthesize →":**
- Navigate to `/chat` with `?synthesis_ids=id1,id2,...`.
- Chat screen detects the param, calls `POST /ai/synthesize` with the memory IDs.
- The synthesis result is rendered as the first assistant message.
- User can then ask follow-up questions; those memories are pre-loaded as RAG context.

### 4.2 Backend — Synthesis Endpoint

New endpoint: `POST /ai/synthesize`

```
Request:  { memory_ids: string[] }  // 2–20 memories
Response: { synthesis: string, memory_ids: string[] }
```

- Fetches memory contents by IDs (validates ownership).
- Builds a prompt: "Here are N memories. Identify what they have in common, any tensions between them, and the key insight that connects them."
- Calls GPT-4o (not mini — synthesis quality matters).
- Returns the synthesis text. The mobile client renders it as the chat opening message.
- Does not persist the synthesis (stateless, on-demand).

---

## 5. Silent Goal/Intention Extraction

- Runs as part of the existing memory save pipeline in `POST /memories`.
- After the embedding is generated, pass the content to a lightweight intent classifier (GPT-4o mini, fast + cheap).
- Classifier returns: `{ has_intention: bool, extracted_text: str | null }`.
- If `has_intention: true`, insert into `intentions` table. No user-facing feedback.
- This is the data source for the Intention Loop agent (Section 2.1).

### 5.1 New DB Table: `intentions`

```sql
CREATE TABLE intentions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  memory_id   UUID NOT NULL REFERENCES memories(id) ON DELETE CASCADE,
  extracted   TEXT NOT NULL,
  follow_up_at TIMESTAMPTZ NOT NULL,
  notified_at  TIMESTAMPTZ,
  dismissed_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ DEFAULT now()
);
```

---

## 6. Backend Architecture

### 6.1 New Components

| Component | Location | Trigger |
|---|---|---|
| Intention Extractor | `backend/app/services/agent_service.py` | Called from `POST /memories` after embed |
| Pattern Scanner | `backend/app/tasks/agent_scan.py` | Nightly cron (APScheduler) |
| Synthesis Engine | `backend/app/api/ai.py` — new endpoint | On-demand `POST /ai/synthesize` |
| Notification Service | `backend/app/services/notification_service.py` | Called by Pattern Scanner when insight queued |

### 6.2 New DB Table: `agent_insights`

Stores queued and delivered insights for the notification → chat flow.

```sql
CREATE TABLE agent_insights (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  insight_type VARCHAR(32) NOT NULL,  -- 'intention_loop' | 'arc' | 'tension'
  title        TEXT NOT NULL,
  body         TEXT NOT NULL,
  synthesis    TEXT NOT NULL,          -- full agent message shown in chat
  memory_ids   UUID[] NOT NULL,        -- source memories
  queued_at    TIMESTAMPTZ DEFAULT now(),
  sent_at      TIMESTAMPTZ,
  opened_at    TIMESTAMPTZ,
  dismissed_at TIMESTAMPTZ
);
```

### 6.3 Notification Frequency Cap

Before queuing any insight: check that the user has not received an agent notification in the past 24 hours. If they have, the insight is held and reconsidered the following night.

---

## 7. New API Endpoints Summary

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/ai/synthesize` | Synthesize selected memories |
| `GET` | `/agent/insights/{id}` | Fetch a pre-generated insight for chat load |
| `POST` | `/agent/insights/{id}/open` | Mark insight as opened (for analytics) |
| `POST` | `/agent/insights/{id}/dismiss` | Dismiss an insight |
| `POST` | `/notifications/register` | Register device token (APNs/FCM) |

---

## 8. Mobile Changes Summary

| File | Change |
|---|---|
| `mobile/app/(tabs)/library.tsx` | Add Synthesize button, selection mode, bottom action bar |
| `mobile/app/(tabs)/chat.tsx` | Handle `agent_insight_id` and `synthesis_ids` params on load |
| `mobile/services/api.ts` | Add `synthesizeMemories()`, `getAgentInsight()`, `registerPushToken()` |
| `mobile/app/_layout.tsx` | Register push token on auth, handle notification tap deep link |

---

## 9. Out of Scope

- User-visible goals/intentions list (intentionally silent)
- Editing or manually adding intentions
- The Arc visualization (graph/timeline view) — notifications only for now
- Android notification channels configuration (follow-up work)
- User preference to disable agent notifications (follow-up work)
