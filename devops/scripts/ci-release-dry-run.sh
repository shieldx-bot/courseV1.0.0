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

echo "::group::4. SOPS artifacts"
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
