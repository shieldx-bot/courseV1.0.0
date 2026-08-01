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