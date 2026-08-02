# PROMPT GIAO VIỆC — AI-B (DevOps) — PHASE 7: Request-ID, Scheduler, Retention, CI Gates

> **Từ:** Supervisor
> **Cho:** AI-B — Chuyên viên DevOps (Prometheus, Grafana, Docker, K8s/Helm, CI, middleware)
> **Bối cảnh:** Phase 6 đã sign-off (dashboard 11 panel, M1–M7). Phase 7 = Architecture Hardening phần infra: trace correlation, scheduler cho intelligence, retention job, CI coverage gate. Chi tiết xem `SYSTEM ARCHITECTURE AUDIT.md` + prompt AI-A Phase 7 (NV5 tạo TTL index + M8).

---

## 1. Trạng thái ĐÃ CÓ (verified — không làm lại)

- Không có middleware request-id/trace; `app/main.py` chỉ có CORS, GracefulShutdown (48–61), SlowAPI; error_logs ghi url/method/ip nhưng không trace id.
- Cron hiện có (worker.py:105–117): email h1@:30, analytics 02:00, proactive 03:00, mastery_decay 04:00. Chưa có cron intelligence/snapshot/sync.
- `activity_events`/`notifications` KHÔNG có TTL index (AI-A sẽ thêm ở NV5: activity_events 180d, notifications 90d, intelligence_snapshots 30d). `notifications` hiện cap 500/user app-level.
- CI: `api` job chạy `pytest --cov=app --cov-report=xml` (dòng 64) nhưng **không có `--cov-fail-under`**; ruff/mypy `continue-on-error: true`; có job migration-check (119–136) nhưng chưa có bước seed verify.
- Prometheus scrape api:8000, worker:9101, cron:9101 đã cấu hình (P4). Metrics M1–M7 chốt.

## 2. Nhiệm vụ

### NV1 — Request-ID / trace correlation
1. Middleware mới trong `app/main.py` (hoặc `app/core/middleware.py`): nhận `X-Request-ID` nếu client gửi, ngược lại generate UUID; lưu vào contextvar (tạo `app/core/context.py` nếu cần); echo header trong response.
2. Đưa request-id vào: `error_logger` (thêm field), logs HTTP, và (nếu khả thi) Prometheus labels — ít nhất error_logs + response header.
3. Test: gọi endpoint có header → response trả đúng X-Request-ID; không có header → sinh id mới.

### NV2 — Cron cho intelligence snapshot + sync listener
1. **Snapshot cron**: chạy `build_intelligence_snapshot()` (AI-A NV5) — đề xuất **01:30** hằng ngày (trước analytics 02:00). Verify deployment worker/cron (PROCESS_MODE=cron) tự pickup cron mới (pattern P5 mastery_decay — không cần infra change).
2. **Sync listener cron**: `sync_from_intelligence_snapshot()` — đề xuất **05:00** hằng ngày.
3. **Metric M8** `intelligence_snapshot_runs_total{status}` (AI-A instrument trong `build_intelligence_snapshot`) → thêm vào contract README + alert `IntelligenceSnapshotJobFailed` (rate status=error > 0) + dashboard panel "Intelligence snapshot" (M8).
4. **Retention job**: cron **06:00** hàng ngày: xóa/archive `activity_events` quá hạn + `notifications` quá hạn (dựa TTL index AI-A thêm; nếu TTL index tự expire thì job chỉ xử lý collection không có TTL). Metric `retention_cleanup_runs_total{collection, status}` (M9 — chốt tên).

### NV3 — CI gates
1. **Coverage gate**: đo coverage hiện tại (chạy `pytest --cov=app --cov-report=term` local) → đặt `--cov-fail-under` dưới mức hiện tại ~5–10% (không làm đỏ ngay). Ghi rõ con số chọn + lý do trong báo cáo.
2. **migrate-on-empty + seed verify**: trong job migration-check, sau khi migrate DB in-memory → chạy seed (hook `seed_db()` đã có từ P4) → verify count collection chính > 0 (concept_definitions, help_articles...). Fail nếu seed không chạy.
3. ruff/mypy: giữ `continue-on-error: true` nhưng thêm job/bước report tổng số lỗi (đánh dấu regression — nếu số lỗi tăng → fail). Không ép thành gate chặn ngay.
4. Manifest checks giữ nguyên (helm lint + kubeconform).

### NV4 — Performance budgets p99 (nếu dữ liệu sẵn)
- Với endpoint nóng đã có histogram (submit quiz M3...): thêm panel p99 latency. Nếu chưa có dữ liệu p99 thật → ghi placeholder "waiting for data" (không bịa).
- Kiểm tra Prometheus scrape interval + retention cấu hình đủ cho p99 (ví dụ scrape 15s, giữ 15d).

### NV5 — README + regression
- Cập nhật `devops/README.md`: M8/M9, cron mới (01:30, 05:00, 06:00), request-ID, CI gates.
- `make test-api` → ≥ **215 pass** (khớp AI-A target; nếu AI-A chưa xong ghi nhận 205).
- YAML/JSON parse toàn bộ (pattern P5/P6); dashboard JSON validate.

## 3. Ranh giới
- Được sửa: `devops/**`, `.github/**`, `docker-compose.yml`, `.env.example`, `apps/api/app/main.py` + `app/core/*` (chỉ middleware/context — phần observability). KHÔNG sửa logic nghiệp vụ `app/services/**`, `app/api/v1/**`.
- Phối hợp: AI-A thêm TTL index + M8/M9 instrument — bạn chờ rồi verify; không tự sửa `app/db/indexes.py`.
- Không đổi tên metric M1–M7; M8/M9 theo contract.

## 4. Định Nghĩa Hoàn Thành
- [ ] NV1: middleware request-id + contextvar + error_logs + test.
- [ ] NV2: cron snapshot 01:30 + sync 05:00 + retention 06:00; M8/M9 alert + dashboard panel.
- [ ] NV3: coverage gate (số liệu đo thực), seed verify trong migration-check, ruff/mypy regression report.
- [ ] NV4: p99 panel (hoặc placeholder) + verify scrape/retention.
- [ ] NV5: README cập nhật, `make test-api` ≥ 215 (khi AI-A xong), YAML/JSON checks pass.

## 5. MẪU BÁO CÁO
```
=== BÁO CÁO AI-B — PHASE 7 ===
1. Request-ID: [middleware; header; error_logs; test]
2. Cron: [snapshot 01:30; sync 05:00; retention 06:00; verify deploy]
3. Metrics/Alerts: [M8/M9 chốt; alert mới; dashboard panel]
4. CI: [coverage gate — số đo hiện tại + ngưỡng; seed verify; ruff/mypy report]
5. p99: [panel/placeholder; scrape/retention]
6. CI kết quả: [make test-api; manifest checks]
7. File đã sửa/tạo: [...]
8. Rủi ro: [phụ thuộc AI-A TTL/M8; coverage hiện tại thấp...]
9. Sẵn sàng Phase 8 (Production Readiness): [CÓ/KHÔNG]
=== HẾT BÁO CÁO ===
```

*— Supervisor. Lưu ý: TTL index + M8/M9 do AI-A instrument — chờ báo cáo AI-A rồi verify chéo. Coverage gate đặt dựa số đo thực, không đoán.*
