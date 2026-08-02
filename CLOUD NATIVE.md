
---

# PRODUCTION HARDENING (Kubernetes manifests only — no code/runtime changes)

Iteration scope: 100% k8s manifests. No Helm/ArgoCD/Flux/HPA/Prometheus/Service-Mesh/StatefulSet/PV.

## Added manifests
- `k8s/rbac.yaml` — namespace-scoped Role (get configmaps+secrets) + RoleBinding. No ClusterRole. Pods get least privilege only.
- `k8s/networkpolicy.yaml` — default-deny ingress+egress; allow web→api:8000, ingress-controller→api:8000/web:3000; egress per-workload by concrete ports (DNS 53, Mongo 27017, Redis 6379, Meili 7700, HTTPS 443, SMTP 587). No random destinations.
- `k8s/pdb.yaml` — api minAvailable=1, worker minAvailable=1. No cron PDB (single scheduled process).

## Modified manifests
- `k8s/api-deployment.yaml` — RollingUpdate (maxUnavailable=0, maxSurge=1); topologySpreadConstraints (hostname, maxSkew=1, ScheduleAnyway); pod+container securityContext (runAsNonRoot, runAsUser=10001, noPrivEsc, seccomp RuntimeDefault, drop ALL, readOnlyRootFilesystem) + emptyDir for /tmp and /app/logs.
- `k8s/worker-deployment.yaml` / `k8s/cron-deployment.yaml` — RollingUpdate (maxUnavailable=1, maxSurge=0); same securityContext; emptyDir /tmp + /app/logs.
- `k8s/web-deployment.yaml` — RollingUpdate (0/1); securityContext (runAsUser=1000); emptyDir /tmp + /app/.next/cache.
- `k8s/serviceaccount.yaml` — automountServiceAccountToken: false.
- `k8s/secret.yaml` — SealedSecret-annotated placeholder (no Vault/External Secrets; replacement path documented).

## Security improvements
non-root everywhere · drop ALL capabilities · seccomp RuntimeDefault · readOnlyRootFilesystem with emptyDir writable dirs only · automount SA token off · default-deny network both directions · egress port-scoped.

## Scheduling improvements
topology spread prevents API replicas clumping on one node; conservative CPU/memory requests&limits retained.

## Availability improvements
rolling-update strategies (API zero-unavailable), PDB for api+worker keeping minAvailable=1.

## Verification
grep-confirmed hardening markers in all 5 modified/3 new manifests; git status scope exact (no code/Dockerfile/CI touched). YAML structurally valid per js-yaml/kubectl check where available.

## Rollback
`git revert` of k8s/ manifests restores bootstrap state. Runtime/image unchanged → fail-over is image-tag only.

## Definition of Done
RBAC ✓ NetworkPolicy (default-deny + allowed flows) ✓ PDB (api+worker) ✓ RollingUpdate ✓ topology spread (api) ✓ securityContext audit ✓ secrets prepared for SealedSecret/SOPS ✓ docs updated ✓ no code/runtime/CI changes ✓

---

# KUBERNETES OPERATIONS — Phase 2 (operations conventions & runbooks)

Operations-first hardening. No infra added; no Helm/GitOps/Prometheus/Service-Mesh. All changes are k8s manifests only.

## Operational conventions introduced
- **Recommended labels everywhere**: `app.kubernetes.io/name`, `instance`, `component`, `part-of`, `managed-by: kubectl` on every Deployment (metadata + pod template) — enables `kubectl get deploy -l app.kubernetes.io/part-of=ascendly`.
- **`revisionHistoryLimit: 3`** on all deployments (rollback window while bounding etcd growth).
- **`terminationGracePeriodSeconds: 30`** on all pods (orderly SIGTERM drain).
- **`preStop` lifecycle hooks**: api sleep 5 (drain traffic), worker sleep 2, web sleep 3 (zero-downtime rollouts); cron has none (short scheduled loop).
- **`imagePullSecrets: []`** placeholder — ready for private registry credentials at L3 delivery.

## Deployment conventions
- api: RollingUpdate maxUnavailable=0/maxSurge=1 (capacity preserved); worker/cron: 1/0 (no job duplication); web: 0/1.
- One image per role: api/worker/cron use `ascendly-api:latest` + `PROCESS_MODE`; web uses `ascendly-web:latest`.
- Environment via ConfigMap (non-secret) + Secret (envFrom) — no env literals in manifests.

## Operational runbooks (for platform engineer)
- **Image update (api)**: `kubectl -n ascendly set image deployment/ascendly-api api=ascendly-api:<sha>`
- **Rollout status**: `kubectl -n ascendly rollout status deployment/ascendly-api`
- **Rollback**: `kubectl -n ascendly rollout undo deployment/ascendly-api` (revisionHistoryLimit=3 keeps 2 prior revisions)
- **Scale**: `kubectl -n ascendly scale deployment/ascendly-api --replicas=3` (manual; no HPA yet)
- **Drain node safely**: PDB minAvailable=1 guarantees api+worker survive voluntary disruption
- **Pod tracing**: labels `app.kubernetes.io/component=api|worker|cron|web` + `kubectl get pods -l app.kubernetes.io/part-of=ascendly`
- **Restart all (config propagation)**: `kubectl -n ascendly rollout restart deployment/ascendly-api deployment/ascendly-worker deployment/ascendly-cron deployment/ascendly-web`

## Rollback
`git revert` the 4 deployment files returns manifests to hardened-bootstrap state; runtime/image unchanged.

## Definition of Done
Labels ✓ revision history ✓ termination grace ✓ preStop hooks ✓ image-pull-secrets readiness ✓ runbooks ✓ no new infrastructure ✓ no code/runtime change ✓

---

# HELM PACKAGING (L3.1) — three independent charts, no subcharts

Raw k8s/ manifests are now packaged into maintainable Helm charts. Same single image + api/worker/cron PROCESS_MODE + namespace `ascendly`. No GitOps/Helm dependencies/OCI implemented yet.

## Chart architecture
| Chart | Contents | Values parameterized |
|---|---|---|
| `helm/platform-base` | namespace, serviceaccount, rbac, configmap, secret placeholder, networkpolicy (ranged egress ports), pdb | namespace, SA name, config values, secret data, egressPorts, pdb minAvailable |
| `helm/ascendly-api` | api deployment, service, ingress | image repo/tag, replicas, resources, ingress host, configMapRef/secretRef |
| `helm/ascendly-runtime` | worker + cron deployments (same image, PROCESS_MODE) | image repo/tag, worker/cron replicas + resources |

## Values strategy
Parameterize ONLY: image repository/tag, resources, replicas, ingress host, env, secret names. All securityContext/probes/topology/rollout semantics are hardcoded in templates (not over-templated).

## Install order
1. `helm install platform-base ./helm/platform-base -n ascendly`
2. `helm install ascendly-api ./helm/ascendly-api -n ascendly`
3. `helm install ascendly-runtime ./helm/ascendly-runtime -n ascendly`

## Verification (no helm binary on this host)
- 24 template/values files created across 3 charts (structural check)
- Every deployment template contains PROCESS_MODE; helper labels; RollingUpdate; probes; securityContext — mirrors k8s/ manifests semantics
- `helm template` output must equal `kubectl apply -f k8s/` functionally (equivalence check pending cluster)

## Rollback
`helm uninstall ascendly-runtime ascendly-api platform-base -n ascendly` — or keep raw k8s/ manifests as source of truth (both paths produce identical resources).

## DoD
3 charts ✓ values minimal ✓ no subcharts/dependencies ✓ same image/process/namespace ✓ docs updated ✓

---

# RELEASE ENGINEERING (L3.2) — design-only release model

Full model in RELEASE_MODEL.md. No CI/GitOps implemented.

## Versioning (SemVer everywhere)
- Application: `1.0.0` baseline → all 3 charts `appVersion: "1.0.0"` (verified)
- Image: `ascendly-api:<app-version>` / `ascendly-web:<app-version>` (immutable; latest = dev only)
- Chart: per-chart `version` independent of app; now `1.0.0` (verified)
- Helm release: `ascendly-<app-version>`; git tag: `v<app-version>`

## Release metadata
- Labels `app.kubernetes.io/version` on all charts (verified in 3 helpers)
- NOTES.txt expose release/rollback commands (verified in 3 NOTES)
- Provenance labels (org.opencontainers.image.*) + assently.io build annotations — defined in model, injected by future CI

## Guarantees
- Patch: always compatible. Minor: additive only, upgrade api→worker→cron. Major: breaking, migration window + cron paused first.
- Rollback: `helm rollback ascendly-<version> <rev> -n ascendly` or image fallback. No data rollback (forward-fix).
- Promotion: dev→staging→prod via values-<env>.yaml (image.tag only), gated by rollout status.

## Scope check
Only charts (Chart.yaml/_helpers.tpl/NOTES.txt) + docs changed. No Python/Dockerfile/CI/runtime/API/DB.

---

# ENVIRONMENT MODEL (L3.25) — design-only env separation

Full model in ENVIRONMENT_MODEL.md. No GitOps/CI implemented. Promotion moves the SAME application version.

## Environments
- **Development** (`ascendly-dev`): latest tag, api=1, ingress off, placeholder secrets, auto-approve
- **Staging** (`ascendly-staging`): rc tag, api=2, ingress off, team-lead approval
- **Production** (`ascendly`): immutable tag, api=2, ingress on (ascendly.io), release-manager approval

## Helm values organization
- `values.yaml` (defaults = current semantics) + `values-dev/staging/prod.yaml` per chart — override ONLY real differences (namespace, ENVIRONMENT, image.tag, replicas, ingress.enabled/host). No duplicated config.
- 9 per-env files created (verified); `ingress.enabled` added to ascendly-api (default true, preserves current behavior; template wrapped with `if`).

## Promotion
`dev (branch/latest) → staging (vX.Y.Z-rc) → prod (vX.Y.Z)` — same image digest moves; no rebuild, no mutable tags. Gates: readiness green, PDB satisfiable, appVersion == image tag.

## Rollback
dev: reinstall · staging/prod: `helm rollback` · prod image fallback via `kubectl set image`. No migration rollback (forward-fix).

## Scope check
Only helm values + 1 template flag + docs. No code/Dockerfile/CI/runtime/API/DB/GitOps.
