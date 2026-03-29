# Memory AI Execution Backlog: Epics, Stories, Proof

Date: 2026-03-29
Derived from: docs/COMPETITOR_FEATURE_PLAN_2026-03-29.md
Goal: Convert strategy into implementation-ready Epic/Story backlog with proof and release gates.

## 1) How To Use This Backlog

Each story below includes:
- Scope
- Acceptance Criteria (AC)
- Proof of Execution (PoE)
- i18n EN/VI requirement
- DB migration requirement
- Deployment update requirement
- Validation commands

Story status workflow:
- Todo -> In Progress -> In Review -> Done

Definition of Done per story:
1. AC passed.
2. PoE artifacts attached.
3. EN/VI parity passed for any user-facing text.
4. Migration impact explicitly marked: Yes/No.
5. Deployment impact explicitly marked: Yes/No.
6. Validation commands pass.

---

## 2) Epic Overview

Epic E1: Radar v2 Quality + Instrumentation (Weeks 1-4)
Epic E2: Decision Replay v1 (Weeks 5-8)
Epic E3: Connected Ideas v2 (Weeks 5-8)
Epic E4: Web Production Integration (Weeks 9-12)
Epic E5: Reliability, Cost Control, and Release Ops (Cross-phase)

---

## 3) Epic Details and Stories

## Epic E1: Radar v2 Quality + Instrumentation

Outcome:
- Recall is explainable, measurable, and tunable by user preference.

### Story E1-S1: Radar scoring policy v2

Scope:
- Improve ranking score with recency, type weighting, and behavior signals.

AC:
- Radar endpoint returns stable ordering for identical input.
- Score thresholds configurable by recall sensitivity.
- Reason + confidence always returned per radar item.

i18n:
- No new user-facing strings in backend only.

DB migration:
- No.

Deployment update:
- Yes, if introducing new env flags for scoring thresholds.

Validation:
- backend/venv/bin/pytest backend/test_endpoints.py -q
- backend/venv/bin/pytest backend/test_insights_cache.py -q

PoE:
- API sample payload before/after scoring update.
- Test run output attached.

### Story E1-S2: Radar event logging completeness

Scope:
- Log served/opened/dismissed/acted with context and confidence.

AC:
- Event endpoint accepts all valid event types.
- Invalid event type rejected with 422.
- Event rows queryable by user_id and created_at.

i18n:
- No.

DB migration:
- Yes, if telemetry schema changes.

Deployment update:
- Yes, migration execution and smoke check update.

Validation:
- backend/venv/bin/pytest backend/test_endpoints.py -q
- backend/venv/bin/python backend/test_endpoints.py

PoE:
- DB row snapshots for each event type.
- Endpoint smoke output attached.

### Story E1-S3: Radar settings in preferences

Scope:
- Expose and persist recall sensitivity + proactive opt-in.

AC:
- Preferences API returns defaults when unset.
- Preferences update persists and reflects in radar results.

i18n:
- Yes, if new labels shown in mobile settings.
- Must pass EN/VI parity.

DB migration:
- Yes, if preferences columns are not present in production.

Deployment update:
- Yes, include migration and rollback notes.

Validation:
- backend/venv/bin/pytest backend/test_preferences.py -q
- cd mobile && npm run type-check
- cd mobile && npm run i18n:check

PoE:
- API request/response for setting updates.
- Mobile screenshot showing settings values.

### Story E1-S4: Radar UX polish and action loop

Scope:
- Improve recall card clarity and action affordances in mobile.

AC:
- Card displays reason, confidence, and clear action hint.
- Dismiss/Open actions tracked and reflected instantly in UI.

i18n:
- Yes, all copy in EN and VI.

DB migration:
- No.

Deployment update:
- No (unless API contract changed).

Validation:
- cd mobile && npm run type-check
- cd mobile && npm run test
- cd mobile && npm run i18n:check

PoE:
- Screen recording of interaction flow.
- Event logging verification for actions.

---

## Epic E2: Decision Replay v1

Outcome:
- Users create decisions, revisit at due time, and close review loops.

### Story E2-S1: Decision schema and migration

Scope:
- Add decision entity and required indexes.

AC:
- Table created with status and revisit fields.
- Indexes support user/status/due queries.
- Migration idempotent and safe on existing DB.

i18n:
- No.

DB migration:
- Yes.

Deployment update:
- Yes.

Validation:
- backend/venv/bin/pytest -q
- backend/venv/bin/python backend/test_endpoints.py

PoE:
- Migration diff and successful apply log.
- Rollback rehearsal notes.

### Story E2-S2: Decision CRUD API

Scope:
- Create/list/update/review endpoints for decisions.

AC:
- Full lifecycle works for authenticated user.
- Status transitions validated.
- Unauthorized access blocked.

i18n:
- No.

DB migration:
- Yes (depends on E2-S1).

Deployment update:
- Yes.

Validation:
- backend/venv/bin/pytest -q
- New decision endpoint integration tests pass.

PoE:
- Postman or curl collection with pass results.

### Story E2-S3: Decision capture UI

Scope:
- Add mobile flow to create/edit/review decisions.

AC:
- User can create and schedule revisit date.
- User can mark reviewed.
- Validation errors are user-friendly.

i18n:
- Yes, EN/VI complete.

DB migration:
- No new migration beyond E2-S1.

Deployment update:
- No.

Validation:
- cd mobile && npm run type-check
- cd mobile && npm run test
- cd mobile && npm run i18n:check

PoE:
- UI screenshots EN and VI.
- Test output attached.

### Story E2-S4: Decision revisit queue and reminders

Scope:
- Surface due and near-due decisions in reminder flow.

AC:
- Due items shown in revisit section.
- Completed review no longer shown as due.

i18n:
- Yes.

DB migration:
- No.

Deployment update:
- Maybe, if background scheduling added.

Validation:
- backend/venv/bin/pytest -q
- cd mobile && npm run type-check
- cd mobile && npm run i18n:check

PoE:
- Before/after queue screenshots.
- API payload for due filtering.

---

## Epic E3: Connected Ideas v2

Outcome:
- Related memories are useful, explainable, and partially user-controlled.

### Story E3-S1: Related scoring quality gate

Scope:
- Improve semantic/temporal blending and low-quality filtering.

AC:
- Related endpoint returns fewer low-signal links.
- Similarity score exposed for analytics/debug.

i18n:
- No.

DB migration:
- No (unless adding explicit link table in next stories).

Deployment update:
- No.

Validation:
- backend/venv/bin/pytest -q

PoE:
- Quality sample set with manual relevance checks.

### Story E3-S2: Explicit link model

Scope:
- Add user-created link edges between memories.

AC:
- User can create and remove explicit links.
- API preserves both explicit and auto links.

i18n:
- No in backend; Yes in mobile UI.

DB migration:
- Yes.

Deployment update:
- Yes.

Validation:
- backend/venv/bin/pytest -q
- migration smoke test in staging

PoE:
- Schema migration evidence.
- Endpoint examples for add/remove link.

### Story E3-S3: Connected ideas UI in memory detail

Scope:
- Display grouped related memories with explanation.

AC:
- Related section loads fast and degrades gracefully.
- Tap navigates to related memory detail.

i18n:
- Yes, EN/VI keys complete.

DB migration:
- No (depends on E3-S2 only for explicit links).

Deployment update:
- No.

Validation:
- cd mobile && npm run type-check
- cd mobile && npm run test
- cd mobile && npm run i18n:check

PoE:
- EN/VI screenshots and interaction recording.

### Story E3-S4: Related CTR instrumentation

Scope:
- Track exposure and click-through of related cards.

AC:
- Events logged with memory_id, source, and timestamp.
- Daily CTR dashboard query available.

i18n:
- No.

DB migration:
- Maybe (if new event fields/table needed).

Deployment update:
- Yes if migration.

Validation:
- backend/venv/bin/pytest -q

PoE:
- Query result screenshot and sample events.

---

## Epic E4: Web Production Integration

Outcome:
- Web is no longer mock-only; core flows run on production APIs.

### Story E4-S1: Web API client and auth flow

Scope:
- Wire login/session and API base layer in web app.

AC:
- User can authenticate and keep session.
- API errors handled gracefully.

i18n:
- Yes if localized web copy is visible.

DB migration:
- No.

Deployment update:
- Yes, web env and deploy docs update.

Validation:
- web type-check and unit tests
- webapp testing for login and session restore

PoE:
- Web test recording for login/logout.

### Story E4-S2: Web memory list/detail/search

Scope:
- Replace mock data with real memory list/detail/search.

AC:
- Pagination works and matches mobile behavior.
- Search returns expected items and empty states.

i18n:
- Yes.

DB migration:
- No.

Deployment update:
- No.

Validation:
- webapp testing: list/detail/search
- API smoke checks for pagination contract

PoE:
- Test evidence for all core journeys.

### Story E4-S3: Web capture and create flow

Scope:
- Enable create memory flow in web.

AC:
- Text and link capture functional in web.
- Success and error states clear.

i18n:
- Yes.

DB migration:
- No.

Deployment update:
- No.

Validation:
- webapp testing: create flow end-to-end
- i18n parity check if web locale files introduced

PoE:
- Capture flow recording and created item verification.

### Story E4-S4: Insights parity in web

Scope:
- Read-only insights surfaces consistent with mobile.

AC:
- Weekly recap and key stats render correctly.
- Loading/error states are resilient.

i18n:
- Yes.

DB migration:
- No.

Deployment update:
- No.

Validation:
- webapp testing: insights view
- backend insight endpoint smoke

PoE:
- Screenshots and endpoint timing snapshot.

---

## Epic E5: Reliability, Cost Control, and Release Ops

Outcome:
- Production rollout is safer, cheaper, and measurable.

### Story E5-S1: AI retry/backoff/circuit breaker

Scope:
- Harden external AI calls with safe retry and fallback.

AC:
- Transient failures recover without user-visible crash.
- Error budgets and fallback path documented.

i18n:
- No.

DB migration:
- No.

Deployment update:
- Yes if env flags added.

Validation:
- backend resilience tests
- smoke test with simulated provider failure

PoE:
- Failure drill logs and fallback evidence.

### Story E5-S2: Token/cost guardrails

Scope:
- Add daily budget and per-user token guardrails.

AC:
- Requests over limit are throttled gracefully.
- Cost dashboard query available.

i18n:
- No.

DB migration:
- Maybe, if storing daily usage ledger.

Deployment update:
- Yes.

Validation:
- backend tests for quota behavior

PoE:
- Quota test outputs and budget alert sample.

### Story E5-S3: Migration governance baseline

Scope:
- Standardize migration policy and staging rehearsal.

AC:
- Every schema change has forward+rollback note.
- Staging migration check is mandatory before prod deploy.

i18n:
- No.

DB migration:
- Process-level Yes.

Deployment update:
- Yes.

Validation:
- Migration rehearsal checklist signed.

PoE:
- Attached checklist and rehearsal logs.

### Story E5-S4: Release gate checklist automation

Scope:
- Add CI gates for tests, i18n parity, and smoke scripts.

AC:
- PR cannot merge when required checks fail.
- Release checklist generated for each deploy candidate.

i18n:
- Yes, parity gate enforced.

DB migration:
- No.

Deployment update:
- Yes, docs and pipeline steps.

Validation:
- CI pipeline run with pass/fail scenarios.

PoE:
- CI run URLs or logs showing enforced gates.

---

## 4) Sprint Suggestion (First 3 Sprints)

Sprint 1:
- E1-S1, E1-S2, E1-S3

Sprint 2:
- E1-S4, E2-S1, E2-S2

Sprint 3:
- E2-S3, E3-S1, E3-S3

Parallel mandatory tasks each sprint:
- EN/VI i18n parity check for user-facing changes.
- Migration impact assessment note in PR.
- Deployment impact assessment note in PR.

---

## 5) Proof of Execution Template (Copy per Story)

Story ID:
Owner:
PR link:

1. AC evidence:
-

2. i18n EN/VI:
- Impacted strings: Yes/No
- Evidence:

3. DB migration:
- Needed: Yes/No
- Migration file(s):
- Rollback note:

4. Deployment update:
- Needed: Yes/No
- Updated file(s):

5. Validation outputs:
- Backend tests:
- Mobile tests:
- Webapp testing:

6. Risks or follow-up:
-
