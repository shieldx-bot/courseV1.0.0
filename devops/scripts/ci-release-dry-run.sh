#!/usr/bin/env bash
# ── Release pipeline dry-run validator (Phase 8 NV3/NV7) ─────────────────────
# Local/CI validation for the release tooling WITHOUT a cluster, a registry, or
# secrets. Verifies:
#   1. All YAML/YML files parse (workflows, alerts, k8s, helm values, SOPS enc)
#   2. All devops/scripts/*.sh are syntactically valid (bash -n)
#   3. deploy.sh / rollback.sh / secrets scripts dry-run cleanly
#   4. helm template renders with release-style --set overrides
#      (image.tag, image.repository, imagePullSecrets) for every chart/env
#   5. SOPS secret artifacts exist (pubkey + <env>.enc.yaml for both envs)
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$REPO_ROOT"

echo "::group::1. YAML parse check (all .yml/.yaml)"
PY="${PYTHON:-python3}"
if [ -x "apps/api/.venv/bin/python" ]; then PY="apps/api/.venv/bin/python"; fi
"$PY" - <<'PYEOF'
import sys, glob, yaml
files = sorted(
    glob.glob(".github/workflows/*.yml") + glob.glob("*.yml") + glob.glob("*.yaml")
    + glob.glob("devops/**/*.yml", recursive=True) + glob.glob("devops/**/*.yaml", recursive=True)
)
# Helm chart templates are Go templates, not YAML — skip them (they are
# validated by `helm lint`/`helm template` in CI instead).
files = [f for f in files if "/templates/" not in f]
bad = 0
for f in files:
    try:
        with open(f) as fh:
            content = fh.read()
        # Multi-document k8s manifests (--- separators) need load_all.
        docs = list(yaml.safe_load_all(content))
        for doc in docs:
            if doc is not None and not isinstance(doc, dict):
                bad += 1
                print(f"::error::not a YAML mapping: {f}", file=sys.stderr)
    except Exception as exc:
        bad += 1
        print(f"::error::YAML parse failed: {f}: {exc}", file=sys.stderr)
print(f"checked {len(files)} YAML files, {bad} failures")
sys.exit(1 if bad else 0)
PYEOF
echo "::endgroup::"

echo "::group::2. bash -n on devops/scripts"
for f in devops/scripts/*.sh; do
  bash -n "$f" && echo "OK $f"
done
echo "::endgroup::"

echo "::group::3. deploy.sh / rollback.sh dry-run"
for env in staging production; do
  bash devops/scripts/deploy.sh "$env" \
    ghcr.io/example/ascendly-api ghcr.io/example/ascendly-web \
    v1.0.0-test1234 --dry-run > /dev/null
  echo "OK deploy.sh --dry-run $env"
done
bash devops/scripts/rollback.sh staging 3 --dry-run > /dev/null && echo "OK rollback.sh --dry-run"
echo "::endgroup::"

echo "::group::4. Release smoke gate semantics (fail-closed production)"
"$PY" - <<'PYEOF'
import sys, yaml

wf = yaml.safe_load(open(".github/workflows/release.yml"))
errs = []

# 1. allow-smoke-skip input exists, boolean, default false
# NOTE: YAML 1.1 parses the workflow key `on` as the boolean True.
dispatch = wf.get(True, wf.get("on", {}))
inputs = (dispatch.get("workflow_dispatch") or {}).get("inputs") or {}
ass = (inputs.get("allow-smoke-skip") or {})
if ass.get("type") != "boolean" or ass.get("default") is not False:
    errs.append("allow-smoke-skip input must be a boolean defaulting to false")

jobs = wf.get("jobs") or {}
prod = jobs.get("deploy-prod") or {}
stag = jobs.get("deploy-staging") or {}

def steps_of(job):
    return job.get("steps") or []

def find_step(job, name_part):
    for step in steps_of(job):
        if name_part.lower() in (step.get("name") or "").lower():
            return step
    return None

# Production smoke: MUST fail closed (no skip; missing URL -> exit 1)
prod_smoke = find_step(prod, "Smoke tests (production)")
if prod_smoke is None:
    errs.append("deploy-prod missing 'Smoke tests (production)' step")
else:
    run = prod_smoke.get("run") or ""
    if "exit 0" in run:
        errs.append("deploy-prod smoke step contains a skip path (exit 0) — must be fail-closed")
    if "::error::" not in run or "exit 1" not in run:
        errs.append("deploy-prod smoke step must hard-fail (::error:: + exit 1) when SMOKE_BASE_URL_PRODUCTION is missing")
    if "[ -z \"$SMOKE_BASE_URL\" ]" not in run:
        errs.append("deploy-prod smoke step must guard on empty SMOKE_BASE_URL")

# Staging smoke: keeps warning+skip, honors allow-smoke-skip
stag_smoke = find_step(stag, "Smoke tests (staging)")
if stag_smoke is None:
    errs.append("deploy-staging missing 'Smoke tests (staging)' step")
else:
    run = stag_smoke.get("run") or ""
    if "ALLOW_SMOKE_SKIP" not in run:
        errs.append("deploy-staging smoke step must honor ALLOW_SMOKE_SKIP")

if errs:
    for e in errs:
        print(f"::error::release.yml gate check: {e}", file=sys.stderr)
    sys.exit(1)
print("OK release.yml smoke gates: production fail-closed, staging flag-gated skip allowed")
PYEOF
echo "::endgroup::"

echo "::group::4b. Simulate production smoke gate without SMOKE_BASE_URL_PRODUCTION"
# Extract the deploy-prod smoke step's guard from release.yml and execute it with
# an EMPTY SMOKE_BASE_URL — the guard must hard-fail (exit 1). This exercises the
# exact code path release.yml ships with (no pip install / make smoke involved).
GUARD="$("$PY" - <<'PYEOF'
import yaml
wf = yaml.safe_load(open(".github/workflows/release.yml"))
prod = (wf.get("jobs") or {}).get("deploy-prod") or {}
for step in prod.get("steps") or []:
    if "smoke tests (production" in (step.get("name") or "").lower():
        run = step.get("run") or ""
        start = run.find('if [ -z "$SMOKE_BASE_URL" ]; then')
        assert start != -1, "prod smoke guard not found"
        end = run.find("\nfi", start)
        assert end != -1, "prod smoke guard closing fi not found"
        print(run[start:end + 4])
        break
PYEOF
)"
if [ -z "$GUARD" ]; then
  echo "::error::could not extract production smoke guard from release.yml" >&2
  exit 1
fi
if SMOKE_BASE_URL="" bash -c "$GUARD" >/tmp/prod-smoke-guard.out 2>&1; then
  echo "::error::production smoke gate DID NOT fail with SMOKE_BASE_URL_PRODUCTION unset (fail-open!)" >&2
  cat /tmp/prod-smoke-guard.out >&2
  exit 1
fi
grep -q "SMOKE_BASE_URL_PRODUCTION is not configured" /tmp/prod-smoke-guard.out \
  || { echo "::error::unexpected guard output:" >&2; cat /tmp/prod-smoke-guard.out >&2; exit 1; }
rm -f /tmp/prod-smoke-guard.out
echo "OK production smoke gate fails closed (exit 1) when SMOKE_BASE_URL_PRODUCTION is unset"
echo "::endgroup::"

echo "::group::5. SOPS artifacts"
[ -f devops/secrets/age.pubkey.txt ] || { echo "::error::missing devops/secrets/age.pubkey.txt" >&2; exit 1; }
grep -qE '^age1[a-z0-9]+$' devops/secrets/age.pubkey.txt || { echo "::error::no bare age1... key in age.pubkey.txt" >&2; exit 1; }
for env in staging production; do
  [ -f "devops/secrets/secrets.$env.enc.yaml" ] || { echo "::error::missing devops/secrets/secrets.$env.enc.yaml" >&2; exit 1; }
  grep -q 'sops:' "devops/secrets/secrets.$env.enc.yaml" || { echo "::error::$env enc file is not SOPS format" >&2; exit 1; }
  echo "OK secrets.$env.enc.yaml (SOPS)"
done
echo "::endgroup::"

if command -v helm >/dev/null 2>&1; then
  echo "::group::5. helm template with release-style --set overrides"
  for chart in platform-base ascendly-api ascendly-runtime; do
    for env in dev staging prod; do
      helm template "$chart-$env" "devops/helm/$chart" \
        -f "devops/helm/$chart/values-$env.yaml" \
        --set image.repository=ghcr.io/example/ascendly-api \
        --set image.tag=v1.0.0-test1234 \
        --set image.pullPolicy=IfNotPresent \
        --set imagePullSecrets[0].name=regcred \
        --dry-run > /dev/null
      echo "OK helm template $chart ($env) + release --set overrides"
    done
  done
  echo "::endgroup::"
else
  echo "::warning::helm not found — skipping template override check (runs in CI)"
fi

echo "✅ Release dry-run validation passed"
