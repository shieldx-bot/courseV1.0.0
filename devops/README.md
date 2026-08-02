# Ascendly — DevOps (Phase 0 → Phase 3)

Infrastructure, CI/CD, and local developer tooling for the Ascendly monorepo.

## Layout

| Path | Purpose |
|---|---|
| `docker/` | Dockerfiles (`Dockerfile.api`, `Dockerfile.web`) + local observability config (`prometheus.yml`, `grafana/`) |
| `helm/` | Helm charts: `platform-base`, `ascendly-api`, `ascendly-runtime` |
| `k8s/` | Hardened Kubernetes manifests (namespaces, network policies, PDBs, HPA, RBAC…) |
| `prometheus/` | Prometheus alerting rules |
| `scripts/` | CI helper scripts (e.g. `ci-migration-check.sh`) |
| `.github/workflows/` | CI + Preview deployment workflows (repo root) |

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
  `worker_jobs_completed_total{task="run_proactive_support_checks",status="error"}`.
- **Grafana** (`devops/docker/grafana/dashboards/api-metrics.json`): LLM
  panels + proactive run / email-sent panels.
- **Backend dependency**: `worker_jobs_completed_total` is defined in
  `apps/api/app/core/telemetry.py` but the arq hooks
  (`on_job_complete`/`on_job_failed` in `apps/api/app/worker.py` are `None`)
  are not wired and the worker/cron process does not serve `/metrics` (only
  the API process does, and Prometheus scrapes `api:8000`). For the proactive
  alert and dashboard panels to go live, the backend must (a) wire the arq
  hooks to increment `worker_jobs_completed_total{task,status}` (or export a
  dedicated `proactive_checks_total{status}` counter), and (b) expose those
  counters on a scraped `/metrics` endpoint (e.g. start a metrics HTTP server
  in the worker/cron runtime and add a scrape target).

## CI (`.github/workflows/ci.yml`)

Jobs run in parallel and all must pass for the `gate` job to go green:

1. **api** — pip install (cached via `actions/setup-python`), `ruff` + `mypy`
   (report-only, non-blocking: the baseline is not lint/type-clean), full
   `pytest` against the in-memory Mongo backend (no external services).
2. **web** — `npm ci` (cached via `actions/setup-node`), `next lint`, `tsc --noEmit`,
   `next build`, jest unit tests + a11y tests. Build is independent of a running API.
3. **migration-check** — runs `scripts/ci-migration-check.sh` on a clean in-memory
   DB; fails fast if the runner cannot locate/execute migrations or seed.
4. **docker-build** — builds `devops/docker/Dockerfile.api` (api stage) and
   `devops/docker/Dockerfile.web` from the repo root.
5. **security-scan** — Trivy filesystem scan, SARIF upload.
6. **manifest-check** — `helm lint` + `helm template` (3 charts, dev values) and
   offline `kubeconform` validation of `devops/k8s/` (KEDA `ScaledObject` is a
   CRD and is skipped). No cluster required.
7. **gate** — summary + required status check for PRs.

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