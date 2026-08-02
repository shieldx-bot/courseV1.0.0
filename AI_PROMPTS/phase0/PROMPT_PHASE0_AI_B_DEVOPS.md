# PROMPT GIAO VIỆC — AI-B (DevOps) — PHASE 0: Nền Tảng & Chuẩn Hóa

> **Từ:** Supervisor (người giám sát)
> **Cho:** AI-B — Chuyên viên DevOps (Docker, K8s/Helm, CI/CD, Observability, Release)
> **Khi nhận prompt này, bạn là AI-B. Thực hiện đúng các nhiệm vụ Phase 0 dưới đây, KHÔNG làm thêm ngoài phạm vi, và gửi báo cáo theo đúng mẫu ở cuối.**

---

## 1. Bối cảnh dự án

- Đây là repo monorepo **Ascendly**: backend FastAPI (`apps/api/`), frontend Next.js (`apps/web/`), infra tại `docker/`, `k8s/`, `helm/`, `prometheus/`.
- Hiện trạng infra: đã có `docker-compose.yml`, Dockerfiles (`docker/Dockerfile.api`, `docker/Dockerfile.web`), manifests `k8s/*` (đã hardened), Helm charts (3 charts: `platform-base`, `ascendly-api`, `ascendly-runtime`), cấu hình Prometheus/Grafana.
- **CI đã tồn tại**: `.github/workflows/ci.yml` và `.github/workflows/preview.yml` — cần review lại, không tạo mới từ đầu.
- **KHÔNG có Makefile** ở thư mục gốc — cần tạo local dev tooling.
- Tài liệu tham khảo: `ENGINEERING_PLAYBOOK.md`, `CLOUD NATIVE.md`, `RELEASE_MODEL.md`, `ENVIRONMENT_MODEL.md`, `SYSTEM ARCHITECTURE AUDIT.md`.
- Mục tiêu Phase 0: CI xanh & tin cậy, local dev tooling tiện, đảm bảo builds/tests chạy được nhất quán trên máy dev và CI.

## 2. Ranh giới (BẮT BUỘC tuân thủ)

- Bạn được sửa: `.github/workflows/**`, `docker/**`, `docker-compose.yml`, `Makefile` (tạo mới ở gốc), scripts CI/CD, `apps/api/migrations/README.md` (chỉ ghi chú/chỉnh doc runner nếu cần — không sửa migration logic).
- Bạn **KHÔNG được** sửa: code Python backend logic (`apps/api/app/**` trừ khi chỉ là doc/config), code frontend logic (`apps/web/app/**`, `apps/web/components/**`).
- Không thay đổi hành vi runtime của app (không đổi Dockerfile để thay đổi app code; chỉ build/packaging nếu cần cho CI).
- KHÔNG deploy lên production. Chỉ CI + local dev tooling + verify manifests.

## 3. Khảo sát thực tế đã ghi nhận (để bạn không làm lại việc đã xong)

| Mục | Trạng thái hiện tại (verified) |
|---|---|
| CI | ĐÃ có `.github/workflows/ci.yml` + `.github/workflows/preview.yml`. Cần đọc để biết còn thiếu gì (cache, job song song, migration check). |
| Makefile | CHƯA có — cần tạo. |
| `apps/api/tests/conftest.py` | Test API đã có fixture `disable_rate_limiter`, dùng `memory://` DB — chạy được không cần dịch vụ ngoài. |
| Web tests | Có `jest.config.ts`, `playwright.config.ts`, `lighthouse-budget.json` — cần verify scripts trong `apps/web/package.json`. |
| Migrations | Có `apps/api/migrations/` (0001, 0002…), README. Cần đọc README để biết cách runner hoạt động. |

## 4. Nhiệm vụ cụ thể (theo thứ tự ưu tiên)

### Nhiệm vụ 1 — Review & củng cố CI pipeline
1. Đọc `.github/workflows/ci.yml` và `.github/workflows/preview.yml`. Liệt kê hiện trạng: các job hiện có, có cache dependency (pip/npm) chưa, có chạy song song API/Web chưa.
2. Cải tiến `ci.yml`:
   - **Job 1 — API**: install Python (đúng version trong `apps/api/.python-version`), `pip install -r apps/api/requirements.txt`, chạy `pytest tests/` (working-dir `apps/api`).
   - **Job 2 — Web**: `npm ci`, chạy `tsc --noEmit`, `npm run build`, `npm test` (dựa trên scripts trong `apps/web/package.json`).
   - Chạy 2 job **song song**, có `actions/cache` cho `pip` và `~/.npm` / `node_modules`.
   - **Gate chung**: cả 2 job xanh → merge được.
3. **Thêm job Migration check** (quan trọng): job riêng chạy migration runner trên DB sạch (ví dụ: dùng `mongodb-memory-server` hoặc script test) để đảm bảo migration chạy được + idempotent. Nếu runner hiện tại chưa hỗ trợ chạy trong CI, ghi chú rõ vào báo cáo cho Supervisor.
4. **Web build không phụ thuộc API đang chạy**: đảm bảo CI build web không cần gọi API thật (dùng `NEXT_PUBLIC_API_URL` mock hoặc build không fetch runtime).

### Nhiệm vụ 2 — Tạo Makefile local dev tooling
Tạo `Makefile` ở thư mục gốc với các target (chạy được trên máy dev Linux/macOS):
```makefile
# Các target bắt buộc
setup          # cài dependencies: pip cho apps/api + npm ci cho apps/web
compose-up     # docker compose up -d (mongodb, redis, meilisearch,...)
compose-down   # docker compose down
test-api       # cd apps/api && python -m pytest tests/ -q
test-web       # cd apps/web && npm test
build-api      # kiểm tra py_compile / build
build-web      # cd apps/web && npm run build
lint           # chạy lint cho cả 2 app (nếu config có sẵn)
migrate        # chạy migration runner cho apps/api
dev            # chạy cả api + web ở chế độ dev (2 terminal hoặc đồng thời)
```
- Dùng các lệnh thực tế đã có trong `apps/api/requirements.txt` / `apps/web/package.json`.
- Ghi chú trong README gốc (hoặc file mới) cách dùng `make setup`, `make test-api`…

### Nhiệm vụ 3 — Verify build & manifest
1. Chạy thử `docker build -f docker/Dockerfile.api .` và `docker build -f docker/Dockerfile.web .` (nếu Docker sẵn có) — ghi kết quả. Nếu không build được do thiếu context, ghi rõ giới hạn vào báo cáo.
2. `kubectl apply --dry-run=client -f k8s/` (nếu có kubectl) hoặc `helm template` cho 3 charts → ghi kết quả verify. KHÔNG deploy thật.

### Nhiệm vụ 4 — Kiểm tra migration runner & seed trong CI
1. Đọc `apps/api/migrations/README.md` — mô tả cách chạy migration hiện tại (lệnh gì, thứ tự, idempotent không).
2. Đảm bảo CI job migration dùng đúng cách đó. Nếu thiếu, thêm script/ghi chú.

## 5. Định nghĩa hoàn thành (Definition of Done) — Phase 0 dành cho AI-B

- [ ] `.github/workflows/ci.yml` có 2 job API + Web chạy song song, có cache, có gate chung.
- [ ] CI chạy được toàn bộ pytest API (không cần dịch vụ ngoài nhờ conftest memory).
- [ ] CI build web thành công không phụ thuộc API thật.
- [ ] Có job/who check migration chạy trên DB sạch (hoặc ghi chú rõ giới hạn).
- [ ] `Makefile` tạo xong với đủ target, chạy được `make setup`, `make test-api`, `make test-web`.
- [ ] Build Docker + verify manifests ghi rõ kết quả trong báo cáo.
- [ ] Không sửa code logic API/web.

## 6. MẪU BÁO CÁO — gửi về cho Supervisor sau khi hoàn thành

```
=== BÁO CÁO AI-B — PHASE 0 ===
1. Tổng quan: [1-2 câu tóm tắt]
2. Kết quả từng nhiệm vụ:
   - Nhiệm vụ 1 (CI review & củng cố): [hiện trạng cũ → đã đổi gì; job API/Web/cache; thời gian ước tính]
   - Nhiệm vụ 2 (Makefile): [danh sách target đã tạo]
   - Nhiệm vụ 3 (Build & manifest verify): [kết quả docker build / kubectl dry-run / helm template]
   - Nhiệm vụ 4 (Migration check): [cách runner hoạt động; job migration có/không; giới hạn nếu có]
3. File đã sửa/tạo: [danh sách]
4. Kết quả chạy thử:
   - `make test-api`: [kết quả]
   - `make test-web`: [kết quả]
   - CI trigger thử (nếu có quyền): [kết quả]
5. Rủi ro/điểm cần Supervisor chú ý: [ví dụ: need secrets cho CI, Docker context, thời gian build]
6. Sẵn sàng nhận việc Phase tiếp theo: [CÓ / KHÔNG + lý do]
=== HẾT BÁO CÁO ===
```

## 7. Quy trình với Supervisor

1. Bạn làm xong → gửi báo cáo theo mẫu trên.
2. Supervisor sẽ kiểm tra → phản hồi hoặc yêu cầu sửa.
3. Khi Supervisor xác nhận → chờ nhận prompt Phase tiếp theo. KHÔNG tự ý bắt đầu phase mới.

---

*Chúc bạn hoàn thành tốt Phase 0. — Supervisor*