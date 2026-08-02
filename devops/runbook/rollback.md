# Rollback Runbook — Ascendly (Phase 8 NV6)

Goal: return the stack to the last known-good release with minimal downtime.

## Preconditions

- `KUBECONFIG` pointing at the **target cluster** (staging or production).
- `helm` + `kubectl` installed.
- The last known-good **image tag** (immutable `<sha>` from the release
  pipeline) recorded — e.g. from the release run, `kubectl get deploy -o
  jsonpath` below, or a prior `helm history`.

## 1. Identify what is deployed

```bash
# Helm releases (api, runtime) — find the last known-good revision:
helm history ascendly-api -n <ns>
helm history ascendly-runtime -n <ns>

# Web manifest — image + rollout revision currently live:
kubectl -n <ns> get deployment ascendly-web -o jsonpath='{.spec.template.spec.containers[0].image}{"\n"}'
kubectl -n <ns> rollout history deployment/ascendly-web
```

Namespace map: staging → `ascendly-staging`, production → `ascendly`.

## 2. Roll back

Quick path (previous revision), or pass an explicit helm revision:

```bash
# Previous revision:
bash devops/scripts/rollback.sh staging

# Explicit revision:
bash devops/scripts/rollback.sh production 3

# Preview without touching the cluster:
bash devops/scripts/rollback.sh staging 3 --dry-run
```

What the script does:

1. `helm rollback ascendly-api [--to-revision N] -n <ns>`
2. `helm rollback ascendly-runtime [--to-revision N] -n <ns>`
3. `kubectl rollout undo deployment/ascendly-web -n <ns>`
   (plus `kubectl rollout undo` on api/worker/cron to be safe)
4. `kubectl rollout status deployment/{api,web,worker,cron} -n <ns> --timeout=300s`

### Restore an old image tag explicitly (web or helm)

If the rollout history is lost (or you want to pin a specific image):

```bash
# Web (static manifest):
kubectl -n <ns> set image deployment/ascendly-web web=ghcr.io/<owner>/ascendly-web:<old-sha>

# Helm charts (api/runtime) — re-run the deploy script with the old SHA:
bash devops/scripts/deploy.sh <env> \
  ghcr.io/<owner>/ascendly-api ghcr.io/<owner>/ascendly-web \
  <old-sha>
```

> Immutable tags (`<sha>`) mean the old image is still in the registry — no
> rebuild needed. Semver aliases are overwritten per release; never roll back
> to an alias.

## 3. Verify after rollback

```bash
# 1. Rollouts settled:
kubectl -n <ns> get pods -o wide

# 2. Health endpoints (through the ingress, or port-forward):
make smoke SMOKE_BASE_URL=https://<env-url>/api/v1

# 3. Watch for the alerts (MasteryDecayJobFailed / ProactiveCheckJobFailed /
#    RetentionCleanupJobFailed) that triggered the rollback — see
#    devops/prometheus/alerts.yml.
```

Smoke must be green before traffic is trusted again.

## Checklist

- [ ] Confirm `KUBECONFIG` targets the right cluster
- [ ] Record the current image tag + helm revision (`helm history`)
- [ ] Run `rollback.sh <env> [revision]` (dry-run first if unsure)
- [ ] `kubectl rollout status` all four deployments green
- [ ] `make smoke SMOKE_BASE_URL=<env-url>` passes
- [ ] Root cause logged (metrics/alerts from `devops/prometheus/`)
- [ ] Decide: fix forward (new release) vs keep rolled-back revision
- [ ] Update `values-*.yaml` / deploy script only with an intentional fix; do
      not re-tag a rolled-back SHA

## When NOT to roll back

- Schema-breaking migration already applied (rollback of code + schema can
  diverge). Instead: **fix forward** — deploy a new immutable tag.
- The failure is a dependency outage (DB/registry): rollback changes nothing.
