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