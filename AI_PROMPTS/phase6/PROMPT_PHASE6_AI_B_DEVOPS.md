# PROMPT GIAO VIỆC — AI-B (DevOps) — PHASE 6: Remediation Observability + Analytics

> **Từ:** Supervisor
> **Cho:** AI-B — Chuyên viên DevOps (Prometheus, Grafana, Docker, K8s/Helm, CI)
> **Bối cảnh:** Phase 5 đã sign-off (dashboard adaptive-metrics.json + 3 alert + metric contract M1–M5). Phase 6 = observability & analytics cho Remediation + AI Tutor (chạy nền LLM heavy). Chi tiết xem `AI_PROMPTS/phase5/WORK_DIVISION_PHASE5.md`.

---

## 1. Trạng thái ĐÃ CÓ (verified — không làm lại)

- Metric contract M1–M5 đã chốt + ghi `devops/README.md`; `adaptive-metrics.json` có 7 panel (một số chờ data).
- Alerts: `AdaptiveQuizHighErrorRate`, `AdaptiveQuizSlowSubmit`, `MasteryDecayJobFailed` + LLMCostSpike (giữ).
- Redis cache remedial: `generate_remedial_content` cache TTL 1h (AI-A sẽ thêm collection `remedial_content` ở P6 → cache TTL có thể tăng).
- CI: manifest-check (helm lint 3 charts, helm template, kubeconform -strict). Ghi nhận: local không có helm/kubeconform daemon → AI-B verify bằng YAML parse; CI là nguồn verify chính.

## 2. Nhiệm vụ

### NV1 — Chốt contract metric mở rộng M6–M7 (chờ AI-A, làm song song)
- **M6** `adaptive_remediation_feedback_total{helpful}` (Counter)
- **M7** `adaptive_remediation_exercise_submitted_total{concept_id, passed}` (Counter)
- Cập nhật bảng metric vào `devops/README.md`. M1–M5 KHÔNG đổi tên.

### NV2 — Dashboard "Adaptive Learning" mở rộng
Thêm panel vào `devops/docker/grafana/dashboards/adaptive-metrics.json`:
- M6: remediation feedback rate (helpful vs not, rate 5m) — bar chart 2 series.
- M7: exercise submissions by concept (top N) + pass-rate.
- **Analytics remediation effectiveness** (yêu cầu đặc tả 16-de-xuat §11 "Remediation effectiveness"): panel "% user cải thiện mastery sau remediation" — nguồn dữ liệu: so sánh mastery trước/sau từ `quiz_attempts` (không phải metric Prometheus; nếu chưa có API analytics → để panel placeholder ghi chú nguồn dữ liệu, không bịa query).
- Giữ các panel M1–M5 hiện có.

### NV3 — Alerts
- Giữ 3 alert Phase 5 + LLMCostSpike. **Remediation là LLM-heavy** → nếu `adaptive_remediation_generated_total` tăng đột biến kèm cost, `LLMCostSpike` sẽ bắt — không cần alert mới. Xác nhận trong báo cáo.
- Optional (nếu AI-A báo lỗi LLM remediation cao): `RemediationGenerationHighErrorRate` — chờ số liệu thực, KHÔNG thêm vội.

### NV4 — LLM timeout/retry cho remediation
- `generate_remedial_content` đã có try/except + fallback text. AI-B verify: không có retry tự động chồng lấn (tránh double-cost khi LLM chậm); nếu cần cấu hình timeout → đề xuất cụ thể cho AI-A (không tự sửa `apps/api/**`).
- Redis: khi AI-A thêm collection `remedial_content` (reuse cross-user), cache TTL 1h có thể tăng lên 24h — xác nhận Redis eviction không đổi gì (`expire` tự nhiên OK).

### NV5 — CI & regression
- Chạy lại `make test-api` → ≥ **200 pass** (khớp AI-A target; nếu AI-A chưa xong ghi nhận 190).
- Manifest checks: YAML parse toàn bộ `devops/k8s/*` + dashboard JSON validate (pattern Phase 5).
- Cập nhật `devops/README.md` (M6/M7, panel mới).

## 3. Ranh giới
- Chỉ sửa `devops/**`, `docker-compose.yml`, `.env.example`, `.github/**`. KHÔNG sửa `apps/api/**`, `apps/web/**`.
- Không đổi tên metric M1–M5; M6/M7 theo contract.

## 4. Định Nghĩa Hoàn Thành
- [ ] NV1: M6/M7 chốt + README.
- [ ] NV2: dashboard thêm M6/M7 + panel remediation effectiveness (placeholder nếu chưa có data).
- [ ] NV3: xác nhận alert đủ (LLMCostSpike là canary cho remediation).
- [ ] NV4: verify timeout/retry không double-cost; ghi chú TTL.
- [ ] NV5: `make test-api` ≥ 200 (khi AI-A xong), YAML/JSON checks pass, README cập nhật.

## 5. MẪU BÁO CÁO
```
=== BÁO CÁO AI-B — PHASE 6 ===
1. Metric contract: [M6/M7; README cập nhật]
2. Dashboard: [panel mới; remediation effectiveness nguồn từ đâu]
3. Alerts: [giữ gì; LLMCostSpike canary cho remediation]
4. LLM timeout/retry: [verify gì; đề xuất gì cho AI-A]
5. CI: [make test-api kết quả; manifest checks]
6. File đã sửa/tạo: [...]
7. Rủi ro: [metric chưa có data; effectiveness cần API analytics]
8. Sẵn sàng Phase 7 (Hardening): [CÓ/KHÔNG]
=== HẾT BÁO CÁO ===
```

*— Supervisor. Lưu ý: panel "remediation effectiveness" cần dữ liệu từ `quiz_attempts` (không phải metric) — nếu chưa có API analytics thì để placeholder, đừng bịa query.*
