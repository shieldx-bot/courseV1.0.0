# ASCENDLY — Release Engineering Model (L3.2)

Design-only. No CI/GitOps/ArgoCD/Flux implemented. Standardizes how every release is identified, versioned, promoted, rolled back — deterministically.

## 1. Architecture rationale
One modular monolith → one application version, three processes (api/worker/cron) from one image, three Helm charts. Release engineering must answer: *what changed, how to promote, how to undo* — without ambiguity. All rules below are pure convention (manifests/charts/docs), fully reversible, no runtime change.

## 2. Release model
| Artifact | Identity rule | Source of truth |
|---|---|---|
| Application | SemVer `MAJOR.MINOR.PATCH` (baseline `1.0.0`) | Chart `appVersion` (all 3 charts share it) |
| Image | `ascendly-api:<app-version>` · `ascendly-web:<app-version>` (repo has no worker image — worker/cron reuse api image) | `values.yaml image.tag` |
| Chart | SemVer per chart, independent of app (bump when templates/values change) | `Chart.yaml version` |
| Helm release | `ascendly-<app-version>` (e.g. `ascendly-1.4.0`) | helm install name |
| Git tag | `v<app-version>` (e.g. `v1.4.0`) | git tag |

## 3. Versioning strategy
- **Application**: strict SemVer. Major = breaking contract/DB; Minor = new feature; Patch = fix/refactor with zero contract change.
- **Image**: tag = app version exactly; `latest` reserved for dev; no floating `stable`.
- **Chart**: SemVer; `platform-base` bumps independently (infra-only), `ascendly-api`/`ascendly-runtime` bump when their templates/values change. Chart `appVersion` mirrors app version at packaging time.
- **Build provenance**: labels `org.opencontainers.image.revision=<git-sha>`, `.version=<app-version>`, `.created=<ISO-timestamp>` on images (set by CI later); manifests carry `app.kubernetes.io/version` label (added to chart helpers now).

## 4. Release naming, metadata, annotations
- Release name: `ascendly-<app-version>`.
- Helm-managed annotations (auto): `meta.helm.sh/release-name`, `meta.helm.sh/release-namespace`, `helm.sh/hook` — used by `helm rollback`.
- Chart-provided labels: `app.kubernetes.io/version: <Chart.AppVersion>` (added to all 3 `_helpers.tpl`).
- Later CI adds: `ascendly.io/build-sha`, `ascendly.io/release-date` annotations (documented; not applied now — no CI).

## 5. Release conventions
- One release = one git tag `v<app-version>` + image tag `<app-version>` + 3 charts with matching `appVersion`.
- Promotion is declarative: environment-specific `values-<env>.yaml` override `image.tag` only (charts identical).
- Immutable tags: never re-tag `1.0.0`; bugfix = new patch `1.0.1`.

## 6. Compatibility guarantees
- **Patch (P → P+1)**: always compatible; upgrade anytime; no DB/API change.
- **Minor (M → M+1)**: backward compatible; additive API/DB only; upgrade orchestrated (api → worker → cron; no downtime via RollingUpdate 0/1).
- **Major (X → X+1)**: breaking; requires migration window, feature-flag cutover, and documented upgrade path; cron paused first.
- **Chart-app**: chart `version` is independent; any chart version may package any app version (verified via `appVersion` reconciliation).

## 7. Release promotion policy
- dev → staging → prod, each environment with its own `values-<env>.yaml`.
- Promotion blocked if: readiness not green in prior env, PDB minAvailable not satisfiable, or chart `appVersion` mismatch with image tag.
- Rollout verification gate: `kubectl -n ascendly rollout status deploy/ascendly-api` must reach complete before promotion.

## 8. Rollback strategy
- **Cluster**: `helm rollback ascendly-<version> <revision> -n ascendly` (revisionHistoryLimit=3 keeps 2 prior).
- **Image-level fallback**: `kubectl -n ascendly set image deployment/ascendly-api api=ascendly-api:<prev-version>`.
- **Data**: no rollback of migrations (forward-fix policy); DB compatibility guaranteed by SemVer rules above.

## 9. Supported upgrade paths & deprecation
- Supported: X.y.z → X.(y+1).0 and X.y.z → X.(y+1).z' (always latest patch; no jumping major).
- Deprecation: removing a minor feature → announce one minor release ahead; removing an API/DB field → only at next major.

## 10. Verification (this iteration)
- All 3 Chart.yaml: `version: 1.0.0`, `appVersion: "1.0.0"` (grep-verified).
- All 3 helpers include `app.kubernetes.io/version`.
- All 3 NOTES.txt expose release/rollback commands.
- git diff scope: charts + docs only, no code/Dockerfile/CI/runtime.

## 11. Definition of Done (this iteration)
Release model documented ✓ versioning rules defined ✓ chart metadata normalized ✓ compatibility/promotion/rollback/deprecation policies defined ✓ reversible (all changes are convention/docs) ✓

## 12. Next milestone (not implemented here)
L3.3 — GitOps foundation (ArgoCD app-of-apps) will consume this model: repo tag = release, env promotion via values files, auto-sync with rollback via `helm rollback`.
