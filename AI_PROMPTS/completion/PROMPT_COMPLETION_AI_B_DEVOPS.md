# PROMPT HOÀN TẤT — AI-B (DevOps) — Đóng 2 việc code + chuẩn bị release gate

> **Từ:** Supervisor
> **Cho:** AI-B — Chuyên viên DevOps
> **Bối cảnh:** Phase 0–8 đã sign-off (release.yml, HPA, SOPS, rollback, retention xong). Rà soát còn **1 vấn đề nghiêm trọng** (prod promote fail-open) + 2 việc nối/nền. Xem `AI_PROMPTS/completion/SUMMARY_REMAINING.md`.

---

## B1 (ƯU TIÊN CAO NHẤT) — Release gate FAIL-CLOSED cho PRODUCTION

**Vấn đề:** `release.yml` hiện **SKIP smoke** khi chưa cấu hình `SMOKE_BASE_URL` (line 172: `::warning::SMOKE_BASE_URL_STAGING not configured — smoke skipped`, line 237 tương tự cho production) → **deploy prod vẫn chạy mà không có gate smoke** = fail-open, nguy hiểm nhất trong toàn bộ remaining.

**Làm:**
1. **Production step: HARD-FAIL** — nếu `SMOKE_BASE_URL_PRODUCTION` không cấu hình HOẶC smoke không xanh → job `deploy-prod` **fail, không promote**. KHÔNG có đường "skip".
2. **Staging step**: giữ warning + skip (cho phép dev chạy thử staging chưa đủ secrets) — nhưng ghi log rõ.
3. Nếu khả thi: thêm option input `allow-smoke-skip: boolean` (mặc định false) để dev gỡ lỗi pipeline mà không chặn staging — prod luôn chặn.
4. Test: chạy `release-dry-run` + đọc code path — mô phỏng "production + không SMOKE_BASE_URL" → job phải fail (assert trong script test hoặc ghi rõ cách kiểm chứng trong báo cáo).

## B2 — Nối dashboard "Remediation Effectiveness" với endpoint AI-A (A1)

**Điều kiện:** AI-A phải xong A1 trước (endpoint `GET /admin/adaptive/analytics/remediation-effectiveness`).
1. Panel "Remediation Effectiveness" hiện là placeholder (`targets = []` — verified P6) → nối data source với endpoint mới (JSON API source hoặc ghi rõ cách; không bịa PromQL).
2. Cập nhật note panel: hết "cần analytics API" → nguồn thật.
3. Validate dashboard JSON (pattern P5–P8).

## B3 — Re-baseline lint-regression cuối + CI xanh

**Điều kiện:** sau khi AI-A xong A1–A3 (đợt hoàn tất).
1. Re-đo ruff/mypy baseline → cập nhật `devops/ci/{ruff,mypy}.count` nếu cần (tiêu chuẩn: 0 finding mới từ tất cả đợt).
2. `make test-api` ≥ **242 pass + 4 skip** (khớp AI-A sau hoàn tất).
3. Manifest checks: helm lint 3 charts + kubeconform (qua CI — local không có tool), YAML/JSON parse toàn bộ.

## B4 — Chuẩn bị deploy staging thật (chờ credentials)
- Kiểm tra `deploy.sh` + `rollback.sh` sẵn sàng nhận env `KUBECONFIG_STAGING`/`SMOKE_BASE_URL_STAGING`; ghi rõ lệnh chạy khi Supervisor cấp secrets (trong README).
- Checklist backup `age.key` (SOPS private) — ghi vào README (Supervisor sẽ cấp `AGE_SECRET_KEY`).

## DoD
- [ ] B1: prod promote fail-closed (không thể skip smoke); test/kiểm chứng.
- [ ] B2: dashboard panel nối endpoint A1 (sau khi AI-A báo cáo).
- [ ] B3: baseline cuối + `make test-api` ≥ 242+4 + manifest checks xanh.
- [ ] B4: README có lệnh staging + checklist age.key.
- Không làm giảm suite hiện có.

## MẪU BÁO CÁO
```
=== BÁO CÁO HOÀN TẤT AI-B ===
1. B1 fail-closed: [cách chặn prod; kiểm chứng thế nào]
2. B2 dashboard: [panel nối nguồn gì; hết placeholder chưa]
3. B3 baseline: [ruff/mypy sau re-đo; make test-api]
4. B4: [lệnh staging; checklist age.key]
5. File đã sửa/tạo: [...]
6. Rủi ro: [chưa chạy release thật; chờ AI-A A1]
=== HẾT BÁO CÁO ===
```

*— Supervisor. Lưu ý: B1 là việc duy nhất thuộc loại "bảo vệ production" còn thiếu — làm đầu tiên. B2 chờ AI-A A1; B3 chờ AI-A xong hết.*
