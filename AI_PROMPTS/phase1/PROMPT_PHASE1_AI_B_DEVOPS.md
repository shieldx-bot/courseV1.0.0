# PROMPT GIAO VIỆC — AI-B (DevOps) — PHASE 1: Support System — Hạ Tầng & CI End-to-End

> **Từ:** Supervisor
> **Cho:** AI-B — Chuyên viên DevOps
> **Bối cảnh:** Phase 0 **đã sign-off** (có điều kiện). Bạn đã dựng CI song song + Makefile + migration-check. AI-A vừa fix 2 bug migration → `cli migrate` chạy được. Nhiệm vụ Phase 1: **đưa CI chạy được end-to-end thực sự** và **chuẩn bị seed data dev** cho Support System. KHÔNG làm lại những gì đã có.

---

## 1. Trạng thái ĐÃ CÓ (verified — không làm lại)

| Thành phần | Trạng thái |
|---|---|
| `.github/workflows/ci.yml` | ✅ Đã có job `api` + `web` song song (cache pip/npm), `migration-check`, `docker-build`, `security-scan`, `gate` chung |
| `Makefile` | ✅ Đã có đủ target: setup, compose-up, test-api, test-web, build-api, build-web, lint, migrate, dev... |
| `devops/scripts/ci-migration-check.sh` | ✅ Fail-fast khi migration không chạy |
| Migration runner | ✅ Đã fix bởi AI-A: `python -m app.core.cli migrate <full_name>` + `seed` chạy được |
| Docker/K8s/Helm | ⚠️ Trước đó chưa verify được local (docker permission, kubectl/helm absent) — **cần xử lý trong Phase 1** |

## 2. Nhiệm vụ

### NV1 — Đưa CI chạy được end-to-end trên repository thực tế
1. **Verify docker build trong CI**: đảm bảo job `docker-build` có đường dẫn đúng (`devops/docker/Dockerfile.api`, `devops/docker/Dockerfile.web` — vì git track infra ở `devops/`), build context đúng. Nếu local không chạy được, CI phải chạy được.
2. **Cài kubectl + helm trong CI** (hoặc dùng action sẵn có) để chạy `helm template` thật + `kubectl apply --dry-run=client` cho `devops/k8s/` — từ bỏ giới hạn "chỉ parse YAML" của Phase 0.
3. **Migration-check end-to-end**: cập nhật script để chạy đúng lệnh mới `python -m app.core.cli migrate 001_seed_categories` + `002_add_indexes` + `seed` trên DB sạch; xác nhận pass.
4. **CI sped-up**: xem lại cache có thực sự bật không; fail-fast cho 2 job API/Web.

### NV2 — Seed data dev cho Support System
1. Tạo script seed (hoặc Makefile target `seed-support`) giả lập dữ liệu dev cho môi trường local:
   - 5–8 `help_articles` mẫu (billing, technical, account, general) — nếu cần bổ sung ngoài FAQ có sẵn.
   - 3–5 `support_tickets` mẫu với trạng thái khác nhau (open, in_progress, resolved, closed) + vài `ticket_messages`.
   - Đảm bảo idempotent (chạy nhiều lần không nhân đôi).
2. Đặt ở `devops/scripts/seed_support.py` hoặc tương tự — không đụng logic service.

### NV3 — Hỗ trợ môi trường dev Support
1. Đảm bảo `make compose-up` (hoặc target liên quan) khởi động đủ dịch vụ support cần (Mongo, Redis + Meilisearch nếu search KB dùng).
2. Document ngắn trong `devops/README.md`: cách chạy `make seed-support`, cách test local flow support (tạo ticket → admin xử lý).

### NV4 — Kiểm tra tổng CI
- Chạy thử `ci-migration-check.sh` local (nếu khả thi) → pass.
- Ghi rõ trạng thái CI sau thay đổi vào báo cáo (chưa cần trigger thật nếu không có quyền — ghi rõ).

## 3. Ranh giới
- Chỉ sửa: `.github/`, `devops/`, `Makefile`, `docker-compose.yml`. Không sửa `apps/api/app/**` (logic) và `apps/web/**`.
- KHÔNG deploy production.
- Nếu phát hiện bug thuộc backend (AI-A) → ghi rõ trong báo cáo, KHÔNG tự sửa logic.

## 4. Định Nghĩa Hoàn Thành
- [ ] CI `docker-build` + `helm template` + `kubectl dry-run` chạy được (trên CI nếu local không thể).
- [ ] `ci-migration-check.sh` pass với lệnh migration chuẩn mới.
- [ ] `seed_support` script idempotent chạy được trên dev.
- [ ] `make seed-support` (hoặc tương đương) hoạt động.
- [ ] Không sửa logic API/web.

## 5. MẪU BÁO CÁO
```
=== BÁO CÁO AI-B — PHASE 1 ===
1. CI end-to-end: [kết quả docker-build/helm/kubectl trên CI hoặc local + giới hạn]
2. Migration-check: [đã cập nhật thế nào; kết quả chạy thử]
3. Seed support: [path script; cách chạy; kết quả]
4. CI speed: [cải thiện gì]
5. File đã sửa/tạo: [...]
6. Rủi ro/giới hạn: [...]
7. Sẵn sàng Phase 2 (hỗ trợ chat AI/SSE): [CÓ/KHÔNG]
=== HẾT BÁO CÁO ===
```

*— Supervisor. Lưu ý: Phase 1 này không có migration DB mới — nếu AI-A thêm collection, bạn cập nhật migration-check tương ứng.*