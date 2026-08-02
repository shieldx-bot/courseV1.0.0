# PROMPT GIAO VIỆC — AI-B (DevOps) — PHASE 5: Adaptive Learning — Metrics, Alerts, Cron, Redis

> **Từ:** Supervisor
> **Cho:** AI-B — Chuyên viên DevOps (Docker, K8s/Helm, CI/CD, Prometheus, Grafana)
> **Bối cảnh:** Phase 4 đã sign-off (manifest checks OK, scrape config api/worker/cron, NetworkPolicy, seed hook). Phase 5 = observability cho Adaptive Mastery Engine. Chi tiết chung xem `AI_PROMPTS/phase5/WORK_DIVISION_PHASE5.md`.

---

## 1. Trạng thái ĐÃ CÓ (verified — không làm lại)

- Scrape config: compose (`ascendly-api → api:8000`, `ascendly-worker → worker:9101`, `ascendly-cron → cron:9101`) + canonical `devops/prometheus/prometheus.yml`.
- K8s Service `ascendly-worker-metrics`/`ascendly-cron-metrics` (:9101) + NetworkPolicy allow metrics ingress/egress — đã xong P4.
- Alert `LLMCostSpike` đã đổi metric `llm_cost_usd_total` (P4).
- Redis: `services/cache.py` (AI-A) đã có read-through + fallback in-memory; `docker-compose` đã có redis service.
- CI: manifest-check (helm lint 3 charts, helm template, kubeconform -strict) pass; không cần sửa cho Service/NetworkPolicy.

## 2. Nhiệm vụ

### NV1 — Chốt contract metric adaptive (LÀM TRƯỚC, phối hợp AI-A)
Bảng M1–M5 trong `AI_PROMPTS/phase5/WORK_DIVISION_PHASE5.md` §4 là tên metric CHỐT:
- `adaptive_quiz_generated_total{mode, course_id}` (Counter)
- `adaptive_quiz_submitted_total{mode, passed}` (Counter)
- `adaptive_quiz_submit_duration_seconds{course_id}` (Histogram)
- `adaptive_mastery_decay_runs_total{status}` (Counter)
- `adaptive_remediation_generated_total{concept_id}` (Counter)

Trách nhiệm: xác nhận tên/labels khớp chuẩn Prometheus (suffix `_total` cho counter, `_seconds` cho histogram), ghi chú vào README observability. **Không chờ AI-A — chốt ngay để AI-A instrument cùng lúc.**

### NV2 — Grafana dashboard "Adaptive Learning"
Tạo `devops/docker/grafana/dashboards/adaptive-metrics.json`:
- Dựng khung đầy đủ panel (dùng `absent()` hoặc ghi chú "waiting for data") để panel tồn tại ngay; sau khi AI-A instrument xong thì số liệu tự fill.
- Panels: quiz throughput (M1, rate 5m), submit pass-rate (M2), submit latency p50/p95 (M3, histogram_quantile), mastery decay runs + status (M4), remediation generation (M5).
- Register dashboard (grafana provisioning đã có pattern từ api-metrics.json P4 — theo đúng cách đó).

### NV3 — Alerts (dry-run chính xác)
Trong `devops/prometheus/alerts.yml` (+ bản docker `devops/docker/prometheus/alerts.yml` — đồng bộ tên metric ở cả 2, giữ nguyên ngưỡng lịch sử):
- `AdaptiveQuizHighErrorRate`: `rate(adaptive_quiz_submitted_total{passed="false"}[5m]) / rate(adaptive_quiz_submitted_total[5m]) > 0.05` — pending 10m.
- `AdaptiveQuizSlowSubmit`: `histogram_quantile(0.95, rate(adaptive_quiz_submit_duration_seconds_bucket[5m])) > 3` — pending 10m.
- `MasteryDecayJobFailed`: `rate(adaptive_mastery_decay_runs_total{status="error"}[5m]) > 0` (hoặc job up = 0 nếu cron chết).
- Giữ `LLMCostSpike` (đã sync P4).
- Verify: promtool (nếu có) hoặc parse YAML + rule expression kiểm tra thủ công; dry-run qua config.

### NV4 — Redis cho adaptive cache
- Verify `docker-compose.yml`: redis service đã có; đảm bảo không cần đổi cho Phase 5 (AI-A sẽ dùng `services/cache.py` với fallback in-memory).
- Kiểm tra TTL/eviction config mặc định hợp lý cho cache mastery map (60–120s TTL — đủ ngắn, không cần đổi Redis).
- Nếu thấy cần `REDIS_URL`/`REDIS_PASSWORD` đúng env cho worker/cron → thêm vào `.env.example` + compose (chỉ khi cần, không tự ý thêm).

### NV5 — Deploy cron mastery decay (chờ AI-A NV4)
Sau khi AI-A thêm `run_mastery_decay` vào cron_jobs:
- Verify deployment worker/cron: image, `PROCESS_MODE=cron` chạy cron_jobs, lịch daily 04:00 không trùng 03:00 proactive.
- Manifest checks chạy lại: helm lint (3 charts), helm template, kubeconform -strict cho `devops/k8s/` + rendered charts.
- Alert fail job đã có ở NV3.

### NV6 — CI & regression
- Không sửa `.github/workflows/ci.yml` trừ khi cần thêm bước check dashboard JSON (nếu có pattern cũ — theo nó).
- `make test-api` chạy lại → phải ≥ 185 pass (khớp AI-A target; nếu AI-A chưa xong, ghi nhận baseline 173 và chạy lại sau).
- Ghi chú cập nhật `devops/README.md` (dashboard mới, alerts mới, cron decay).

## 3. Ranh giới
- Chỉ sửa `devops/**`, `docker-compose.yml`, `.env.example`, `.github/**`. KHÔNG sửa `apps/api/**` logic, `apps/web/**`.
- Không đổi tên metric AI-A đang instrument; nếu xung đột → báo Supervisor.
- Không hợp nhất 2 bản alerts.yml lịch sử lệch ngưỡng (giữ nguyên, chỉ đồng bộ tên metric).

## 4. Định Nghĩa Hoàn Thành
- [ ] NV1: bảng M1–M5 xác nhận + ghi README.
- [ ] NV2: dashboard `adaptive-metrics.json` có 5 panel, provisioning đúng pattern.
- [ ] NV3: 3 alert mới + giữ LLMCostSpike; parse/dry-run không lỗi.
- [ ] NV4: Redis verify (không phá cấu hình hiện có).
- [ ] NV5: cron decay deploy verified (sau khi AI-A xong) + manifest checks xanh.
- [ ] NV6: `make test-api` xanh (≥185 khi AI-A xong), helm lint/template + kubeconform pass, README cập nhật.

## 5. MẪU BÁO CÁO
```
=== BÁO CÁO AI-B — PHASE 5 ===
1. Metric contract: [M1–M5 xác nhận; ghi chú]
2. Dashboard: [panels, provisioning, trạng thái chờ data]
3. Alerts: [3 alert + LLMCostSpike; dry-run kết quả]
4. Redis: [verify gì, đổi gì/không đổi]
5. Cron decay: [verify sau khi AI-A xong — lịch, batch, up alert]
6. CI: [make test-api kết quả; manifest checks]
7. File đã sửa/tạo: [...]
8. Rủi ro: [metric chưa có data; tên metric AI-A đổi giữa chừng...]
9. Sẵn sàng Phase 6 (remediation metrics + analytics): [CÓ/KHÔNG]
=== HẾT BÁO CÁO ===
```

*— Supervisor. Lưu ý: chốt tên metric M1–M5 NGAY để AI-A instrument cùng lúc; nếu AI-A đổi tên counter (như vụ llm_cost ở P4) → alert sẽ chết, cần sync lại.*
