#!/usr/bin/env bash
# ── Ascendly rollback (Phase 8 NV6) ───────────────────────────────────────────
# Rolls the Ascendly stack back to a previous release:
#   - helm rollback ascendly-api / ascendly-runtime / platform-base (--to-revision N)
#   - kubectl rollout undo for the static web manifest
#   - optional explicit image-tag restore (kubectl set image)
#   - rollout status wait
#
# Usage:
#   bash devops/scripts/rollback.sh <staging|production> [helm-revision] [--dry-run]
#
#   helm-revision  (optional) helm revision to roll back to. When omitted,
#                  --to-revision is not passed → helm rolls back one revision.
#   --dry-run      print commands without touching a cluster (CI validation).
#
# Examples:
#   bash devops/scripts/rollback.sh staging             # previous revision
#   bash devops/scripts/rollback.sh production 3        # revision 3
#   bash devops/scripts/rollback.sh staging 3 --dry-run # show commands only
#
# Env:
#   KUBECONFIG        path to target cluster kubeconfig (required unless --dry-run)
#   WEB_IMAGE         optional full web image (repo:tag) to restore explicitly
#   DEPLOY_TIMEOUT    rollout timeout (default: 300s)
#
# Always re-run the post-deploy smoke suite (make smoke SMOKE_BASE_URL=…)
# after a rollback — see devops/runbook/rollback.md.
set -euo pipefail

ENV_NAME="${1:-}"
HELM_REV="${2:-}"
DRY_RUN=""
for arg in "$@"; do
  [ "$arg" = "--dry-run" ] && DRY_RUN="1"
done

if [ -z "$ENV_NAME" ]; then
  echo "Usage: rollback.sh <staging|production> [helm-revision] [--dry-run]" >&2
  exit 2
fi
case "$ENV_NAME" in
  staging|production) ;;
  *) echo "::error::Unknown environment '$ENV_NAME' (expected staging|production)" >&2; exit 2 ;;
esac

case "$ENV_NAME" in
  staging)    NS="ascendly-staging" ;;
  production) NS="ascendly" ;;
esac

TIMEOUT="${DEPLOY_TIMEOUT:-300s}"
REV_ARGS=()
[ -n "$HELM_REV" ] && REV_ARGS=(--to-revision "$HELM_REV")

rollout_cmd() {
  local deploy="$1"
  if [ -n "${WEB_IMAGE:-}" ] && [ "$deploy" = "ascendly-web" ]; then
    echo "kubectl rollout undo deployment/$deploy -n $NS"
    echo "kubectl -n $NS set image deployment/$deploy web=$WEB_IMAGE"
  else
    echo "kubectl rollout undo deployment/$deploy -n $NS"
  fi
}

if [ -n "$DRY_RUN" ]; then
  echo "── DRY RUN rollback ($ENV_NAME, ns=$NS) ─────────────────────"
  echo "kubectl    = $(command -v kubectl || echo 'MISSING (not required for dry-run)')"
  echo "helm       = $(command -v helm || echo 'MISSING (not required for dry-run)')"
  for chart in ascendly-api ascendly-runtime; do
    if [ -n "$HELM_REV" ]; then
      echo "helm rollback $chart --to-revision $HELM_REV -n $NS"
    else
      echo "helm rollback $chart (previous revision) -n $NS"
    fi
  done
  for deploy in ascendly-web ascendly-api ascendly-worker ascendly-cron; do
    rollout_cmd "$deploy"
  done
  echo "kubectl rollout status deployment/ascendly-api -n $NS --timeout=$TIMEOUT (same for web/worker/cron)"
  echo "── END DRY RUN ──────────────────────────────────────────────"
  echo "After the rollback, re-run smoke: make smoke SMOKE_BASE_URL=…"
  exit 0
fi

command -v helm >/dev/null || { echo "::error::helm not found" >&2; exit 1; }
command -v kubectl >/dev/null || { echo "::error::kubectl not found" >&2; exit 1; }
[ -n "${KUBECONFIG:-}" ] || { echo "::error::KUBECONFIG must be set for a real rollback" >&2; exit 1; }

echo "── Rolling back $ENV_NAME (ns=$NS) revision ${HELM_REV:-previous} ──"

for chart in ascendly-api ascendly-runtime; do
  echo "::group::helm rollback $chart"
  helm rollback "$chart" "${REV_ARGS[@]}" -n "$NS"
  echo "::endgroup::"
done

echo "::group::kubectl rollout undo"
for deploy in ascendly-web ascendly-api ascendly-worker ascendly-cron; do
  kubectl rollout undo "deployment/$deploy" -n "$NS"
  if [ "$deploy" = "ascendly-web" ] && [ -n "${WEB_IMAGE:-}" ]; then
    kubectl -n "$NS" set image "deployment/$deploy" web="$WEB_IMAGE"
  fi
done
echo "::endgroup::"

echo "::group::rollout status"
for deploy in ascendly-api ascendly-web ascendly-worker ascendly-cron; do
  kubectl rollout status "deployment/$deploy" -n "$NS" --timeout="$TIMEOUT"
done
echo "::endgroup::"

echo "✅ Rollback complete: $ENV_NAME → revision ${HELM_REV:-previous}"
echo "Next: run the post-deploy smoke suite: make smoke SMOKE_BASE_URL=<env-url>"
