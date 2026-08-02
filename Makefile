# ── Ascendly — Phase 0 Local Dev Tooling ─────────────────────────────────────
# Repo-root Makefile for local development (Linux / macOS).
#
#   Backend : apps/api   (Python 3.11, venv at apps/api/.venv)
#   Frontend: apps/web   (Node 20+, npm with package-lock.json)
#
# Infra Dockerfiles live in devops/docker/ (repo tracks infra under devops/).
# Docker contexts are the repo root, so `docker compose` must run from here.

PYTHON     ?= python3
API_DIR    := apps/api
WEB_DIR    := apps/web
VENV       := $(abspath $(API_DIR)/.venv)
VENV_PY    := $(VENV)/bin/python
# Prefer the project venv when present, otherwise fall back to system python3.
# NOTE: paths are abspath so targets that `cd` into apps/ still resolve them.
API_PY     := $(if $(wildcard $(VENV_PY)),$(VENV_PY),$(PYTHON))

# Post-deploy smoke suite base URL (override with `make smoke SMOKE_BASE_URL=https://staging...`).
SMOKE_BASE_URL ?= http://localhost:8000/api/v1

.PHONY: help setup compose-up compose-up-all compose-down \
        test-api test-web build-api build-web lint migrate seed-support \
        smoke dev dev-api dev-web

help: ## Show available targets
	@echo "Ascendly local dev tooling — Phase 0"
	@echo ""
	@echo "  make setup           Install deps: pip (apps/api) + npm ci (apps/web)"
	@echo "  make compose-up      Start infra (mongo, redis, meilisearch, mailpit) in Docker"
	@echo "  make compose-up-all  Start ALL compose services (infra + api + web + observability)"
	@echo "  make compose-down    Stop and remove compose services"
	@echo "  make test-api        Run backend pytest suite (in-memory DB, no external services)"
	@echo "  make test-web        Run frontend unit tests"
	@echo "  make smoke           Run post-deploy smoke suite against a live API (SMOKE_BASE_URL)"
	@echo "  make build-api       Compile-check backend modules (py_compile)"
	@echo "  make build-web       Build Next.js production bundle"
	@echo "  make lint            Lint backend (ruff, if installed) + frontend (next lint)"
	@echo "  make migrate         Run documented DB migrations + seed (apps/api/migrations/README.md)"
	@echo "  make seed-support    Seed dev support data (articles, tickets, messages) — idempotent"
	@echo "  make dev             Run api (8000) + web (3000) dev servers concurrently"
	@echo "  make dev-api         Run only the FastAPI dev server"
	@echo "  make dev-web         Run only the Next.js dev server"

setup: ## Install backend + frontend dependencies
	@if [ ! -d "$(VENV)" ]; then echo "Creating venv at $(VENV)…"; $(PYTHON) -m venv $(VENV); fi
	$(VENV_PY) -m pip install --upgrade pip
	$(VENV_PY) -m pip install -r $(API_DIR)/requirements.txt
	@echo "Backend deps installed ✓"
	cd $(WEB_DIR) && npm ci
	@echo "Frontend deps installed ✓"

compose-up: ## Start infra services (mongo, redis, meilisearch, mailpit)
	docker compose up -d mongo redis meilisearch mailpit
	@echo "Infra ready: MongoDB :27017 | Redis :6379 | MeiliSearch :7700 | Mailpit UI http://localhost:8025"

compose-up-all: ## Start every compose service (infra + app + observability)
	docker compose up -d

compose-down: ## Stop and remove compose services (data volumes kept)
	docker compose down

test-api: ## Run backend pytest suite (hermetic, in-memory Mongo via conftest)
	cd $(API_DIR) && MONGODB_URI=memory://test $(API_PY) -m pytest tests/ -q

test-web: ## Run frontend unit tests
	cd $(WEB_DIR) && npm test -- --ci

smoke: ## Run post-deploy smoke suite against a live API (SMOKE_BASE_URL, default http://localhost:8000/api/v1)
	cd $(API_DIR) && MONGODB_URI=memory://test SMOKE_BASE_URL=$(SMOKE_BASE_URL) $(API_PY) -m pytest tests/test_smoke.py -q

build-api: ## Compile-check all backend modules (no server start)
	cd $(API_DIR) && $(API_PY) -m compileall -q app scripts
	@echo "OK: backend modules compile"

build-web: ## Build Next.js production bundle
	cd $(WEB_DIR) && npm run build

lint: ## Lint backend (ruff if present) + frontend (next lint)
	@if [ -x "$(VENV)/bin/ruff" ]; then cd $(API_DIR) && "$(VENV)/bin/ruff" check .; else echo "SKIP backend lint: ruff not installed (run: $(VENV_PY) -m pip install ruff)"; fi
	cd $(WEB_DIR) && npm run lint

migrate: ## Run documented migrations + seed (see apps/api/migrations/README.md)
	cd $(API_DIR) && $(API_PY) -m app.core.cli migrate 001_seed_categories
	cd $(API_DIR) && $(API_PY) -m app.core.cli migrate 002_add_indexes
	cd $(API_DIR) && $(API_PY) -m app.core.cli seed

seed-support: ## Seed dev support data (help_articles, support_tickets, ticket_messages) — idempotent
	$(API_PY) devops/scripts/seed_support.py

dev: ## Run API (8000) + Web (3000) dev servers concurrently
	@echo "Starting API  → http://localhost:8000"
	@echo "Starting Web  → http://localhost:3000"
	@trap 'kill 0' INT TERM EXIT; \
	(cd $(API_DIR) && $(API_PY) -m uvicorn app.main:app --reload --port 8000) & \
	(cd $(WEB_DIR) && npm run dev) & \
	wait

dev-api: ## Run only the FastAPI dev server
	cd $(API_DIR) && $(API_PY) -m uvicorn app.main:app --reload --port 8000

dev-web: ## Run only the Next.js dev server
	cd $(WEB_DIR) && npm run dev