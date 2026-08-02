# ASCENDLY — Environment Model Foundation (L3.25)

Design-only. No GitOps/CI/ArgoCD/Flux implemented. Answers: *how environments differ* — GitOps will consume this later. Promotion moves the SAME application version (immutable image tags; no rebuild).

## 1. Architecture rationale
One app version, one image, 3 charts. Environments differ ONLY in configuration (values), never in artifacts. This makes promotion deterministic: the exact image verified in dev is the exact image promoted to prod.

## 2. Environment model

| Property            | Development                     | Staging                         | Production                     |
|---------------------|---------------------------------|---------------------------------|--------------------------------|
| **Purpose**          | local iteration, feature-dev    | pre-prod verification           | live service                   |
| **Namespace**        | `ascendly-dev`                  | `ascendly-staging`              | `ascendly` (current)           |
| **Release policy**   | every commit / branch tag       | release candidates (`vX.Y.Z-rc`) | immutable `vX.Y.Z` only        |
| **Replica policy**   | api=1, worker=1, cron=1         | api=2, worker=1, cron=1         | api=2, worker=1, cron=1        |
| **Resource policy**  | minimal (api 250m/512Mi 1Gi)    | prod-like (api 250m/1Gi)        | prod full (api 250m/1Gi)       |
| **Ingress policy**   | disabled / internal             | disabled / internal             | enabled, host `ascendly.io`    |
| **Secret strategy**  | placeholder values              | placeholder + manual override   | real secrets (SealedSecret later) |
| **Image tag policy** | `latest` / feature branch       | `vX.Y.Z-rc`                     | `vX.Y.Z` immutable             |
| **Rollback policy**  | redeploy previous commit        | `helm rollback` immediate       | `helm rollback` + image fallback |
| **Promotion source** | code → dev                      | dev ✓ tests ✓ → staging         | staging ✓ → prod               |
| **Deployment approval** | auto (CI/PR merge)           | team lead approval              | release-manager approval       |
| **Feature flag policy** | all flags visible (canary)   | flags as prod, staged rollout   | release flags only             |
| **Maintenance policy** | no guarantee, anytime restart | announced window (out-of-hours) | scheduled window, PDB respected |

## 3. Helm values organization
Each chart has `values.yaml` (defaults = current semantics) + per-env overrides. Only real differences are overridden — no duplicated config:
```
helm/<chart>/
  values.yaml          # defaults (matches k8s/ semantics today)
  values-dev.yaml      # namespace, entry replicas, minimal resources, ingress disabled, latest tag
  values-staging.yaml  # namespace, prod-like replicas/resources, rc tag, ingress disabled
  values-prod.yaml     # namespace, prod replicas/resources, immutable tag, ingress enabled + host
```
Usage: `helm install ascendly-api ./helm/ascendly-api -n ascendly-staging -f helm/ascendly-api/values-staging.yaml`

## 4. Promotion model
```
dev (branch) ──CI/smoke──▶ staging (vX.Y.Z-rc) ──manual verify + approval──▶ prod (vX.Y.Z)
```
- SAME image digest moves up (digest pinned at staging; prod consumes identical digest).
- No rebuild, no mutable tag. Env promotion = running `helm upgrade` with the env values file + the same `image.tag`.
- Gate for staging→prod: readiness green in staging, PDB satisfiable, chart appVersion == image tag.

## 5. Rollback model
- dev: reinstall latest; no durability concerns.
- staging: `helm rollback ascendly-staging <rev> -n ascendly-staging`.
- prod: `helm rollback ascendly <rev> -n ascendly`; image fallback `kubectl set image deployment/ascendly-api api=ascendly-api:<prev>`.
- Data: forward-fix policy (no migration rollback).

## 6. Compatibility guarantees
- Identical image across env ⇒ behavior same; env differences are configuration-only.
- SemVer rules from RELEASE_MODEL.md hold per environment (patch anytime; minor additive; major orchestrated).
- Secrets/features are env-scoped, never version-scoped.

## 7. Verification (this iteration)
- ENVIRONMENT_MODEL.md created.
- values-dev/staging/prod created for all 3 charts (grep-verific).
- Chart `ingress.enabled` added (default true — preserves current behavior).
- git diff scope: helm values + templates(1 flag) + docs only. No code/Dockerfile/CI/runtime.

## 8. Definition of Done
Env model documented ✓ values organization ✓ promotion = same version ✓ rollback per env ✓ compatibility defined ✓ reversible ✓ no GitOps/infra/CI.

## 9. Next milestone (not implemented here)
L3.3 — GitOps foundation (ArgoCD): consumes this model — one ArgoCD Application per chart per environment, `values-<env>.yaml` as source, sync policy with automated rollback.
