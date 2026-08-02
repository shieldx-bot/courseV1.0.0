# PROMPT GIAO VIỆC — AI-B (DevOps) — PHASE 8: Release Pipeline, HPA, Secrets, Rollback

> **Từ:** Supervisor
> **Cho:** AI-B — Chuyên viên DevOps (GitHub Actions, Docker, Helm, K8s, Prometheus)
> **Bối cảnh:** Phase 7 đã sign-off (7 cron, request-ID, CI gates). Phase 8 = Production Readiness: release pipeline, HPA web, secrets thật, rollback runbook + **2 carry-over**. Chiến thuật: **CI là nguồn verify chính** (local không có docker daemon/helm/kubectl — đã ghi nhận); mọi manifest/thay đổi chạy qua CI PR.

---

## 0. CARRY-OVER (làm ĐẦU TIÊN)

### CO2 — Fix alert status mismatch (2 file alerts.yml)
`MasteryDecayJobFailed` + `ProactiveCheckJobFailed` hiện watch `status="error"` (alerts.yml:104,142) nhưng code ghi `status="failed"` (tasks.py:313, worker.py:54) → **alert không bao giờ fire**. Sửa: đổi expr cả 2 file (`devops/prometheus/alerts.yml` + `devops/docker/prometheus/alerts.yml`) thành `status="failed"`. Verify: grep đối chiếu từng alert với giá trị `.labels(status=...)` thực tế trong `apps/api/app/core/tasks.py` + `worker.py` — KHÔNG còn alert nào trỏ `error` khi code chỉ ghi `failed` (và ngược lại). Đồng bộ comment.

### CO1 (phối hợp AI-A) — Retention enforce cho activity_events/notifications
AI-A đã bỏ TTL index def cho 2 collection (ISO string không TTL được) → **retention job `run_retention_cleanup` của bạn là nguồn enforce duy nhất**. Hiện job SKIP collection có TTL index — sau khi AI-A bỏ def, job phải:
1. Xử lý `activity_events` (giữ 180 ngày) + `notifications` (90 ngày) theo ISO `created_at` (parse + xóa quá hạn).
2. Đảm bảo cũng giữ `intelligence_snapshots` (TTL real trên `expire_at` datetime — xử lý nếu cần).
3. Test: doc quá hạn bị xóa, doc còn hạn giữ lại; `M9` inc đúng collection/status.

## 1. Trạng thái ĐÃ CÓ (verified — không làm lại)

- Helm 3 chart: `ascendly-api` (Deployment+HPA+Ingress+Service), `ascendly-runtime` (worker/cron+KEDA), `platform-base` (ConfigMap/Secret/ns/RBAC/PDB/NetworkPolicy). Probes K8s + Docker HEALTHCHECK đã đúng `/api/v1/health` + `/health/ready`.
- `devops/k8s/`: 14 file — `api-hpa.yaml` CÓ; **web KHÔNG HPA** (web-deployment.yaml replicas:1). Secrets chỉ placeholder `sealedsecrets.bitnami.com/placeholder: "true"`.
- CI: `ci.yml` (304 dòng, có coverage gate 45%, lint-regression, manifest-check, docker-build **chỉ verify tag :test KHÔNG push**); `preview.yml` (e2e + lighthouse-ci + chromatic). **KHÔNG có release.yml.**
- Docker: `devops/docker/Dockerfile.api` (multi-stage api/worker/cron) + `Dockerfile.web` (standalone). Compose dev-only.
- Grafana 2 dashboards (api-metrics, adaptive-metrics 13 panel). Alerts 2 file.

## 2. Nhiệm vụ

### NV1 — CO2 (mục 0)

### NV2 — CO1 retention (mục 0)

### NV3 — Release pipeline (`release.yml`) + registry
1. **Registry**: cấu hình login ghcr (hoặc registry có sẵn) qua GitHub secrets (`REGISTRY_*`). Push image **immutable tag**: `ascendly-api:<sha>` / `ascendly-web:<sha>` + alias `<major.minor>` (vd `1.0.0`).
2. **Workflow `release.yml`**: trigger `workflow_dispatch` (env: staging|production) + tag push. Pipeline: build → push image → `helm upgrade --install` (api/runtime/platform-base) + deploy web manifest (k8s) → **chạy smoke (AI-A `make smoke` với SMOKE_BASE_URL) → nếu xanh promote tiếp → rollout status check**.
3. **Promotion gate staging→prod**: smoke xanh + optional manual approval (environment protection rule) trước khi prod. Ghi rõ trong README cách chạy.
4. **Image version hiện tại**: `values-prod.yaml:3` hardcode `v1.0.0` — đổi sang inject qua CI (values override `image.tag`).
5. Không phá các job CI hiện có.

### NV4 — HPA cho web + hoàn thiện scaling
1. Thêm HPA cho web (k8s/web-deployment + nếu khả thi helm): CPU 70%/mem 80%, min 2/max 10, gated per-env (dev tắt — giống pattern api-hpa.yaml).
2. Verify KEDA scaledobject worker (đã có) vẫn hợp lệ.

### NV5 — Secrets thật (SOPS hoặc SealedSecret)
1. Chọn 1 (nêu lý do): **SOPS + age** (đơn giản, local-encrypt, phù hợp repo này) hoặc **SealedSecret** (cần controller). Đi kèm: script encrypt/decrypt (`devops/scripts/secrets-*.sh`), file mẫu `secrets.staging.enc.yaml`, placeholder cũ thay bằng cơ chế thật + README.
2. KHÔNG commit secret thật (chỉ encrypted); CI decrypt trong job release nếu cần.
3. `.env.example` bổ sung block staging/prod (ENVIRONMENT=staging/production, URL khác) — không bắt buộc thêm biến mới.

### NV6 — Rollback runbook
1. `devops/README.md` hoặc `devops/runbook/rollback.md`: quy trình rollback (helm rollback --to-revision N, k8s rollout undo, khôi phục image tag cũ, verify smoke sau rollback), checklist.
2. Script `devops/scripts/rollback.sh` (tham số env + revision).

### NV7 — CI & regression
- `make test-api` ≥ **231 pass** (khớp AI-A; nếu AI-A chưa xong ghi nhận 231 hiện tại).
- Manifest checks: helm lint 3 charts + helm template + kubeconform (qua CI — local không có tool); YAML/JSON parse toàn bộ.
- README: mục Phase 8 (release flow, secrets, rollback, retention).
- Lint-regression gate: baseline ruff/mypy KHÔNG tăng (0 finding mới từ file của bạn).

## 3. Ranh giới
- Được sửa: `devops/**`, `.github/**`, `docker-compose.yml`, `.env.example`, `apps/api/app/worker.py` + `app/core/tasks.py` (CHỈ cron/retention/metric — logic do bạn quản lý). KHÔNG sửa `apps/web/**`, logic API `app/services/**`/`app/api/v1/**`.
- CO1/CO2 nếu chạm `apps/api` → giới hạn trong tasks/worker/metric như đã nêu; phối hợp AI-A nếu cần thêm gì (báo cáo).

## 4. Định Nghĩa Hoàn Thành
- [ ] CO2: không còn alert trỏ `status` sai; verify 2 file.
- [ ] CO1: retention xóa activity_events/notifications quá hạn (test), M9 đúng.
- [ ] NV3: `release.yml` build+push+helm+smoke gate; thử dry-run qua CI; README.
- [ ] NV4: web HPA (gated dev), k8s+helm.
- [ ] NV5: SOPS/SealedSecret + script + README, placeholder thay thế.
- [ ] NV6: rollback runbook + script.
- [ ] NV7: `make test-api` ≥ 231 (khi AI-A xong), manifest checks pass qua CI.

## 5. MẪU BÁO CÁO
```
=== BÁO CÁO AI-B — PHASE 8 ===
0. CO2: [alert nào sửa; verify status thực tế]
   CO1: [retention xử lý 2 collection; test; M9]
1. Release pipeline: [registry; tag; flow; smoke gate; thử qua CI?]
2. Web HPA: [min/max; gated dev]
3. Secrets: [SOPS hay SealedSecret; lý do; script; file mẫu]
4. Rollback: [runbook; script; checklist]
5. CI: [make test-api; manifest checks; lint-regression baseline]
6. File đã sửa/tạo: [...]
7. Rủi ro: [không chạy local infra; smoke chờ AI-A/staging; secrets CI decrypt]
8. Sẵn sàng hỗ trợ E2E AI-C trên staging (deploy staging trước W2): [CÓ/KHÔNG]
=== HẾT BÁO CÁO ===
```

*— Supervisor. Lưu ý: W2 phụ thuộc bạn deploy staging TRƯỚC để AI-A smoke + AI-C E2E chạy. Release.yml cần gate smoke xanh trước khi promote prod.*
