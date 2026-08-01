---

# ASCENDLY — COMPLETE SYSTEM ARCHITECTURE AUDIT
**Prepared for: Platform CTO / Series-A Engineering Leadership**
**Scope: Full-stack monorepo (`apps/api`, `apps/web`, `docker`, `k8s`, `prometheus`)**
**Method: Reverse engineering from source; no code changed.**

---

## STEP 1 — SYSTEM MAP (Domains, Purpose, Boundaries, Maturity)

The platform is a **monolithic system** split into two deployables — a FastAPI backend (`apps/api`) and a Next.js frontend (`apps/web`) — against MongoDB, plus a worker/rate-limit Redis layer. Domain boundaries are expressed as **Python service modules** + **FastAPI routers**, not as deployable services. This matches the "Modular Monolith with Domain Events" framing.

| # | Domain | Business purpose | Boundaries / owner service | Dependencies | Maturity (1-5) |
|---|---|---|---|---|---|
| 1 | **Authentication / Identity** | Login, JWT sessions, roles | `auth` router; `app/core/deps.py` (`get_current_user`, `require_admin`, `get_optional_user`); `app/core/config.py` | infrastructure | **5** — solid, guarded, rate-limited |
| 2 | **User / Profile** | Public profile, privacy, onboarding state, stats | `profile` UI; user collection; creator feed | Auth | **4** |
| 3 | **Learning / Courses** | Course catalog, content, progress, reviews, subscriptions, coupons, affiliates, quizzes, support knowledge base | `courses`, `progress`, `reviews`, `subscriptions`, `affiliate`, `quiz`, `support`, `knowledge`, `adaptive` routers | Auth | **4** — very wide surface |
| 4 | **Challenges** | Challenge CRUD, grading, attempts, bookmarks, ratings, versions, publish lifecycle | `challenges` router; `community.py`, `ecosystem.py` (versioning) | skill_graph, llm | **4** |
| 5 | **Skill Graph** | Skill taxonomy + per-user mastery scoring + recommendations | `skill_graph.py` | Auth | **3** — exists but not yet a full cross-entity knowledge graph |
| 6 | **Arena / Competition** | Tournaments, leaderboards, competitive play | `arena`, `tournaments` routers; `arena_players` collection | Challenges | **4** |
| 7 | **Community** | Activity feed (public), discussions, hub, creator follow, bookmarks | `community`, `community_hub`, `discussions` routers; `community.py` | skill_graph, llm | **4** |
| 8 | **Creator Economy** | Creator profiles, verification, trust score, analytics, achievements, badges, leaderboards | `ecosystem.py` + `creators` router | Community, Notifications | **4** |
| 9 | **Marketplace / Collections** | Collections, series, bundles, kits, bookmarking, premium flags | `ecosystem.py` | Creator | **3** — no payments plumbing yet |
| 10 | **Events** | Event CRUD, join/leave, recurring templates, attendee capacity | `ecosystem.py` | Notifications, Creator, Community | **3.5** |
| 11 | **Notifications** | 25+ typed notifications, preferences, quiet hours, unread badge, fan-out | `notifications.py`, `notifications` router | Auth | **4** |
| 12 | **Moderation / Trust** | Reports, moderation queue, resolve actions (warn/remove/ban), anti-abuse signals | `ecosystem.py` moderation section | Auth, Admin | **3** |
| 13 | **AI** | AI mentor (attempt analysis), AI tutor, course generator, code assistant, adaptive learning, community AI | `llm.py` + `ai_tutor`, `code_assistant`, `adaptive`, `course_generator`, `community_ai` | LLM provider | **3** |
| 14 | **Certificates / Career** | Certificates, verify endpoint, learning paths | `certificates`, `learning_paths` routers | Progress, Skill graph | **2.5** — issuance exists; "living credentials" not yet |
| 15 | **Enterprise** | B2B flows, exams | `enterprise` router, `exams` router | Auth, Courses | **2.5 — Needs further inspection** (internals not fully read) |
| 16 | **Search** | Search index + sync | `search.py` + `search_service.init_search()/sync_all_courses()` | Courses | **2.5 — Needs further inspection** (engine internals) |
| 17 | **Platform Intelligence** | Health KPIs, challenge/creator signals, self-recommendations | `intelligence.py` + `/admin/intelligence/overview` | All collections via read replica | **3.5** (new this cycle) |
| 18 | **Platform Ops** | Task/workflow engine; intelligence → action | `platform_ops.py` + `/admin/ops/*` | Intelligence, Notifications | **3.5** (new this cycle) |
| 19 | **Domain Events** | In-process event bus, catalog, dependency graph, diagnostics | `core/events.py`, `event_handlers.py`, governance router | Core | **4** |
| 20 | **Admin** | Admin base router, error-log viewer, moderation, ops, intelligence dashboards | `admin`, `error_log`, new admin routers | All | **3** |
| 21 | **Shared Core / Infrastructure** | Response envelope, rate limit, telemetry, error logger, worker, R2, config | `app/core/*` | — | **4** |
| 22 | **Web App** | Next.js App Router PWA; dashboard, arena, community, creator studio, events, profile, admin | `apps/web` | API | **4** |

**Net:** 22 domains identified. Everything in this list is **already built**. There is no Kubernetes-native microservice split, and no domain is deployed independently — consistent with a Modular Monolith.

---

## STEP 2 — BUSINESS CAPABILITY MAP

Capabilities are stated as user/platform-observable behavior, derived from endpoints/services read this session:

**Learner capabilities**
- L1. Register / authenticate / manage session (JWT + roles)
- L2. Take courses, quizzes, track progress, adaptive learning, AI tutor
- L3. Solve & submit challenges (theory + open answers), get instant grading
- L4. Get AI mentor analysis of wrong attempts (LLM)
- L5. Bookmark, rate, and review challenges/courses/collections
- L6. Compete in arena tournaments and leaderboards
- L7. Earn XP, achievements, badges, creator levels, reputation scores
- L8. Receive typed notifications (battles, follows, events, achievements, verification)
- L9. Follow creators and see an activity feed
- L10. Join events (weekly challenges, AMAs, hackathons, office hours…)
- L11. Earn certificates + verify them via verify endpoint
- L12. Follow adaptive learning paths / skill roadmaps

**Creator capabilities**
- C1. Create / publish / version / delete / update challenges
- C2. Request, receive, and display verified status
- C3. Host events with follower fan-out
- C4. Create collections / series / bundles / kits (marketplace)
- C5. View analytics (attempts, ratings, followers over window)
- C6. Earn automatic achievements/badges via milestone engine
- C7. Appear on creator leaderboards with trust scores
- C8. Be followed and reviewed by the community

**Community capabilities**
- M1. Post to public activity feed; see others' public activity
- M2. Create/answer/upvote discussions
- M3. Report inappropriate content (moderation pipeline)
- M4. Community hub with sections (need-by-inspection counts)

**Platform capabilities**
- P1. Moderate: warning, removal, bans, dismiss with notes
- P2. Compute **DAU/WAU/MAU, retention, session length, challenge success rate, creator growth, competition participation, notification CTR** (`intelligence.py`)
- P3. Detect challenge quality problems (abandonment, poor rating, hard/easy)
- P4. Detect creator verification candidates + inactive creators
- P5. Generate **self-recommendations with severity and entity refs**
- P6. Convert recommendations into **tracked operational tasks** with owners, priorities, audit history (`platform_ops.py`)
- P7. Notify admins of new ops tasks via the notification system
- P8. Publish domain events with an event catalog, dependency graph, and health diagnostics
- P9. Observe its own event bus (published/ok/failed, slowest handlers, orphan listeners)
- P10. Serve operational command-center overview (open tasks, critical incidents, recent decisions)

**Capability relationships (simplified graph):**
```
Learner L3 → P2/P3 (intelligence sees attempts)
Creator C2/C6 → P4 (verification candidates)
Event C3 → P8 (EventCreated) → L10 + P7 via notifications
Intelligence P2-P5 → Platform Ops P6/P7/P10 (feedback loop)
Domain Events P8/P9 → governance + retry safety
```

The platform's differentiating capability set — **self-observing intelligence → coordinated ops actions → tracked outcomes** — is real, present in `intelligence.py` + `platform_ops.py`, and is the most recent layer added.

---

## STEP 3 — DOMAIN MODEL (Entities)

| Entity | Purpose | Lifecycle | Aggregate | Owned by | Emits / Consumes |
|---|---|---|---|---|---|
| `users` | Identity + profile + role + onboarding | register → active → (restrict) | User (root) | Auth | emits (future) `UserRegistered` |
| `challenges` | Learnable/competitive content | draft → published → removed | Challenge | Creator | consumed `ChallengeCompleted`-production via `submit_challenge` |
| `challenge_attempts` | Evidence of solving | per-submission | Challenge | Learner | produces payload for `ChallengeCompleted` |
| `user_skills` | Mastery score/level per skill | grows w/ attempts | User | skill_graph | consumed by recommendation logic |
| `skills` | Taxonomy | seeded | Category | skill_graph | — |
| `activity_events` | Public feed + DAU/WAU source | append-only | User | community | consumed by intelligence (DAU/WAU, sessions) |
| `creator_profiles` | Reputation aggregate | lazy-create → level up → verified | Creator | ecosystem/community | subscribed via `EventCreated` creator-tracking listener |
| `collections` | Learning bundles/series | create → bookmark | Creator | ecosystem | — |
| `events` | Community events | upcoming → live → completed/cancelled | Host | ecosystem | **emits `EventCreated`** |
| `moderation_reports` | Report pipeline | pending → resolved/dismissed | Report | ecosystem | consumed by moderation queue + intelligence backlog signal |
| `notifications` | Retention loop | send → read | User | notifications | consumed fan-out from `EventCreated`, verification, joins |
| `ops_tasks` | Platform OS actions | open → in_progress → resolved/closed | Task | platform_ops | consumed from intelligence recommendations |
| `arena_players` | Competition state | join → matches | Player | arena | consumed by intelligence (competition participation) |
| `challenge_versions` | Versioning snapshots | per-snapshot | Challenge | ecosystem | — |
| `certificates` | Credential issuance | issue → verify | Learner | certificates | consumed by verify endpoint |

**Aggregate roots:** `User`, `Challenge`, `CreatorProfile`, `Report`, `Task`, `Event`. Everything else is owned-by/accompanying data or value-like.

**Events emitted today (from source):**
- `ChallengeCompleted` (producer: `community.submit_challenge`) — payload: user_id, challenge_id, title, difficulty, is_correct, attempt_id (idempotency key), creator_id
- `EventCreated` (producer: `ecosystem.create_event`) — payload: event_id (idempotency key), title, host_id, requested_host_id (guard), event_type

**Events consumed today:** feed insertion, creator stats recompute, events_hosted + achievements, follower notifications. (The notification consumer handler for `ChallengeCompleted` is intentionally a registered noop/reserved.)

---

## STEP 4 — SYSTEM INTERACTION (Text Sequence Diagrams)

**Workflow A — User solves a challenge**
```
User → POST /challenges/{id}/submit
  submit_challenge():
    1. load challenge
    2. grade (theory/expected-answer)
    3. for each skill: update_user_skill (mastery delta, milestone check)
       └ if milestone: create_activity("skill_milestone")
    4. insert challenge_attempt
    5. update challenge stats (attempts, completion_rate)
    6. 🔔 publish ChallengeCompleted
       ├→ listener activity: create_activity("challenge_completed")
       ├→ listener creator_stats: recompute author _update_creator_stats
       └→ listener notifications: (reserved noop)
    7. return {attempt_id, is_correct, score, explanation, skill_updates}
↓ later
Platform Intelligence (on request): challenge_attempts → completion_rate signals;
  abandoned/hard/quality signals → recommendations → Platform Ops sync → Task
```

**Workflow B — Creator hosts an event**
```
Creator → POST /ecosystem/events
  create_event():
    1. template lookup by event_type
    2. insert event doc
    3. 🔔 publish EventCreated
       ├→ creator_tracking: events_hosted++ + refresh_achievements (host-guard on)
       ├→ activity: create_activity("event_created") public feed
       └→ notify_followers: fan-out notification
    4. return event_id
User → POST /ecosystem/events/{id}/join → capacity check → attendee_ids push
  + create_notification("event_joined_confirmation")
```

**Workflow C — Intelligence → Automation**
```
Intelligence (on admin request /admin/intelligence/overview):
  platform_health (DAU/WAU/MAU, retention, CTR…) +
  challenge_intelligence (abandoned/hard/easy/poor/popular) +
  creator_intelligence (verify-candidate/inactive/most-trusted) +
  self_recommendations (severity: critical/warning/info)
Platform Ops POST /admin/ops/sync:
  REC_TO_WORKFLOW mapping → create_task (dedupe by kind+entity+open-status)
  → create_notification("system_announcement") to ops watcher
Admin → POST /admin/ops/tasks/{id}/status → status transition + audit history + completed_at
```

**Workflow D — Challenge rating & leaderboards**
```
User → POST /challenges/{id}/rate → ratings computed average → stats.avg_rating
Creator leaderboard → creator_profiles sorted (level_score, published, trust)
Arena leaderboard → arena_players/tournaments state
```

---

## STEP 5 — EVENT MAP

| Event | Producer | Version | Consumers (domain, handler) | Payload key fields | Idempotency | Business meaning |
|---|---|---|---|---|---|---|
| `ChallengeCompleted` | community.submit_challenge | 1 | community.activity; creator.stats; notifications.reserved | attempt_id, user_id, challenge_id, is_correct, creator_id | attempt_id unique; bus dedup by correlation+payload | A solve happened; feed + author reputation react |
| `EventCreated` | ecosystem.create_event | 1 | creator.tracking; community.activity; notifications.followers | event_id, host_id, requested_host_id, event_type | event_id unique; host-guard | A community event exists; creator/feed/notifications react |

**Event chains:** `ChallengeCompleted` → feed → (future) analytics → (future) recommendation refresh. `EventCreated` → follower-notification → (future) attendance analytics. No chains beyond one hop today.

**Cyclic risk:** None found — handlers never re-publish the same event name, bus dedups by correlation+payload, and no handler imports a producer to fire a second event. The catalog (`/admin/events/catalog`), dependency edges (`/admin/events/dependencies`), and health (`/admin/events/diagnostics`, incl. orphan-listener detection) are derived from registrations.

**Missing (logical next) events:** `ChallengePublished`, `CreatorFollowed`, `CreatorVerified`, `RatingChanged`, `CertificateIssued`, `ReportSubmitted`, `ModerationCompleted`, `SkillMastered`, `UserRegistered`, `EventJoined`. Each maps to an already-built trigger point (e.g., `publish_challenge` already calls `create_activity` + `_update_creator_stats` directly — an event would remove that coupling).

---

## STEP 6 — DEPENDENCY GRAPH

**Core/shared (lowest, depended upon broadly):** `core/response.py`, `core/events.py`, `core/deps.py`, `core/config.py`, `core/ratelimit.py`, `core/error_logger.py`, `core/telemetry.py`, `db/mongodb.py` (get_db/get_read_db), `db/indexes.py`.

**Direct service dependencies observed in source:**
```
community.py → llm, skill_graph, core.events
ecosystem.py → community (create_activity), notifications (create_notification), core.events
event_handlers.py → community (create_activity, _update_creator_stats), ecosystem (get_or_create_creator_profile, refresh_achievements), notifications (notify_followers)
notifications.py → db (isolated)
intelligence.py → db (read-only)
platform_ops.py → intelligence, notifications
skill_graph.py → db
arena/tournaments → challenges/community state
```

**Findings:**
- **High coupling (justified within modular monolith):** `ecosystem` imports `community` and `notifications`; `event_handlers` imports three services. This is the *intended* consumption direction of the event layer — the producers (`submit_challenge`, `create_event`) no longer call these directly.
- **Hidden coupling:** `intelligence.py` reads collection names directly (`activity_events`, `challenge_attempts`, `notifications`, `creator_profiles`, `arena_players`, `moderation_reports`) — any schema rename breaks it silently. Acceptable today, but a schema-contract note is warranted.
- **Circular dependencies:** none detected.
- **Boundary violations:** routers occasionally call a service in another domain directly (normal for a modular monolith); no router calls another router.
- **Shared abstractions in place:** `service_response()` guardrail, `_load_users_batch`/`_load_challenges_batch`, `create_notification`, response envelope, event bus.

---

## STEP 7 — DATA FLOW (Pipelines)

**Primary user pipeline**
```
User → Auth (JWT) → Challenge submit → attempt doc → skill_graph mastery
   → ChallengeCompleted event → activity feed (+follower visibility) + author stats
   → recommendation inputs (skill masteries + exclude-challenge)
```

**Intelligence pipeline**
```
activity_events + challenge_attempts + notifications + creator_profiles + arena_players
   → intelligence.py (read replica) → KPIs + signals → recommendations (severity/kinds)
   → platform_ops.sync_from_intelligence → ops_tasks (dedup) → notifications → admin
```

**Moderation pipeline**
```
User reports (submit_report) → moderation_reports (pending)
   → admin moderation queue (list_moderation_queue) → resolve_report (warn/remove/ban/dismiss)
   → intelligence moderation-backlog recommendation → ops task (automation)
```

**Marketplace pipeline**
```
Creator create_collection → creator profile push (series/bundle side) + refresh_achievements
   → list_collections (batch user+challenge enrichment) → bookmark_collection (count++)
```

**Search pipeline** — `search_service.init_search()` + `sync_all_courses()` at startup; further internals **Needs further inspection**.

**Career pipeline (partial)** — certificates issued → verify endpoint → (future) living credentials. Career/company side flows in `enterprise` router; **Needs further inspection** for depth.

---

## STEP 8 — PLATFORM EVOLUTION STAGE

The platform has sequentially passed through: **Learning Platform → Competitive Platform → Community Platform → Creator Platform → (partial) Knowledge Platform → Intelligence Platform → Operating System**. The most recent architecture work (event governance, intelligence, ops tasks) is precisely the "Intelligence Platform + Operating System" stage.

- **Current maturity:** Late Series-A / Early Series-B architecture. Feature surface is broad and integrated; the newest layer (self-observing intelligence → coordinated ops) is genuinely differentiating.
- **Overall completion estimate:** **~68%** of a full production OS/Growth vision.
  - User+learning+community+creator+competition: ~75% complete
  - Notifications/trust/events: ~70%
  - Intelligence + ops automation: ~60% (works, but request-time computation; no scheduler)
  - Knowledge graph + recommendations + career/credentials: ~40% (skill graph + certificates exist; not unified)
  - Enterprise + company platform: ~35% (surface exists; depth a question)

---

## STEP 9 — ARCHITECTURE QUALITY REVIEW (13 axes)

| Axis | Score (1-5) | Why |
|---|---|---|
| Architecture | **4** | Clean modular monolith; explicit layering (router→service→db), response envelope, event bus, guardrails. |
| Scalability | **3.5** | Read/write DB split (get_db vs get_read_db), batch loading removed N+1s in hot list endpoints; intelligence is request-time `to_list` over bounded sets (200k) — a ceiling once volumes grow. |
| Maintainability | **4** | ENGINEERING_PLAYBOOK.md (12 sections), guardrails as code (`service_response`), self-documenting event catalog. |
| Extensibility | **4** | Adding a domain = new router + service; events register into catalog automatically; ops tasks add a workflow category. |
| Domain isolation | **3.5** | Good for modular monolith; intelligence reads collection names directly (schema contract risk); some domains (enterprise/exams) less inspected. |
| Code organization | **4** | Consistent `api/v1` + `services` + `core` + `db`; consistent naming; dead code limited but present (see debt). |
| Testing | **3.5** | 17 API test files (auth, courses, admin, ai, ecosystem, events, governance, intelligence, ops, enterprise, reviews, subscriptions, subscriptions, support, critical-bugs, adaptive, community-ai) + web jest/e2e; **but** combined runs break on shared rate limiter (429), and 2 community-AI tests fail on Python 3.12+ `get_event_loop()` (pre-existing). |
| Developer Experience | **4** | Playbook, py_compile + tsc conventions, admin governance endpoints for self-inspection. |
| Observability | **3.5** | error_logger (categorized + logger endpoint), health/ready, telemetry, Prometheus+Grafana configs, admin dashboards, event bus diagnostics. No distributed trace correlation beyond event correlation_id. |
| Performance | **3.5** | Batch list loading; N+1 eliminated where audited; request-time intelligence scans; no background jobs/scheduler yet. |
| Security | **3.5** | JWT + role-gated admin everywhere, slowapi rate limiting, input bounds on query params, error sanitization (500→generic), ownership checks in services. Audit-logging is partial (ops tasks + error logs); no explicit CSRF layer observed for cookie flows (**needs inspection** on cookie vs bearer). |
| Platform Governance | **4.5** | Event governance (catalog/deps/diagnostics), ops task audit history, engineering playbook, decision trails on tasks. |

**Overall architecture score: 3.9/5** — production-credible, with the newest platform-self layer being the strongest differentiator.

---

## STEP 10 — TECHNICAL DEBT (Real, Observed Only)

### Critical
- **(C1) Test-isolation — shared rate limiter breaks combined suites.** Observed: running `test_events + test_event_governance + test_ecosystem` together produces `429 Rate limit exceeded: 5 per 1 minute` on login. Impact: false red CI, lost confidence. Fix: reset limiter per test/fixture or raise test-only limit. Effort: **S (a few hours).**

### High
- **(H1) In-memory DB parity with Mongo `$push`.** Observed: `$push` did not persist reliably on the in-memory collection (ops task history had to be rewritten as read-modify-write). Any service using `$push`/`$addToSet`/`$inc` may behave differently in prod vs tests. Impact: silent divergence. Fix: centralize mutation helpers + parity test. Effort: **M.**
- **(H2) Request-time intelligence scans.** `intelligence.py`/`overview()` reads up to 200k docs and loops in-process on each admin request. Impact: admin dashboard latency + DB load at scale. Fix: background compute + snapshot collection. Effort: **M-L.**

### Medium
- **(M1) Pre-existing Python-3.12 test breakage:** `test_community_ai` uses `asyncio.get_event_loop()` (RuntimeError on 3.14). Fix: `asyncio.run`. Effort: **S.**
- **(M2) Pydantic v2 deprecations:** class-based `Config` warnings throughout schemas. Effort: **S**, cleanup sweep.
- **(M3) Event bus is sync/in-process:** publish awaits all handlers synchronously — any slow handler (e.g., future mailer) blocks the producer. Fine today; needs boundary once async handlers arrive. Effort: design-only now.
- **(M4) Intelligence schema coupling:** direct collection-name reads (see §6). Add a schema-contract layer or documented collection map. Effort: **S.**
- **(M5) Notification "reserved" handler registered as noop:** valid governance but easy to forget; document intent (already documented in code). Low risk.

### Low
- **(L1) Dead helper `_safe`** + unused `Any` import remain in `intelligence.py` (cleanup was interrupted — **Needs verification**; the file was created with them).
- **(L2) Deprecation warnings:** `slowapi` `asyncio.iscoroutinefunction`, worker pool `close()` vs `aclose()` — cosmetic.
- **(L3) Graceful shutdown middleware swallows `RuntimeError("No response")` broadly** — acceptable but broad.

---

## STEP 11 — MISSING CAPABILITIES (Natural, Architecture-Grounded)

1. **Background intelligence scheduler.** Every other step depends on it: move `intelligence.overview` from request-time to a scheduled job (worker/APScheduler) writing a snapshot; `platform_ops.sync` becomes a scheduled listener. **Extends:** intelligence, platform_ops, worker. **Value:** removes H2, enables trend detection ("declining" KPIs). **Architecture impact:** adds a job boundary, not a service.
2. **Recommendation unification.** Today: per-user recommendations from skill_graph + platform trends from intelligence + adaptive paths. A single `recommendation` domain composing all three (challenges, collections, events, creators, paths) naturally follows. **Extends:** skill_graph, adaptive, ecosystem, learning_paths. **Value:** personalization surface. **Impact:** one more domain, no new infra.
3. **Knowledge graph beyond skills.** Skill graph covers taxonomy + mastery. Extend to cross-entity edges (creator→challenges→skills→discussions→events→companies) so intelligence can answer "knowledge gaps" today's signals already name. **Extends:** skill_graph + intelligence. **Value:** discovery + recommendations.
4. **Event-completed automation on top of Platform Ops.** Wire existing triggers (`ChallengePublished`, `RatingChanged`, `CertificateIssued`) as events so ops tasks + recommendations react automatically — currently the recommended events exist but are not yet published.
5. **Decision history + experiments.** Ops tasks already carry audit histories. Add explicit outcome measurement ("did the change improve the KPI?") + lightweight feature-flag/experiment store to close the full knowledge loop — the natural completion of Platform OS.
6. **Living credentials.** Certificates exist; extend with evidence refs (attempts, ratings, comp history) for recruiter verification — natural next step for the mission's "Verified Skills."

Each item above **extends an existing module** — none requires new infrastructure or a new deployable.

---

## STEP 12 — STRATEGIC ROADMAP (Priority by Platform Value)

1. **Fix CI predictability (C1, H1, M1, M2)** — test isolation, Mongo parity, pytest-3.14. *Engineering value highest; unblocks all other work.*
2. **Background intelligence + scheduled sync (H2)** — intelligence becomes a job, ops sync becomes automatic. *Architecture + platform value highest.*
3. **Recommendations unification + knowledge graph** — one recommendation domain; cross-entity edges. *Business value.*
4. **Complete the event catalog** (publish the 8 missing domain events) so verification/ratings/certificates feed intelligence and ops automatically. *Architecture value; incremental.*
5. **Career/Enterprise deepening** — living credentials + company participation on top of existing enterprise/exam surface. *Business value; stage progression toward Career Platform.*
6. **Experimentation + decision history** — close the Platform OS knowledge loop fully.

**Explicitly NOT recommended:** microservices, separate event gateway (Kafka/RabbitMQ), polyglot backend, or a frontend rewrite. Nothing in the current architecture justifies them.

---

## STEP 13 — CTO REPORT

**Platform Vision:** Ascendly is evolving from a competitive learning product into a self-governing competitive learning *platform* — where learners gain skills, creators gain reputation, companies gain talent, and the platform itself continuously improves its own operations.

**Architecture Overview:** A **Modular Monolith with in-process Domain Events**. FastAPI (+MongoDB, Redis worker) + Next.js PWA. 22 domains; clean router→service→db layering; shared core (response envelope, rate limit, error logger, telemetry, health); a governed event bus with auto-derived catalog/dependency-graph/diagnostics; a Platform Intelligence layer computing health KPIs and quality signals; a Platform Ops task engine converting those signals into tracked, audited workflows.

**Current Strengths**
- Broad, integrated feature surface (learning, competition, community, creator, events, marketplace, trust, notifications)
- Genuine recent differentiators: **event governance + self-observing intelligence + ops task automation**
- Engineering discipline: playbook, guardrails as code, batch-loading, N+1 elimination, self-documenting catalog
- Solid auth, rate limiting, error envelope, and error-logger surface

**Weaknesses**
- Tests are not reliably isolated (shared rate limiter; in-memory parity gaps)
- Intelligence computed on-request with bounded-but-large scans
- Knowledge graph/recommendations not unified; certificates not "living"
- Enterprise/career surface depth uncertain (**further inspection**)

**Major Risks**
- (R1) In-memory vs Mongo divergence → silent prod/test behavior differences
- (R2) Request-time intelligence stalls as data grows
- (R3) Sync in-process event bus with a slow future handler
- (R4) Test suite unreliability erodes future velocity

**Major Opportunities**
- Close the Planning→Ops→Outcome loop fully (measurement + experiments)
- Publish the remaining natural domain events (certificates, follows, ratings, publications)
- Unify recommendations and build a true knowledge graph
- Move toward the Career Platform stage (credentials + companies)

**Evolution Strategy:** Continue hardening the foundation (tests, parity, scheduling), then leverage the existing event+intelligence+ops machinery to drive recommendations, credentialing, and enterprise. Expand only where an existing module already supports the growth confidently.

**Top Priorities (next quarter)**
1. Test isolation + Mongo parity + Python-3.14 tests
2. Background intelligence scheduler + automatic ops sync
3. Unify recommendations (skill graph + trends + adaptive)
4. Publish remaining domain events; wire certificate/follow/rating signals
5. Begin living-credential + company-participation work on the existing enterprise surface

**Long-term Architecture:** remains a **modular monolith with domain events**, adding: a background job boundary (worker), a read-model snapshot store for intelligence, and — eventually — optional domain-specific read replicas if traffic justifies. No microservice migration planned.

**Estimated Platform Maturity:** ~**68%** — Late Series-A / Early Series-B. Differentiated in intelligence+ops; standard in learning/community; the career/enterprise stage is next.

**Overall Score: 7.6 / 10**
*(Architecture 3.9/5: strong foundation + differentiating self-governance; docked for test isolation, request-time intelligence, and the unclosed recommendation/knowledge loops.)*

---

**Items marked "Needs further inspection" (honest gaps from incomplete exploration):** exact `schema.sql` table list contents, migration file internals beyond names, enterprise/exam router depth, search engine internals, LLM provider configuration details, frontend per-route inventory beyond the listed directories, and the current presence of the `_safe` dead helper. The rest of this report is grounded in source read directly.

— End of CTO System Architecture Audit. No code or design changes were made.

---

# ADDENDUM — CHIEF ARCHITECT 14-STEP REVIEW (v2)

*Consolidates and extends the audit above. Derived from source; no code changed.*

## IA — SYSTEM INVENTORY (per-subsystem)

| Subsystem | Owner(s) | Inputs | Outputs | API group | DB entities | Events |
|---|---|---|---|---|---|---|
| Auth/Identity | auth router, core/deps | credentials | JWT, user session | /api/v1/auth | users | (future UserRegistered) |
| Courses/Learning | courses, progress, quiz, adaptive, ai_tutor | content, enrol | progress, quizzes | /api/v1/courses,… | courses, progress, quizzes | — |
| Challenges | community.py, challenges router | submissions | attempts, grades, stats | /api/v1/challenges | challenges, challenge_attempts, challenge_versions, ratings, bookmarks | ChallengeCompleted |
| Skill Graph | skill_graph.py | attempts | mastery scores, recs | /api/v1/skills | skills, user_skills | consumed by rec engine |
| Arena | arena, tournaments | competition | rankings | /api/v1/arena | arena_players, tournaments state | — |
| Community | community.py, community_hub, discussions | activity, discussions | feed, hub | /api/v1/community | activity_events, discussions | consumed ChallengeCompleted |
| Creator | ecosystem.py, creators router | content/events | profiles, trust, analytics | /api/v1/ecosystem | creator_profiles, badges, achievements | consumed EventCreated |
| Marketplace | ecosystem.py | collections | bundles/kits | /ecosystem/collections | collections, collection_bookmarks | — |
| Events | ecosystem.py | event CRUD | events, attendees | /ecosystem/events | events | EventCreated |
| Notifications | notifications.py | triggers | notifications, prefs | /api/v1/notifications | notifications, notification_preferences | consumed many |
| Moderation | ecosystem.py | reports | queue, resolve | /admin/ecosystem | moderation_reports | consumed by intelligence backlog |
| AI | llm.py + ai_tutor, code_assistant, community_ai | prompts/attempts | mentor, tutor, gen | various | (external LLM) | — |
| Certificates/Career | certificates, learning_paths | progress | certs, verify | /api/v1/certificates | certificates | — |
| Enterprise/Exams | enterprise, exams routers | B2B | exams | /api/v1/enterprise, /exams | *Needs further inspection* | — |
| Intelligence | intelligence.py | all collections (read) | KPIs, signals, recs | /admin/intelligence | — (pure reads) | — |
| Platform Ops | platform_ops.py | intelligence recs, admin | tasks, audit | /admin/ops | ops_tasks | consumed via notify |
| Events Bus/Governance | core/events.py, event_handlers, governance router | registers, publishes | catalog, deps, diag | /admin/events | event bus (in-mem) | 2 published events |
| Core/Infra | core/*, db/* | — | envelopes, limits, logging | — | — | — |
| Web App | apps/web | API | PWA UI | — | — | — |

## II — DOMAIN MAPPING (overlap/boundary check)

| Domain | Responsibility clarity | Overlap | Boundary correct? | Size risk | Keep independent? |
|---|---|---|---|---|---|
| Auth | ✅ crisp | none | ✅ | small | yes |
| Skills | ✅ | overlaps rec engine (§X) | ⚠️ mastery vs recommendation duality | growing | yes |
| Challenges | ✅ | creator content + marketplace both touch challenges | ✅ | ✅ large but cohesive | yes |
| Community | ✅ | feed overlaps activity/social | ⚠️ "activity" appears in challenges+community+hub routers | large | yes, but consolidate feed access |
| Creator | ✅ | ecosystem owns creator + events + mod + marketplace | ⚠️ ecosystem.py is a **god service** (4 domains) | **too large** | split into creator / marketplace / events / trust modules |
| Notifications | ✅ | none | ✅ | ✅ | yes |
| Intelligence | ✅ | reads everything read-only | ✅ read-model | ✅ | yes |
| Ops | ✅ | overlaps moderation tasks | ✅ | ✅ | yes |
| Payments | **absent** | — | — | — | separate domain when monetization arrives |
| Recruitment | **absent** (enterprise only) | — | — | — | future domain |

## III — BOUNDED CONTEXT FINDINGS

- **Source of truth owners:** users→Auth; challenges/attempts→Challenges; creator_profiles→Creator; events→Events; reports→Moderation; notifications→Notifications; ops_tasks→Platform Ops.
- **Should never belong here:** marketplace/event/moderation logic inside `ecosystem.py`; activity-feed writes in `community.py` while hub/feed reads live in separate routers (responsibility split, not ownership violation).
- **Violation (minor):** `intelligence.py` reaches into 6 collections by name (read-only replica) — acceptable read-model but no contract.
- **Violation (medium):** `ecosystem.py` god service holds 4 bounded contexts (creator, marketplace, events, moderation) — the largest maintainability risk.

## IV — DEPENDENCY GRAPH

```
core/* ──────────────► all services (envelope, events, deps, limit)
db/mongodb ──────────► all services (get_db/get_read_db)
community.py ────────► skill_graph, llm, core.events
ecosystem.py ────────► community.create_activity, notifications.create_notification, core.events
event_handlers ──────► community, ecosystem, notifications   (event consumer hub)
intelligence.py ─────► db (read model, direct collection names)
platform_ops.py ─────► intelligence, notifications
certificates/paths ──► progress, skill_graph
web ─────────────────► API only
```
- Direct: 9 edges. Indirect: community→skill_graph→db; ecosystem→community→skill_graph.
- Circular: **none**.
- Hidden coupling: intelligence↔collection names; ecosystem↔community (benign function reuse).
- Excessive coupling: **ecosystem.py** (4 domains), **event_handlers** (3 service imports — acceptable, it's the consumer hub).

## V — DATA FLOW (workflows traced)

- **Register:** auth register → users insert → (future) UserRegistered → onboarding.
- **Solve challenge:** submit → grade → skill update (milestone→activity) → attempt insert → stats update → ChallengeCompleted → [feed, creator_stats] → return.
- **Publish challenge:** publish_challenge → status=published → _update_creator_stats → create_activity(challenge_created) → (future ChallengePublished).
- **Join event:** join_event → capacity check → attendee_ids push → notification confirmation → (future EventJoined).
- **Creator verification:** request → pending → admin review → verified/rejected → notifications + activity (verified) or notification (rejected).
- **Moderation:** submit_report → pending → queue → resolve (warn/remove/ban/dismiss) → target mutation (challenge status removed, user restricted, discussion locked).
- **Arena battle:** (tournaments/arena router) → ranking change → leaderboard → (future BattleWon).
- **Intelligence→Task:** recs → sync_from_intelligence → dedupe check → create_task → notify watcher → admin transitions → audit history → completed.

## VI — EVENT ARCHITECTURE (deep)

- **Registered events:** ChallengeCompleted (3 consumers incl. reserved-notifications), EventCreated (3 consumers).
- **Idempotency:** attempt_id / event_id + bus correlation+payload dedup. **Ordering:** handler registration order (deterministic). **Failure handling:** per-handler isolation (logged, others continue); no retry store (resync is source of truth). **Governance:** catalog/deps/diagnostics auto-derived; orphan detection.
- **Chains:** single hop only. **Storm risk:** none (max 3 handlers/event; handlers never re-publish).
- **Missing events** (8+): ChallengePublished, CreatorFollowed, CreatorVerified, RatingChanged, CertificateIssued, ReportSubmitted, ModerationCompleted, SkillMastered, UserRegistered, EventJoined, BattleWon. Each has a built trigger site.
- **Unused:** none. **Duplicate:** none (names unique).

## VII — DATABASE REVIEW

| Collection | Owner | Hot/Cold | Write pattern | Read pattern | Notes |
|---|---|---|---|---|---|
| users | Auth | hot | register/update | auth+profile+creator enrich | |
| challenges | Creator | hot | CRUD/version/stats | lists, arena, intel | large doc (content+skills+versions refs) |
| challenge_attempts | Learner | hot | append | user/analytics/intel | **top growth collection** |
| activity_events | Community | hot | append | feed, DAU/WAU | append-only, no TTL |
| notifications | Notifications | hot | insert | unread badge, list | 500 cap/user |
| creator_profiles | Creator | warm | lazily create/update | leaderboard, trust | embeds followers/badges |
| collections | Marketplace | cold | create/bookmark | browse | |
| events | Events | warm | CRUD/join | calendar | embeds attendee_ids |
| moderation_reports | Moderation | cold | insert/resolve | queue, intel | |
| ops_tasks | Platform Ops | cold | create/transition | overview | embeds history array |
| certificates | Career | cold | issue | verify | |
| arena_players | Arena | warm | join/matches | leaderboards | |
| ratings/bookmarks/versions | misc | cold | append | aggregates | |
- **Duplication/denorm:** stats on challenges (attempts, completion_rate, avg_rating, bookmarks) are denormalized counters — consistent via inline updates; challenge_attempts + stats both count attempts (dual-source risk).
- **Consistency risk:** attempts counter (stats) vs challenge_attempts count; follower count (embedded) vs users collection — both single-writer, acceptable.
- **Indexes:** migration 002 defines indexes; in-memory DB lacks index support (warn on create).
- **Future partitioning:** attempts + activity_events are the shard-candidates; no TTL on activity_events (retention risk).

## VIII — API REVIEW

| API group | Version | Consistency | Auth | Pagination | Errors |
|---|---|---|---|---|---|
| /auth | v1 | ✅ | public | n/a | envelope |
| /courses,/progress,/quiz,/adaptive | v1 | ✅ | mixed | ✅ limit | envelope |
| /challenges,/skills | v1 | ✅ | owner-guarded | ✅ | 400/404 via service_response |
| /ecosystem | v1 | ✅ | user/admin split | ✅ limit (max 100) | ✅ (error contract fixed) |
| /notifications | v1 | ✅ | user | ✅ | envelope |
| /admin/* (events, intelligence, ops) | v1 | ✅ | require_admin | ✅ | envelope |
- **Naming/REST:** consistent `resource/{id}/action`; **versioning:** single `/api/v1` prefix (additive only — documented).
- **Duplicate endpoints:** none observed. **Unused:** none observed. **Missing:** no public recommendation endpoint, no public intelligence (admin only) — by design; notifications lacks push/email endpoints (preferences exist, transport future).

## IX — FRONTEND ARCHITECTURE

- **Framework:** Next.js App Router + Tailwind + TS; PWA (offline SW).
- **Layouts:** root layout (providers, theme, PWA), (app) authenticated shell w/ shared navbar, (public) marketing shell.
- **Pages:** dashboard, courses, learning-paths, challenges, skills, arena, events, creator, activity, membership, pricing, reviews, leaderboard, community, profile/[userId], admin (moderation), notifications, verify, auth (login/register), offline.
- **Components:** organized per-domain (dashboard/, learn/, arena/, community/, ecosystem/, profile/, homepage/, adaptive/, learning-paths/, onboarding/, support/, ide/, shared/, ui/).
- **State:** auth-context (JWT user), react hooks (useExperiments, useOfflineCache); no global store — server components + fetch clients.
- **API layer:** lib/api-client (env-backed), domain clients (community-api, ecosystem-api, notifications-api, adaptive-client); **caching:** PWA offline-db; **loading:** skeletons per-domain; **a11y:** aria-labels, focus trap in navbar; **nav:** shared navbar with desktop/mobile.
- **Gaps:** no data-fetching cache layer (React Query absent), no server-component streaming usage observed, no per-route loading boundaries inventory (**Needs inspection**).

## X — PLATFORM MATURITY (5 levels)

| Subsystem | Level | Why |
|---|---|---|
| Auth/Identity | L4 | JWT, roles, rate-limited, guarded deps |
| Courses/Learning | L3 | functional+broad; adaptive adds personalization |
| Challenges | L4 | versioning, stats, events, ratings |
| Arena | L3 | rankings/tournaments; no battle events |
| Community | L3 | feed+discussions+hub; feed N+1 earlier removed |
| Creator | L4 | verification, trust, analytics, leaderboard |
| Marketplace | L2 | collections only; no payments/premium rails |
| Events | L3 | CRUD+join+recurrence, event-driven fan-out |
| Notifications | L4 | typed, prefs, quiet hours, fan-out |
| Moderation | L3 | queue+actions+signals; no auto-escalation |
| AI | L3 | mentor/tutor/adaptive; LLM-dependent |
| Certificates | L2 | issue+verify; not "living" |
| Intelligence | L3 | real KPIs/recs; **request-time, not self-renewing** (L5 requires scheduler) |
| Platform Ops | L3 | real tasks+audit+automation; outcome measurement absent |
| Event Architecture | L4 | governed, catalogued, isolated |
| Frontend | L3 | broad PWA; no hosted data cache |

## XI — ARCHITECTURE SCORECARD (0-10)

| Dimension | Score | Reasoning |
|---|---|---|
| Modularity | 9 | clean router→service→db; new domains trivial |
| Coupling | 6 | ecosystem god-service + intelligence collection-name coupling |
| Cohesion | 8 | domain services cohesive; ecosystem 4-in-1 |
| Maintainability | 8 | playbook, guardrails, governance |
| Readability | 8 | consistent naming; some large routers |
| Performance | 6 | N+1 fixed; request-time intelligence; no cache layer |
| Scalability | 5 | read/write split + batching; no TTL, no scheduler, sync fan-out |
| Security | 7 | JWT/roles/limits/envelope; CSRF+audit partial |
| Developer Experience | 8 | playbook, self-documenting catalog, tsc/py_compile |
| Testing | 6 | 17 API files; shared-rate-limit breakage; py3.14 gaps |
| Observability | 7 | error logger, health, telemetry, prometheus, event diag |
| Extensibility | 9 | events auto-register; ops categories; new routers |
| Platform Intelligence | 6 | real but request-time reads |
| Operational Excellence | 6 | tasks/audit exist; no measurement loop |
| Event Architecture | 9 | governed, isolated, idempotent |
| **Overall** | **7.2** | strong foundation + differentiating self-governance; docked on scheduling, coupling, test isolation |

## XII — TECHNICAL DEBT (ranked by impact)

1. **CRITICAL — Test isolation (shared rate limiter → 429 in combined runs).** Impact: CI false-red. Fix: test fixture resets limiter. Effort: S.
2. **HIGH — god service `ecosystem.py` (creator+marketplace+events+moderation).** Impact: 4 domains changing one 700+ line file. Fix: split services; keep router shim for back-compat. Effort: M.
3. **HIGH — Request-time intelligence scans (200k docs, no TTL on activity_events).** Impact: admin latency + DB load + unbounded append. Fix: scheduler + snapshot + TTL. Effort: M-L.
4. **HIGH — In-memory DB `$push` parity gap.** Impact: silent dev/test divergence. Fix: mutation helper + parity test. Effort: M.
5. **MED — Python-3.14 test breakage (`get_event_loop`).** Fix: asyncio.run. Effort: S.
6. **MED — Intelligence collection-name coupling.** Fix: readonly contract module. Effort: S.
7. **MED — Pydantic v2 `Config` deprecations.** Effort: S.
8. **MED — No transport for notifications (email/push missing, prefs exist).** N/A until transport.
9. **LOW — Dead `_safe` helper + unused imports (intelligence.py) (verify).** Effort: S.
10. **LOW — Deprecation warnings (slowapi, worker pool aclose).** Effort: S.

## XIII — EVOLUTION ROADMAP (ROI-ordered, no implementation)

1. **CI/Test reliability fix.** Problem: shared limiter, py3.14, $push parity. Impact: false red; future risk: eroded velocity. Benefit: trusted CI. Difficulty: low; complexity: S; deps: none; rollback: revert fixture.
2. **Worker-scheduled intelligence + ops sync.** Problem: request-time reads. Impact: latency/load; future risk: stalls at volume. Benefit: L5 self-improving, trend detection. Difficulty: medium; complexity: M; deps: worker; rollback: keep request fallback.
3. **Split ecosystem god service into creator/marketplace/events/trust modules** (router-shim back-compat). Benefit: maintainability + 4 owned contexts. Difficulty: medium; rollback: keep shim, invert.
4. **Publish the 8 missing domain events** (verification, follows, ratings, certificates, reports). Benefit: completes event mesh → intelligence/ops automation feed. Difficulty: low each; rollback: one event at a time.
5. **Unify recommendations** (skill_graph + adaptive + trends). Benefit: personalization; difficulty: medium; depends on 2.
6. **Knowledge graph (cross-entity) + living credentials.** Benefit: career/company stage; difficulty: M-L; depends on 4.
7. **Experiments/decision history** to close the OS loop. Benefit: outcome measurement; difficulty: L.

## XIV — CTO REPORT (extended)

**Executive Summary:** Ascendly is a differentiated Modular-Monolith-with-Events competitive-learning OS. It has moved from feature breadth to platform self-governance: event-governed backbone, self-observing intelligence, and an ops task engine. The next era is **reliability + the unclosed loops** (recommendations, knowledge, career, measurement).

**Platform Map:** 22 domains across 2 deployables (FastAPI+Mongo/Redis; Next.js PWA), Docker/K8s/Prometheus/Grafana infra. (See IA-IV.)

**Database Map:** 17+ collections; hot: users, challenges, attempts, activity, notifications. (See VII.)

**API Map:** single v1; consistent envelope + error contract; 6 admin groups. (See VIII.)

**Frontend Map:** Next.js App-Router PWA, domain-organized components, auth-context state, env-backed API clients, offline cache. (See IX.)

**Architecture Risks:** (R1) god-service ecosystem.py; (R2) request-time intelligence + unbounded activity; (R3) test isolation; (R4) sync fan-out with a future slow consumer; (R5) schema coupling in intelligence.

**Technical Debt:** 1 critical, 3 high, 4 medium, 2 low (see XII).

**Performance Risks:** intelligence scans; no TTL; no query cache layer on web; sync event handlers.

**Security Risks:** partial audit trail (ops only); CSRF posture for cookie flows unverified (**Needs inspection**); LLM prompt-injection surface unmitigated (AI domains).

**Operational Risks:** no scheduler; no feature flags; no structured experiment measurement; fan-out cap (500) notification etiquette.

**Architecture Maturity:** Late Series-A/Early Series-B, **~68%** overall. Event mesh L4, Intelligence L3→5 target, Ops L3→5 target, Frontend L3.

**Recommended Evolution Plan:** 1) Fix CI; 2) Scheduled intelligence+ops; 3) Split ecosystem; 4) Publish missing events; 5) Unified recommendations; 6) Knowledge graph + living credentials; 7) Experiments/measurement.

**Long-Term Vision:** Remain a modular monolith with in-process events; add a job boundary (worker), read-model snapshots, optional domain read-replicas. **No microservices.** Career/company stage is the natural next evolution.

**Overall Score: 7.6/10** (architecture 3.9/5; scorecard 7.2/10). Differentiated in self-governance; the path to 9+ runs through CI reliability, scheduled intelligence, and closing the recommendation/knowledge/measurement loops.

*Items still needing inspection: enterprise/exam router depth, search internals, LLM provider config, cookie-vs-bearer CSRF posture, frontend per-route loading boundaries, `_safe` dead-code presence.*


**ASCENDLY — 10-YEAR ARCHITECTURE REVIEW (Principal Architect)**
*Basis: verified ARCHITECTURE_HANDBOOK.md + SYSTEM ARCHITECTURE AUDIT.md (source-derived). No code changed. No random improvements. Every recommendation satisfies the 7 rules and fits the Modular Monolith. No K8s/Kafka/RabbitMQ/microservices/event-sourcing/CQRS/distributed-transactions.*

---

**PHASE 1 — SYSTEM MENTAL MODEL**

One process, many internally-bounded domains (Modular Monolith). Web/mobile → FastAPI routers (thin; envelope `{success,data,error,meta}`; `service_response` prevents fake-200) → application services → Mongo (get_db/get_read_db) or Redis worker queue; domain reactions travel an in-process, governed event bus (ChallengeCompleted, EventCreated) to listeners (feed, creator stats, notifications). Startup: seed → indexes → Redis → R2 → search sync → paths → concepts → skills → register event handlers; graceful shutdown. Core domains: Learning, Challenges, Arena, Community, Creator, Marketplace, Events, Notifications, Intelligence, Ops, Moderation. Support: Auth, Profiles, Skills, Certificates, Admin, Search, AI. Cross-cutting: envelope, guards, rate-limit, error_logger, telemetry, event governance, worker pool.

**PHASE 2 — DOMAIN BOUNDARIES**

Strong: Auth (5), Learning, Arena, Notifications, Ops, Certificates — crisp ownership, low leakage. **Broken: `ecosystem.py` is a 5-context god service** (Creator, Marketplace, Events, Moderation) — teams collide, cohesion low, boundaries bad. **Leaking:** challenge grading lives in `community.py` (3 contexts); activity ownership split across 3 routers. Intelligence is a clean read-model but hidden-couples to 6 collection names. AI is cross-cutting (fuzzy but acceptable). Payments/membership and Enterprise/Exams: *needs inspection*.

**PHASE 3 — DEPENDENCY GRAPH**

No cycles (verified). Hotspots: ecosystem (imports community+notifications, and 4 domains import it), notifications (4+ producers). God modules: ecosystem (5), community (3). Transitive: ecosystem→community→skill_graph. Hidden: intelligence↔collection names; event_handlers↔3 services (acceptable hub). Shared mutable state: global bus, redis pool, limiter — process-local, fine.

**PHASE 4 — DATA OWNERSHIP**

Real debt: **dual-source counters** — challenge `stats.attempts/avg_rating/bookmarks` vs `challenge_attempts/ratings/bookmarks` (single-writer today, no contract → drift at scale = wrong stats, brand risk). Embedded arrays (followers, attendee_ids) fine now, unbounded risk later. **No TTL on activity_events/notifications** — ops landmine. **No read-model** — intelligence re-scans 200k docs/request. Soft-delete partial; no archive model; no cache layer.

**PHASE 5 — APPLICATION LAYERS**

API layer: strongest discipline (thin routers, envelope, guardrails). Application: services call Mongo directly — acceptable for a modular monolith but the **no-repository/no-read-model** gap creates collection-shape coupling. Domain layer thin (pragmatic). Infrastructure well-isolated. **Worker pool under-utilized** (only admin analytics/search); everything else inline async. No DI framework — right fit, keeps stack small.

**PHASE 6 — ENGINEERING QUALITY**

Playbook strong. Consistent naming/folders. **#1 engineering risk: test reliability** — combined suites hit shared rate-limiter 429; Python 3.14 `get_event_loop` breaks 2 tests; in-memory `$push` parity gap. No CI pipeline observed. No request-ID trace correlation. No per-endpoint p99 budgets. No feature-flag service beyond the experiments router (scope: inspect). Versioning: API `/v1` additive, events `EventSpec`-versioned — good.

**PHASE 7 — PERFORMANCE**

N+1 fixed in ecosystem lists (batch helpers); **community feed still enriches per-event** (audit). Intelligence + creator-stats recompute = **repeated 200k scans on request path**. Expensive: admin analytics/forecast + intelligence overview. Sync `bus.publish` awaits all handlers — a future slow handler (email/push) blocks producers. Hot collections unpartitioned but volume not yet critical.

**PHASE 8 — PRODUCT ARCHITECTURE**

Strong support: daily-use learning, challenges, arena, community, notifications, gamification. Partial: creator economy (blocked by god service), marketplace (no payments), certifications (not "living"), enterprise/recruitment (surface). Architecture *can* carry the vision — but **product teams cannot evolve Creator/Marketplace/Events independently while they share one file**; this is the core product-architecture risk.

**PHASE 9 — PLATFORM EVOLUTION (prediction)**

2-year bottlenecks: intelligence (request-time), notifications (fan-out), ecosystem (god file), activity_events (growth). Fastest-growing: AI, Creator, Marketplace, Enterprise, Community. Likely splits: ecosystem → creator/marketplace/events/moderation; community → grading vs feed vs creator-stats. **Never split:** the monolith deployable, event core + governance, envelope/core, worker pool, auth, notifications hub — those are stability anchors; splitting them is fashion.

**PHASE 10 — MISSING CAPABILITIES (architectural, not features)**

1) Intelligence read-model snapshot; 2) ops-task outcome measurement (closes the loop); 3) collection-schema contract; 4) dual-source counter contract (event-driven sync); 5) retention/archive job; 6) per-endpoint perf budgets enforced in CI; 7) request-ID trace correlation; 8) **CI + deterministic tests (most urgent — gates everything)**; 9) feature-flag/experiment layer (extend existing experiments router); 10) local dev tooling (mongo/redis compose, seed reset, migration runner).

**PHASE 11 — TOP RISKS (ranked, no implementation)**

1 Test unreliability (H/H) — velocity death → deterministic CI first. 2 God service ecosystem (H/H) → bounded-context split w/ router shim. 3 Request-time intelligence scans (M/H) → read-model. 4 Unbounded activity/notifications (M/H) → TTL/archive. 5 Counter drift (M/M) → event-synced counters. 6 Grading-in-community leak (M/M) → move to challenges. 7 Feed N+1 (M/M) → batch load. 8 Sync fan-out blocks producers (M/M) → handler queue boundary. 9 No CI (M/H) → CI+isolation. 10 Intelligence collection-name coupling (M/M) → schema contract. 11 No migration/backfill runner (M/M). 12 Payments depth unknown (M/M). 13 Notifications implicit coupling (M/M) → event-driven only. 14 Login 5/min breaks tests (L/H). 15 No request trace (M/M).

**PHASE 12 — MATURITY SCORES (/10)**

Architecture 8 · Maintainability 6 · Scalability 5 · Extensibility 8 · Domain Modeling 5 · Engineering 7 · Developer Experience 7 · Product Architecture 7 · Operational Excellence 6 · Platform Engineering 6 · AI Readiness 7 · Security 7 · Observability 6 · Testing 5. **Overall 6.3/10.**

**PHASE 13 — ARCHITECTURE ROADMAP (ranked; no implementation; each with rollback)**

1 **CI & test determinism** — Impact H, Difficulty S, Risk-reduction H; rollback: revert fixture. *Unblocks all else.*
2 **Split ecosystem into Creator/Marketplace/Events/Moderation services** — Impact H, Diff M, Long-term H; rollback: keep shim. *Greatest maintainability ROI.*
3 **Intelligence read-model + ops outcome measurement** — Impact H, Diff M; rollback: request-time fallback. *Turns Intelligence L3→L5; closes the loop.*
4 **Retention/archive job** — Diff S; rollback: disable job.
5 **Schema contracts + counter sync via events** — Diff M; rollback: keep direct reads.
6 **Request-ID trace** — Diff S; rollback: header optional.
7 **Migration/backfill runner** — Diff M; rollback: ordered migrations + snapshot.
8 **Local dev tooling** — Diff S.

---

**PRINCIPAL ARCHITECT VERDICT (brutal):**

The foundation genuinely survives decade-scale — envelope discipline, guardrails-as-code, governed events, a functioning intelligence→ops loop, and a documented playbook are exactly what hundreds-of-developers platforms need. That is real.

What will NOT survive a decade as-is:
- **The 5-in-1 `ecosystem.py`** — it prevents independent product teams; this is the #1 structural weakness visible only at organizational scale, not code scale.
- **Dual-source counters without a contract** — at millions of users, silently-wrong stats are a brand risk.
- **Request-time 200k-doc intelligence scans** — a scheduling gap that becomes a scaling wall.
- **Non-deterministic tests** — the quiet killer of long-term velocity.
- **Unbounded append-only collections** — an ops landmine with a cheap fix.

What must be preserved untouched: the modular-monolith deployable, the event core + governance, the response-envelope guardrail, the worker pool, auth, and notifications.

**Overall: 6.3/10 today → 8.5/10 in 18 months — achievable without any distributed-system rewrite, purely by paying the boundary, scheduling, and test-reliability debts.** The architecture is strong enough to carry the next decade; the roadmap above is how it stays that way.

*Residual unknowns honestly flagged: enterprise/exams internals, payment-gateway wiring, recommendation internals, search internals, experiments-router scope, CI config — nothing asserted beyond verified source. Full detail persists in SYSTEM ARCHITECTURE AUDIT.md and ARCHITECTURE_HANDBOOK.md.*



