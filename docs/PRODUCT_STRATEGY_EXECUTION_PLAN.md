# Memory AI Product Strategy Execution Plan

Date: 2026-03-28
Scope: 6-week execution plan for competitor-informed killer features
Method: Product Strategy Canvas -> execution backlog with schema, API, i18n, deployment, and rollout gates
Status: Audit-informed revision (backend + mobile + landing)

## 0) Production Audit Snapshot (Validated)

Audit scope reviewed:
- backend API + data model + deployment scripts
- mobile app (logic, i18n, tests)
- landing page (SEO/perf/best-practice signals)

Validated high-impact findings (refreshed):
1. Resolved: backend security defaults were hardened
- CORS now uses env-driven origins in backend/app/main.py
- DEBUG defaults to false in backend/app/config.py
- Secret-like defaults were removed from backend/app/config.py

2. Resolved: deploy health contract mismatch
- backend/app/main.py now returns status ok
- deployment/deploy.sh health parser is resilient (ok|healthy)

3. Remaining: migration approach is still one-off script based
- backend/migrate.py is additive and useful short-term, but not versioned like Alembic
- Feature expansion (Radar/Links/Decision Replay) still requires repeatable migration history

4. Resolved baseline + remaining scope for i18n
- EN/VI parity guard now exists via mobile/scripts/check-i18n-parity.mjs
- New feature keys for radar/decision/settings still need implementation in both locale files during feature delivery

5. Test baseline from current run
- Backend tests (backend/venv): 20 passed
- Mobile checks: type-check passed; i18n parity check passed; Jest suites passed (2/2)

Landing page notes:
- SEO metadata and structured data are present in landing/index.html
- Future UI changes should include webapp testing and performance checks before release

## 1) Strategic Focus (What We Build Now)

Primary wedge:
- Proactive, high-precision recall that appears at the right moment

Killer features for this cycle:
1. Memory Radar
- Context-aware proactive recall with explicit reason and confidence score

2. Connected Ideas
- Auto-linked related memories from semantic + temporal similarity

3. Decision Replay
- Structured decision memories with scheduled revisit and rationale recall

Features intentionally out of scope for this cycle:
- Team collaboration/workspaces
- Desktop-native app
- Integration marketplace
- Complex manual tagging/folder systems

## 2) Competitor-Led Prioritization

Direct competitors analyzed:
- Notion AI, Evernote: broad, but heavy for quick capture + timely recall
- Obsidian, Logseq, Roam: powerful graph workflows, high setup burden
- Readwise, Pocket: strong ingestion, weaker personal decision recall
- ChatGPT/Claude apps: strong reasoning, weak durable personal memory timeline

Why this plan wins:
- Keep capture friction near-zero
- Make recall quality measurable and visible
- Build an automatic memory graph without requiring user setup

## 2.1) Product Strategy Canvas (Competitor-Driven)

### 1. Vision
- Build the most trusted personal memory companion that surfaces the right memory at the right time with clear reasons.
- Make forgetting normal and recovery effortless across text, voice, links, and photos.

### 2. Market Segments
- Segment A: Busy professionals with fragmented context across meetings, chats, and links.
  - JTBD: "Help me quickly save and later recover exactly what matters before I decide or act."
- Segment B: Builders/creators/researchers managing idea-heavy workflows.
  - JTBD: "Connect my scattered notes into useful insight without manual graph maintenance."
- Segment C: Bilingual mobile-first users (EN/VI) with low tolerance for setup complexity.
  - JTBD: "Give me a smart memory assistant that works instantly in my language."

### 3. Relative Costs
- Optimize for premium value at disciplined infra cost, not lowest unit cost.
- Compete on precision recall quality, explanation clarity, and mobile usability.

### 4. Value Proposition
- Before: Users save content but cannot reliably retrieve it when context changes.
- How: Proactive recall (Memory Radar), auto-linking (Connected Ideas), and decision revisit loops (Decision Replay).
- After: Users recover relevant context faster, make better decisions, and build trust in memory continuity.
- Alternatives: Notion/Evernote search, Obsidian manual linking, Readwise ingestion, generic AI chat apps.

### 5. Trade-offs
- Will not prioritize team collaboration, desktop-native app, or integration marketplace in this cycle.
- Will not ship feature breadth that dilutes the recall precision wedge.

### 6. Key Metrics
- North Star: Weekly Meaningful Recalls (WMR) per WAU.
- OMTM (this quarter): Recall Activation Rate = users with >=3 relevant recalls/week and recall open rate >=40%.

### 7. Growth
- Product-led growth: free capture habit -> trust in recall quality -> referral and retention loops.
- Primary channels: extension-led capture, mobile app stores, creator/community demos, bilingual content.
- Unit economics: reduce token/storage costs via confidence thresholds, async pipelines, and cache-first retrieval.

### 8. Capabilities
- Build: ranking/relevance engine, event instrumentation, semantic/temporal linking, decision revisit orchestration.
- Partner: LLM/embedding providers and cloud infra.
- Must develop: experimentation discipline, feature flags, and bilingual product operations.

### 9. Can't/Won't (Defensibility)
- Defensibility comes from behavior graph + recall event feedback loops + decision-memory history.
- Competitors can copy UI surfaces, but not quickly replicate personalized precision tuned on accumulated interaction signals.

## 2.2) Competitor Review -> Killer Features

Top overlap competitors and exploitable gaps:
- Notion AI/Evernote: broad workspace, weak proactive recall timing.
- Obsidian/Roam/Logseq: powerful but high setup burden and manual link maintenance.
- Readwise/Pocket: strong ingestion, weak decision-centric memory loops.
- ChatGPT/Claude apps: strong reasoning, weak durable personal timeline and recall instrumentation.

Ranked killer features for this cycle:
1. Memory Radar (highest impact x feasibility)
- Why it can win: addresses the core problem directly: recall relevance at decision time.
- Success target: open rate >=30% at Gate 1 and acted rate >=15% by Gate 2.

2. Decision Replay (novel differentiator)
- Why it can win: competitors rarely support structured decision revisit with rationale memory.
- Success target: sustained weekly creation and review completion trend.

3. Connected Ideas (retention multiplier)
- Why it can win: automatic graphing without user setup burden.
- Success target: >=80% active memories linked; related CTR >=12%.

Features intentionally deferred despite value:
- Collaborative spaces (high complexity, lower near-term feasibility)
- Deep marketplace integrations (distribution risk before core wedge matures)

## 2.3) Critical Hypotheses and Low-Effort Experiments

Hypothesis H1:
- If recall includes clear reason + confidence, users will trust and open recalls more frequently.
- Experiment: A/B reason text clarity and confidence threshold bands for 2 weeks.

Hypothesis H2:
- Decision Replay increases long-term perceived product value versus generic notes.
- Experiment: dogfood cohort with mandatory revisit prompts and review-completion tracking.

Hypothesis H3:
- Automatic links increase exploratory behavior without adding cognitive overhead.
- Experiment: compare connected-card exposure vs hidden-control cohort.

Hypothesis H4:
- EN/VI parity reduces onboarding friction in Vietnam-first segments.
- Experiment: compare activation/retention by locale after parity gate enforcement.

## 3) Revised Delivery Roadmap (Production-First)

Execution principle:
- No broad feature rollout until security/reliability gates pass in staging

### Week 0: Platform Hardening Gate (Must Pass)

Epics:
- Security defaults and deploy correctness
- Test reliability baseline

Deliverables:
- Restrict backend CORS to configured origins (no wildcard in production)
- Remove insecure config defaults for secrets and set DEBUG default false
- Align health response contract used by API and deploy script
- Fix backend async test execution configuration (pytest + asyncio)

Definition of done:
- Security defaults hardened and env-driven
- Deploy script health check is contract-consistent
- Backend test suite runs async tests successfully in CI/local

### Week 1: Migration Foundation + Observability

Epics:
- Versioned migration path
- Event instrumentation baseline

Deliverables:
- Introduce migration versioning workflow (Alembic) while preserving safe rollout path
- Add recall event logging (served, opened, dismissed, acted)
- Add reason and confidence in recall payload
- Create dashboard query for Weekly Meaningful Recalls (WMR)

Definition of done:
- Migration history is reproducible across environments
- 100% recall impressions are logged
- Baseline open rate/action rate visible daily

## 3.1) Implementation Readiness Checklist

### Memory Radar
- [ ] Add schema support for reason/confidence instrumentation (table or normalized event model)
- [ ] Implement endpoint telemetry and experiment tags for reason-text A/B testing
- [ ] Add missing Radar UI keys in EN/VI and pass parity gate
- [ ] Add user setting for precision threshold and rollout default

### Decision Replay
- [ ] Create decision memory schema with revisit scheduling fields
- [ ] Add background job pathway for due/near-due revisit reminders
- [ ] Add missing Decision Replay EN/VI keys and pass parity gate
- [ ] Add decision review metrics (creation rate, review completion rate, changed-after-review)

### Connected Ideas
- [ ] Instrument related-memory CTR and exposure metrics for gate decisions
- [ ] Add safeguards for low-quality links (threshold + fallback)

### Cost and Reliability Controls
- [ ] Add OpenAI spend controls (daily budget and per-user token guards)
- [ ] Add retry/backoff + circuit breaker behavior for external AI/link providers
- [ ] Add fallback path when semantic/vector retrieval is unavailable

### Migration and Deployment Safety
- [ ] Adopt Alembic baseline and migration policy before feature schema rollout
- [ ] Update deploy flow to use revision-based migrations
- [ ] Add migration rollback runbook and staging parity gate

## Week 2: Memory Radar v1

Epics:
- Relevance scoring and trigger policy
- Explainable recall reasons

Deliverables:
- Ranking policy combining recency, semantic match, and revisit cadence
- New API for proactive recall feed with reason/confidence
- User setting for recall sensitivity (low/medium/high)

Definition of done:
- Recall feed returns top-N items with reason text + confidence
- At least 30% open rate in internal dogfood cohort

## Week 3: Connected Ideas v1

Epics:
- Similar-memory linking job
- UI surface in memory detail

Deliverables:
- Background linking job for top related items per memory
- Related memories card on memory detail (mobile first)
- Track related-click events

Definition of done:
- 80% of active memories have at least one related link
- Related card click-through rate >= 12% in test cohort

## Week 4: Decision Replay v1

Epics:
- Structured decision capture
- Scheduled revisit reminders

Deliverables:
- Decision memory schema and APIs
- Decision capture flow in mobile create/capture
- Reminder generation for due/near-due decisions

Definition of done:
- Users can create, list, and mark decisions as reviewed
- First decision revisit notifications are sent and tracked

## Week 5: Bilingual UX Hardening + Cost Controls

Epics:
- EN/VI copy parity for new features
- AI cost and latency controls

Deliverables:
- Full EN/VI translation set for Radar, Connected Ideas, Decision Replay
- Rate limits and async fallback for expensive summarization/embedding calls
- Confidence threshold tuning experiment

Definition of done:
- Zero missing translation keys in EN/VI for new flows
- P95 recall feed latency under agreed target in staging

## Week 6: Rollout + Metrics Gates

Epics:
- Controlled release and validation
- PMF signal review and next-cycle decision

Deliverables:
- Feature flags for staged rollout (10% -> 30% -> 100%)
- Weekly executive review using NSM and OMTM
- Post-launch report with keep/kill/iterate recommendation

Definition of done:
- Rollout completed or paused by explicit gate criteria
- Next 6-week plan committed

## Week 7: Production Readiness Review

Epics:
- Operational resilience
- Release governance

Deliverables:
- Run staging failure drills for migrations and rollback toggles
- Complete deployment runbook validation (backup/restore + smoke tests)
- Final go/no-go review against security, test, and latency gates

Definition of done:
- Rollback path validated end-to-end
- Operational runbook tested by at least one non-author teammate
- Release decision documented with explicit risk acceptance

## 4) Data Model Changes (Database Migration Plan)

Current state notes:
- Existing migration runner uses backend/migrate.py and is executed in deployment/deploy.sh
- Existing schema already has memories.embedding, metadata JSONB, ai_summary, last_viewed_at

Migration required for this cycle: Yes
Migration strategy decision: Move from one-off script usage toward versioned migrations before broad rollout

### 4.1 New Tables

1. recall_events
- id UUID PK
- user_id UUID FK users.id
- memory_id UUID FK memories.id
- event_type VARCHAR(32)  -- served | opened | dismissed | acted
- reason_code VARCHAR(64) -- topical_match | revisit_window | decision_due | etc
- confidence FLOAT
- context JSONB
- created_at TIMESTAMPTZ default now()

Indexes:
- (user_id, created_at desc)
- (memory_id, created_at desc)
- (event_type, created_at desc)

2. memory_links
- id UUID PK
- user_id UUID FK users.id
- source_memory_id UUID FK memories.id
- target_memory_id UUID FK memories.id
- link_type VARCHAR(32)   -- semantic | temporal | co_capture
- score FLOAT
- explanation TEXT
- created_at TIMESTAMPTZ default now()

Indexes and constraints:
- unique (source_memory_id, target_memory_id, link_type)
- (user_id, source_memory_id)

3. decision_memories
- id UUID PK
- user_id UUID FK users.id
- memory_id UUID FK memories.id nullable (optional link to original memory)
- title TEXT
- rationale TEXT
- expected_outcome TEXT
- revisit_at TIMESTAMPTZ
- status VARCHAR(32) -- open | reviewed | archived
- reviewed_at TIMESTAMPTZ nullable
- created_at TIMESTAMPTZ default now()
- updated_at TIMESTAMPTZ default now()

Indexes:
- (user_id, status, revisit_at)

### 4.2 Existing Table Additions

user_preferences additions:
- recall_sensitivity VARCHAR(16) default 'medium'
- proactive_recall_opt_in BOOLEAN default true

memories additions (optional for speed):
- is_decision BOOLEAN default false

### 4.3 Migration Strategy

Phase A (safe additive):
- Create new tables and indexes
- Add nullable/new columns with defaults

Phase A.1 (foundation):
- Establish versioned migration baseline and lock migration order in CI/deploy checks

Phase B (backfill):
- Backfill memory_links for recent active users only
- No blocking full-history backfill

Phase C (enforcement):
- Add unique constraints after data cleanup checks

Rollback plan:
- Additive migrations only in this cycle; rollback by disabling feature flags and ignoring new tables

## 5) API Contracts (Exact v1 Endpoints)

All endpoints under existing auth model (JWT).

### 5.1 Memory Radar

GET /ai/radar?limit=10
Response:
- items: [
  {
    memory: MemoryResponse,
    reason: string,
    reason_code: string,
    confidence: number,
    action_hint: string
  }
]
- generated_at

POST /ai/radar/events
Body:
- memory_id
- event_type (served/opened/dismissed/acted)
- reason_code
- confidence
- context

### 5.2 Connected Ideas

GET /memories/{id}/related?limit=6
Response:
- source_memory_id
- items: [{ memory: MemoryResponse, score: number, link_type: string, explanation: string }]

POST /memories/related/rebuild
Body:
- memory_ids: [UUID]
- mode: incremental|full_user

### 5.3 Decision Replay

POST /decisions
GET /decisions?status=open&due_before=...
PATCH /decisions/{id}
POST /decisions/{id}/review

Decision payload fields:
- title
- rationale
- expected_outcome
- revisit_at
- memory_id (optional)

### 5.4 Settings

PATCH /preferences
New accepted fields:
- recall_sensitivity
- proactive_recall_opt_in

## 6) Mobile UX and i18n Plan (EN + VI)

Migration required for i18n keys: No DB migration
Code changes required: Yes (both locale files + screens)
Quality gate required: Yes (automated EN/VI key parity check in CI)

Add these keys to both locale files:
- radar.title
- radar.subtitle
- radar.whyNow
- radar.confidence
- radar.actionHint
- radar.dismiss
- radar.empty
- related.title
- related.matchScore
- related.linkType.semantic
- related.linkType.temporal
- related.linkType.coCapture
- decision.title
- decision.rationale
- decision.expectedOutcome
- decision.revisitAt
- decision.markReviewed
- decision.empty
- settings.recallSensitivity
- settings.recallSensitivity.low
- settings.recallSensitivity.medium
- settings.recallSensitivity.high
- settings.proactiveRecallOptIn

Proposed EN strings:
- radar.title: Memory Radar
- radar.subtitle: Relevant memories, right when you need them
- radar.whyNow: Why now
- radar.confidence: Confidence {{score}}%
- radar.actionHint: Suggested next step
- radar.dismiss: Dismiss
- radar.empty: Nothing urgent to recall right now
- related.title: Connected Ideas
- related.matchScore: Match {{score}}%
- related.linkType.semantic: Similar topic
- related.linkType.temporal: Saved around the same time
- related.linkType.coCapture: Captured in a similar context
- decision.title: Decision Replay
- decision.rationale: Why this decision
- decision.expectedOutcome: Expected outcome
- decision.revisitAt: Revisit on
- decision.markReviewed: Mark as reviewed
- decision.empty: No decisions to revisit
- settings.recallSensitivity: Recall sensitivity
- settings.recallSensitivity.low: Low
- settings.recallSensitivity.medium: Medium
- settings.recallSensitivity.high: High
- settings.proactiveRecallOptIn: Allow proactive recall

Proposed VI strings:
- radar.title: Radar Ky Uc
- radar.subtitle: Goi y ky uc dung luc ban can
- radar.whyNow: Vi sao luc nay
- radar.confidence: Do tin cay {{score}}%
- radar.actionHint: Goi y hanh dong tiep theo
- radar.dismiss: Bo qua
- radar.empty: Hien chua co ky uc can nhac
- related.title: Y Tuong Lien Ket
- related.matchScore: Do khop {{score}}%
- related.linkType.semantic: Cung chu de
- related.linkType.temporal: Luu cung thoi diem
- related.linkType.coCapture: Luu trong boi canh tuong tu
- decision.title: Nhac Lai Quyet Dinh
- decision.rationale: Ly do cua quyet dinh
- decision.expectedOutcome: Ket qua ky vong
- decision.revisitAt: Xem lai vao
- decision.markReviewed: Danh dau da xem
- decision.empty: Chua co quyet dinh can xem lai
- settings.recallSensitivity: Do nhay nhac lai
- settings.recallSensitivity.low: Thap
- settings.recallSensitivity.medium: Trung binh
- settings.recallSensitivity.high: Cao
- settings.proactiveRecallOptIn: Cho phep nhac lai chu dong

Note:
- If your product copy standard requires full Vietnamese diacritics, convert these VI strings before release.
- Any new user-facing key is blocked from merge unless present in both EN and VI files.

## 7) Deployment and Ops Updates

Need deployment update: Yes

Why:
- New tables and backfill jobs increase migration complexity
- Feature flags and staged rollout need env settings

Required updates:
1. Replace one-off migrate.py usage with migration directory runner (or Alembic) in deploy flow (pending)
2. Health contract alignment between API and deploy checks (done)
3. Add env vars (pending):
- FEATURE_RADAR_ENABLED
- FEATURE_CONNECTED_IDEAS_ENABLED
- FEATURE_DECISION_REPLAY_ENABLED
- RADAR_MIN_CONFIDENCE
- RADAR_MAX_ITEMS
4. Required env validation for non-empty critical secrets in deploy preflight (done)
5. Add post-deploy smoke tests for new endpoints (pending):
- GET /health
- GET /ai/radar (auth)
- GET /memories/{id}/related (auth)
- GET /decisions (auth)
6. Add rollback toggle procedure in deployment README (pending)

## 8) Validation and Test Plan

Backend tests (backend/venv):
- Unit:
  - ranking logic and confidence thresholds
  - related-link builder scoring
  - decision due window calculator
- API integration:
  - radar feed contract and auth
  - event logging idempotency checks
  - related endpoint with/without links
  - decision CRUD and review transitions
- Migration tests:
  - upgrade from current schema to new schema
  - verify indexes and unique constraints
  - downgrade safety for additive changes

Backend quality gates before feature rollout:
- Async test framework configuration must be green
- No failing tests on default CI command
- Critical path auth/memory endpoints covered by integration tests

Mobile tests:
- i18n key parity checks EN/VI for all new keys
- UI rendering for radar cards, related cards, decision replay states
- Dismiss/acted instrumentation from mobile event calls

Mobile baseline from this audit:
- Type check: pass
- Jest suites: pass

Web testing:
- Only required if web UI surfaces are changed this cycle
- If changed: run webapp testing for related cards and bilingual rendering

Landing baseline from this audit:
- No mandatory UI change in this revision
- If landing content/UI changes in release branch, run web quality + webapp testing before deploy

## 9) Rollout Gates (Metric-Based)

North Star Metric:
- Weekly Meaningful Recalls (WMR) per WAU

Quarter OMTM:
- Recall Activation Rate = users with >=3 relevant recalls/week and open rate >=40%

Release gates:
- Gate 1 (10% traffic):
  - radar open rate >= 30%
  - dismiss rate <= 45%
  - p95 API latency within SLO
- Gate 2 (30% traffic):
  - acted rate >= 15%
  - no severe regression in capture flow retention
- Gate 3 (100% traffic):
  - WMR/WAU improves >= 20% vs baseline

Kill/iterate criteria:
- If open rate < 20% for 2 consecutive weeks, lower proactive frequency and retune thresholds
- If dismiss rate > 60%, reduce trigger aggressiveness and improve reason text clarity

## 10) Execution Ownership (Lean Team)

Product:
- Own hypotheses, metric gates, and weekly review

Backend:
- Own migrations, ranking, related links, decision APIs, event logging

Mobile:
- Own radar cards, related section, decision capture and i18n parity

Ops:
- Own deployment migration reliability and feature-flag rollout safety

## 11) Immediate Next Actions (Next 5 Business Days)

1. Establish versioned migration path (Alembic baseline), then create migrations for recall_events, memory_links, decision_memories
2. Add feature-flag env vars and rollout defaults in deployment .env.example and deploy checklist
3. Implement EN/VI keys for radar/related/decision/settings and keep parity gate required in CI
4. Add post-deploy smoke script covering /health, /ai/radar, /memories/{id}/related, /decisions
5. Ship /ai/radar read + /ai/radar/events write behind flags and run dogfood with 20-50 users

## 12) Code Review Findings (Current Snapshot)

Severity: High
1. Migration governance gap remains
- Current state still relies on one-off migration scripts (backend/migrate.py and ad-hoc SQL files)
- Risk: non-repeatable schema evolution for multi-stage rollout

2. Rate limiting and circuit breaker coverage is insufficient for external dependencies
- AI and link-enrichment flows have timeouts but limited resilience controls under burst/failure conditions
- Risk: reliability degradation and unpredictable LLM costs during traffic spikes

Severity: Medium
3. Deployment flow still couples migration execution to migrate.py
- deploy.sh currently executes python migrate.py
- Recommendation: move to versioned migration runner with explicit revision checks

4. Mobile feature i18n for upcoming Radar/Decision flows is not implemented yet
- Parity tooling exists and is passing, but planned Radar/Decision keys are still pending in both locales
- Recommendation: block feature merge until EN/VI keys are implemented and validated

5. Landing messaging/model references may drift from runtime stack
- landing/index.html currently advertises GPT-4 in metadata
- Recommendation: align copy with actual shipped model policy and pricing strategy

6. Auth and session hardening opportunities remain
- Google OAuth validation path needs full production policy checks (redirect and secret handling)
- Mobile token refresh resilience can be improved for better session continuity

Severity: Low
7. Backend warnings remain even though tests pass
- Deprecation warnings from datetime.utcnow usage and Pydantic v2 class Config usage in schema models
- Recommendation: schedule technical debt cleanup sprint (no launch blocker)
