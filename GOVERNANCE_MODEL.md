# ASCENDLY — Platform Governance Model (Official, L3.35)

Architecture-only. No implementation/manifests/code/Helm/GitOps/CI. This is the GOVERNANCE layer above PLATFORM_CONTRACT (L3.3), below future GitOps (L3.4). Every future deployment system (GitOps, CI/CD, multi-cluster) MUST obey this model.

## 1. Platform ownership
| Asset | Owner | Escalation |
|---|---|---|
| Platform (namespace, k8s structure) | Platform Engineering | CTO |
| Application (business logic, runtime contract) | Application Engineering | CTO |
| Charts (helm/*) | Platform Engineering (template owner) + App Eng (values owner) | Tech Lead |
| Environment (dev/staging/prod values + namespaces) | dev=App Lead, staging=Tech Lead, prod=Release Manager | CTO for prod |
| Release (tags, images, promotion gates) | Release Manager (single accountable) | CTO |
| Infrastructure (Mongo/Redis/Meili/external) | Infrastructure Eng (stateful outside cluster per contract) | CTO |
| Documentation (this + RELEASE/ENVIRONMENT/PLATFORM_CONTRACT) | Docs Owner | Tech Lead |

## 2. Promotion governance
- Who: dev=App Eng (auto); staging=Tech Lead approval; prod=Release Manager approval (matches ENVIRONMENT_MODEL).
- Approvals: dev→staging = team-lead + CI pass; staging→prod = release-manager + readiness evidence + PDB satisfiable.
- Evidence: rollout complete, /health/ready green, chart appVersion == image tag, release-note diff.
- Promotion STOPS when: readiness red, PDB unsatisfiable, mutable/non-matching image tag, security finding, release tuple mismatch.

## 3. Release governance
- Version: SemVer (RELEASE_MODEL). Cadence: minor monthly, patch on-demand, no fixed major.
- Emergency: patch/minor additive only, Release Manager + CTO, cron paused on breaking rollout.
- Hotfix: branch from last prod tag → patch → full-gate promotion.
- Rollback: prod = helm rollback + image fallback (RELEASE_MODEL §8).
- Deprecation: one-minor-ahead notice; breaking only at major.
- Support window: current + previous minor; security backport within window.

## 4. Configuration governance
- ConfigMap: Platform Eng (defaults) / env owner; changes via PR.
- Secret: Platform Eng (structure) + Security/Release Manager (values); no plaintext in repo.
- Helm values: app values (image/replicas/ingress) = App Eng; platform values (namespace/network) = Platform Eng.
- Review: all config = git PR + docs owner; prod = release-manager.
- Environment ownership: per §1; no cross-env mutation except promotion flow.

## 5. Contract governance
- Owners: PLATFORM_CONTRACT = Platform Eng; RELEASE/ENVIRONMENT_MODEL = Release/Platform Eng.
- Modify: PR + explicit reviewer set (Platform Tech Lead + Release Manager); prod-impacting = CTO.
- Backward compat: additive = patch/minor; behavior change = minor + notice; breaking = major + migration window.
- Breaking policy: document impact in diff, one-release overlap when feasible, ship with major tag.

## 6. Deployment governance
- ALLOWED: helm install/upgrade/rollback via release tuple; kubectl apply of rendered YAML in dev only; image rollback (prod fallback).
- FORBIDDEN: kubectl exec writes into running pods; direct namespace mutation outside release; image/chart tag reuse; chart edits outside PR.
- Immutability: images never re-tagged; published chart versions never mutated.
- Namespace ownership: ascendly / ascendly-dev / ascendly-staging per env owner.
- Release tuple (vX.Y.Z + image + 3 chart appVersions + ingress) owned by Release Manager, immutable once promoted to prod.

## 7. Security governance
- RBAC: Platform Eng (least-privilege, rbac.yaml). NetworkPolicy: Platform Eng (port-scoped, networkpolicy.yaml), Security review.
- ServiceAccount: Platform Eng (automount off). Secret rotation: Release Manager/Security (new Secret + rollout restart).
- Container image: Platform Eng publishes; App Eng owns content; both approve releases.

## 8. Platform lifecycle
| Stage | Enter | Exit |
|---|---|---|
| Experimental | RFC approved | Supported after 1 prod-candidate use |
| Supported | thorough review + prod smoke | deprecation notice (one minor ahead) |
| Deprecated | release-note deprecation | Removed at next major |
| Removed | next major after deprecation | — |
| Long-term support | CTO decision (prod security) | like Supported |

Stage movement requires ADR + release-note + contract-diff review.

## 9. Audit model
- Document: every promotion (from→to + evidence), rollback (reason + revision), chart/contract change (ADR), secret rotation (timestamp+scope), release tuple.
- Release history: git tags + helm revision log. Rollback history: ADR/journal.
- ADRs in docs/adr/ (proposed → accepted → superseded); CLOUD NATIVE.md = platform changelog.

## 10. Documentation (this file)
Platform Governance ✓ Ownership Matrix (§1) ✓ Promotion Policy (§2) ✓ Release Policy (§3) ✓ Compatibility Policy (§5) ✓ Audit Policy (§9) ✓

## Definition of Done
Governance documented ✓ ownership matrix ✓ promotion/release/config/contract/deployment/security ✓ lifecycle stages ✓ audit policy ✓ no implementation ✓ reversible (docs only).

## Verification
GOVERNANCE_MODEL.md created; cross-references RELEASE_MODEL/ENVIRONMENT_MODEL/PLATFORM_CONTRACT — introduces no deviation.

## Rollback
Delete file via git — no runtime effect.

## Next milestone (not implemented)
L3.4 — GitOps foundation (ArgoCD): every Application declares governance owner, promotion gate, release tuple per this model.
