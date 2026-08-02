# Ascendly — DevOps (Phase 0)

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
make compose-up     # docker compose up -d mongo redis meilisearch (infra only)
make compose-down   # docker compose down
make test-api       # cd apps/api && pytest tests/ -q   (hermetic: in-memory Mongo)
make test-web       # cd apps/web && npm test -- --ci
make build-api      # compileall check of backend modules
make build-web      # next build
make lint           # ruff (backend, if installed) + next lint (frontend)
make migrate        # documented migration runner + seed (see apps/api/migrations/README.md)
make dev            # API (8000) + Web (3000) dev servers concurrently
make dev-api        # only FastAPI dev server   (http://localhost:8000)
make dev-web        # only Next.js dev server   (http://localhost:3000)
```

> Note: `make migrate` uses the real runner (`app.core.cli` with full migration
> names). See `apps/api/migrations/README.md` for the known runner limitations
> recorded in Phase 0.

## CI (`.github/workflows/ci.yml`)

Jobs run in parallel and all must pass for the `gate` job to go green:

1. **api** — pip install (cached via `actions/setup-python`), `ruff`, `mypy`,
   full `pytest` against the in-memory Mongo backend (no external services).
2. **web** — `npm ci` (cached via `actions/setup-node`), `next lint`, `tsc --noEmit`,
   `next build`, jest unit tests + a11y tests. Build is independent of a running API.
3. **migration-check** — runs `scripts/ci-migration-check.sh` on a clean in-memory
   DB; fails fast if the runner cannot locate/execute migrations or seed.
4. **docker-build** — builds `devops/docker/Dockerfile.api` (api stage) and
   `devops/docker/Dockerfile.web` from the repo root.
5. **security-scan** — Trivy filesystem scan, SARIF upload.
6. **gate** — summary + required status check for PRs.

`preview.yml` deploys PR previews (Vercel frontend, Railway backend) and runs
Playwright e2e, Lighthouse CI and visual regression when secrets are configured.

## Verified in Phase 0

- Backend pytest suite passes locally via `make test-api` (in-memory DB).
- Frontend jest suite passes locally via `make test-web`.
- `docker compose config` validates (paths fixed to `devops/docker/…`).
- `kubectl` / `helm` were **not available** in this environment; manifests were
  validated as YAML only. Docker daemon was not accessible for image builds.
  See the Phase 0 report for details.