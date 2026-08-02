# ASCENDLY — Kubernetes Platform Contract (Official, L3.3)

Architecture-only. No GitOps/observability/autoscaling/service-mesh/feature additions. This is the official contract every Ascendly workload (api/worker/cron/web) must satisfy on any orchestrator.

## 1. Application Identity
Standard metadata applied to every Deployment + pod (verified in manifests/charts):
- `app: ascendly-<component>` (api|worker|cron|web)
- `app.kubernetes.io/name: ascendly`, `instance: ascendly-<component>`, `component: <component>`, `part-of: ascendly`, `managed-by: helm|kubectl`, `version: <Chart.AppVersion>`
- Release identity: immutable image tag `<app-version>`; helm release `ascendly-<app-version>`; git tag `v<app-version>` (RELEASE_MODEL.md).

## 2. Downward API model
Contract: the platform MAY expose these via env (not business logic — no internals leak):
- `POD_NAME` (metadata.name), `POD_NAMESPACE` (metadata.namespace), `NODE_NAME` (spec.nodeName), `POD_IP` (status.podIP), `IMAGE_VERSION` (from image tag), `RELEASE_VERSION` (helm release), `CLUSTER_NAME` (injected by operator/CI later).
- All OPTIONAL today (no runtime change); when injected they MUST be read-only env, never configuration inputs.

## 3. Runtime contracts (environment variables)
Official env contracts (from `app/core/config.py` + charts):
- **Mandatory**: `PROCESS_MODE` (api|worker|cron); `MONGODB_URI`, `REDIS_URL` (stateful backends); `JWT_SECRET` (Secret).
- **Optional (defaults in Settings)**: `LOG_LEVEL` (INFO), `APP_TIMEZONE` ("" = host), `FRONTEND_URL`, `API_BASE_URL`, `MEILI_URL/MASTER_KEY`, LLM keys (OPENAI/GEMINI/OPENROUTER), R2 keys, SMTP, stripe/paypal.
- **Evolution**: adding a new env = backward compatible (Settings default). Changing a mandatory env's meaning = major version (major = breaking).
- Backward compatibility: any removed/renamed env MUST be announced one release ahead (RELEASE_MODEL deprecation rule).

## 4. Application lifecycle contracts
- **Startup**: `/api/v1/health` liveness; startupProbe (20s initial, 10s period, ×30) waits for seed/indexes; readiness `/api/v1/health/ready` (Mongo+Redis).
- **Graceful shutdown**: SIGTERM only; `terminationGracePeriodSeconds: 30`; `preStop` sleep (api 5s drain, worker 2s flush, web 3s).
- **Pod replacement**: RollingUpdate (api/web 0/1; worker/cron 1/0); PDB minAvailable=1 (api+worker).
- **Restart expectations**: pods are ephemeral — no local state (rofs + emptyDir only); restart via rollout/helm upgrade is safe.
- **CrashLoop**: liveness failure ⇒ kill+restart; readiness failure ⇒ no traffic, pod kept (no restart) — platform-owned.

## 5. Configuration contracts
- **Immutable**: image, chart templates, securityContext, probes — change = new release (rollback via helm rollback).
- **Reloadable**: ConfigMap env (non-secret) requires pod restart to propagate — documented; Secret env requires restart too.
- **Secret lifecycle**: placeholder SealedSecret-annotated; rotation = new Secret + rollout restart; no in-place mutation.
- **Propagation**: config changes are release-scoped (env promotion flows), never hot-reloaded into running pods.

## 6. Resource contracts
- CPU/Memory: requests (api 250m/512Mi, worker 500m/512Mi, cron 100m/256Mi, web 100m/256Mi) + limits (verified in manifests/charts). Requests = guarantee; limits = ceiling.
- Ephemeral storage: `emptyDir` bounded by pod lifecycle; no PVC (no stateful storage).
- GPU: not used today; contract reserves `resources.limits."nvidia.com/gpu"` as future additive (no change now).

## 7. Failure contracts (responsibility boundaries)
- **Kubernetes owns**: scheduling, pod restart (liveness), traffic routing (readiness+Service), node drains (PDB), rollout progress.
- **Application owns**: correctness of /health + /health/ready, graceful SIGTERM handling, forward-compat with backends (Mongo/Redis tolerance).
- **Infrastructure owns**: Mongo/Redis/Meili uptime, DNS, external API availability (LLM/R2/SMTP) — app treats them as external.

## 8. Upgrade contracts
- Order: api → worker → cron (additive changes safe in any order; breaking: cron paused first).
- Version skew: api and worker/cron run SAME image tag (single image) ⇒ no skew window. Web separate image but same app version.
- Chart compatibility: chart `version` independent; `appVersion` must equal deployed image tag (reconcile gate).
- Release tuple: one git tag `vX.Y.Z` = image tag + 3 charts `appVersion` + ingress host — immutable.

## 9. Platform compatibility matrix
| Platform | Status | Notes |
|---|---|---|
| Docker (compose) | ✅ dev | healthchecks, non-root, same image |
| k3s | ✅ current target | full hardening/ops applied |
| Kubernetes (upstream) | ✅ compatible | no k3s-specific features used |
| Managed K8s (EKS/GKE/AKS) | ✅ designed | env injection, config via env only |
| Multi-cluster (future) | ⚠️ designed | namespaces/env isolation already modeled; needs L6 |

No architecture change required for any row — contract is orchestrator-agnostic (12-Factor + standard labels/probes).

## 10. Documentation (this file)
- Platform API Contract ✓ Runtime Contract ✓ Configuration Contract ✓ Lifecycle Contract ✓ Failure Contract ✓ Compatibility Matrix ✓
- Definitions of Done: official contract documented; no implementation required; reversible (docs only).

## Rollback
Delete this doc via git — no runtime effect. All contracts reflect current platform (no deviation introduced).

## Verification
- This file created (10 sections).
- All claims cross-checked against existing manifests + charts (labels/probes/security/resources/values verified in earlier iterations).

## Next milestone (not implemented)
L3.4 — GitOps foundation (ArgoCD): consumes PLATFORM_CONTRACT as the source of declared behavior.
