# ASCENDLY — ARCHITECTURE HANDBOOK (Official)
**Principal Architect review — v3, 10-phase exhaustive.**
*Scope: full monorepo (apps/api FastAPI, apps/web Next.js, docker, k8s, prometheus). Method: source inspection; no code changed; no solutions proposed in Phases 1–10.*

---

# PHASE 1 — ARCHITECTURE DISCOVERY

## 1.1 Physical structure
- **`apps/api`** — Python 3.14 FastAPI monolith; Mongo (memory driver for tests), Redis (worker/rate limit).
- **`apps/web`** — Next.js App Router + TypeScript + Tailwind PWA; jest + playwright E2E.
- **`docker/ k8s/ prometheus/`** — container builds, K8s manifests (api/web/worker deployments, ingress, HPA), Prometheus+Grafana + alerts.

## 1.2 Backend layers (verified from source)
| Layer | Location | Contents |
|---|---|---|
| **API/Transport** | `app/api/v1/*` | 33+ routers (full list in §8.1) |
| **Application services** | `app/services/*` | community, ecosystem, skill_graph, notifications, intelligence, platform_ops, event_handlers, llm, recommendation, search, r2_storage, adaptive/course-generator/community-ai/ai helpers, worker tasks |
| **Domain** | `app/core/*` | response envelope, events bus, deps (auth guards), config, ratelimit, telemetry, error_logger |
| **Infrastructure** | `app/db/*`, `app/core/worker.py`, `app/core/r2_storage.py` | mongodb (get_db/get_read_db), indexes, seed_concepts, Redis pool, R2 storage |
| **Schemas** | `app/schemas/*` | Pydantic DTOs (Course, Quiz, Exam, etc.) |
| **Tests** | `tests/*` | 17+ API test files + web jest/e2e |

## 1.3 Startup/lifecycle (main.py, verified)
1. seed_db → create_indexes → Redis pool → R2 lifecycle → `search_service.init_search()` + `sync_all_courses()` → seed_learning_paths → seed_concepts → seed_skill_taxonomy → **register_default_handlers(event_bus)**.
2. Middleware: CORSMiddleware → GracefulShutdown → SlowAPIMiddleware (rate).
3. Exception handlers: RateLimitExceeded, StarletteHTTPException, RequestValidationError, generic → all funnel to `error_logger` JSON + `error_response` envelope.
4. Health: `/api/v1/health` and `/api/v1/health/ready` (Mongo+Redis ping).

## 1.4 Core abstractions (verified)
- **Response envelope**: `api_response(data, meta)` / `error_response(msg, status)` / `service_response(result)` (converts `{"error":True}` → 400/404, prevents fake-200).
- **Auth guards**: `get_current_user`, `get_optional_user`, `require_admin` (JWT; admin role).
- **Rate limit**: slowapi global limiter (observed 5/min default in tests).
- **Error logger**: structured category/level/url/method/ip/UA; admin viewer endpoint (`error_log` router).
- **Telemetry**: `setup_telemetry(app, environment)`, Sentry optional via `settings.sentry_dsn`.
- **Worker**: Redis-backed task queue used by admin analytics/search (`enqueue run_analytics_task`, `index_search_task`) — *see §2.5*.
- **Config**: pydantic `Settings` (Mongo URI, Redis, CORS, R2, Sentry, telemetry env).

---

# PHASE 2 — DEPENDENCY MAPPING

## 2.1 Layer graph (verified)
```
Frontend (Next.js) ─── HTTP/JWT ───► API routers ───► Application services
    └─ PWA/offline-db                              └─► Domain core (envelope, events, deps)
                                                       └─► Infrastructure (Mongo get_db/get_read_db, Redis worker, R2)
```

## 2.2 Service→Service (verified)
```
community.py  → skill_graph (update/get/recommend/next), llm (mentor), core.events (ChallengeCompleted)
ecosystem.py  → community (create_activity, _update_creator_stats), notifications (create_notification, notify_followers), core.events (EventCreated)
event_handlers → community, ecosystem, notifications   (event consumer hub)
intelligence.py → db (read-only, direct collection names: activity_events, challenge_attempts, notifications, creator_profiles, arena_players, moderation_reports)
platform_ops.py → intelligence (self_recommendations), notifications (create_notification)
recommendation.py → courses (get_recommendations/get_popular_courses/get_similar_courses)
admin analytics → ai service (build_metrics, summarize_with_llm, forecast_revenue/new_subscriptions/churn)
search.py → index + sync_all_courses (startup)
```
**No circular dependencies detected (verified imports).**

## 2.3 Hidden coupling / god modules (verified)
- **`ecosystem.py` = god service**: owns creator economy + marketplace + events + moderation + platform-intelligence signals — 5 bounded contexts in one module.
- **`community.py`** spans challenges (grading) + community feed + creator stats — 3 contexts.
- **`intelligence.py`** hidden-couples to 6 collection names (no schema contract).
- **`admin.py`** mixes inline Mongo CRUD + AI analytics/forecast + background enqueue — broad but lower risk.

## 2.4 Shared mutable state
- Global **event bus** (`core/events.py::bus`) — in-process, synchronously awaited, per-correlation dedup. Singletons: limiter, redis pool, r2_storage.
- **Dual-source counters**: challenge `stats.attempts` vs `challenge_attempts` count; `stats.bookmarks` vs `bookmarks` collection; follower count embedded in `creator_profiles`.

## 2.5 Background processing (verified)
- Redis worker pool (`core/worker.py`); admin enqueues `run_analytics_task` + `index_search_task`.
- Search index rebuilt from courses at startup; R2 lifecycle auto-delete configured.

---

# PHASE 3 — MODULE REVIEW

(*Purpose, responsibilities, owned data, public APIs, dependencies, consumers, maturity L1–L5, risk, debt. Scores: Maintainability M, Testability T, Performance P — 1..5.*)

| Module | Purpose | Owns data | Public API | Depends | Consumers | Maturity | Risk | M/T/P |
|---|---|---|---|---|---|---|---|---|
| **auth** | identity, JWT, roles | users | POST login/register | core | all | L4 | low | 5/4/5 |
| **courses** | catalog, chapters, search-backed listing, reviews, recommendations wiring | courses, categories, reviews | GET/POST courses, reviews, recommendations, similar | recommendation, search | web | L3 | med (inline heavy) | 3/3/3 |
| **challenges** | CRUD, grading, attempts, ratings, bookmarks, publish | challenges, challenge_attempts, ratings, bookmarks | /challenges/… | community, skill_graph | web | L4 | low | 4/4/4 |
| **community** | grading + feed + creator stats (3 contexts) | activity_events, creator followers | feed, submit, follow, rate | skill_graph, llm, events | hub, arena | L4 | **med-high (god-ish)** | 3/3/4 |
| **ecosystem** | creator, marketplace, events, moderation, intelligence signals (5 contexts) | creator_profiles, collections, events, moderation_reports | /ecosystem/*, /admin/ecosystem/* | community, notifications, events | web, admin | L4 | **high (god service)** | 2/2/3 |
| **skill_graph** | taxonomy + mastery + per-user recs | skills, user_skills | /skills/* | db | community, adaptive | L3 | med (rec duality) | 3/3/3 |
| **arena/tournaments** | competition, leaderboards | arena_players, tournaments | /arena/* | community | web | L3 | low | 3/3/3 |
| **notifications** | typed notifications, prefs, quiet hours | notifications, notification_preferences | /notifications/* | db | all | L4 | low | 4/4/5 |
| **events bus + event_handlers** | in-process event bus, catalog, deps, diagnostics | (in-memory) | /admin/events/* | core | producers+consumers | L4 | low | 4/5/5 |
| **intelligence** | health KPIs, challenge/creator signals, recs | — (read-only) | /admin/intelligence/overview | db direct names | ops, admin | L3 | **med (request-time 200k scans; schema coupling)** | 3/3/2 |
| **platform_ops** | task/workflow engine, audit, automation | ops_tasks | /admin/ops/* | intelligence, notifications | admin | L3 | low | 4/4/4 |
| **admin** | KPI dashboard, AI analytics + forecasts, course mgmt, error-log view | — | /admin/* | ai, search worker | ops | L3 | med | 3/3/3 |
| **payments/membership** | subscriptions, coupons, affiliate (via subscriptions/affiliate routers) | subscriptions, coupons | /subscriptions, /affiliate | auth | web | **L2** | **med — gateway wiring: Needs further inspection** | 2/2/3 |
| **AI** | mentor, tutor, course-gen, code-assistant, community-ai, admin forecasts | (external LLM) | various | llm | web, admin | L3 | **med (prompt-injection hygiene unverified)** | 3/4/3 |
| **certificates** | issuance + verify | certificates | /certificates, /verify | progress | web | L2 | low | 3/3/3 |
| **enterprise/exams** | B2B, exams | (*Needs further inspection*) | /enterprise, /exams | auth, courses | web | L2 | **med (depth unknown)** | ?/?/? |
| **search** | index + sync | search index | internal | courses worker | courses | L2 | med | 2/2/2 |
| **web app** | PWA UI | local (offline-db) | — | API | users | L3 | med (no fetch cache layer) | 3/3/3 |

---

# PHASE 4 — DOMAIN REVIEW

| Domain | Cohesive? | Over-owns? | Leaks? | Boundary clear? | Reusable? | Independently evolvable? |
|---|---|---|---|---|---|---|
| Learning/Courses | yes | no | no | yes | yes | yes |
| Challenges | yes | no | minor (grading in community.py) | yes | yes | yes |
| Arena | yes | no | no | yes | yes | yes |
| Creator | yes | **yes (inside ecosystem w/ 4 others)** | via ecosystem | **no — needs module split** | partially | no |
| Community | mostly | marketing/creator overlap | activity split across 3 routers | fuzzy | yes | partially |
| Events | yes | no | no | yes (router + listeners) | yes | yes |
| Notifications | yes | no | no | yes | yes | yes |
| Intelligence | yes | read-everything | direct collection names | yes (read-model) | yes | yes |
| Platform Ops | yes | no | no | yes | yes | yes |
| Moderation | yes | no | no | yes | yes | yes |
| Auth/Identity | yes | no | no | yes | yes | yes |
| Membership/Payments | unknown depth | — | — | *Needs further inspection* | — | — |
| AI | scattered (mentor/tutor/gen/forecast all separate) | no | crosses all domains | fuzzy | yes | partially |
| Profiles | yes | no | no | yes | yes | yes |
| Admin | command surface | inline logic | some | broad | no | no |
| Marketplace | yes | inside ecosystem | via ecosystem | no | partially | no |

**Key verdicts:** ecosystem and community need bounded-context decomposition; AI is a cross-cutting capability not a single aggregate; intelligence is a proper read-model domain.

---

# PHASE 5 — EVENT ARCHITECTURE REVIEW

## 5.1 Registered events (verified)
| Event | Producer | Consumers | Idempotency |
|---|---|---|---|
| `ChallengeCompleted` v1 | community.submit_challenge | community.activity; creator.stats; notifications.reserved(noop) | attempt_id + correlation+payload dedup |
| `EventCreated` v1 | ecosystem.create_event | creator.tracking; community.activity; notifications.followers | event_id + host-guard |

## 5.2 Bus mechanics (verified)
- In-process, async `publish`; **deterministic handler registration order**; per-handler failure isolation (logged, others continue); per-handler timing stats + per-event published/ok/failed; **no retry store** (resync-from-source = retry strategy).
- Governance: `EventSpec` contracts; catalog/dependencies/diagnostics **auto-derived** (`/admin/events/*`); orphan-listener detection.

## 5.3 Risk analysis
- **Chains**: max 1 hop (verified). **Storms**: none (≤3 handlers/event; handlers never re-publish).
- **Missing events (11)** each with built trigger site (verified code paths): ChallengePublished, CreatorFollowed, CreatorVerified, RatingChanged, CertificateIssued, ReportSubmitted, ModerationCompleted, SkillMastered, UserRegistered, EventJoined, BattleWon.
- **Unnecessary events**: none — the 2 existing events each remove real direct-call coupling.
- **Naming/ownership**: past-tense PascalCase, producer-tagged, singular business meaning. Good.
- **Versioning**: `EventSpec.version` + backward-compat documented.
- **Future migration path**: sync in-process → async handler queue boundary (worker) without schema change; producers/consumers unchanged.

---

# PHASE 6 — DATABASE REVIEW

## 6.1 Collections (verified from code reads)
Hot: users, challenges, challenge_attempts, activity_events, notifications.
Warm: creator_profiles (embeds followers/badges/achievements), events (embeds attendee_ids), arena_players, courses, progress.
Cold: collections/collection_bookmarks, moderation_reports, ops_tasks (history array), certificates, ratings, bookmarks, challenge_versions, reviews, subscriptions, coupons, discussions, blog, contacts, learning_paths, user_skills, skills.

## 6.2 Reference/ownership
- Embedded lists (followers, attendee_ids, badges, history) for read locality; append-only feeds/counters for hot writes.
- **Dual-source risks**: challenge `stats.attempts` vs `challenge_attempts`; `stats.bookmarks` vs `bookmarks`; `stats.avg_rating` vs `ratings`. Single-writer today → acceptable, but contract needed.
- **N+1 history**: prior phase **eliminated N+1** in ecosystem list endpoints via `_load_users_batch/_load_challenges_batch`; community feed still enriches users per-event in a loop (*Needs inspection on whether batched*).

## 6.3 Indexes/growth
- Index creation at startup (migration 002); **in-memory DB lacks index support** (warn logged) → parity risk.
- `activity_events` growth: **no TTL/retention** (risk).
- Shard candidates: challenge_attempts, activity_events.

---

# PHASE 7 — FRONTEND ARCHITECTURE REVIEW

## 7.1 Verified
- **Framework**: Next.js App Router + TS + Tailwind + PWA (manifest, sw.ts, _headers, _routes.json).
- **Route groups**: (app) authenticated dashboard/creator/events/activity/…, (auth) login/register, (public) marketing/courses/pricing/reviews/leaderboard/community/profile/[userId], admin (moderation + ops views), verify, offline, offline-courses.
- **Component organization**: per-domain folders — dashboard/ (leaderboard-preview…), arena/ (leaderboard-view…), community/ (hub-view, hub-sections…), ecosystem/ (creator-studio, events-view, moderation-queue, notifications-view, notification-bell…), profile/ (header/view/sections…), homepage/, adaptive/, learning-paths/, onboarding/, support/, ide/, experiments/, shared/ (navbar…), ui/ (Button, Skeleton…).
- **State**: `auth-context` (JWT user), hooks `use-experiments`, `use-offline-cache`; no global store.
- **API layer**: `lib/api-client` (env-backed) + domain clients (community-api, ecosystem-api, notifications-api, adaptive-client); `lib/error-logger`, `lib/offline-db`.
- **Loading**: skeletons per domain; empty states per view; **a11y**: aria-labels, navbar focus-trap + Escape.

## 7.2 Gaps (verified absent)
- No data-fetch cache layer (React Query/SWR absent); no SSR/streaming usage confirmed on dynamic pages; no per-route loading boundaries inventory; hydration cost unknown (*inspect lighthouse budget file: `lighthouse-budget.json` exists*).

---

# PHASE 8 — PLATFORM OS REVIEW

- **Intelligence** (L3): real KPIs (DAU/WAU/MAU, retention, session, challenge success, creator growth, competition participation, notification CTR) + challenge signals (abandoned/hard/easy/popular/poor) + creator signals (verify-candidate/inactive/most-trusted) + severity-ranked recommendations. **Request-time scans (200k) — not self-renewing (no scheduler).**
- **Platform Ops** (L3): task system (9 workflows, priorities, audit history, dedup sync `REC_TO_WORKFLOW`, admin notify, overview command center).
- **Loop**: Recommendation → Task → Execution → (outcome measurement **absent**) → Better Recommendation. **Measurement is the missing last link.**
- **Governance**: event catalog/deps/diagnostics + ops audit + playbook = strong self-oversight.
- **Automation** today: only `sync_from_intelligence` (manual admin trigger); no timer.

---

# PHASE 9 — ENGINEERING REVIEW

- **Standards**: ENGINEERING_PLAYBOOK.md §1–12 (layering, API, DB, errors, perf budgets, security, observability, events governance, ops, testing, a11y, DX).
- **Consistency**: response envelope everywhere; `service_response` guardrail; router prefixes `/api/v1/<domain>`; admin under `/admin/*`; `limit` bounds (ge=1 le=100).
- **Observability**: error_logger (categorized), health/ready, telemetry, Prometheus+Grafana configs, event diagnostics, admin dashboards. Trace correlation limited to event `correlation_id`.
- **Testing**: 17 API test files; web jest (accessibility, components, lib) + playwright e2e. **Known failures/risks**: shared rate limiter 429 in combined runs; Python 3.14 `get_event_loop` in community-ai tests; in-memory `$push` parity gap.
- **CI/CD**: no CI pipeline observed in repo (*inspect CI config*); Docker + K8s deployment yaml present.
- **Security**: JWT + require_admin; rate limit; input bounds; generic 500; ownership checks; error sanitization. **Open items**: CSRF posture for cookie flows (bearer likely), LLM prompt-injection hygiene, audit-log breadth (ops-only today).

---

# PHASE 10 — ARCHITECTURE SCORECARD (10-point scale)

| Dimension | Score | Justification |
|---|---|---|
| Architecture | 8 | clean modular monolith, layering, guardrails, event mesh |
| Scalability | 5 | read/write split + batching + worker queue; but request-time intelligence, no TTL/cache, sync fan-out |
| Maintainability | 7 | playbook + governance excellent; ecosystem/community god services hurt |
| Domain Modeling | 6 | clear majority; ecosystem (5-in-1) + community (3-in-1) violate bounded contexts |
| Developer Experience | 8 | playbook, self-documenting catalog, tsc/py_compile conventions |
| Performance | 6 | N+1 eliminated in list paths; feed enrichment + intelligence scans remain |
| Security | 7 | auth/roles/limits solid; CSRF + LLM + audit breadth open |
| AI Readiness | 7 | mentor/tutor/gen/forecast/adaptive exist; prompt-injection + cost surfaced |
| Community Platform | 8 | feed, discussions, hub, follow, moderation, events |
| Creator Economy | 7 | verification, trust, analytics, leaderboard, achievements; split from ecosystem pending |
| Platform Intelligence | 6 | real KPIs/recs; request-time, not self-renewing |
| Platform Ops | 7 | tasks + audit + dedup automation; no outcome measurement |
| Product Architecture | 8 | matches competitive-learning mission; wide coherent surface |
| Technical Debt | 5 | 1 critical (test isolation), god services, $push parity, no TTL |
| Future Scale | 5 | partition-ready (attempts/activity), but scheduler + read-model snapshots missing |
| **Overall** | **6.8 / 10** | strong differentiated core; docked on god services, test isolation, scheduling, measurement |

*Residual unknowns explicitly flagged:* enterprise/exams router internals, payment-gateway wiring (subscriptions/affiliate), recommendation-service internals, search engine internals, per-route frontend loading boundaries, CI config. Nothing above asserts beyond verified source.

— End of Architecture Handbook (Phase 1–10). No code changed; no solutions proposed.



**ASCENDLY — 10-YEAR ARCHITECTURE REVIEW (Principal / Distinguished Engineer)**  
Basis: verified `SYSTEM ARCHITECTURE AUDIT.md` + `ARCHITECTURE_HANDBOOK.md`. No code changed; no new features; no K8s/Kafka/RabbitMQ/microservices/CQRS/event-sourcing; no "split everything." Stay inside Modular Monolith.

---

## PART 1 — MENTAL MODEL (architecture, boundaries, deps, lifecycles)

```
                    ┌────────────────────────────────────────────┐
                    │        API LAYER  (33+ FastAPI routers)     │
                    │  thin; envelope {success,data,error,meta};  │
                    │  service_response prevents fake-200         │
                    └──────┬──────────────────────────────┬───────┘
                       JWT  │                              │
                    ┌───────▼──────────┐          ┌────────▼───────────────┐
                    │ APPLICATION SVCs │ publish  │   EVENT BUS (in-proc)  │
                    │ community/ecosys │────────► │ ChallengeCompleted     │
                    │ /notifications/  │          │ EventCreated           │
                    │ intelligence/ops │          │ governed: catalog,     │
                    └───────┬──────────┘          │ deps, diagnostics      │
                            │                     └────────┬───────────────┘
                   ┌────────▼─────────────┐                 │ handlers
                   │ INFRA: Mongo (read/  │    ┌────────────▼──────────────┐
                   │ write), Redis worker,│    │ listeners: feed, creator  │
                   │ R2, error logger     │    │ stats, notification fan-  │
                   └──────────────────────┘    └───────────────────────────┘
```

- **Domain boundaries:** Auth → self-contained (5/10). Learning, Arena, Notifications, Ops, Certificates crisp. **ecosystem.py holds 5 bounded contexts** (Creator, Marketplace, Events, Moderation); **community.py holds 3** (grading, feed, creator stats). Intelligence is a clean read-model but hidden-couples to 6 collection names.
- **Dependency graph:** No cycles (verified). Hotspots: ecosystem; notifications (fan-out, 4+ producers). Transitive: ecosystem→community→skill_graph. Shared mutable state: global bus, redis pool, limiter (all process-local).
- **Runtime / request lifecycle:** router → one service → Mongo/worker → (domain event) → listeners → envelope response.
- **Event lifecycle:** producer publishes; bus dedups by correlation+payload; handlers isolated (failure logs, others continue); catalog/deps/diagnostics auto-derived.
- **Startup:** seed→indexes→Redis→R2→search sync→paths→concepts→skills→**register event handlers**→serve; graceful shutdown awaits Redis close.
- **Background worker lifecycle:** Redis pool; used for admin analytics + search indexing; otherwise under-utilized (most flows inline).

## PART 2 — DEEP DOMAIN ANALYSIS (scores /10)

| Domain | Ownership | Data | APIs | Events out/in | Smell | Scal. | Maint. | Growth | Score |
|---|---|---|---|---|---|---|---|---|---|
| Auth | clear | users | /auth | (out: future UserRegistered) | none | H | H | H | 9 |
| Learning/Courses | clear | courses, reviews | /courses… | none | inline-heavy router | M | M | M | 7 |
| Challenges | leaked (grading in community) | challenges, attempts, ratings | /challenges | out: ChallengeCompleted | **boundary leak** | H | M | H | 6 |
| Arena | clear | arena_players, tournaments | /arena, /tournaments | none yet (BattleWon missing) | none strong | M | M | M | 6 |
| Community | split feed (3 routers) | activity_events, discussions | /community, hub | in: ChallengeCompleted | ownership diffused | M | M | H | 6 |
| Creator | inside ecosystem | creator_profiles | /ecosystem | in: EventCreated | **god-service**: not evolvable alone | L | L | H | 4 |
| Marketplace | inside ecosystem | collections | /ecosystem/collections | none | same | L | L | M | 4 |
| Events | inside ecosystem | events | /ecosystem/events | out: EventCreated | same | L/ M | L | M | 5 |
| Notifications | clear | notifications, prefs | /notifications | consumed many | implicit fan-in (4+ producers) | M | H | H | 8 |
| Moderation | inside ecosystem | moderation_reports | /admin/ecosystem | consumed by intelligence | same | L | L | M | 5 |
| Intelligence | clear (read-model) | none (reads 6 collections) | /admin/intelligence | → ops | collection-name coupling; request-time scans | L | M | H | 5 |
| Platform Ops | clear | ops_tasks | /admin/ops | input: intelligence | outcome measurement missing | M | H | H | 7 |
| Certificates | clear | certificates | /certificates | none | not "living" | M | H | M | 6 |
| AI | cross-cutting | (LLM) | tutor/mentor/gen | none | scattered, prompt hygiene unverified | M | M | H | 6 |

## PART 3 — ARCHITECTURAL VIOLATIONS (mapped to the Handbook's architecture violation taxonomy)

1. **God service (high):** ecosystem.py owns 5 bounded contexts → wrong ownership; teams cannot evolve one without the other four.
2. **Wrong ownership (med):** challenge grading lives in community.py; activity feed owned across 3 routers.
3. **Duplicate source of truth (med):** challenge `stats.attempts/avg_rating/bookmarks` vs `challenge_attempts/ratings/bookmarks` — same fact counted twice with no contract.
4. **Implicit dependency (med):** intelligence imports 6 collection shapes (database coupling) without a read-contract → schema rename breaks silently.
5. **Temporal coupling (med):** sync `bus.publish` awaits all handlers in order — a future slow handler (email/push) blocks the producer's request lifecycle.
6. **Framework coupling (low):** services call Mongo driver directly (acceptable in a modular monolith; flag as "no repository abstraction = shape coupling").
7. **Boundary leak (low-med):** "activity" concept appears in challenges + community + hub routers.
8. **Shared mutable state (low):** global bus/redis/limiter are process-local and single-writer; safe today.
9. **Cyclic dependency (none)** — verified absent.
10. **Transaction boundaries (n/a):** no cross-collection transactions observed; each flow is a single-writer sequence (acceptable; document if distributed atomicity ever needed).

## PART 4 — SUBSYSTEM REVIEW (good / fragile / must-not-change / can-evolve)

- **Challenge Engine:** Good: grading, attempts, bookmarks, ratings, versions, event. Fragile: grading in community. Must-not-change: Challenge schema + `stats` invariant. Evolve: grading → challenges domain.
- **Arena:** Good: rankings/tournaments/leaderboard. Fragile: lacks BattleWon events and match-history as first-class event. Must-not: core ranking model. Evolve: event-ize results.
- **Community:** Good: feed + discussions + hub + follow. Fragile: feed N+1 enrichment (per-event user lookup). Must-not: activity append-only semantics. Evolve: batch-load, one feed owner.
- **Creator:** Good: verification, trust, analytics, achievements, leaderboard. Fragile: all inside ecosystem. Must-not: reputation invariants. Evolve: extract to its own service module (router shim).
- **Marketplace:** Good: collections/series/bundles/kits + bookmarks. Fragile: inside ecosystem, no payments. Must-not: nothing structural. Evolve: standalone module; premium rails later.
- **Events:** Good: CRUD, recurrence, join/leave, capacity, EventCreated fan-out. Fragile: inside ecosystem. Must-not: event scheduling semantics. Evolve: module extraction.
- **Moderation:** Good: reports/queue/actions/signals. Fragile: inside ecosystem; no auto-escalation. Must-not: action semantics. Evolve: module extraction + intelligence loop.
- **Notifications:** Good: 25+ types, prefs, quiet hours, fan-out. Fragile: sync fan-in (implicit coupling). Must-not: type registry/preference semantics. Evolve: event-driven-only emission.
- **AI:** Good: mentor, tutor, generator, code assistant, adaptive, admin forecasts. Fragile: scattered; prompt hygiene unverified. Must-not: LLM-abstraction boundary. Evolve: unify AI domain façade, add eval/guardrails.
- **Intelligence:** Good: health KPIs, signals, recs. Fragile: request-time 200k scans, collection-name coupling. Must-not: KPI definitions. Evolve: read-model snapshot + retention.
- **Platform Ops:** Good: tasks, audit, dedup automation. Fragile: no outcome measurement. Must-not: task history/audit semantics. Evolve: close measurement loop.
- **Search:** Good: index + sync at startup. Fragile: internals unverified. Must-not: search-neutral API to courses. Evolve: incremental indexing via events.
- **Recommendation:** Good: per-user + popular + similar exist. Fragile: internals unverified; dual engines (skill_graph + course recommendation). Must-not: recommendation neutral edge. Evolve: unify.
- **Profile / Reputation / Skill Graph / Leaderboard:** Good: mastery scoring, trust, leaderboards, embedded aggregates. Fragile: dual-source counters feeding stats; unbounded follower arrays. Must-not: scoring formulas. Evolve: read-models + bounded arrays.

## PART 5 — OPERATIONAL READINESS

| Area | Status | Gap |
|---|---|---|
| Logging | error_logger (categorized) ✅ | no request-ID trace correlation |
| Metrics | Prometheus/Grafana configured ✅ | no per-endpoint p99 budgets/alerts wired |
| Rate limiting | global slowapi ✅ | 5/min default breaks combined tests |
| Indexes | created at startup; in-memory lacks index support ⚠️ | parity risk |
| Migration | migrations/0001,0002 + seed scripts ⚠️ | no backfill runner for schema evolution |
| Idempotency | bus dedup + attempt_id/event_id ✅ | counters not event-synced (drift) |
| Retries | none beyond resync-from-source ⚠️ | worker tasks idle, no retry policy |
| TTL/retention | none ⚠️ | activity_events + notifications unbounded |
| Backups/DR/data repair | **not observed** ⚠️ | *needs inspection* |
| Deployment | Docker + K8s manifests + HPA ✅ | no CI pipeline observed |
| Secrets | env-based (Settings) ⚠️ | no vault/secret-injection review |

## PART 6 — ENGINEERING PRODUCTIVITY (1→300 engineers)

- **1–5 engineers:** comfortable; playbook guides; god files manageable.
- **20 engineers:** conflict begins on ecosystem.py (Creator vs Events vs Moderation work collide) and on any file touching `community.py`. Merges grow weekly.
- **100 engineers:** god files become the bottleneck; no CI → regressions invisible; no feature flags → release coordination heavy; ownership unclear on Marketplace/Events/Creator (one service, three teams).
- **300 engineers:** **without bounded-context split, this architecture cannot host 300 engineers** — the monolith deployable is fine, but internal module ownership must match team boundaries (Conway). The two god modules plus indeterminate test suite are the merge/ownership/velocity hotspots.

## PART 7 — SCALABILITY PROJECTION

| Scale | DB | CPU/Memory | Network/Events | Workers/Cache |
|---|---|---|---|---|
| 10k | fine | fine | fine | fine |
| 100k | attempts/activity grow; counters drift visible | batch helpers OK; feed N+1 hurts | fan-out OK (bus in-proc) | worker used for admin only; no cache |
| 1M | **activity_events unbounded; intelligence scans 200k/req: bottleneck #1** | scans+LLM admin endpoints heavy | sync event fan-out blocks producers | cache missing; worker under-used |
| 10M | sharding of attempts+activity needed; embedded arrays too big; no TTL = ops issue | read-model snapshot required | notification fan-out needs queue boundary beyond bus | cache required on hot reads |
| 50M | Mongo partitioning + read replicas; counters must be event-synced; archive job mandatory | computing must be batch, never request-time | async handler queue (worker) mandatory; correlation IDs must propagate | every hot read cached or read-modeled |

**The ceiling is not the monolith — it is:** request-time intelligence, unbounded append-only collections, sync fan-out, and dual-source counters. Each has a modular-monolith-compatible fix (worker job, TTL/archive, queue boundary, event-synced counters).

## PART 8 — TECHNICAL DEBT HEATMAP

| Level | Items | Eng cost | Biz risk | User impact | Interest |
|---|---|---|---|---|---|
| **Critical** | test isolation (429), ecosystem god service | H | H | indirect (velocity) | compounds daily |
| **High** | request-time intelligence scans; unbounded activity/notifications; $push parity; no CI | M-H | M | L-M | grows with usage |
| **Medium** | dual-source counters; community.py 3-context; feed N+1; collection-name coupling; migration runner missing; request trace missing; feature flags absent | M | M | L-M | moderate |
| **Low** | pydantic deprecations, dead `_safe`, P3.14 test helpers, deprecation warnings | S | L | L | low |

## PART 9 — EVOLUTION ROADMAP (10-year, staying in the monolith)

- **Year 1:** deterministic CI/tests; split ecosystem into 4 service modules behind router shim; feed N+1 fix; request-ID trace.
- **Year 2:** intelligence read-model + scheduled job; Platform Ops outcome measurement (close the loop); retention/archive for activity/notifications; event-synced counters + schema contract.
- **Year 3:** worker-as-handler-queue boundary for slow consumers (email/push); unified recommendation domain; search via events; feature-flag/experiment layer.
- **Year 5:** read-replica configuration per hot domain; materialized leaderboards/rankings; moving-border read models; audit/archive model for historical data; still one monolith.
- **Year 10:** monolith remains the unit of deployment; domains are modules owned by teams; scaling is via read-model + worker + partition, never service-split. The modular monolith is the long-term architecture.

## PART 10 — MISSING PLATFORM CAPABILITIES (architectural; each: needed?)

| Capability | Needed? | Why |
|---|---|---|
| Job Scheduler | **Yes** | intelligence snapshot, retention, ops sync |
| Read Models / Mat Views | **Yes** | leaderboards, intelligence KPIs, feeds |
| Audit System | **Yes (extend ops audit)** | ops tasks already audit; generalize |
| Migration Engine | **Yes** | schema evolution beyond SQL seeds |
| Schema Registry (internal) | **Yes** | kill intelligence collection-coupling |
| Contract Testing | **Yes** | internal API/event contracts |
| Feature Flags / Experiments | **Partial (extend existing experiments router)** | rollout safety at 100+ eng |
| Observability Platform (traces) | **Partial** | request-ID layer existing pieces |
| Domain Registry | Low | catalog exists for events; may extend to modules |
| Policy/Rule Engine, Permission Engine | Low now | can be built later inside monolith |
| Developer SDK/CLI/Admin Toolkit | Low now | helpful at 100+ eng; not blocking |
| Plugin Model / Internal SDK | **No** | outside modular-monolith simplification; revisit at 10x product growth |

## PART 11 — ARCHITECTURE FITNESS FUNCTIONS (must always hold)

- No endpoint may perform >5 DB round-trips on list reads (batch helpers enforced).
- No service may own behavior of another domain (goal: ecosystem/community split).
- Every domain event documented (EventSpec) + versioned + correlation-id-bearing. ✅ existing governance.
- Every background job idempotent in payload design (attempt_id/event_id pattern).
- Every public API contract has a test (400/404 + envelope). ✅ existing; extend to all domains.
- Every collection has a named owner; every counter has one source of truth (event-synced).
- Every workflow is observable (ops task audit already does this).
- Introduce a CI guard that runs these functions (architecture-lint) along with unit tests.

## PART 12 — FUTURE ORGANIZATION DESIGN (300 engineers, Conway-aligned)

- **Learning Team** → courses, quiz, adaptive.
- **Challenge Team** → challenges (moving grading out of community).
- **Arena Team** → tournaments, live contests, ratings.
- **Community Team** → feed, discussions, hub (single owner of `activity_events`).
- **Creator Team** → own module (extracted from ecosystem): profiles, verification, trust, analytics.
- **Marketplace/Events Team** → own modules (extracted from ecosystem).
- **Trust & Safety Team** → moderation module (extracted from ecosystem) + intelligence signals.
- **AI Team** → mentor/tutor/generator/skill-graph/recommendations (one façade).
- **Platform Team** → notifications, events bus, worker, search, admin, Platform Ops.
- **DX/Infra Team** → CI, dev tooling, migration runner, observability.
- **Conclusion:** the **current architecture supports Conway's Law only after the two god modules are split into owned modules.** The deployable stays a monolith; team boundaries map to internal modules. This is the single highest-leverage organizational change.

## PART 13 — FINAL CTO VERDICT

**Can this architecture survive 10 years?** — **Yes**, with the boundary, scheduling, test, and retention debts paid. The Modular Monolith + in-process governed events + intelligence→ops loop is a durable, decade-scale posture. **9/10.**

**Can 300 engineers work on it?** — **Only after** ecosystem/community are module-split and CI is deterministic; then: yes, 300 engineers can work on one monolith deployable with team-owned modules. Today: 5/10. After milestone 2: 8/10.

**What MUST never change:** the response-envelope/error contract; auth/RBAC; the event-bus governance (EventSpec, catalog, diagnostics); the worker pool; the modular-monolith deployable; notification preferences/quiet-hours; scoring/reputation formulas (change only with product discipline).

**What MUST be redesigned (in-module, not re-architected):** ecosystem.py → 4 owned modules (router shim); community.py → move grading to challenges; intelligence → read-model; counters → event-synced; feed → batch-loaded; bus → async handler-queue boundary.

**Next 5 architectural milestones:** (1) deterministic CI/tests; (2) ecosystem/community bounded-context split (router shim); (3) intelligence read-model + ops measurement loop + retention job; (4) event-synced counters + schema contract + request-ID tracing; (5) worker-as-handler-queue + unified recommendation domain.

**Scores (/10):** Architecture 8 · Boundaries 5 (→8 after split) · Scalability 5 · Maintainability 6 · Engineering/Testing 5 (→8 with CI) · DX 7 · Observability 6 · Security 7 · Operational Excellence 6 · AI 7 · Product 8 · **Overall 6.3 today → 8.5 in 18 months — all inside the Modular Monolith, no distributed rewrite.**

---

**EXECUTIVE SUMMARY (for the Board)**

Ascendly's architecture is built on sound, durable principles: one modular deployable, consistent contracts and guardrails, a governed event bus, working Platform Intelligence and Platform Ops that turn recommendations into tracked action, and an engineering playbook. This foundation is strong enough to carry the company through the next decade — the questions are not "do we need a service rewrite" (we do not) but "do we pay the internal debts that become visible only at scale." The three structural debts that must be settled are: (1) the four business teams currently share two large modules (ecosystem/community), which will collide at ~20–100 engineers and is the top reason a scale-up stalls; (2) intelligence and a few counters are recomputed or duplicated in ways that become brand- and cost-relevant at 1M+ users; (3) a non-deterministic test suite and unseen CI gate will quietly erode velocity long before any feature matters. Fix those three within the current modular monolith — no Kafka, no microservices — and materialized read-models, event-synced counters, an async handler queue, and retention policies will carry the platform through 10M and 50M users without changing the deployment model. **Verdict: architecture resilient enough for the decade; the management commitment is to pay the internal debts now, not to redesign the system.**



**ASCENDLY — FOUNDER/CTO REVIEW: THE FLYWHEEL**  
Basis: verified `ARCHITECTURE_HANDBOOK.md` + `SYSTEM ARCHITECTURE AUDIT.md`. No code changed. Every recommendation below strengthens a compounding loop, not a feature count.

---

## 1. THE FLYWHEEL

```
        ┌────────────────────────────────────────────────────────┐
        │      LEARNERS COMPETE & IMPROVE  (more data, better   │
        │      skill mastery → higher ratings, more reputation) │
        └───────────────────────────┬────────────────────────────┘
                                    │ evidence (attempts, ratings,
                                    │ competitions)
        ┌───────────────────────────▼────────────────────────────┐
        │      CREATORS EARN REPUTATION  (trust, followers,       │
        │      analytics, leaderboard)  → they publish more/      │
        │      better challenges, host events, build collections │
        └───────────────────────────┬────────────────────────────┘
                                    │ content + events
        ┌───────────────────────────▼────────────────────────────┐
        │      COMMUNITY STRENGTHENS  (feed, discussions,         │
        │      follows, moderation keeps it healthy)              │
        └───────────────────────────┬────────────────────────────┘
                                    │ engagement signals
        ┌───────────────────────────▼────────────────────────────┐
        │      PLATFORM INTELLIGENCE LEARNS  (health KPIs,        │
        │      quality signals, gaps)                             │
        └───────────────────────────┬────────────────────────────┘
                                    │ recommendations
        ┌───────────────────────────▼────────────────────────────┐
        │      PLATFORM OPS ACTS  (audited tasks fix quality,     │
        │      verify creators, rebalance content)                │
        └───────────────────────────┬────────────────────────────┘
                                    │ better product
        ┌───────────────────────────▼────────────────────────────┐
        │      RETENTION COMPOUNDS  (notifications, streaks,      │
        │      season rewards, credential value)                  │
        └───────────────────────────┬────────────────────────────┘
                                    │ more learners → back to top
        └────────────────────  (loop never ends)  ────────────────┘
```

**The architecture already builds the flywheel's connective tissue.** What's missing is not new features — it's making each loop measurable and self-reinforcing.

## 2. FLYWHEEL STRENGTH vs. GAPS (per verified capability)

| Loop | What works | What's missing (architectural, not feature) | Flywheel impact if closed |
|---|---|---|---|
| Learners → Compete | Challenge engine, arena, XP/badges, ratings | **Match/battle events** (BattleWon) so competition history feeds reputation + intel | Med-High |
| Compete → Creators | Attempts feed creator stats, trust, leaderboard | **Dual-source counters** can drift → wrong stats destroy creator trust; **grading lives in community** (boundary delays content iterations) | **High** — creators are the supply side; wrong numbers lose them |
| Creators → Community | Events, collections, follower fan-out, feed | Creator/Marketplace/Events/Moderation in one god service → **product teams can't evolve supply-side features independently** | **Highest at scale** — 20+ engineers collide on one file; velocity stalls the whole flywheel |
| Community → Intelligence | Feed, discussions, moderation signals | Feed N+1; search not event-driven | Med |
| Intelligence → Ops | KPI + signal + recommendation → audited tasks | **No outcome measurement** — the loop opens after "Task" and never closes; **request-time 200k scans** limit intelligence freshness | **Highest flywheel unlock** — closing the loop = the platform continuously improves itself |
| Ops → Retention | Notifications (25+ types, prefs, fan-out), ops announcements | Unbounded activity/notifications (no TTL); sync fan-out limits future push/email | Med |
| Retention → Learners | Streaks, seasons, credentials | Certificates not "living"; no career/company value yet | Med-High (unlocks the Career stage) |

## 3. FOUNDER/CTO PRIORITIES (flywheel-ordered, inside the modular monolith)

**1. Close the Intelligence→Ops→Measurement loop.** This is the flywheel's self-improvement heart. Today: recs → tasks → audit. Missing: outcome attached to each task ("did resolving this challenge fix completion rate?"). Investment: read-model snapshot + outcome field + one scheduled job (worker exists). Payoff: each completed task makes the *next* recommendation better — the platform compounds.

**2. Make the Creator side trustworthy and independently evolvable.** Two moves: (a) settle dual-source counters via event-synced counters so creator stats are never wrong; (b) split ecosystem into owned modules (Creator/Marketplace/Events/Moderation, router shim) so Creator product teams ship in weeks, not in one massive PR. Payoff: supply-side velocity is the #1 flywheel multiplier; trust is the #1 creator-retention factor.

**3. Turn competition into lasting reputation asset.** Publish BattleWon + MatchFinished events so competition history becomes first-class evidence (feeds profile, certificates, recruiting, trust). Payoff: competition stops being a destination and becomes an asset → season retention + Career stage.

**4. Make retention infrastructure durable.** TTL/archive for activity + notifications (ops cost control), then async handler queue for future email/push (fan-out ceiling removal). Payoff: the retention loop grows without ops debt.

**5. Make certificates a living credential.** Attach evidence (attempts, ratings, competition history) + verification URL + recruiter endpoint. Payoff: unlocks the platform's Career flywheel (learners gain career value → they stay → create → share → recruit) and the company side of the flywheel.

**6. Foundation gate: deterministic CI + test isolation.** No flywheel accelerates if every merge is blocked by a 429 rate-limit collision or a py3.14 test failure. This is the *velocity gate* for all of the above. It looks unsexy; it is the highest-ROI move for a founder.

## 4. ARCHITECTURE AS FLYWHEEL ENABLER (what to keep and why)

| Keep (never redesign) | Why the flywheel depends on it |
|---|---|
| Modular monolith deployable | One unit of deployment = low ops cost = all flywheel investment goes to loops, not plumbing |
| Response envelope + error guardrails | Trust in API = developers (internal + future external) build on it, compounding platforms |
| Governed event bus (EventSpec, catalog, diagnostics) | Events are the flywheel's synapses — governance makes them safe to add; each new event strengthens loops without breaking old ones |
| Notifications (prefs, fan-out) | The retention loop's delivery mechanism |
| Worker pool | The future scheduling surface for every self-improvement job (intel snapshot, retention, ops sync) |
| Auth + reputation/scoring formulas | Identity & trust are the flywheel's bearings; changing them breaks every loop |

**Explicitly avoid:** microservices, Kafka, event sourcing, CQRS, "split everything." The flywheel compounds *because* the system stays simple enough to evolve one loop at a time. Adding distributed complexity now would consume the very velocity the flywheel needs. Staying a modular monolith with governed events is the durable competitive advantage.

## 5. THE NEXT 12 MONTHS (flywheel roadmap, not feature roadmap)

- Q1: deterministic CI + test isolation (velocity gate).
- Q2: **intelligence read-model + ops outcome measurement** (loop #1 closed) + TTL/archive job.
- Q3: ecosystem → 4 owned modules (router shim); event-synced counters (supply-side trust).
- Q4: publish remaining events (BattleWon, CreatorVerified, RatingChanged…); async handler-queue boundary; begin living credentials.
Each quarter leaves the flywheel measurably stronger; none requires leaving the monolith.

## 6. LONG-TERM VISION (10 years)

- **Year 2:** platform self-improves (each ops task measured), creators trust their numbers, teams ship independently.
- **Year 3–5:** competition + credentials become a career asset → the Career/Recruiting loop engages; companies join the flywheel as employers of ranked talent (existing enterprise surface extends from the same architecture).
- **Year 5–10:** one monolith deployable, 10 teams, read-models + worker + partitions; **still no microservices** — the flywheel survives because the architecture stays simple enough for every team to keep turning it.

## 7. FINAL VERDICT (founder/CTO lens)

**The right architecture for the flywheel already exists.** The governed events, intelligence→ops loop, notifications, creator reputation, and monolith discipline are precisely the bones a compounding platform needs. The flywheel is real and visible; it just has three open seams — the **measurement loop** (intel→task→outcome), the **creator supply-side trust/velocity** (counters + module ownership), and the **velocity gate** (CI). Close those three within the current modular monolith, and the platform's long-term compound curve is not only intact — it accelerates.

**Scores:** Flywheel completeness 6.5/10 → 8.5/10 in 18 months with Q1–Q4 above. Architecture stays 8/10 *because* it resists the temptation to over-engineer — the rarest and most valuable instinct in a platform company.

**For the Board:** Ascendly's technology is a compounding asset, not a cost center. The next investment should go to closing the platform's self-improvement loop, making creator data trustworthy, and paying the CI debt — because each one strengthens the flywheel the company is literally built on. No infrastructure rewrite required; what's needed is disciplined execution on the loops that already exist.