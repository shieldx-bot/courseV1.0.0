# PROMPT GIAO VIỆC — AI-A (Backend) — PHASE 8: Production Readiness (Smoke + Config + Carry-over TTL)

> **Từ:** Supervisor
> **Cho:** AI-A — Chuyên viên Backend (FastAPI, MongoDB, pytest)
> **Bối cảnh:** Phase 7 đã sign-off (231 pytest). Phase 8 = Production Readiness: đóng băng API, smoke suite post-deploy, config theo env, + **1 carry-over TTL**. Chiến thuật: CI là nguồn verify chính; không thay đổi response nào đã công bố.

---

## 0. CARRY-OVER (làm ĐẦU TIÊN) — CO1: TTL index trên ISO string không expire

**Vấn đề (phát hiện khi verify P7):** `db/indexes.py:161/164` khai báo TTL index cho `activity_events` (180 ngày) và `notifications` (90 ngày) trên field `created_at`, nhưng mọi nơi ghi dữ liệu đều dùng `.isoformat()` (string, ví dụ `mongodb.py:960/975/990`) → **MongoDB TTL thật CHỈ expire field BSON Date → string không bao giờ hết hạn**. Retention job của AI-B hiện SKIP collection có TTL index → `activity_events`/`notifications` tăng vô hạn ở prod.

**Quyết định của Supervisor (plan A — chọn, không bàn luận):**
1. **Bỏ TTL index def** của `activity_events` + `notifications` trong `db/indexes.py` (giữ TTL của `intelligence_snapshots` — field `expire_at` là datetime, chạy được; và `event_deliveries` trên `processed_at`).
2. Giữ nguyên format `created_at` ISO string (đổi sang BSON Date ảnh hưởng read-path nhiều nơi — rủi ro cao ở phase cuối, KHÔNG làm).
3. **Retention job của AI-B (W1) là nguồn enforce duy nhất** cho 2 collection này (xóa theo ISO `created_at`). Bạn không viết job — chỉ đảm bảo field `created_at` luôn có ở mọi doc (kiểm tra `create_activity` community.py + notifications.py + remediation.py event: tất cả đều ghi).
4. Test: index def không còn TTL cho 2 collection; `create_activity`/notification luôn có `created_at` ISO hợp lệ; in-memory backend không phá.

## 1. Trạng thái ĐÃ CÓ (verified — không làm lại)

- `/api/v1/health` (main.py:264) + `/api/v1/health/ready` (main.py:273, ping Mongo+Redis, 200/503) **đã tồn tại**; K8s probes (helm ascendly-api deployment.yaml:69–87) + Docker HEALTHCHECK (Dockerfile.api:62) **đã cấu hình đúng 2 path này** → không cần endpoint mới, chỉ verify.
- `config.py` có `environment: str = "development"` (:14) + các biến env phổ biến — đủ cho P8 (không yêu cầu refactor enum phức tạp).
- `/metrics` qua telemetry (:225–227). Sentry init theo `settings.sentry_dsn` (:131–138).
- **Chưa có smoke suite post-deploy** (survey xác nhận: không thư mục smoke, Makefile không target smoke).

## 2. Nhiệm vụ

### NV1 — CO1 (mục 0) — bỏ TTL def + verify created_at

### NV2 — Smoke suite post-deploy
1. Tạo `tests/test_smoke.py` (hoặc thư mục `tests/smoke/`) — **điểm khác biệt: chạy bằng httpx/requests với base URL từ env `SMOKE_BASE_URL`** (mặc định `http://localhost:8000/api/v1`), KHÔNG dùng in-memory fixture. Khi `SMOKE_BASE_URL` không set → skip (pytest `skipif`), để suite CI thường không bị ảnh hưởng.
2. Luồng smoke tối thiểu (critical paths): `GET /health` 200 → `GET /health/ready` 200 (hoặc 503 degraded — không fail cứng nếu Redis tắt) → login thật (mock credential qua env `SMOKE_USER`/`SMOKE_PASSWORD`, skip nếu thiếu) → `GET /courses` trả list → `GET /adaptive/concepts/{course_id}` trả data → tạo support ticket + xem lại. Envelope `{success, data}` đúng mọi response.
3. Thêm Makefile target `make smoke` (chạy `pytest tests/test_smoke.py` với SMOKE_BASE_URL).

### NV3 — Config runtime theo env (tối thiểu)
1. `config.py`: thêm validator/assert `environment` ∈ {development, staging, production} (fail fast khi typo); đảm bảo `cors_origins`, `frontend_url` đọc đúng per-env (đã có — chỉ verify).
2. Không thêm field mới trừ khi thiếu thật sự (báo cáo nếu cần).

### NV4 — Tests & regression
- Full suite giữ **≥ 231 pass** (không giảm); smoke tests (khi chạy với SMOKE_BASE_URL) xanh.
- `python -m pytest tests/ -q` xanh.

## 3. Ranh giới
- Chỉ sửa `apps/api/**`, `Makefile` (target smoke). KHÔNG sửa `apps/web/**`, `devops/**`, `.github/**` (trừ báo cáo nếu cần AI-B phối hợp).
- **Đóng băng API**: không đổi response shape, không thêm endpoint mới (health đã có). Không phá envelope.
- CO1 chỉ đụng `db/indexes.py` + verify — không đổi write format `created_at`.

## 4. Định Nghĩa Hoàn Thành
- [ ] CO1: TTL def `activity_events`/`notifications` bị bỏ; mọi doc có `created_at`; test.
- [ ] NV2: smoke suite + `make smoke`; chạy thử local (base URL http://localhost:8000 nếu API chạy được, hoặc ghi rõ cần staging).
- [ ] NV3: validator environment fail-fast.
- [ ] NV4: pytest ≥ 231 pass.

## 5. MẪU BÁO CÁO
```
=== BÁO CÁO AI-A — PHASE 8 ===
0. CO1: [TTL def bỏ; verify created_at; test]
1. Smoke: [test nào; chạy bằng base URL nào; kết quả]
2. Config: [validator; có thêm field gì không]
3. Tests: [số test trước/sau; smoke pass?]
4. File đã sửa/tạo: [...]
5. Rủi ro: [smoke cần staging; probe path; created_at thiếu chỗ nào]
6. Sẵn sàng hỗ trợ release (fix bug trong quá trình deploy): [CÓ/KHÔNG]
=== HẾT BÁO CÁO ===
```

*— Supervisor. Lưu ý: smoke của bạn là GATE cho AI-B promote (release.yml chờ smoke xanh). Nếu smoke cần staging → nêu rõ để AI-B deploy staging trước.*
