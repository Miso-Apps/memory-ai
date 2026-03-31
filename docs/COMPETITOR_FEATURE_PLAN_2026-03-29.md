# Memory AI Competitor Research + Feature Completion Plan

Date: 2026-03-29
Owner: Product + Engineering
Scope: Competitor-informed plan to complete and harden app features across backend, mobile, extension, and web.

Execution backlog:
- docs/EXECUTION_EPICS_STORIES_2026-03-29.md

## 1) Executive Summary

Memory AI already has a strong base: multi-modal capture, semantic search, related memories, insights, and weekly recap. The next winning move is not "more features" in general, but sharper execution on three differentiators:

1. Timely proactive recall with measurable trust (reason + confidence + action loop).
2. Decision intelligence (capture decisions, revisit, compare outcomes).
3. Low-friction connected memory graph (automatic plus explicit links).

This plan is designed to close the most important competitive gaps while enforcing release quality gates:
- EN/VI i18n parity for all user-visible strings.
- Explicit migration policy before schema changes.
- Deployment updates for every infra-impacting change.
- Validation and testing gates before rollout.

## 2) Competitor Snapshot (2026)

Sources reviewed: public product pages for Notion AI, Evernote, Obsidian, Mem, and Readwise.

### Notion AI
- Strength: AI agents, enterprise search across tools, meeting notes, governance/security controls.
- Weakness for personal memory niche: broad workspace complexity, less focused on personal recall timing.

### Evernote
- Strength: strong capture stack (web clipper, scanning, search, tasks/calendar).
- Weakness: less differentiated proactive recall and decision loops.

### Obsidian
- Strength: explicit links, backlinks, graph, plugin ecosystem, local-first privacy.
- Weakness: setup burden for mainstream users, manual workflow tuning.

### Mem
- Strength: auto-organization, meeting capture, contextual retrieval, "second brain" narrative.
- Weakness: less transparent measurable recall quality loops for users.

### Readwise
- Strength: spaced repetition and daily resurfacing habit loop.
- Weakness: focused on reading highlights rather than full life/work memory capture.

## 3) Current Product Reality (from codebase)

### Strongly implemented
- Text/link/photo/voice capture.
- Semantic search + AI-assisted summary.
- Related memories (embedding-based).
- Radar/proactive recall baseline.
- Weekly recap and insights pipeline.
- Mobile EN/VI localization with parity check script.

### Partial
- Web app: mostly design shell, not fully wired to production APIs.
- Reminder and revisit UX: available capability but limited product flow depth.

### Missing or underpowered
- Explicit user-defined memory links.
- Decision workflow lifecycle (decide, revisit, evaluate outcome).
- Rich instrumentation loop for recall quality optimization.
- Team/shared memory (deliberately out of current scope unless strategy changes).

## 4) Priority Matrix (Impact x Differentiation x Feasibility)

Priority P0 (build now):
1. Memory Radar v2 (reason clarity, confidence calibration, feedback instrumentation).
2. Decision Replay v1 (structured decisions + revisit scheduling + outcome tracking).
3. Connected Ideas v2 (explicit links + auto links + quality controls).

Priority P1 (next):
1. Web production integration for core read/create/search flows.
2. Notification and habit loops for revisit/reminder completion.

Priority P2 (defer):
1. Team collaboration/workspaces.
2. Marketplace-scale integrations.

## 5) 12-Week Execution Plan

## Phase 1 (Weeks 1-4): Recall Quality and Instrumentation

Goal:
- Make proactive recall measurably useful, not just available.

Deliverables:
1. Radar reason templates + confidence calibration by memory type.
2. Event instrumentation upgrade: served/opened/dismissed/acted/snoozed.
3. Personalization seed signals (recent actions and category affinity).

Engineering changes:
- Backend: scoring policy update and telemetry payload extensions.
- Mobile: explanation-first card UI and clear actions.
- Extension: optional capture intent tags to enrich scoring.

i18n gate:
- Add all new EN keys and VI keys together.
- Pass: `mobile/scripts/check-i18n-parity.mjs`.

DB migration check:
- Needed: Yes (if new telemetry columns/tables added).
- Action: create versioned migration and backfill-safe defaults.

Deployment check:
- Needed: Yes (new migrations + optional env flags).
- Action: update deploy runbook for migration order and rollback path.

Validation:
- Backend: `backend/venv/bin/pytest` for radar and insights tests.
- Mobile: type-check + key UI/state tests.
- Metrics: Radar open rate and acted rate tracked daily.

## Phase 2 (Weeks 5-8): Decision Replay and Explicit Linking

Goal:
- Turn memory app into decision quality engine.

Deliverables:
1. Decision entity with hypothesis, options, chosen action, expected outcome, due-review date.
2. Revisit flow: due/near-due queue with completion states.
3. Explicit linking UI in memory detail (link/unlink) plus auto-link co-existence.

Engineering changes:
- Backend: decision model + link edge model + APIs.
- Mobile: decision capture/edit/review screens; link management actions.
- Insights: decision quality metrics and replay summaries.

i18n gate:
- New decision/linking copy must launch EN and VI together.
- No feature flag goes to 100% with missing locale keys.

DB migration check:
- Needed: Yes (new tables and indexes).
- Action: add migrations, indexes for lookup paths, and idempotent compatibility rules.

Deployment check:
- Needed: Yes.
- Action: update deployment docs/scripts for revision-based migrations and rollback steps.

Validation:
- Backend: model + endpoint tests, migration smoke tests.
- Mobile: flow tests for create/review/link.
- Product: weekly decision review completion trend.

## Phase 3 (Weeks 9-12): Web Integration and Reliability Hardening

Goal:
- Ensure cross-platform continuity and launch readiness.

Deliverables:
1. Web app wired to production API for auth, memory list/detail, search, capture.
2. Shared state and pagination consistency with mobile.
3. Reliability controls: retries/backoff/circuit-breaker for AI-provider calls.

Engineering changes:
- Web: replace mocked data with API client and production state handling.
- Backend: endpoint consistency and response contracts for web/mobile parity.

i18n gate:
- If web includes localized UI, enforce EN/VI parity at build time.

DB migration check:
- Needed: Maybe (only if schema evolves in this phase).
- Action: no schema change, no migration.

Deployment check:
- Needed: Yes (web deploy flow and backend contract checks).
- Action: update deployment docs for new smoke tests and health checks.

Validation:
- Web UI change requires end-to-end web app testing before release.
- Run webapp testing skill flow for key journeys: login, capture, search, detail, insights.

## 6) KPI and Release Gates

North Star:
- Weekly Meaningful Recalls per WAU.

Quarter OMTM:
- Recall activation quality = users with >=3 relevant recall interactions per week.

Ship gates by phase:
1. Quality gate:
- No P0/P1 regressions in backend tests.
- Mobile type-check and tests green.
2. Localization gate:
- EN/VI parity check passes.
3. Data gate:
- Migrations applied successfully in staging and rollback verified.
4. Ops gate:
- Deployment runbook updated when any infra or schema behavior changes.

## 7) Immediate Backlog (Next 10 Working Days)

1. Finalize Radar v2 scoring RFC and event schema.
2. Implement telemetry extension and dashboards.
3. Define Decision Replay data contract and UX wireframes.
4. Add explicit-link DB design and migration draft.
5. Prepare staging migration rehearsal checklist.
6. Prepare i18n key plan (EN/VI) for all phase-1 and phase-2 screens.

## 8) Risk Register and Mitigation

Risk 1: Schema churn slows delivery.
- Mitigation: batch compatible migrations by phase, avoid frequent breaking schema shifts.

Risk 2: AI quality variance reduces trust.
- Mitigation: confidence thresholds, fallback responses, user feedback loop.

Risk 3: Localization lag blocks release.
- Mitigation: translation keys are part of definition of done for each story.

Risk 4: Multi-client inconsistency (mobile vs web).
- Mitigation: shared API contracts, pagination consistency tests, staged rollouts.

## 9) Definition of Done (Per Feature)

A feature is done only when all are true:
1. Functionality implemented across required surfaces.
2. EN/VI translations complete and parity check passes.
3. DB migration impact assessed and implemented if needed.
4. Deployment docs/scripts updated if operational behavior changed.
5. Automated tests and smoke checks pass in staging.
6. Feature flag and rollback plan documented.
