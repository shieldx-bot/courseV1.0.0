# PROMPT BỔ SUNG 2 — AI-A (Backend) — PHASE 0: Fix 2 Bug Migration Runner (BLOCKER CI)

> **Từ:** Supervisor
> **Cho:** AI-A — Chuyên viên Backend
> **Trạng thái:** Báo cáo Phase 0 của bạn đã được Supervisor verify độc lập. Kết quả tốt: **129/129 pytest pass**, Pydantic v2 sạch, dead code sạch, DB helpers đủ. **NHƯNG 2 bug migration runner chưa được fix** — đây là blocker chặn CI xanh. Bạn cần fix 2 bug này rồi gửi lại báo cáo ngắn.

---

## 1. Kết quả Verify Độc Lập Của Supervisor

| Mục | Trạng thái verify |
|---|---|
| `pytest tests/ -q` | ✅ **129 passed / 0 failed** |
| `class Config:` trong `app/` | ✅ Đã sạch (Pydantic v2) |
| `_safe(` trong `app/` | ✅ Đã sạch (dead code) |
| DB helpers (`create_doc`, `push_to_array`, `increment_field`, `set_fields`, `safe_push_to_array`, `safe_add_to_set`, `update_doc`) | ✅ Đủ 7 hàm |
| **Bug 1: `apps/api/app/core/cli.py:14`** | ❌ **VẪN CÒN BUG** — `path = Path(__file__).parent.parent / "migrations" / f"{name}.py"` → trỏ `app/migrations` (thư mục KHÔNG tồn tại). Migration thật nằm ở `<repo>/apps/api/migrations/`. |
| **Bug 2: `apps/api/migrations/002_add_indexes.py`** | ❌ **VẪN CÒN BUG** — `from app.db.indexes import ensure_indexes` nhưng `app/db/indexes.py` chỉ có hàm `create_indexes` → sẽ `ImportError` khi chạy migration 002. |
| `tests/test_db_parity.py` | ✅ Đã có (8 test) — pass trong full suite |

## 2. Nhiệm vụ bắt buộc — Fix 2 Bug (chỉ 2 việc này)

### Bug 1 — Fix path trong `apps/api/app/core/cli.py`
Hiện tại:
```python
path = Path(__file__).parent.parent / "migrations" / f"{name}.py"
```
Phân tích: file `cli.py` nằm ở `apps/api/app/core/cli.py`. `Path(__file__).parent` = `.../app/core`, `.parent.parent` = `.../app` → ra `app/migrations` (sai).

Ta cần tới `apps/api/migrations`. Yêu cầu:
- Sửa để path trỏ đúng `<repo>/apps/api/migrations/{name}.py`.
- KHÔNG hardcode tuyệt đối — dùng `Path(__file__).resolve()` và điều chỉnh `.parents[N]` cho đúng (ví dụ: `.parents[2]` từ `cli.py` = `apps/api`, sau đó `/ "migrations"`).
- Sau khi sửa, CHẠY THỬ để chứng minh:
  ```bash
  cd apps/api && MONGODB_URI=memory://test .venv/bin/python -m app.core.cli migrate 001_seed_categories
  ```

### Bug 2 — Fix import trong `apps/api/migrations/002_add_indexes.py`
Hiện tại:
```python
async def run(db):
    from app.db.indexes import ensure_indexes
    await ensure_indexes()
    return {"indexes_ensured": True}
```
Yêu cầu:
- Hàm đúng trong `app/db/indexes.py` là `async def create_indexes(db: AsyncIOMotorDatabase) -> None`.
- Sửa thành:
  ```python
  async def run(db):
      from app.db.indexes import create_indexes
      await create_indexes(db)
      return {"indexes_ensured": True}
  ```
- Kiểm tra lại import: `create_indexes` nhận tham số `db` — truyền đúng.

### Sau khi fix — chạy thử cả 2 migration trên DB test
```bash
cd apps/api
MONGODB_URI=memory://test .venv/bin/python -m app.core.cli migrate 001_seed_categories
MONGODB_URI=memory://test .venv/bin/python -m app.core.cli migrate 002_add_indexes
MONGODB_URI=memory://test .venv/bin/python -m app.core.cli seed
```
- Migration `001` và `002` phải chạy KHÔNG lỗi (không `ImportError`, không "Migration not found").
- `seed` phải bỏ qua collection đã có (idempotent).

## 3. Định Nghĩa Hoàn Thành (DoD) — Bổ sung 2

- [ ] `cli.py` path trỏ đúng `apps/api/migrations/`.
- [ ] Migration 002 dùng `create_indexes` đúng tên + đúng tham số.
- [ ] Cả 2 migration chạy được trên DB test (xác nhận bằng log output trong báo cáo).
- [ ] `pytest tests/ -q` vẫn 129 pass (không vỡ gì do sửa).
- [ ] KHÔNG sửa file ngoài `apps/api/**`.
- [ ] Chỉ sửa 2 file: `app/core/cli.py` + `migrations/002_add_indexes.py` (+ README migration nếu cần ghi lệnh đúng).

## 4. MẪU BÁO CÁO NGẮN

```
=== BÁO CÁO AI-A — PHASE 0 (BỔ SUNG 2) ===
1. Bug 1 (cli.py path): [đã sửa như thế nào; output lệnh chạy migration 001]
2. Bug 2 (migration 002): [đã sửa như thế nào; output lệnh chạy migration 002]
3. Kết quả seed idempotent: [output]
4. pytest cuối: [X pass / Y fail]
5. File đã sửa: [danh sách]
=== HẾT BÁO CÁO ===
```

## 5. Lưu ý

- Đây là bước CUỐI để sign-off Phase 0. AI-B đang chờ bạn fix để CI job `migration-check` xanh.
- Sau khi bạn báo cáo, Supervisor sẽ verify lần cuối rồi giao Phase 1 (Support System Foundation) cho cả 3 AI.

---

*— Supervisor. Chỉ cần 2 việc này, không làm thêm gì khác.*