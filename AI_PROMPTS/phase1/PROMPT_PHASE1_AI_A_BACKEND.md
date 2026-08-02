# PROMPT GIAO VIỆC — AI-A (Backend) — PHASE 1: Support System — Hoàn Thiện & Kiểm Thử

> **Từ:** Supervisor
> **Cho:** AI-A — Chuyên viên Backend
> **Bối cảnh:** Phase 0 đã **integration sign-off** (129/129 pytest, migration chạy được, CI tiến triển). Khảo sát cho thấy phần lớn Support System backend đã triển khai sẵn. Bạn KHÔNG làm lại. Nhiệm vụ của bạn là **gap-fill + kiểm thử** các phần còn thiếu/không chắc chắn.

---

## 1. Trạng thái ĐÃ CÓ (verified — không làm lại)

| Thành phần | Trạng thái |
|---|---|
| `services/support_tickets.py` | ✅ Đã có: `create_ticket`, `add_message`, `get_ticket`, `get_ticket_messages`, `get_user_tickets`, `list_tickets`, `update_ticket_status`, `assign_ticket`, `rate_ticket`, `get_stats`, `check_sla_breaches`, `send_ticket_notification` (SLA P1/P2/P3 + auto-priority) |
| `services/knowledge_base.py` | ✅ Đã có: `create_article`, `update_article`, `delete_article`, `get_article_by_slug`, `get_article`, `search_articles`, `list_articles`, `record_article_feedback`, `increment_article_views` |
| API `api/v1/support.py` | ✅ User: GET/POST `/tickets`, GET `/tickets/{id}`, POST `/tickets/{id}/messages`, POST `/tickets/{id}/satisfaction`, POST `/chat`, GET/DELETE `/chat/history` |
| API admin support | ✅ Trong `support.py`: `admin_router` — GET `/tickets`, GET `/tickets/{id}`, POST `/tickets/{id}/status`, POST `/tickets/{id}/assign` (cần xác nhận prefix + có stats chưa) |
| API `api/v1/knowledge.py` | ✅ Trang help articles: GET `/articles`, GET `/articles/search`, GET `/articles/{slug}` (+ increment views) — cần xác nhận admin CRUD articles (create/update/delete) có hay chưa |
| Seed `help_articles` | ✅ Có trong `app/db/mongodb.py` (tự insert FAQ khi collection rỗng); index trong `app/db/indexes.py` |
| `test_support_system.py` | ✅ Đã tồn tại và pass (trong 129) |

## 2. Nhiệm vụ — Gap-fill & Kiểm thử

### NV1 — Xác nhận & đóng chặt admin support API
1. Mở `apps/api/app/api/v1/support.py`, xác định prefix của `admin_router` (dự kiến `/admin/support`). Báo cáo chính xác các path.
2. Kiểm tra còn thiếu endpoint nào so với chuẩn file 15:
   - Admin list tickets có filter (status/category/priority/assigned) chưa?
   - **Admin support stats** (`GET /admin/support/stats` — tickets by category, resolution time, satisfaction) CÓ hay CHƯA? Nếu thiếu → thêm endpoint dùng `get_stats()` có sẵn.
   - **Admin knowledge articles CRUD** (create/update/delete article) CÓ hay CHƯA? Nếu thiếu → thêm admin endpoints gọi `create_article`/`update_article`/`delete_article` có sẵn.
3. Mọi admin endpoint phải có `Depends(require_admin)`.

### NV2 — Củng cố test `test_support_system.py`
1. Đọc test hiện tại, liệt kê coverage.
2. Bổ sung test nếu thiếu cho các luồng quan trọng:
   - User tạo ticket (không phải admin).
   - Admin assign + update status → user thấy phản hồi đúng.
   - SLA breach logic (`check_sla_breaches`) — tạo ticket P1 quá hạn → trả breach đúng.
   - Knowledge: search theo keyword, feedback tăng `helpful_count`.
   - Feedback `satisfaction` cập nhật stats.
3. Bảo đảm: `pytest tests/test_support_system.py -q` pass.

### NV3 — Đảm bảo seed help_articles & permissions nhất quán
1. Xác nhận seed FAQ trong `mongodb.py` đủ nội dung cho hỗ trợ billing/technical/account (không nhất thiết nhiều, nhưng đủ categories).
2. Kiểm tra quyền: user thường KHÔNG được tạo/xóa article (chỉ admin); user thường chỉ xem + feedback.
3. Fix nếu phát hiện lỗi quyền.

### NV4 — Regression tổng
- Chạy `cd apps/api && .venv/bin/python -m pytest tests/ -q` → phải **129+ pass / 0 fail** (số test tăng do bạn thêm).

## 3. Ranh giới
- Chỉ sửa `apps/api/**`. Không sửa `apps/web/**`, `.github/**`, `Makefile`, `devops/**`.
- Giữ nguyên response envelope `{success, data, error, meta}`.
- KHÔNG thêm tính năng AI/chat mới (Phase 2 sẽ xử lý AI support).

## 4. Định Nghĩa Hoàn Thành
- [ ] Admin support có đủ: list, detail, status, assign, **stats**, **knowledge CRUD** (nếu thiếu đã thêm).
- [ ] `test_support_system.py` phủ: tạo ticket, assign/status, SLA, search KB, feedback, satisfaction.
- [ ] `pytest tests/ -q` full pass (≥129).
- [ ] Báo cáo chính xác các route admin hiện có + prefix.

## 5. MẪU BÁO CÁO
```
=== BÁO CÁO AI-A — PHASE 1 ===
1. Admin support hiện có (prefix + path): [liệt kê]
2. Đã thêm/sửa gì (endpoint/stats/knowledge CRUD nếu thiếu): [...]
3. Test support: [số test trước/sau; kết quả]
4. Seed/permission: [xác nhận]
5. pytest cuối: [X pass / Y fail]
6. File đã sửa/tạo: [...]
7. Rủi ro: [...]
8. Sẵn sàng Phase 2 (AI Support - chat RAG): [CÓ/KHÔNG]
=== HẾT BÁO CÁO ===
```

*— Supervisor*