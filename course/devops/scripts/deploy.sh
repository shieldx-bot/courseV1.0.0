#!/usr/bin/env bash
# ── Ascendly deploy script (Phase 8) ──────────────────────────────────────────
# Deploys the stack to a target environment: helm charts (platform-base,
# ascendly-api, ascendly-runtime) + the static web manifest
# (devops/k8s/web-deployment.yaml), then waits for rollout. When a SOPS
# encrypted secret file exists for the environment, it is decrypted and
# applied after the helm releases (real values win over the chart defaults).
#
# Usage:
#   bash devops/scripts/deploy.sh <staging|production> <api-image> <web-image> <tag> [--dry-run]
#
# Examples:
#   # Dry run (no cluster access — used by CI to validate the script):
#   bash devops/scripts/deploy.sh staging ghcr.io/acme/ascendly-api ghcr.io/acme/ascendly-web v1.0.0-abc1234 --dry-run
#
#   # Real deploy (KUBECONFIG must point at the target cluster):
#   KUBECONFIG=~/.kube/staging.yaml \
#   REGISTRY_USERNAME=... REGISTRY_PASSWORD=... \
#   bash devops/scripts/deploy.sh staging ghcr.io/acme/ascendly-api ghcr.io/acme/ascendly-web v1.0.0-abc1234
#
# Env:
#   KUBECONFIG          path to the target cluster kubeconfig (required unless --dry-run)
#   REGISTRY_USERNAME   registry login username (GHCR: the GitHub actor; GitHub App: x-access-token)
#   REGISTRY_PASSWORD   registry login token (GHCR: GITHUB_TOKEN with packages:write)
#   REGISTRY_SERVER     registry host for the docker-registry secret (defaults to $REGISTRY env or ghcr.io)
#   REGISTRY_REGCRED    imagePullSecret name created for the web manifest (default: regcred)
#   DEPLOY_TIMEOUT      kubectl rollout status timeout (default: 300s)
#   AGE_SECRET_KEY      age private key for SOPS secret decryption (optional)
#
# Requires: helm 3, kubectl. None are needed for --dry-run.
set -euo pipefail

ENV_NAME="${1:-}"
API_IMAGE="${2:-}"
WEB_IMAGE="${3:-}"
TAG="${4:-}"
DRY_RUN=""
for arg in "$@"; do
  if [ "$arg" = "--dry-run" ]; then DRY_RUN="1"; fi
done

if [ -z "$ENV_NAME" ] || [ -z "$API_IMAGE" ] || [ -z "$WEB_IMAGE" ] || [ -z "$TAG" ]; then
  echo "Usage: deploy.sh <staging|production> <api-image> <web-image> <tag> [--dry-run]" >&2
  exit 2
fi
case "$ENV_NAME" in
  staging|production) ;;
  *) echo "::error::Unknown environment '$ENV_NAME' (expected staging|production)" >&2; exit 2 ;;
esac

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
CHART_DIR="$REPO_ROOT/devops/helm"
WEB_MANIFEST="$REPO_ROOT/devops/k8s/web-deployment.yaml"
TIMEOUT="${DEPLOY_TIMEOUT:-300s}"
REGCRED="${REGISTRY_REGCRED:-regcred}"

# staging → ascendly-staging, production → ascendly
case "$ENV_NAME" in
  staging)    NS="ascendly-staging" ;;
  production) NS="ascendly" ;;
esac

log()  { echo "::group::$*"; }
loge() { echo "::endgroup::"; }

if [ -n "$DRY_RUN" ]; then
  echo "── DRY RUN (no cluster access) ──────────────────────────────"
  echo "env=$ENV_NAME ns=$NS api=$API_IMAGE web=$WEB_IMAGE tag=$TAG"
  echo "kubectl   = $(command -v kubectl || echo 'MISSING (not required for dry-run)')"
  echo "helm      = $(command -v helm || echo 'MISSING (not required for dry-run)')"
  if [ -n "${REGISTRY_USERNAME:-}" ] && [ -n "${REGISTRY_PASSWORD:-}" ]; then
    echo "dry-run: kubectl -n $NS create secret docker-registry $REGCRED (from REGISTRY_* env)"
  fi
  echo "dry-run: helm upgrade --install platform-base $CHART_DIR/platform-base -f $CHART_DIR/platform-base/values-$ENV_NAME.yaml -n $NS --create-namespace"
  echo "dry-run: helm upgrade --install ascendly-api $CHART_DIR/ascendly-api -f $CHART_DIR/ascendly-api/values-$ENV_NAME.yaml -n $NS --create-namespace --set image.repository=$API_IMAGE --set image.tag=$TAG --set image.pullPolicy=IfNotPresent --set imagePullSecrets[0].name=$REGCRED"
  echo "dry-run: helm upgrade --install ascendly-runtime $CHART_DIR/ascendly-runtime -f $CHART_DIR/ascendly-runtime/values-$ENV_NAME.yaml -n $NS --create-namespace --set image.repository=$API_IMAGE --set image.tag=$TAG --set image.pullPolicy=IfNotPresent --set imagePullSecrets[0].name=$REGCRED"
  echo "dry-run: render $WEB_MANIFEST (ns=$NS image=$WEB_IMAGE:$TAG replicas=2) | kubectl apply -f -"
  echo "dry-run: kubectl rollout status deployment/ascendly-api -n $NS --timeout=$TIMEOUT (same for web/worker/cron)"
  if [ -f "$REPO_ROOT/devops/secrets/secrets.$ENV_NAME.enc.yaml" ]; then
    echo "dry-run: sops decrypt devops/secrets/secrets.$ENV_NAME.enc.yaml | kubectl apply -f - (AGE_SECRET_KEY set: $([ -n "${AGE_SECRET_KEY:-}" ] && echo yes || echo no))"
  fi
  echo "── END DRY RUN ──────────────────────────────────────────────"
  exit 0
fi

command -v helm >/dev/null || { echo "::error::helm not found" >&2; exit 1; }
command -v kubectl >/dev/null || { echo "::error::kubectl not found" >&2; exit 1; }
if [ -z "${KUBECONFIG:-}" ]; then
  echo "::error::KUBECONFIG must be set for a real deploy (see rollback.sh/deploy.sh docs)" >&2
  exit 1
fi

# ── 1. Registry imagePullSecret (so pods can pull the private image) ─────────
if [ -n "${REGISTRY_USERNAME:-}" ] && [ -n "${REGISTRY_PASSWORD:-}" ]; then
  SERVER="${REGISTRY_SERVER:-${REGISTRY:-ghcr.io}}"
  log "Create/refresh docker-registry secret $REGCRED ($SERVER)"
  kubectl -n "$NS" create secret docker-registry "$REGCRED" \
    --docker-server="$SERVER" \
    --docker-username="$REGISTRY_USERNAME" \
    --docker-password="$REGISTRY_PASSWORD" \
    --dry-run=client -o yaml | kubectl apply -f -
  loge
else
  echo "::warning::REGISTRY_USERNAME/REGISTRY_PASSWORD not set — assuming public images"
fi

# ── 2. Helm releases (platform-base → api → runtime) ─────────────────────────
log "helm upgrade platform-base ($ENV_NAME)"
helm upgrade --install platform-base "$CHART_DIR/platform-base" \
  -f "$CHART_DIR/platform-base/values-$ENV_NAME.yaml" \
  -n "$NS" --create-namespace
loge

log "helm upgrade ascendly-api ($ENV_NAME)"
helm upgrade --install ascendly-api "$CHART_DIR/ascendly-api" \
  -f "$CHART_DIR/ascendly-api/values-$ENV_NAME.yaml" \
  -n "$NS" --create-namespace \
  --set "image.repository=$API_IMAGE" \
  --set "image.tag=$TAG" \
  --set "image.pullPolicy=IfNotPresent" \
  --set "imagePullSecrets[0].name=$REGCRED"
loge

log "helm upgrade ascendly-runtime ($ENV_NAME)"
helm upgrade --install ascendly-runtime "$CHART_DIR/ascendly-runtime" \
  -f "$CHART_DIR/ascendly-runtime/values-$ENV_NAME.yaml" \
  -n "$NS" --create-namespace \
  --set "image.repository=$API_IMAGE" \
  --set "image.tag=$TAG" \
  --set "image.pullPolicy=IfNotPresent" \
  --set "imagePullSecrets[0].name=$REGCRED"
loge

# ── 3. Web deployment (static manifest, image/ns/replicas injected) ──────────
log "Deploy web manifest ($ENV_NAME)"
sed -e "s|namespace: ascendly|namespace: $NS|" \
    -e "s|image: ascendly-web:latest|image: $WEB_IMAGE:$TAG|" \
    -e "s|^\([ ]*\)replicas: [0-9]*|\1replicas: 2|" \
    "$WEB_MANIFEST" | kubectl apply -f -
if [ -n "${REGISTRY_USERNAME:-}" ] && [ -n "${REGISTRY_PASSWORD:-}" ]; then
  kubectl -n "$NS" patch deployment ascendly-web --type=strategic -p \
    "{\"spec\":{\"template\":{\"spec\":{\"imagePullSecrets\":[{\"name\":\"$REGCRED\"}]}}}}"
fi
loge

# ── 4. SOPS secrets (real values override the chart placeholder secret) ──────
if [ -f "$REPO_ROOT/devops/secrets/secrets.$ENV_NAME.enc.yaml" ]; then
  log "Apply SOPS secrets ($ENV_NAME)"
  if command -v sops >/dev/null 2>&1 && [ -n "${AGE_SECRET_KEY:-}" ]; then
    tmp="$(mktemp)"
    trap 'rm -f "$tmp"' EXIT
    bash "$REPO_ROOT/devops/scripts/secrets-decrypt.sh" "$ENV_NAME" "$tmp"
    kubectl apply -f "$tmp"
    rm -f "$tmp"
    echo "::notice::SOPS secrets applied for $ENV_NAME"
  else
    echo "::warning::devops/secrets/secrets.$ENV_NAME.enc.yaml exists but sops/AGE_SECRET_KEY unavailable — helm chart placeholder secret stays in place"
  fi
  loge
fi

# ── 5. Rollout status (fail fast on stuck deploys) ───────────────────────────
log "rollout status"
for deploy in ascendly-api ascendly-web ascendly-worker ascendly-cron; do
  kubectl rollout status "deployment/$deploy" -n "$NS" --timeout="$TIMEOUT"
done
loge

echo "✅ Deploy complete: $ENV_NAME ($TAG) in namespace $NS"
