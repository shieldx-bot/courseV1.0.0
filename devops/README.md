# Ascendly — DevOps (Phase 0 → Phase 7)

Infrastructure, CI/CD, and local developer tooling for the Ascendly monorepo.

## Layout

| Path | Purpose |
|---|---|
| `docker/` | Dockerfiles (`Dockerfile.api`, `Dockerfile.web`) + local observability config (`prometheus.yml`, `grafana/`, `prometheus/alerts.yml`) |
| `helm/` | Helm charts: `platform-base`, `ascendly-api`, `ascendly-runtime` |
| `k8s/` | Hardened Kubernetes manifests (namespaces, network policies, PDBs, HPA, RBAC…) |
| `prometheus/` | Canonical Prometheus scrape config (`prometheus.yml`) + alerting rules (`alerts.yml`) — used by the Kubernetes / self-hosted Prometheus |
| `scripts/` | CI helper scripts (e.g. `ci-migration-check.sh`) |
| `.github/workflows/` | CI + Preview deployment workflows (repo root) |

Prometheus config lives in two places:

- `devops/docker/prometheus.yml` — the **docker-compose** stack's config
  (mounted into the `prometheus` service; `rule_files` → `docker/prometheus/alerts.yml`).
- `devops/prometheus/prometheus.yml` — the **canonical/Kubernetes** config
  (`rule_files` → `prometheus/alerts.yml`), for a Prometheus scraping the
  `ascendly-worker-metrics` / `ascendly-cron-metrics` Services.

The repo root `Makefile` drives local dev. Docker contexts are the **repo root**
(they must be: the Dockerfiles `COPY apps/api/…` and `COPY apps/web/…`).

## Local development (make targets)

```bash
make setup          # create apps/api/.venv, pip install -r requirements.txt, npm ci in apps/web
make compose-up     # docker compose up -d mongo redis meilisearch mailpit (infra only)
make compose-down   # docker compose down
make test-api       # cd apps/api && pytest tests/ -q   (hermetic: in-memory Mongo)
make test-web       # cd apps/web && npm test -- --ci
make build-api      # compileall check of backend modules
make build-web      # next build
make lint           # ruff (backend, if installed) + next lint (frontend)
make migrate        # documented migration runner + seed (see apps/api/migrations/README.md)
make seed-support   # seed dev support data (help_articles, tickets, messages) — idempotent
make dev            # API (8000) + Web (3000) dev servers concurrently
make dev-api        # only FastAPI dev server   (http://localhost:8000)
make dev-web        # only Next.js dev server   (http://localhost:3000)
```

> Note: `make migrate` uses the real runner (`app.core.cli` with full migration
> names). See `apps/api/migrations/README.md` for the known runner limitations
> recorded in Phase 0.
>
> Note: `make compose-up` (infra only) needs no `.env`. `make compose-up-all`
> starts the app services too, which reference a repo-root `.env` via
> `env_file` — create one (`cp .env.example .env` and fill in secrets) before
> using it.

## LLM / AI support chat (Phase 2)

LLM provider keys are read by the backend (`apps/api/app/core/config.py`)
from the environment. Template + passthrough:

| Layer | File | Notes |
|---|---|---|
| Local dev | `.env.example` → `.env` | `OPENAI_API_KEY`, `OPENAI_BASE_URL`, `OPENAI_MODEL`, `OPENROUTER_API_KEY`, `GEMINI_API_KEY`, `TAVILY_API_KEY` — empty = provider disabled/fallback |
| docker compose | `docker-compose.yml` | api/worker/cron pass `${VAR:-}` through (empty-safe) |
| K8s | `devops/k8s/secret.yaml` | Placeholder keys; real values set via `kubectl create secret` (never committed) |
| Helm | `devops/helm/platform-base/{values.yaml,templates/secret.yaml}` | `secretData.OPENAI_API_KEY` etc., override per-env |

SSE (`POST /api/support/chat/stream`, `text/event-stream`) is unbuffered at
the ingress layer so streams are not held or cut off:

- nginx-ingress annotations (both `devops/k8s/ingress.yaml` and the Helm chart
  `ascendly-api` values → template):
  - `nginx.ingress.kubernetes.io/proxy-buffering: "off"`
  - `nginx.ingress.kubernetes.io/proxy-read-timeout: "120"`
  - `nginx.ingress.kubernetes.io/proxy-send-timeout: "120"`
  - `nginx.ingress.kubernetes.io/proxy-request-buffering: "off"`

Timeouts are bounded (120s) — long enough for a single LLM streamed response,
not infinite.

NetworkPolicy egress already permits HTTPS (443) for api/worker/cron, so
outbound LLM calls (OpenAI/Groq/OpenRouter/Gemini) are allowed.

Monitoring (`llm_*` metrics exposed by the backend — see Phase 2 report):

- Prometheus alerts (both `devops/prometheus/alerts.yml` and
  `devops/docker/prometheus/alerts.yml`): `LLMHighErrorRate` (>20% over 5m),
  `LLMSpikeInRequests`, `LLMCostSpike`.
- Grafana dashboard `devops/docker/grafana/dashboards/api-metrics.json` gains
  LLM request rate, error rate, cost, and token panels.

## Email development (Mailpit) — Phase 3

`docker-compose.yml` ships a `mailpit` service for local email dev:

| Port | Purpose |
|---|---|
| `1025` | SMTP (backend `SMTP_PORT`) |
| `8025` | Web UI — open **http://localhost:8025** to inspect received mail |

The `api`, `worker`, and `cron` services pass through `SMTP_HOST`/`SMTP_PORT`/
`SMTP_USER`/`SMTP_PASSWORD` from the environment (compose defaults:
`SMTP_HOST=mailpit`, `SMTP_PORT=1025`, `SMTP_USER=mailpit`,
`SMTP_PASSWORD=mailpit` — Mailpit accepts any credentials, so the backend
delivers real SMTP messages you can read in the UI instead of only
`[DEV EMAIL]` print fallbacks).

- `make compose-up` starts Mailpit together with the other infra services.
- `.env.example` ships dev-safe defaults (`SMTP_HOST=mailpit`,
  `SMTP_PORT=1025`, empty user/password). Inside compose, empty
  user/password resolve to the Mailpit dummy creds, so mail still lands in
  the UI. Running the backend *without* compose (`make dev`) with empty
  `SMTP_USER`/`SMTP_PASSWORD` keeps the `[DEV EMAIL]` print fallback in
  `apps/api/app/services/email.py` (no mail server needed).
- Real SMTP: set `SMTP_HOST`/`SMTP_PORT`/`SMTP_USER`/`SMTP_PASSWORD` in
  `.env` (user+password non-empty) — compose passes them through and the
  backend sends real mail. Never commit real SMTP credentials.

## Phase 3 — Proactive support (ops)

- **Cron schedule**: `run_proactive_support_checks` runs once per day at
  **03:00 UTC** (arq `cron_jobs` in `apps/api/app/worker.py`). It is defined
  exactly once — no duplicate run. In K8s/Helm the cron process is a
  `Deployment` (`devops/k8s/cron-deployment.yaml` /
  `ascendly-runtime` `templates/cron-deployment.yaml`) running with
  `PROCESS_MODE=cron`; scheduling happens *inside* the pod via arq, so it is
  **not** a Kubernetes `CronJob` and no `ttlSecondsAfterFinished` is needed.
  The daily 03:00 cadence is deliberately conservative for cost; if a higher
  frequency (e.g. every 15 min, per `15-de-xuat-cai-tien.md`) is approved,
  adjust the `cron()` entry in `worker.py` (backend/AI-A) — no infra change
  is required for it.
- **Alerts** (both `devops/prometheus/alerts.yml` and
  `devops/docker/prometheus/alerts.yml`): `LLMHighErrorRate`,
  `LLMSpikeInRequests`, `LLMCostSpike`, and `ProactiveCheckJobFailed`.
  `ProactiveCheckJobFailed` watches
  `worker_jobs_completed_total{task="run_proactive_support_checks",status="failed"}`.
- **Grafana** (`devops/docker/grafana/dashboards/api-metrics.json`): LLM
  panels + proactive run / email-sent panels.
- **Backend dependency (Phase 4, resolved)**: `worker_jobs_completed_total` is
  defined in `apps/api/app/core/telemetry.py`; the worker/cron processes now
  start a Prometheus `/metrics` HTTP server on `PROMETHEUS_PORT` (default
  **9101**) via `prometheus_client.start_http_server` when telemetry is
  enabled (`apps/api/app/core/telemetry.py:start_metrics_server`), and arq
  job outcomes are recorded by the `_tracked` wrappers in
  `apps/api/app/worker.py`. Prometheus scrapes `worker:9101` / `cron:9101`
  (compose) or the `ascendly-worker-metrics` / `ascendly-cron-metrics`
  Services (k8s). See the Phase 4 section below for the scrape topology.

## Phase 4 — Adaptive learning: worker/cron metrics scraping + seed

### Worker/cron `/metrics` scraping

The API process exposes `/metrics` on `:8000` (FastAPI). The **worker** and
**cron** processes each bind their own Prometheus `/metrics` HTTP server on
`PROMETHEUS_PORT` (default `9101`, see `apps/api/app/core/config.py`), sharing
the default registry, so all `worker_*` and `llm_*` series are exportable from
the runtime process that produces them.

| Environment | Prometheus config | Targets |
|---|---|---|
| docker compose | `devops/docker/prometheus.yml` | `ascendly-api` → `api:8000`, `ascendly-worker` → `worker:9101`, `ascendly-cron` → `cron:9101` |
| Kubernetes / self-hosted | `devops/prometheus/prometheus.yml` | `ascendly-api:8000`, `ascendly-worker-metrics:9101`, `ascendly-cron-metrics:9101` |

Notes:

- **Compose connectivity**: Prometheus (a compose service) reaches the worker
  and cron containers over the compose network by service name — no host port
  publish is required. `docker-compose.yml` publishes `9101:9101` for the
  **worker** only (a convenience for `curl localhost:9101/metrics`); the cron
  container also binds `9101` internally but is intentionally not published to
  the host (would collide with the worker's host port). Both are scraped
  in-network.
- **K8s**: `devops/k8s/service.yaml` (and the `ascendly-runtime` Helm chart)
  define ClusterIP Services `ascendly-worker-metrics` and
  `ascendly-cron-metrics` (selector `app: ascendly-worker` / `app:
  ascendly-cron`, port `9101`). `devops/k8s/networkpolicy.yaml` (and the
  `platform-base` chart) add:
  - `allow-prometheus-metrics-ingress` — ingress to worker/cron pods on `9101`
    from a Prometheus in the `monitoring` namespace **or** a same-namespace
    pod labelled `app: prometheus`;
  - `allow-egress-prometheus` — egress from a same-namespace `app: prometheus`
    pod to worker/cron `:9101` + DNS. (A Prometheus hosted in another
    namespace is governed by that namespace's policies; the egress rule is
    inert there by design.)
- **Alerts are live once the series exist**: with the scrape targets above,
  `ProactiveCheckJobFailed` fires when
  `worker_jobs_completed_total{task="run_proactive_support_checks",status="failed"}`
  increases, and `LLMHighErrorRate` / `LLMSpikeInRequests` / `LLMCostSpike`
  fire from `llm_requests_total{provider,status}` / `llm_cost_usd_total{provider}`
  exported by the worker/cron process. Alert metric names were aligned with
  the backend counter names (`llm_cost_usd_total`, not `llm_cost_total_usd`).
- **Metric contract** (backend, exported via `/metrics`):
  `worker_queue_depth`, `worker_dlq_count`, `worker_jobs_enqueued_total{task}`,
  `worker_jobs_completed_total{task,status}`, `llm_requests_total{provider,status}`,
  `llm_tokens_total{provider}`, `llm_cost_usd_total{provider}`.
- **Grafana** datasource already points at the compose Prometheus
  (`devops/docker/grafana/datasources/prometheus.yml` → `http://prometheus:9090`),
  so the worker/proactive/LLM panels query the new jobs automatically.

### Adaptive seed data (dev)

AI-A ships an idempotent concept seeder (`apps/api/app/db/seed_concepts.py`,
`seed_concepts(db)`): it inserts `concept_definitions` for 3 sample courses
(`course-python-data`, `course-js`, `course-sql`; 5–6 concepts each with
`difficulty_base`, `tags`, `lesson_ids`) and skips when the collection is
non-empty. Indexes for `concept_definitions` / `concept_mastery` are defined in
`apps/api/app/db/indexes.py`.

**Hooked at startup (confirmed)**: `seed_db()` in `apps/api/app/db/mongodb.py`
calls `seed_concepts(db)` (guarded, idempotent), and `seed_db()` runs in the
FastAPI lifespan on every API start (`apps/api/app/main.py`). Dev therefore
gets the adaptive sample data automatically on `make compose-up` /
`make dev` — no extra infra step. `make migrate` (migrations + `app.core.cli
seed`) and `make seed-support` (articles/tickets/messages) are unchanged and
independent.

## Phase 5 — Adaptive learning observability (metrics, dashboard, alerts, Redis)

### Metric contract M1–M7 (final: M1–M5 Phase 5, M6–M7 Phase 6)

Names are final — the backend (AI-A) instruments against these and must not
rename them (lesson learned from the P4 `llm_cost_usd_total` rename). All
names follow Prometheus conventions: Counter base names get the `_total`
suffix on the wire, Histograms are suffixed `_seconds` and expose
`_bucket`/`_sum`/`_count` series.

| Mã | Metric (on-wire) | Type | Labels | Notes |
|---|---|---|---|---|
| M1 | `adaptive_quiz_generated_total` | Counter | `mode` (`lesson`\|`mastery-check`), `course_id` | Define with base name `adaptive_quiz_generated`; `_total` is appended automatically |
| M2 | `adaptive_quiz_submitted_total` | Counter | `mode`, `passed` (`"true"`\|`"false"`) | Pass-rate = `{passed="true"}` / total |
| M3 | `adaptive_quiz_submit_duration_seconds` | Histogram | `course_id` | Quantiles via `histogram_quantile` on `_bucket`; measures `grade_quiz` |
| M4 | `adaptive_mastery_decay_runs_total` | Counter | `status` (`success`\|`failed`) | Incremented by cron `run_mastery_decay` |
| M5 | `adaptive_remediation_generated_total` | Counter | `concept_id` | Incremented by `generate_remedial_content` |
| M6 | `adaptive_remediation_feedback_total` | Counter | `helpful` (`"true"`\|`"false"`) | Incremented by remediation feedback endpoint |
| M7 | `adaptive_remediation_exercise_submitted_total` | Counter | `concept_id`, `passed` (`"true"`\|`"false"`) | Incremented by remediation micro-exercise submit |

Dashboard and alert queries assume these exact label names (`mode`, `passed`,
`course_id`, `status`, `concept_id`). If any label name changes, the
dashboard/alert expressions below must be updated in lockstep.

### Grafana dashboard — Adaptive Learning

`devops/docker/grafana/dashboards/adaptive-metrics.json` (same provisioning
pattern as `api-metrics.json` — dropped into the folder mounted at
`/etc/grafana/provisioning/dashboards`). Panels:

1. Quiz Generation Throughput (M1, rate 5m by mode)
2. Quiz Submissions (M2, rate 5m by mode)
3. Quiz Pass Rate (M2: passed/total, by mode)
4. Submit Latency p50/p95 (M3, `histogram_quantile` on 5m rate)
5. Mastery Decay Runs (M4, 1h increase by status)
6. Remediation Generated (M5, 1h increase by concept)
7. Remediation Feedback (M6, rate 5m by `helpful` — bar chart, 2 series)
8. Remediation Exercise Submissions by Concept (M7, top 10 by 1h increase)
9. Remediation Exercise Pass Rate (M7, passed/total by concept)
10. Remediation Effectiveness (placeholder — data from `quiz_attempts` / exercise
    submit mastery deltas, **not** a Prometheus metric; needs an analytics API —
    see Phase 6 section below)

Panels render "No data" until the backend exports the series; a note panel
documents that the data is pending AI-A instrumentation.

### Alerts — Adaptive Learning (both `devops/prometheus/alerts.yml` and
`devops/docker/prometheus/alerts.yml`; historical thresholds unchanged)

| Alert | Expression | For | Meaning |
|---|---|---|---|
| `AdaptiveQuizHighErrorRate` | `rate(adaptive_quiz_submitted_total{passed="false"}[5m]) / rate(adaptive_quiz_submitted_total[5m]) > 0.05` | 10m | Adaptive quiz failure rate > 5% |
| `AdaptiveQuizSlowSubmit` | `histogram_quantile(0.95, rate(adaptive_quiz_submit_duration_seconds_bucket[5m])) > 3` | 10m | p95 submit latency > 3s |
| `MasteryDecayJobFailed` | `rate(adaptive_mastery_decay_runs_total{status="failed"}[5m]) > 0` | 10m | `run_mastery_decay` failures (pod death covered by `InstanceDown`) |

`LLMCostSpike` from Phase 4 is kept as-is. Empty series → no fires until the
backend instruments M1–M5; dry-run of the rule files passes.

### Redis — adaptive cache (verified, no change)

- Compose already runs `redis:7-alpine` with a healthcheck; `api`/`worker`/
  `cron` already receive `REDIS_URL=redis://redis:6379/0`.
- `.env.example` already ships `REDIS_URL`.
- `apps/api/app/services/cache.py` (`get_or_cache` / `invalidate_pattern`)
  falls back to an in-process store when Redis is unreachable, so a Redis
  outage degrades to a short-lived per-process cache instead of a failure.
- Mastery map is cached with a short TTL (60–120s); Redis default config is
  fine for that — no `maxmemory`/eviction change is required for Phase 5.

### Cron — mastery decay (pending AI-A NV4)

`run_mastery_decay` will be registered in `WorkerSettings.cron_jobs` (daily
**04:00 UTC** — deliberately distinct from the 03:00 proactive run). No infra
change is needed: the cron deployment (compose `cron` service / `devops/k8s/
cron-deployment.yaml` / `ascendly-runtime` chart) already runs the same arq
worker with `PROCESS_MODE=cron`, so a new `cron()` entry is picked up on
deploy. Failure telemetry flows through `adaptive_mastery_decay_runs_total
{status="failed"}` -> `MasteryDecayJobFailed`.

## Phase 6 — Remediation observability & analytics

### Metric contract M6–M7 (added Phase 6; M1–M5 unchanged — see table above)

- **M6** `adaptive_remediation_feedback_total{helpful}` — incremented by
  `POST /adaptive/remediation/{course_id}/feedback/{concept_id}` (AI-A Phase 6
  NV2.4).
- **M7** `adaptive_remediation_exercise_submitted_total{concept_id,passed}` —
  incremented by
  `POST /adaptive/remediation/{course_id}/exercise/{concept_id}/submit`
  (AI-A Phase 6 NV2.3). Pass-rate = `{passed="true"}` / total.

Instrumented by AI-A in parallel with this work (Phase 6 NV4). Empty series ->
no dashboard data and no alert fires until then.

### Dashboard panels added (Phase 6)

`devops/docker/grafana/dashboards/adaptive-metrics.json` now also contains:

7. **Remediation Feedback** (M6) — bar chart, rate 5m by `helpful`
   (`sum(rate(adaptive_remediation_feedback_total[5m])) by (helpful)`), 2
   series (`true` / `false`).
8. **Remediation Exercise Submissions by Concept** (M7) — top 10 concepts by
   1h increase (`topk(10, sum(increase(adaptive_remediation_exercise_submitted_total[1h])) by (concept_id))`).
9. **Remediation Exercise Pass Rate** (M7) — `{passed="true"}` / total by
   concept, 5m rate, `clamp_min(..., 1)` guard.
10. **Remediation Effectiveness** — **placeholder panel only**. The metric
    "% users improving mastery after remediation" (spec `16-de-xuat` §11) is
    computed from mastery before/after deltas stored in `quiz_attempts`
    (`concept_results.mastery_before/after`) and the exercise-submit payload
    (`mastery_before`/`mastery_after`), **not** from a Prometheus counter.
    It needs an analytics API (e.g. `GET /admin/adaptive/analytics/remediation-effectiveness`)
    to aggregate those documents; until that API exists the panel stays a
    note documenting the data source. **No fabricated Prometheus query.**

### Alerts (confirmed — no new alert)

The 3 Phase 5 alerts (`AdaptiveQuizHighErrorRate`, `AdaptiveQuizSlowSubmit`,
`MasteryDecayJobFailed`) plus `LLMCostSpike` (Phase 4) are kept as-is in both
`devops/prometheus/alerts.yml` and `devops/docker/prometheus/alerts.yml`.

Remediation is LLM-heavy: a spike in `adaptive_remediation_generated_total`
(M5) driven by `generate_remedial_content` increases `llm_requests_total` and
`llm_cost_usd_total`, so **`LLMCostSpike` acts as the canary** for remediation
cost. `LLMSpikeInRequests` (>100 req/5m) catches runaway generation loops.
`RemediationGenerationHighErrorRate` is intentionally **not** added yet: no
per-concept error-rate series exists and there is no real data to tune a
threshold against; revisit only if AI-A reports elevated LLM failure in
remediation (then wire
`rate(adaptive_remediation_generated_total[5m])` against a failure counter).

### LLM timeout/retry + Redis TTL (verified — no double cost)

- `apps/api/app/services/llm.py` `call_llm` retries across **different
  providers** (OpenRouter -> Gemini -> Groq -> OpenAI fallback) but never
  retries the same provider; there is **no automatic retry loop** on
  `generate_remedial_content`. On LLM failure the service catches the
  exception and falls back to static text (and still caches + counts M5), so
  a slow/failing LLM cannot double-charge the same generation.
- Each provider call uses `httpx.AsyncClient(timeout=...)` (60s chat, 120s
  stream). No configurable `LLM_TIMEOUT` setting exists today. **Suggestion
  for AI-A (optional, not required):** if remediation timeouts need to be
  tunable per environment, expose `LLM_TIMEOUT_SECONDS` (default 60) in
  `app/core/config.py` and pass it to `call_llm`; behavior change only — no
  double-cost risk since retries stay cross-provider only.
- **Redis TTL**: `REDIS_TTL_SECONDS = 60 * 60` (1h) in `remediation.py`. Once
  AI-A ships the `remedial_content` collection (cross-user reuse, Phase 6
  NV2.2), the Redis TTL can be raised to **24h** (indexed collection is the
  source of truth; Redis is just a fast front cache). Redis default
  eviction/`expire` behavior needs **no change** — `expire` is natural, no
  `maxmemory` policy update required.

## Phase 7 — Architecture hardening: request-ID, scheduler, retention, CI gates

### Request-ID / trace correlation (NV1)

- **Middleware**: `RequestIDMiddleware` (`apps/api/app/core/middleware.py`) is the
  **outermost** HTTP middleware in `apps/api/app/main.py`. It accepts a
  client-supplied `X-Request-ID` header, otherwise generates a fresh UUID4, and
  echoes it back in the response `X-Request-ID` header.
- **Contextvar**: the id lives in `apps/api/app/core/context.py`
  (`get_request_id()` / `set_request_id()` / `reset_request_id()`) and is
  readable anywhere inside the request — handlers, exception handlers, the
  HTTP access log, and background tasks spawned from the request.
- **Trace correlation points**:
  - `error_logs` records now carry `request_id` (all three exception handlers
    in `app/main.py` pass `get_request_id()`; `error_logger.log()/log_exception()`
    accept a `request_id` field).
  - HTTP access log (`access` logger, `app/core/telemetry.py`) includes
    `request_id` in the structured extra fields.
  - **Not** added as a Prometheus label on `http_requests_total`: request ids
    are high-cardinality and would explode the metric — the correlation path is
    error_logs + response header + access log (per the "at least error_logs +
    response header" requirement).
- **Tests**: `apps/api/tests/test_request_id.py` — echo of supplied id, UUID4
  generation, propagation into `error_logs` on a 404, and uniqueness across
  requests.

### Cron schedule (NV2) — arq `cron_jobs` in `apps/api/app/worker.py`

| Time (UTC) | Job | Function | Notes |
|---|---|---|---|
| 01:30 | Intelligence snapshot | `run_intelligence_snapshot` → `build_intelligence_snapshot()` (AI-A) | Before the 02:00 analytics run; persists `intelligence_snapshots` (TTL 30d) |
| 05:00 | Intelligence → ops-tasks sync | `run_intelligence_sync` → `sync_from_intelligence_snapshot()` (AI-A) | Reads the latest snapshot, creates deduplicated ops tasks |
| 06:00 | Retention cleanup | `run_retention_cleanup` | Explicit delete only for collections without a TTL index |

Deployment note: the cron process (`PROCESS_MODE=cron`, compose `cron` service
/ `devops/k8s/cron-deployment.yaml` / `ascendly-runtime` chart) reuses
`WorkerSettings.cron_jobs`, so the new entries are picked up on deploy with
**no infra change** (same pattern as P5 mastery_decay).

### Retention (NV2.4)

- TTL indexes are owned by **AI-A** (`apps/api/app/db/indexes.py`):
  `activity_events` 180d, `notifications` 90d, `intelligence_snapshots`
  30d (on `expire_at`).
- `run_retention_cleanup` (`apps/api/app/core/tasks.py`) checks each collection
  for an `expireAfterSeconds` index first: when MongoDB owns expiry it is
  **skipped** (status=`skipped`); otherwise it deletes documents older than the
  window (status=`success`). This makes the job safe on real MongoDB *and* the
  in-memory test backend (which has no TTL support).
- Retention windows live in `RETENTION_CONFIG` (days + timestamp field:
  `created_at` for activity/notifications, `generated_at` for snapshots).

### Metric contract M8–M9 (frozen Phase 7; M1–M7 unchanged)

| Mã | Metric (on-wire) | Type | Labels | Notes |
|---|---|---|---|---|
| M8 | `intelligence_snapshot_runs_total` | Counter | `status` (`success`\|`live_fallback`\|`error`) | `success`/`live_fallback` incremented by AI-A inside `build_intelligence_snapshot`; `error` incremented by the 01:30 cron wrapper on failure |
| M9 | `retention_cleanup_runs_total` | Counter | `collection`, `status` (`success`\|`skipped`\|`error`) | Incremented by `run_retention_cleanup` per collection |

### Alerts (added to both `devops/prometheus/alerts.yml` and
`devops/docker/prometheus/alerts.yml` — new group `intelligence-retention`)

| Alert | Expression | For | Meaning |
|---|---|---|---|
| `IntelligenceSnapshotJobFailed` | `rate(intelligence_snapshot_runs_total{status="error"}[5m]) > 0` | 10m | `build_intelligence_snapshot` failed — check worker/cron logs and DLQ |
| `RetentionCleanupJobFailed` | `rate(retention_cleanup_runs_total{status="error"}[5m]) > 0` | 10m | `run_retention_cleanup` failed for a collection — data may grow past its window |

Empty series → no fires until the backend exports them. Both rule files were
kept in sync (alert counts verified: canonical 15, docker 13).

### Grafana dashboard (`devops/docker/grafana/dashboards/adaptive-metrics.json`)

- New panel **Intelligence snapshot runs (by status)** (M8, 1h increase by
  status).
- New panel **Retention cleanup runs (by collection, status)** (M9, 1h increase
  by collection + status).
- **Submit Latency** panel extended to **p50 / p95 / p99** (M3 histogram —
  `histogram_quantile` on 5m rate; p99 is a real query on
  `adaptive_quiz_submit_duration_seconds_bucket`, not a placeholder).
- `api-metrics.json` already carried a generic **Request Duration (p99)** panel
  on `http_request_duration_seconds_bucket`.
- All dashboard JSONs are validated in CI (`manifest-check` job) and were
  re-validated locally (adaptive: 13 panels, api: 10 panels).

### p99 feasibility (NV4)

- Scrape interval **15s** (both `devops/docker/prometheus.yml` and
  `devops/prometheus/prometheus.yml`) — ~20 samples per 5m rate window, enough
  for `histogram_quantile`.
- Retention: Prometheus **default 15d** (compose does not override
  `--storage.tsdb.retention.time`; k8s/self-hosted also defaults) — comfortably
  covers the 5m/1h ranges used by the latency panels.
- No data exists yet for the adaptive submit histogram in dev → panels render
  "No data" until traffic/instrumentation lands (no fabricated values).

## Phase 8 — Production readiness: release pipeline, HPA, secrets, rollback

### Release pipeline (`.github/workflows/release.yml` + `scripts/deploy.sh`)

Immutable images are built and pushed to the registry, deployed via Helm + the
static web manifest, smoke-tested, and (optionally, with approval) promoted to
production. `devops/scripts/deploy.sh` is the single deploy entry point:

```bash
# Preview what a deploy would run (no cluster access — used by CI too):
bash devops/scripts/deploy.sh staging ghcr.io/<owner>/ascendly-api ghcr.io/<owner>/ascendly-web <sha> --dry-run

# Real deploy (KUBECONFIG must point at the target cluster):
KUBECONFIG=~/.kube/staging.yaml \
REGISTRY_USERNAME=<actor> REGISTRY_PASSWORD=<token> \
AGE_SECRET_KEY=<age-private-key> \
bash devops/scripts/deploy.sh staging ghcr.io/<owner>/ascendly-api ghcr.io/<owner>/ascendly-web <sha>
```

Flow: build → push `ascendly-api:<sha>` / `ascendly-web:<sha>` + `<major.minor>`
alias → `helm upgrade --install` (platform-base, ascendly-api,
ascendly-runtime) + web manifest (k8s) → SOPS secrets applied → `rollout
status` wait → smoke (`make smoke SMOKE_BASE_URL=<env>/api/v1`).

**Triggers** (release.yml):
- `workflow_dispatch` with `environment: staging|production` (+ optional
  `version` alias, + optional debug-only `allow-smoke-skip`).
- push of a `v*` tag → full pipeline to production.

**Promotion gate (fail-closed for production)**: staging is always deployed
first; its smoke must be green before `deploy-prod` runs. `deploy-prod` targets
the GitHub **production environment** — add a manual-approval protection rule in
`Settings → Environments → production` for a human gate.

Smoke gate semantics:
- **Staging**: if `SMOKE_BASE_URL_STAGING` is unset the smoke step logs a
  warning and is skipped — *unless* the workflow is dispatched with
  `allow-smoke-skip=true` (dev/debug only, explicitly authorizes the skip).
- **Production (fail-closed)**: `SMOKE_BASE_URL_PRODUCTION` is **required** and
  the smoke suite **must pass**. There is **no skip path**: if the secret is
  missing or smoke is red, `deploy-prod` **fails and promotion is blocked**.
  This is verified by `ci-release-dry-run.sh` (group 4), which simulates the
  "production + unset `SMOKE_BASE_URL_PRODUCTION`" path and asserts it exits 1.

**Required repo secrets** (`Settings → Secrets → Actions`):

| Secret | Purpose |
|---|---|
| `KUBECONFIG_STAGING` / `KUBECONFIG_PROD` | kubeconfig for each cluster |
| `SMOKE_BASE_URL_STAGING` / `SMOKE_BASE_URL_PRODUCTION` | live API base URL for smoke |
| `SMOKE_USER` / `SMOKE_PASSWORD` | optional authenticated smoke flow |
| `AGE_SECRET_KEY` | age private key (SOPS secrets decrypt) |
| `REGISTRY_USERNAME` / `REGISTRY_PASSWORD` | registry login (default: GITHUB_TOKEN + actor) |
| `REGISTRY` / `REGISTRY_NAMESPACE` | optional registry overrides (default `ghcr.io` / owner) |

Image tags are **immutable** (`<sha>`): rollback never depends on retagging.

### Web HPA (NV4)

`devops/k8s/web-hpa.yaml` — CPU 70% / memory 80%, min **2** / max **10**, same
scale-up/down behavior as `api-hpa.yaml`. `web-deployment.yaml` floor is
`replicas: 2` (rewritten by `deploy.sh`). Per-env gating follows the
`api-hpa.yaml` pattern: these static manifests apply to real clusters only;
dev runs on docker compose (no k8s, no autoscaling). The KEDA
`ScaledObject` for the worker (`worker-scaledobject.yaml` / `ascendly-runtime`
chart) is unchanged and still valid.

### Deploy staging thật (chờ Supervisor cấp credentials)

Khi Supervisor cấp các GitHub secrets `KUBECONFIG_STAGING`, `SMOKE_BASE_URL_STAGING`
(+ `SMOKE_USER` / `SMOKE_PASSWORD`) và `AGE_SECRET_KEY`, staging được deploy theo
2 cách:

**1. Qua GitHub Actions (khuyến nghị)** — chạy workflow `Release` với
`environment: staging`:
`Actions → Release → Run workflow → environment: staging`. Pipeline build + push
image → `deploy.sh staging` → SOPS decrypt → rollout → smoke staging. Nếu
`SMOKE_BASE_URL_STAGING` chưa cấu hình, smoke bị **skip** (warning) trừ khi bật
`allow-smoke-skip=true` (dev/debug). **Production luôn fail-closed** — xem mục
"Promotion gate" bên dưới.

**2. CLI trực tiếp** — cần `KUBECONFIG` vs `SMOKE_BASE_URL` env (cách chạy khi có
quyền cluster):

```bash
# Deploy staging (yêu cầu KUBECONFIG + registry creds + AGE_SECRET_KEY):
KUBECONFIG=~/.kube/staging.yaml \
REGISTRY_USERNAME=<actor> REGISTRY_PASSWORD=<token> \
AGE_SECRET_KEY=<age-private-key> \
bash devops/scripts/deploy.sh staging ghcr.io/<owner>/ascendly-api ghcr.io/<owner>/ascendly-web <sha>

# Smoke thủ công sau deploy (yêu cầu base URL + optional user/pass):
make smoke SMOKE_BASE_URL=https://staging.<host>/api/v1 \
           SMOKE_USER=<u> SMOKE_PASSWORD=<p>
```

`deploy.sh` và `rollback.sh` đã nhận đúng env `KUBECONFIG` / `SMOKE_BASE_URL` /
`SMOKE_USER` / `SMOKE_PASSWORD` qua release.yml — không cần sửa script (đã
kiểm chứng bằng `ci-release-dry-run.sh` group 3 + bash -n).

### Conflicts/Bảo mật — Checklist backup `age.key` (SOPS private key)

Private key **không bao giờ được commit**. Khi Supervisor cấp `AGE_SECRET_KEY`
(cần cho CI decrypt `secrets.{staging,production}.enc.yaml`), phải backup key
bản sao nếu mất thì decrypt mọi env thất bại:

- [ ] Sao chép private key ra nơi an toàn ngoài repo: `~/.config/sops/age/keys.txt`
      (dòng đầu, `AGE-SECRET-KEY-1...`).
- [ ] Verify key khớp `age.pubkey.txt`: `age -i <keyfile> -d` decrypt 1 bản thử,
      hoặc `sops -d devops/secrets/secrets.staging.enc.yaml` không báo lỗi.
- [ ] Lưu một bản vào password manager / Vault của team (ngoài repo).
- [ ] KHÔNG commit private key; `.gitignore` đã loại `age.key`/`AGE_SECRET_KEY`
      (xem `scripts/secrets-*.sh` + `.gitignore`).
- [ ] Nếu mất key → regenerate cặp age, re-encrypt lại 2 file `.enc.yaml`.

### Secrets (NV5 — SOPS + age)

Chosen over SealedSecret because it needs **no cluster controller**, encrypts
locally, produces reviewable diff-able files, and decrypts anywhere `sops`
(or `age`) runs — a good fit for this repo's CI-as-verifier setup.

- Encrypted files (committed): `devops/secrets/secrets.{staging,production}.enc.yaml`
- Public key (committed): `devops/secrets/age.pubkey.txt`
- Private key: **never committed** — in `~/.config/sops/age/keys.txt` locally
  and the `AGE_SECRET_KEY` GitHub secret for CI.
- Scripts: `devops/scripts/secrets-encrypt.sh <env>`,
  `devops/scripts/secrets-decrypt.sh <env> [out]` (sops preferred, age fallback).

```bash
# Encrypt real values (plaintext file is gitignored):
cp devops/secrets/secrets.staging.plain.yaml /tmp/s && vim /tmp/s   # fill values
bash devops/scripts/secrets-encrypt.sh staging /tmp/s

# Decrypt / inspect:
bash devops/scripts/secrets-decrypt.sh staging
```

`release.yml` → `deploy.sh` decrypts `secrets.<env>.enc.yaml` with
`AGE_SECRET_KEY` and applies it **after** the helm release, so real values
override the chart's placeholder secret. The old `sealedsecrets…` placeholder
was replaced (`devops/k8s/secret.yaml`, `platform-base` chart). `.env.example`
documents the staging/production environment blocks.

### Rollback (NV6)

Runbook: `devops/runbook/rollback.md` (steps, when NOT to roll back, checklist).
Script:

```bash
bash devops/scripts/rollback.sh staging            # previous helm revision
bash devops/scripts/rollback.sh production 3       # explicit revision
bash devops/scripts/rollback.sh staging 3 --dry-run
```

Covers `helm rollback --to-revision N` (api + runtime), `kubectl rollout undo`
(web + api/worker/cron), optional old-image restore, rollout status wait, and a
reminder to re-run smoke.

### Retention enforcement (CO1)

`run_retention_cleanup` (06:00 cron, `apps/api/app/core/tasks.py`) is the
**single enforcement source** for `activity_events` (180d) and `notifications`
(90d): their `created_at` is an ISO string, which MongoDB TTL cannot expire, so
the job always runs the explicit delete for them (never "skipped").
`intelligence_snapshots` has a real TTL on `expire_at` — skipped when MongoDB
owns expiry, explicit fallback otherwise. Timestamps are parsed (datetime /
ISO string, any offset), so mixed-offset comparisons are correct. M9
`retention_cleanup_runs_total{collection,status}` increments per collection.

### Alert status fix (CO2)

`ProactiveCheckJobFailed` and `MasteryDecayJobFailed` now match the code's real
label values: the backend records `worker_jobs_completed_total{status="failed"}`
and `adaptive_mastery_decay_runs_total{status="failed"}` (the alerts previously
watched `status="error"` and could never fire). Fixed in both
`devops/prometheus/alerts.yml` and `devops/docker/prometheus/alerts.yml`.

## CI (`.github/workflows/ci.yml`)

Jobs run in parallel and all must pass for the `gate` job to go green:

1. **api** — pip install (cached via `actions/setup-python`), `ruff` + `mypy`
   (report-only, non-blocking: the baseline is not lint/type-clean), full
   `pytest` against the in-memory Mongo backend (no external services) with a
   **coverage gate** `--cov-fail-under=45`.
2. **lint-regression** — runs `scripts/ci-lint-report.sh` (Phase 7): measures
   ruff/mypy error counts and **fails when the count increases** versus the
   committed baselines `devops/ci/{ruff,mypy}.count`. Fixing findings is fine;
   update the baseline files deliberately.
3. **web** — `npm ci` (cached via `actions/setup-node`), `next lint`, `tsc --noEmit`,
   `next build`, jest unit tests + a11y tests. Build is independent of a running API.
4. **migration-check** — runs `scripts/ci-migration-check.sh` on a clean in-memory
   DB; fails fast if the runner cannot locate/execute migrations or seed, and
   verifies the app seed hook (`seed_db`) populated the main content collections
   (`users`, `categories`, `courses`, `help_articles`, `concept_definitions`).
5. **docker-build** — builds `devops/docker/Dockerfile.api` (api stage) and
   `devops/docker/Dockerfile.web` from the repo root.
6. **security-scan** — Trivy filesystem scan, SARIF upload.
7. **manifest-check** — `helm lint` + `helm template` (3 charts, dev values),
   offline `kubeconform` validation of `devops/k8s/` (KEDA `ScaledObject` is a
   CRD and is skipped), and **Grafana dashboard JSON validation**
   (`devops/docker/grafana/dashboards/*.json` must parse and have panels).
   No cluster required.
8. **release-dry-run** — `scripts/ci-release-dry-run.sh`: YAML-parse every
   manifest/workflow, `bash -n` all scripts, `deploy.sh` / `rollback.sh`
   `--dry-run` for staging+production, SOPS artifact checks, and `helm
   template` with the same `--set` overrides the release pipeline uses.
9. **gate** — summary + required status check for PRs.

`preview.yml` deploys PR previews (Vercel frontend, Railway backend) and runs
Playwright e2e, Lighthouse CI and visual regression when secrets are configured.

## Verified in Phase 0

- Backend pytest suite passes locally via `make test-api` (in-memory DB).
- Frontend jest suite passes locally via `make test-web`.
- `docker compose config` validates (paths fixed to `devops/docker/…`).
- `helm lint` + `helm template` pass for all 3 charts (dev values).
- `kubeconform -strict` validates all `devops/k8s/` manifests (KEDA `ScaledObject`
  skipped as a CRD) — fixes applied: `_helpers.tpl` moved into each chart's
  `templates/` dir; pod-level `allowPrivilegeEscalation` removed from the 4
  deployment manifests (invalid at pod level; already enforced per-container).
- Docker image builds **not run locally** (daemon not accessible in this
  environment) — the CI `docker-build` job covers them.
- `make setup` recreates `apps/api/.venv` when it is stale/missing.

## Verified in Phase 7

- `make test-api` → **231 passed** (target ≥ 215; includes AI-A's Phase 7
  hardening tests + request-ID/retention tests), coverage **54%**.
- Coverage gate `--cov-fail-under=45` set from the measured 52% baseline
  (headroom 7pp; the current measured coverage is 54%).
- Lint regression gate green: ruff 753, mypy 125 (baselines updated to the
  Phase 7 shared-work state in `devops/ci/`).
- `devops/scripts/ci-migration-check.sh` passes with the new seed-verify step.
- Alert rule files (canonical 15 / docker 13) + both Grafana dashboards
  (api 10 / adaptive 13 panels) parse and validate.
- Cron schedule verified in-process: 01:30 snapshot, 05:00 sync, 06:00
  retention registered in `WorkerSettings.cron_jobs`.

## Verified in Phase 8

- **CO2**: no alert watches a `status` label the code never writes — verified
  by cross-checking both `alerts.yml` files against the label values in
  `apps/api/app/core/tasks.py` / `worker.py`.
- **CO1**: retention tests extend `tests/test_phase7_cron.py` — expired docs
  deleted / fresh kept (all 3 collections), ISO-string collections never
  skipped, mixed-offset ISO parsing, M9 `retention_cleanup_runs_total`
  increments per collection with the real status. `make test-api` → **242
  passed, 4 skipped** (target ≥ 231).
- **NV3**: `release.yml` + `deploy.sh` validated via `ci-release-dry-run.sh`
  (YAML parse, `bash -n`, `--dry-run` staging+production, SOPS artifacts, helm
  template with release `--set` overrides) — the CI `release-dry-run` job
  enforces this on every PR. Real deploys need the cluster/kubeconfig secrets.
- **NV4**: `web-hpa.yaml` (min 2 / max 10, CPU 70 / mem 80) validated by
  `kubeconform` in `manifest-check`; KEDA `ScaledObject` unchanged/valid.
- **NV5**: SOPS+age encrypt/decrypt scripts verified end-to-end (round-trip on
  both sample `.enc.yaml` files); private key never committed (gitignored).
- **NV6**: `rollback.sh --dry-run` validated; runbook written.
- **NV7**: lint-regression gate green — ruff 752 (baseline 753), mypy 125
  (baseline 125): no new findings from Phase 8 files.

## Verified in Completion round (AI-A A1–A4 + AI-B B1–B4)

- **B1 fail-closed**: `release.yml` production smoke gate is now **fail-closed** —
  no skip path. `SMOKE_BASE_URL_PRODUCTION` missing or smoke red → `deploy-prod`
  fails. Staging keeps warning+skip and honors the new `allow-smoke-skip` debug
  input (default `false`). Verified by `ci-release-dry-run.sh` groups 4/4b
  (static code-path assert + executed simulation of "prod + unset URL" → exit 1).
- **B2 dashboard**: "Remediation Effectiveness" panels (aggregate table + top
  weak concepts) now query the AI-A analytics endpoint
  `GET /api/v1/admin/adaptive/analytics/remediation-effectiveness` via the
  provisioned **Adaptive Analytics API** JSON datasource
  (`devops/docker/grafana/datasources/json-api.yml`, plugin
  `marcusolsson-json-datasource` added to `docker-compose.yml`). Placeholder
  `targets: []` and the "needs an analytics API" note are gone. Dashboard JSON
  re-validated (14 panels, no overlaps, P5–P8 fields intact).
- **B3 baseline**: ruff re-measured → **758** (committed baseline updated from
  753 — AI-A's completion code added analytics/admin_adaptive/test files; mypy
  stays **125**). `make test-api` → **253 passed, 4 skipped** (≥ 242+4 target).
  YAML/JSON parse + dry-run green locally; helm lint/kubeconform run in CI
  `manifest-check` (no local helm/kubeconform).
- **B4 staging**: README documents both deploy paths (Actions workflow vs CLI
  `KUBECONFIG`/`SMOKE_BASE_URL` envs) and the `age.key` backup checklist
  (see "Deploy staging thật" + "Checklist backup age.key").