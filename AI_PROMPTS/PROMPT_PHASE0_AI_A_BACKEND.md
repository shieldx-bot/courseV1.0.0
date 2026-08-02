# PROMPT GIAO VIỆC — AI-A (Backend) — PHASE 0: Nền Tảng & Chuẩn Hóa

> **Từ:** Supervisor (người giám sát)
> **Cho:** AI-A — Chuyên viên Backend (FastAPI, MongoDB, Redis, LLM, domain services)
> **Khi nhận prompt này, bạn là AI-A. Thực hiện đúng các nhiệm vụ Phase 0 dưới đây, KHÔNG làm thêm ngoài phạm vi, và gửi báo cáo theo đúng mẫu ở cuối.**

---

## 1. Bối cảnh dự án

- Đây là repo monorepo **Ascendly** (nền tảng học online premium): backend FastAPI tại `apps/api/`, frontend Next.js tại `apps/web/`.
- Kiến trúc: **Modular Monolith** với domain events, response envelope `{success, data, error, meta}`, rate limit bằng SlowAPI, DB MongoDB (test dùng `memory://`), worker Redis.
- Tài liệu tham khảo: `ENGINEERING_PLAYBOOK.md`, `SYSTEM ARCHITECTURE AUDIT.md` (mục C1/H1/M1/M2/L1 ở Step 10).
- Mục tiêu Phase 0: làm nền tảng kỹ thuật vững chắc (CI xanh, test tin cậy, code sạch) TRƯỚC khi thêm tính năng lớn ở các phase sau.

## 2. Ranh giới (BẮT BUỘC tuân thủ)

- Bạn được sửa: `apps/api/**` (services, api/v1, core, db, schemas, tests, migrations).
- Bạn **KHÔNG được** sửa: `apps/web/**`, `k8s/**`, `helm/**`, `docker/**`, `docker-compose.yml`, `.github/**` (trừ khi có task DevOps riêng).
- Không thay đổi response envelope `{success, data, error, meta}`.
- Không thêm feature mới. Phase 0 chỉ là dọn nợ kỹ thuật & làm test tin cậy.

## 3. Khảo sát thực tế đã ghi nhận (để bạn không làm lại việc đã xong)

Đây là trạng thái VERIFIED trước khi giao việc — đọc kỹ để chỉ xử lý phần còn thiếu:

| Mục | Trạng thái hiện tại |
|---|---|
| `apps/api/tests/conftest.py` | ĐÃ có fixture `disable_rate_limiter` (autouse) gán `app.state.limiter.enabled = False`. Test dùng `fastapi.testclient.TestClient(app)` trực tiếp. Force `MONGODB_URI=memory://test`. |
| `apps/api/tests/test_community_ai.py` | ĐÃ dùng `asyncio.run(seed_skills())` — KHÔNG còn `asyncio.get_event_loop()`. |
| `apps/api/app/services/intelligence.py` | Cần kiểm tra trực tiếp: dead helper `_safe` và unused import `Any` theo Audit L1 (chưa verify). |
| Pydantic v2 `Config` class | Cần quét toàn bộ `apps/api/app/schemas/` — chưa verify. |
| In-memory DB `$push` parity | CHƯA có mutation helpers + parity test — cần làm mới. |

## 4. Nhiệm vụ cụ thể (theo thứ tự ưu tiên)

### Nhiệm vụ 1 — Verify & đóng chặt test isolation (C1)
1. Chạy **toàn bộ** suite `cd apps/api && pytest tests/ -x` (hoặc tương đương) và ghi lại kết quả.
2. Nếu xuất hiện `429 Rate limit exceeded` khi chạy gộp suite → tìm nguyên nhân (limiter không được disable ở một số test tự tạo client riêng, hoặc limiter được khởi tạo lại) và sửa tại `conftest.py` (fixture autouse phủ mọi test).
3. Đảm bảo fixture `disable_rate_limiter` áp dụng cho MỌI TestClient instance (kể cả test tự tạo client).
4. Ghi test riêng nhỏ để chứng minh: chạy 2 file test gộp lại (ví dụ `test_events.py + test_ecosystem.py`) trong cùng lệnh pytest → không còn 429.

### Nhiệm vụ 2 — Quét & dọn Pydantic v2 (M2)
1. Quét toàn bộ `apps/api/app/schemas/*.py` và `**/models/**` tìm class-based `Config` (deprecated).
2. Chuyển sang `model_config = ConfigDict(...)` đúng chuẩn Pydantic v2.
3. Chạy `pytest` toàn bộ để đảm bảo không vỡ.

### Nhiệm vụ 3 — Mutation helpers + parity test in-memory DB (H1)
1. Tạo/hoàn thiện module helpers trong `apps/api/app/db/helpers.py` để chuẩn hóa các mutation: `create_doc`, `update_doc`, `push_to_array`, `increment_field`, `set_fields` (dùng chung cho Mongo thật và in-memory).
2. Viết parity test `apps/api/tests/test_db_parity.py`:
   - Cùng thao tác `$push`/`$addToSet`/`$inc` qua helper trên Mongo thật (nếu có) và in-memory → kết quả phải giống nhau.
   - Nếu chạy cả 2 được, ít nhất test trên in-memory để lộ lỗi `$push` không persist (như Audit đã ghi nhận ở ops task history).
3. Kết quả: mọi service trong tương lai nên dùng helper thay vì gọi trực tiếp operator Mongo.

### Nhiệm vụ 4 — Dọn dead code (L1)
1. Mở `apps/api/app/services/intelligence.py`, xóa helper `_safe` không dùng và import `Any` nếu không dùng (verify từng cái trước khi xóa).
2. Chạy `py_compile` + pytest để chắc không vỡ.

### Nhiệm vụ 5 — Xác nhận migration runner (hỗ trợ AI-B)
1. Đọc `apps/api/migrations/README.md` + cách runner hoạt động.
2. Ghi chú vào báo cáo: lệnh chạy migration hiện tại, cách thêm migration mới, có idempotent không. (AI-B sẽ dùng thông tin này để dựng CI.)

## 5. Định nghĩa hoàn thành (Definition of Done) — Phase 0 dành cho AI-A

- [ ] `cd apps/api && python -m pytest tests/ -q` → 100% pass, không có 429.
- [ ] Test gộp 2+ file chạy chung → không 429.
- [ ] Không còn class-based `Config` trong schemas (grep xác nhận).
- [ ] `helpers.py` có mutation helpers + `test_db_parity.py` pass.
- [ ] Không còn `_safe`/unused import trong `intelligence.py`.
- [ ] Không sửa file ngoài `apps/api/**`.
- [ ] `py_compile` tất cả file Python đã sửa pass.

## 6. MẪU BÁO CÁO — gửi về cho Supervisor sau khi hoàn thành

```
=== BÁO CÁO AI-A — PHASE 0 ===
1. Tổng quan: [1-2 câu tóm tắt]
2. Kết quả từng nhiệm vụ:
   - Nhiệm vụ 1 (test isolation): [đã xử lý/không cần/chi tiết + kết quả lệnh]
   - Nhiệm vụ 2 (Pydantic v2): [số file đã sửa, danh sách]
   - Nhiệm vụ 3 (DB parity): [helper đã tạo gồm hàm nào; test pass không]
   - Nhiệm vụ 4 (dead code): [đã xóa gì]
   - Nhiệm vụ 5 (migration runner): [ghi chú cho AI-B]
3. Kết quả test cuối:
   - `pytest tests/ -q`: [X pass / Y fail / Z error] (ghi rõ)
   - Test gộp file: [kết quả]
4. File đã sửa/tạo: [danh sách]
5. Rủi ro/điểm cần Supervisor chú ý: [nếu có]
6. Sẵn sàng nhận việc Phase tiếp theo: [CÓ / KHÔNG + lý do]
=== HẾT BÁO CÁO ===
```

## 7. Quy trình với Supervisor

1. Bạn làm xong → gửi báo cáo theo mẫu trên.
2. Supervisor sẽ kiểm tra (chạy lại test, review diff) → phản hồi hoặc yêu cầu sửa.
3. Khi Supervisor xác nhận → chờ nhận prompt Phase tiếp theo. KHÔNG tự ý bắt đầu phase mới.

---

*Chúc bạn hoàn thành tốt Phase 0. — Supervisor*