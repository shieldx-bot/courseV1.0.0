# ASCENDLY — Observability Architecture (Official, L5.0)

Architecture-only. No implementation/manifests/Helm/Prometheus/Grafana/Loki/Tempo/OTel. Defines the long-term observability model the platform evolves toward. Sits above PLATFORM_CONTRACT (L3.3) + GOVERNANCE_MODEL (L3.35).

## 1. Observability philosophy
Observability answers *why* systems misbehave, not just *that* they do. Complementary pillars:
- **Monitoring**: known failure modes, time-series state (is it up?).
- **Logging**: discrete records of events, what happened at a point in time.
- **Tracing**: causality through a request/job across services/processes.
- **Profiling**: resource-sampling to find hot paths (CPU/memory/allocation).
- **Alerting**: monitored signals converted into human decisions, prioritized.
- **Audit**: tamper-evident, compliance-focused record of who-did-what-when.

They complement: monitoring surfaces, logs give detail, traces give path, profiles give cost, alerts drive action, audit gives accountability. No pillar replaces another.

## 2. Observability domains
| Domain | Scope | Owner |
|---|---|---|
| Application | api/worker/cron/web signals | App Eng |
| Platform | k8s, helm, rollout, probes | Platform Eng |
| Infrastructure | Mongo/Redis/Meili/external APIs | Infra Eng |
| Business | learners, courses, payments, events | Product + Data |
| Security | RBAC/network/secret anomalies | Security |
| Developer Experience | CI duration, deploy time, error rates | DevEx (Platform Eng) |

## 3. Golden Signals
- **Latency/Traffic/Errors**: API (HTTP) + web (Next.js requests).
- **Saturation**: API — CPU/memory/queue behind rate-limiter.
- **Queue Health**: worker — Redis arq queue depth, processing rate, failures.
- **Worker Health**: heartbeat age, jobs completed/min, retry counts.
- **Cron Health**: last-scheduled timestamp per cron (email 00:30, analytics 02:00, proactive 03:00), no-miss between runs.

Workload→signals: api exposes all 4+; worker exposes queue/saturation/heartbeat (no latency/traffic); cron exposes freshness (last-success age) only; web exposes latency/traffic/errors.

## 4. Telemetry model
Five pillars of telemetry:
- **Metrics**: numeric, aggregatable, low-cardinality (RED for services, USE for resources).
- **Logs**: structured events with context (request id, trace id, process).
- **Traces**: distributed timeline linking api → worker → db/external via propagation.
- **Events**: discrete business/platform occurrences (deploy, promote, secret rotate).
- **Audit Records**: immutable, signed-at-rest, retention by compliance.

Relations: trace id correlates logs of one request; metric anomalies trigger investigation into correlated traces + logs; audit is orthogonal (not part of debugging path).

## 5. Logging architecture
- **Classes**: application (info/debug), platform (kubelet/helm/rollout), audit (who/what), security (auth failures, suspicious egress).
- **Policy**: all logs structured JSON to stdout (12-Factor); no file appends in prod (platform owns collection).
- **Retention classes** (design only): debug=1d, info=30d, platform=90d, audit=1y+, security=1y+ (compliance).
- **Correlation ID**: every request/job carries `trace_id` + `request_id`; propagated to DB queries and external calls; logged on every entry/exit.
- **Sampling**: tail-sampling for traces (keep errors 100%, healthy 10%); logs sampled only at debug level; audit never sampled.

## 6. Metrics architecture
| Metric type | Examples | Owner | Basis |
|---|---|---|---|
| Business | signups, enrollments, revenue, events joined | Product | custom |
| Application | request rate, latency histogram, error ratio | App Eng | RED |
| Runtime | GC, thread pool, event-loop lag | App Eng | runtime |
| Kubernetes | pod availability, rollout progress, restart rate | Platform | kube-state |
| Infrastructure | Mongo/Redis/Meili ops, disk, network | Infra | USE |
| SLO | availability/latency/error budgets | SRE/Platform | derived |

RED for services (rate/errors/duration); USE for resources (utilization/saturation/errors). Ownership boundary: app owns custom+runtime; platform owns k8s-infra aggregations; product owns business.

## 7. Tracing architecture
- **Request tracing**: HTTP api calls — spans at middleware, service layer, DB calls, external LLM/R2/SMTP calls.
- **Background jobs**: worker arq job → one root span per job; child spans per enqueued subtask.
- **Cron jobs**: root span per scheduled run; `cron=freshness` overlap with SLO.
- **Event handlers**: spans emitted by platform event bus handlers (community/ecosystem events).
- **Propagation**: W3C tracecontext (traceparent/tracestate); carrier = headers (HTTP) + job context (arq) + message envelope (event bus).
- **Correlation**: trace_id == correlation id in logs == request_id in metrics labels (single correlation story).

## 8. Alerting architecture
Hierarchy:
- **Critical** (page): api unavailable, /health/ready red >1 min, worker heartbeat dead, prod deploy failed.
- **Warning** (ticket): latency p95 breach, error ratio >1% sustained, queue depth growing, cron miss 1 interval.
- **Info** (log/record): rollout started/complete, promotion approved, secret rotated, deprecation announced.
- **Operational**: deploy failures, helm rollback events. **Business**: anomaly in revenue/signups. **Security**: failed auth spikes, egress policy hits, secret-access anomalies.
Escalation: Info→Warning→Critical by sustained duration + impact; Critical pages on-call (single production SRE), Warning to channel, Info to platform changelog.

## 9. SLO architecture
SLO categories (no thresholds yet — design only):
- **Availability**: API reachable/healthy ratio over window.
- **Latency**: p50/p95/p99 request latency.
- **Freshness**: cron last-success age; content indexes freshness.
- **Queue processing**: wall-time from enqueue to completion (p95).
- **Background execution**: worker job success rate.
- **Deployment success**: % rollouts reaching complete without rollback.
- **Error budget**: 100% − SLO, burn-rate = error-budget consumption speed (multi-window burn alerts).

## 10. Observability data lifecycle
Generation (app/platform emits) → Collection (sidecar/agent per node) → Transport (secure, compressed, backpressure) → Storage (class-segregated: metrics TSDB, logs object store, traces trace store, audit immutable) → Retention (per class §5) → Archive (cold compliance, compressed) → Deletion (age + legal hold honored).
Ownership: generation=App/Platform Eng; collection/transport=Platform Eng; storage/retention/archive/deletion=Platform + Security for audit; compliance holds = Legal.

## 11. Platform compatibility
| Platform | Observability status |
|---|---|
| Docker/Compose | dev: stdout logs + healthchecks only (existing) |
| k3s | target: full collection layer via platform agents |
| Kubernetes | same as k3s (no k3s-specific) |
| Future multi-cluster | per-cluster collection → central aggregation (federation-ready) |
| Future service extraction | telemetry follows the workload (labels/trace-context), no architecture change |

## 12. Documentation
Observability Model ✓ Telemetry Model ✓ Logging Model ✓ Metrics Model (§6) ✓ Tracing Model (§7) ✓ Alert Model (§8) ✓ SLO Model (§9) ✓ Ownership Matrix (§2/§10) ✓

## Definition of Done
Philosophy ✓ domains+ownership ✓ golden signals (incl. queue/worker/cron health) ✓ telemetry pillars+relations ✓ logging policy (structure/correlation/retention/sampling) ✓ metrics taxonomy (business/runtime/k8s/infra/SLO) ✓ tracing (requests/jobs/cron/events/external/db + propagation) ✓ alert hierarchy + escalation ✓ SLO categories + error budget/burn-rate ✓ data lifecycle ✓ platform compatibility ✓ no implementation ✓

## Rollback
Delete file via git — no runtime effect. Introduces no deviation to platform.

## Verification
OBSERVABILITY_ARCHITECTURE.md created; cross-references PLATFORM_CONTRACT (probes/health) + GOVERNANCE_MODEL (ownership).

## Next milestone (not implemented)
L5.1 — Observability Foundation implementation (OTel collection + Prometheus/Loki/Tempo deployment) consumes this architecture.
