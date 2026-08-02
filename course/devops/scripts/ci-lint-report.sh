#!/usr/bin/env bash
# CI lint regression report — Phase 7 NV3.
#
# The repo baseline is NOT lint/type clean (ruff 746 findings, mypy 129 errors
# on 2026-08-02), so ruff/mypy stay non-blocking *reporting* steps. This script
# turns them into a regression gate instead: it runs both tools, parses the
# "Found N errors" summary line, and FAILS the build when the error count goes
# UP versus the committed baselines (devops/ci/{ruff,mypy}.count).
#
# Decreasing the count is fine (encouraged) — update the baseline files when a
# cleanup lands so the next regression is measured against the new floor.
set -uo pipefail

cd "$(dirname "$0")/../.."   # repo root

# Portable interpreter, in order of preference (same as ci-migration-check.sh).
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

RUFF_BASE="$(pwd)/devops/ci/ruff.count"
MYPY_BASE="$(pwd)/devops/ci/mypy.count"

cd apps/api
OUT_DIR="$(mktemp -d)"
trap 'rm -rf "$OUT_DIR"' EXIT

count_errors() {
  # Extract the integer from a "Found N errors in M files" / "Found N errors" line.
  local file="$1"
  grep -oE "Found [0-9]+ errors" "$file" 2>/dev/null | grep -oE "[0-9]+" | tail -1 || true
}

FAILED=0

echo "::group::ruff check (report)"
"$PY" -m ruff check . > "$OUT_DIR/ruff.out" 2>&1
RUFF_RC=$?
cat "$OUT_DIR/ruff.out"
echo "::endgroup::"
if [ -s "$OUT_DIR/ruff.out" ] && ! grep -qE "Found [0-9]+ errors" "$OUT_DIR/ruff.out"; then
  # ruff ran but found 0 errors (its "All checks passed!" output has no count line)
  RUFF_COUNT=0
else
  RUFF_COUNT="$(count_errors "$OUT_DIR/ruff.out")"
fi
if [ -z "$RUFF_COUNT" ]; then
  echo "::error::ruff produced no parseable error count (rc=$RUFF_RC). Gate cannot verify."
  RUFF_COUNT=99999
  FAILED=1
fi
RUFF_BASE_COUNT="$(cat "$RUFF_BASE")"
echo "ruff errors: $RUFF_COUNT (baseline $RUFF_BASE_COUNT)"
if [ "$RUFF_COUNT" -gt "$RUFF_BASE_COUNT" ]; then
  echo "::error::ruff regression: $RUFF_COUNT errors > baseline $RUFF_BASE_COUNT. Fix new findings or update devops/ci/ruff.count after a deliberate cleanup."
  FAILED=1
fi

echo "::group::mypy app (report)"
"$PY" -m mypy app > "$OUT_DIR/mypy.out" 2>&1
MYPY_RC=$?
cat "$OUT_DIR/mypy.out"
echo "::endgroup::"
MYPY_COUNT="$(count_errors "$OUT_DIR/mypy.out")"
if [ -z "$MYPY_COUNT" ]; then
  echo "::error::mypy produced no parseable error count (rc=$MYPY_RC). Gate cannot verify."
  MYPY_COUNT=99999
  FAILED=1
fi
MYPY_BASE_COUNT="$(cat "$MYPY_BASE")"
echo "mypy errors: $MYPY_COUNT (baseline $MYPY_BASE_COUNT)"
if [ "$MYPY_COUNT" -gt "$MYPY_BASE_COUNT" ]; then
  echo "::error::mypy regression: $MYPY_COUNT errors > baseline $MYPY_BASE_COUNT. Fix new findings or update devops/ci/mypy.count after a deliberate cleanup."
  FAILED=1
fi

if [ "$FAILED" -eq 1 ]; then
  echo "::error::Lint regression detected (ruff=$RUFF_COUNT vs $RUFF_BASE_COUNT, mypy=$MYPY_COUNT vs $MYPY_BASE_COUNT)."
  exit 1
fi

echo "✅ Lint regression check passed: ruff=$RUFF_COUNT, mypy=$MYPY_COUNT (no increase vs baselines)."
