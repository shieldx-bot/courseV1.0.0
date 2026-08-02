# PROMPT GIAO VIỆC — AI-A (Backend) — PHASE 7: Architecture Hardening (Split Services + Domain Events)

> **Từ:** Supervisor
> **Cho:** AI-A — Chuyên viên Backend (FastAPI, MongoDB, event bus, arq)
> **Bối cảnh:** Phase 6 đã sign-off (205 pytest). Phase 7 = Architecture Hardening theo `SYSTEM ARCHITECTURE AUDIT.md`: tách god service, publish domain events, snapshot intelligence, contract collection names. **Nguyên tắc số 1: KHÔNG thay đổi response nhìn từ ngoài — mọi refactor qua shim.**

---

## 1. Trạng thái ĐÃ CÓ (verified — không làm lại)

- `app/services/ecosystem.py` — **833 dòng monolith**, 5 domain: Creator (66–308), Collections/Marketplace (338–425), Challenge versioning (428–483), Events (487–596), Moderation (602–717), Platform Intelligence (721). **Chỉ 1 router** `app/api/v1/ecosystem.py:9` import + gọi 19 hàm.
- Event bus đã đầy đủ: `app/core/events.py` (EventBus: register/subscribe/publish/catalog/dependencies/diagnostics + singleton `bus`). Đang có **2 event PascalCase**: `ChallengeCompleted` (community.py:85), `EventCreated` (ecosystem.py:522). `event_handlers.py` có 6 handler + `register_default_handlers()` (main.py:93).
- `app/services/community.py` (444 dòng) chứa toàn bộ grading: `_grade_challenge` (25), `submit_challenge` (37), `analyze_attempt` (110) — router `api/v1/challenges.py:10` import trực tiếp.
- `intelligence.py` (282 dòng): `overview()` (271) chạy request-time, **scan toàn bộ activity_events (100k–200k docs)** khi admin gọi `GET /admin/intelligence/overview`.
- `platform_ops.py`: `sync_from_intelligence` (162) chỉ chạy khi admin bấm `POST /admin/ops/sync` — không cron.
- `db/indexes.py`: 28 collection có index, **`activity_events`/`notifications` KHÔNG có index/TTL**. Không `expireAfterSeconds` ở đâu cả.
- Cron hiện có: email (h1@:30), analytics (02:00), proactive (03:00), mastery_decay (04:00).

## 2. Nhiệm vụ

### NV1 — Split `ecosystem.py` (giữ shim, ZERO contract change)
1. Tạo service mới: `app/services/creator.py` (66–308), `app/services/marketplace.py` (338–483: collections + challenge versions), `app/services/events_service.py` (487–596), `app/services/moderation.py` (602–717). `platform_intelligence` (721) → chuyển sang `app/services/intelligence.py`.
2. **`ecosystem.py` trở thành FACADE**: giữ nguyên tên module + re-export tất cả hàm cũ từ module mới (pattern `from .creator import *` + khai báo `__all__`) → router `api/v1/ecosystem.py` và 19 call sites KHÔNG đổi một dòng.
3. Nội bộ service mới: giữ nguyên logic (KHÔNG refactor hành vi), chỉ di chuyển + đảm bảo import đúng.

### NV2 — Move challenge grading ra `challenges_service.py`
1. Tạo `app/services/challenges_service.py`: chuyển `_grade_challenge`, `submit_challenge`, `analyze_attempt` (+ logic grading liên quan) từ `community.py`.
2. `community.py` re-export shim cho các hàm đó (router `api/v1/challenges.py:10` không đổi).
3. KHÔNG đổi response shape submit/analyze.

### NV3 — Publish 8–10 domain events mới (PascalCase, theo convention hiện có)
Publish tại điểm hành động + đăng ký handler idempotent trong `event_handlers.py`:
| Event | Nơi publish (gợi ý) |
|---|---|
| `ChallengePublished` | community.py — hàm publish challenge |
| `CreatorFollowed` | community.py — follow |
| `CreatorVerified` | ecosystem/creator.py — review_creator_verification |
| `RatingChanged` | community.py — rate |
| `CertificateIssued` | service cấp chứng chỉ (tìm nơi phát certificate) |
| `ReportSubmitted` | ecosystem/moderation.py — submit_report |
| `ModerationCompleted` | ecosystem/moderation.py — resolve_report |
| `SkillMastered` | mastery_engine/concept_mastery — khi mastery đạt ngưỡng (≥ 7.0) |
| `UserRegistered` | auth/registration flow |
| `EventJoined` | ecosystem/events_service.py — join_event |

Yêu cầu:
- Giữ `ChallengeCompleted` + `EventCreated` (đã có) — không đổi tên.
- Handler **idempotent** (đăng ký qua bus, chống chạy lại gây trùng state).
- **Test idempotency**: publish cùng event 2 lần → state không đổi (vd không tạo 2 notification/counter tăng 2 lần).
- Cập nhật governance catalog (`GET /admin/events/catalog`) tự động có (bus đã support).

### NV4 — Schema contract module
Tạo `app/core/collections.py`: hằng số ánh xạ tên collection (`COLLECTIONS.ACTIVITY_EVENTS = "activity_events"`, ...). Thay hardcode string trong **services mới** (creator/marketplace/events_service/moderation/challenges_service) + ít nhất `intelligence.py` + `event_handlers.py`. Không bắt buộc thay toàn repo.

### NV5 — Intelligence snapshot (giảm request-time scan 100–200k docs)
1. Refactor `overview()` → `build_intelligence_snapshot()`: query có giới hạn/batch (không scan toàn bộ), ghi kết quả vào collection `intelligence_snapshots` (doc: `{type: "overview", generated_at, data}`).
2. Endpoint `GET /admin/intelligence/overview`: đọc snapshot mới nhất (TTL ngắn, fallback tính live nếu chưa có snapshot — giữ hành vi cũ khi worker chưa chạy).
3. `sync_from_intelligence` (platform_ops.py): thêm hàm `sync_from_intelligence_snapshot()` chạy được từ cron (không cần admin bấm) — giữ endpoint admin cũ.
4. **TTL index** (phần này do AI-A — DB change): thêm vào `db/indexes.py`: `activity_events` (expireAfterSeconds 180 ngày), `notifications` (90 ngày), `intelligence_snapshots` (30 ngày). AI-B sẽ dựa vào đây cho retention job.

### NV6 (optional, ưu tiên thấp — chỉ làm nếu còn thời gian) — Dual-source counter contract
Đồng bộ `stats.attempts/ratings` qua event thay vì cập nhật trực tiếp (nếu khả thi và không làm phức tạp). KHÔNG bắt buộc cho sign-off.

### NV7 — Tests
Thêm: split regression (19 hàm ecosystem + router không đổi), challenges_service (grade/submit/analyze), event publish + idempotency (từng event mới), snapshot (endpoint đọc snapshot khi có, fallback live khi chưa có), TTL index tồn tại trong indexes. **Target: 205 → ≥ 215 passed.**

## 3. Ranh giới
- Chỉ sửa `apps/api/**`. KHÔNG sửa `apps/web/**`, `devops/**`, `.github/**`, `docker-compose.yml`.
- **ZERO contract change**: mọi router/call site giữ nguyên qua shim. Không đổi response envelope.
- Không đổi tên event đã có (`ChallengeCompleted`, `EventCreated`).
- Metrics: KHÔNG đổi M1–M7. Nếu thêm metric snapshot (đề xuất M8 `intelligence_snapshot_runs_total{status}`) → báo trong báo cáo cho AI-B.

## 4. Định Nghĩa Hoàn Thành
- [ ] NV1: 4 service mới + facade, router không đổi dòng, pytest xanh.
- [ ] NV2: `challenges_service.py` + shim community.py.
- [ ] NV3: 8–10 event mới publish + handler idempotent + test idempotency.
- [ ] NV4: `app/core/collections.py` + thay trong services mới + intelligence + handlers.
- [ ] NV5: snapshot + endpoint đọc snapshot + `sync` chạy cron được + TTL index (activity_events/notifications/snapshots).
- [ ] NV7: pytest ≥ 215 pass.
- [ ] `python -m pytest tests/ -q` xanh.

## 5. MẪU BÁO CÁO
```
=== BÁO CÁO AI-A — PHASE 7 ===
1. Split ecosystem: [4 service + facade; router đổi dòng? (phải = 0)]
2. challenges_service: [grading chuyển; shim]
3. Events: [danh sách event mới publish; handler idempotent; test]
4. collections.py: [module; đã thay ở đâu]
5. Snapshot: [build_intelligence_snapshot; endpoint đọc; sync cron; TTL index]
6. Optional NV6: [làm/không, lý do]
7. Tests: [số test trước/sau]
8. File đã sửa/tạo: [...]
9. Rủi ro: [contract vô tình đổi; event handler trùng; snapshot cũ]
10. Sẵn sàng Phase 8 (Production Readiness): [CÓ/KHÔNG]
=== HẾT BÁO CÁO ===
```

*— Supervisor. Lưu ý: shim phải giữ NGUYÊN public API của ecosystem.py/community.py — router không được đổi dòng nào. AI-B cần M8 + TTL index để dựng cron/alert.*
