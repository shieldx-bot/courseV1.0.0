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
# NOTE: the in-memory Mongo backend is process-local, so state cannot survive
# across separate CLI invocations. Idempotency + final DB state are therefore
# verified in a single Python process (see "Verify DB state" below).
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

echo "::group::CLI smoke — python -m app.core.cli migrate 001_seed_categories"
run_migrate "001_seed_categories" "$LOG_DIR/mig-001.log"
if grep -q "Migration not found" "$LOG_DIR/mig-001.log"; then
  echo "::error::Migration runner could not locate apps/api/migrations/001_seed_categories.py."
  cat "$LOG_DIR/mig-001.log"
  exit 1
fi
grep -E "Migration 001_seed_categories result:" "$LOG_DIR/mig-001.log" || {
  echo "::error::CLI migration 001 produced no result — runner did not execute."
  cat "$LOG_DIR/mig-001.log"
  exit 1
}
cat "$LOG_DIR/mig-001.log"
echo "::endgroup::"

echo "::group::CLI smoke — python -m app.core.cli migrate 002_add_indexes"
run_migrate "002_add_indexes" "$LOG_DIR/mig-002.log"
if grep -q "Migration not found" "$LOG_DIR/mig-002.log"; then
  echo "::error::Migration runner could not locate apps/api/migrations/002_add_indexes.py."
  cat "$LOG_DIR/mig-002.log"
  exit 1
fi
grep -E "Migration 002_add_indexes result:" "$LOG_DIR/mig-002.log" || {
  echo "::error::CLI migration 002 produced no result — runner did not execute."
  cat "$LOG_DIR/mig-002.log"
  exit 1
}
cat "$LOG_DIR/mig-002.log"
echo "::endgroup::"

echo "::group::CLI smoke — python -m app.core.cli seed"
"$PY" -m app.core.cli seed > "$LOG_DIR/seed.log" 2>&1 || {
  echo "::error::Seed command failed."
  cat "$LOG_DIR/seed.log"
  exit 1
}
cat "$LOG_DIR/seed.log"
echo "::endgroup::"

echo "::group::Verify DB state (in-process — memory:// is process-local)"
"$PY" - <<'PY'
import asyncio
import os

os.environ["MONGODB_URI"] = "memory://test"

from app.core.cli import run_migration, run_seed
from app.db.mongodb import get_db


async def main():
    db = get_db()

    # Fresh run on clean DB -> inserts 7 categories.
    await run_migration("001_seed_categories")
    categories = await db.categories.count_documents({})
    assert categories == 7, f"expected 7 categories after 001, got {categories}"

    # Re-run -> idempotent (still 7, no duplicates).
    await run_migration("001_seed_categories")
    categories = await db.categories.count_documents({})
    assert categories == 7, f"expected 7 categories after re-run (idempotent), got {categories}"

    # Indexes.
    await run_migration("002_add_indexes")

    # Seed -> categories already present (no dup), tiers inserted (5).
    await run_seed()
    categories = await db.categories.count_documents({})
    tiers = await db.tiers.count_documents({})
    assert categories == 7, f"expected 7 categories after seed, got {categories}"
    assert tiers == 5, f"expected 5 tiers, got {tiers}"
    print(f"OK: categories={categories}, tiers={tiers}")
    print("OK: 001 inserted once then skipped -> idempotent; seed idempotent")
    print("OK: in-memory DB state verified")

    # Phase 7 NV3: verify the app startup seed hook (seed_db) actually runs on
    # a clean DB — main content collections must be non-empty or the API would
    # boot with an empty catalog/support base. Fail if seed didn't run.
    from app.db.mongodb import seed_db
    await seed_db()
    for col in ("users", "categories", "courses", "help_articles", "concept_definitions"):
        n = await db[col].count_documents({})
        assert n > 0, f"seed_db did not seed {col}: count={n}"
    print("OK: seed_db seeded users/categories/courses/help_articles/concept_definitions")


asyncio.run(main())
PY
echo "::endgroup::"

echo "✅ Migration check passed: CLI executes, migrations+seed run, 001 is idempotent, and seed_db verified."