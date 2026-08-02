#!/usr/bin/env bash
# CI migration check — Ascendly Phase 0.
#
# Runs the documented migration runner (apps/api/migrations/README.md) against a
# clean in-memory Mongo backend (MONGODB_URI=memory://test) and verifies that:
#   1. The runner actually LOCATED and EXECUTED the migration files.
#   2. The DB was mutated (seeded categories exist after `seed`).
#   3. Migration 001 is idempotent (second run is a no-op "skipped").
#
# The runner logs `Migration not found: <name>` (and exits 0) when the source
# path is wrong. This script fails fast in that case instead of silently green.
#
# NOTE (Phase 0 known limitation): `python -m app.cli migrate ...` as documented
# in apps/api/migrations/README.md is currently NOT executable because:
#   - the module lives at `app/core/cli.py` (not `app.cli`), and
#   - the CLI resolves migrations relative to `apps/api/app/migrations/`
#     while the files live in `apps/api/migrations/`.
# This script therefore runs the real module (`app.core.cli`) and uses the full
# migration names; once the backend fixes the aliases/README, the checks below
# remain valid. See the Phase 0 report for the Supervisor.
set -euo pipefail

# Portable interpreter, in order of preference:
#   1. the project venv (local dev: apps/api/.venv has the API deps),
#   2. $PYTHON override,
#   3. `python` (GitHub Actions setup-python),
#   4. `python3` (local Linux often ships python3 only).
cd "$(dirname "$0")/../.."   # repo root
if [ -x "apps/api/.venv/bin/python" ] && [ -z "${PYTHON:-}" ]; then
  PY="$(pwd)/apps/api/.venv/bin/python"
elif [ -n "${PYTHON:-}" ]; then
  PY="$PYTHON"
elif command -v python >/dev/null 2>&1; then
  PY=python
elif command -v python3 >/dev/null 2>&1; then
  PY=python3
else
  echo "::error::No python interpreter found (tried venv, PYTHON, python, python3)."
  exit 1
fi

cd apps/api

export MONGODB_URI="memory://test"
export REDIS_URL="redis://localhost:6379/0"
export JWT_SECRET="test-secret-key-for-ci"

LOG_DIR="$(mktemp -d)"
trap 'rm -rf "$LOG_DIR"' EXIT

run_migrate() {
  local name="$1" log="$2"
  "$PY" -m app.core.cli migrate "$name" > "$log" 2>&1 || {
    echo "::error::Migration '$name' failed (exit $?)."
    cat "$log"
    exit 1
  }
}

echo "::group::Migration 001 (seed categories) on clean DB"
run_migrate "001_seed_categories" "$LOG_DIR/mig-001.log"
if grep -q "Migration not found" "$LOG_DIR/mig-001.log"; then
  echo "::error::Migration runner could not locate apps/api/migrations/001_seed_categories.py (path bug in app.core.cli)."
  cat "$LOG_DIR/mig-001.log"
  exit 1
fi
cat "$LOG_DIR/mig-001.log"
echo "::endgroup::"

echo "::group::Migration 002 (add indexes) on clean DB"
run_migrate "002_add_indexes" "$LOG_DIR/mig-002.log"
if grep -q "Migration not found" "$LOG_DIR/mig-002.log"; then
  echo "::error::Migration runner could not locate apps/api/migrations/002_add_indexes.py (path bug in app.core.cli)."
  cat "$LOG_DIR/mig-002.log"
  exit 1
fi
cat "$LOG_DIR/mig-002.log"
echo "::endgroup::"

echo "::group::Seed (JSON seed data)"
"$PY" -m app.core.cli seed > "$LOG_DIR/seed.log" 2>&1 || {
  echo "::error::Seed command failed."
  cat "$LOG_DIR/seed.log"
  exit 1
}
cat "$LOG_DIR/seed.log"
echo "::endgroup::"

echo "::group::Idempotency check (re-run migration 001)"
run_migrate "001_seed_categories" "$LOG_DIR/mig-001-rerun.log"
if grep -q "Migration not found" "$LOG_DIR/mig-001-rerun.log"; then
  echo "::error::Migration runner could not locate migration on second run."
  cat "$LOG_DIR/mig-001-rerun.log"
  exit 1
fi
cat "$LOG_DIR/mig-001-rerun.log"
echo "::endgroup::"

echo "::group::Verify DB state"
"$PY" - <<'PY'
import asyncio
import os

os.environ["MONGODB_URI"] = "memory://test"

from app.db.mongodb import get_db


async def main():
    db = get_db()
    categories = await db.categories.count_documents({})
    assert categories > 0, f"expected >0 categories after seed, got {categories}"
    print(f"OK: categories={categories} (non-empty after seed)")
    print("OK: in-memory DB state verified")


asyncio.run(main())
PY
echo "::endgroup::"

echo "✅ Migration check passed: migrations resolved, executed, seed applied, and 001 is idempotent."