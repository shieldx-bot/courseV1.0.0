# PROMPT GIAO VIỆC — AI-B (DevOps) — PHASE 2: AI Support — Hạ Tầng LLM + SSE + Giám Sát

> **Từ:** Supervisor
> **Cho:** AI-B — Chuyên viên DevOps
> **Bối cảnh:** Phase 0, 1 đã sign-off. AI-A sẽ thêm endpoint `/support/chat/stream` (SSE) + dùng LLM (OpenRouter/Gemini/Groq/OpenAI) + gọi `call_llm_stream`. Nhiệm vụ của bạn: chuẩn bị hạ tầng cho LLM/SSE trong dev & prod, rate-limit/timeout, và giám sát chi phí. KHÔNG làm lại những gì đã có.

---

## 1. Trạng thái ĐÃ CÓ (verified)

| Thành phần | Hiện trạng |
|---|---|
| LLM config backend | ✅ `apps/api/app/core/config.py` đã có: `openai_api_key/base_url/model`, `openrouter_*`, `gemini_*`, `tavily_api_key` (đọc từ `.env`) |
| ConfigMap/Secret k8s | ✅ `devops/k8s/configmap.yaml` + `secret.yaml` đã tồn tại (cần chắc có placeholder cho LLM keys) |
| docker-compose | ✅ Đã có (trỏ `devops/docker/...`) |
| CI | ✅ Đã có job api/web/migration-check/manifest-check (kubeconform) + gate |
| Prometheus/Grafana | ✅ `devops/prometheus/alerts.yml`, `devops/docker/prometheus`, `devops/docker/grafana` đã có |

## 2. Nhiệm vụ

### NV1 — LLM keys cho dev & CI
1. Tạo `.env.example` (nếu chưa) ghi rõ các biến LLM: `OPENAI_API_KEY` / `OPENAI_BASE_URL` / `OPENAI_MODEL`, `OPENROUTER_API_KEY`, `GEMINI_API_KEY`, `TAVILY_API_KEY` — với comment "để trống = fallback".
2. Cập nhật `docker-compose.yml` env passthrough: `OPENAI_API_KEY=${OPENAI_API_KEY:-}`, `OPENROUTER_API_KEY=${...}`, tương tự — để dev chạy local có key.
3. K8s: đảm bảo `devops/k8s/secret.yaml` + Helm `values*.yaml` có placeholder keys cho LLM (không commit key thật).

### NV2 — SSE qua proxy/ingress (quan trọng)
AI-A sẽ thêm `POST /support/chat/stream` trả `text/event-stream`. Bạn cần đảm bảo SSE không bị buffer:
1. **nginx/ingress**: thêm annotation/header hỗ trợ SSE — ví dụ nginx ingress: `nginx.ingress.kubernetes.io/proxy-buffering: "off"`, hoặc cấu hình tương đương cho Helm ingress template (`devops/helm/ascendly-api/templates/`).
2. **Helm**: nếu ingress template chưa có annotation này → thêm (chỉ cho path support chat stream, hoặc toàn ingress nếu chấp nhận).
3. **docker-compose dev**: nếu có reverse proxy Caddy/nginx trong compose → đảm bảo buffering tắt cho đường chat.

### NV3 — Rate-limit & timeout cho chat
1. Backend đã có rate limit (SlowAPI) — xác nhận `/support/chat` + `/support/chat/stream` có giới hạn hợp lý (ví dụ 10 req/phút/user). Nếu chưa, phối hợp AI-A (backend) — bạn chỉ ghi chú ở hạ tầng.
2. Timeout: đảm bảo ingress/proxy timeout (e.g. `proxy-read-timeout: 120s`) đủ dài cho stream LLM nhưng không vô hạn.
3. Ghi rõ vào báo cáo giá trị cấu hình cụ thể.

### NV4 — Giám sát LLM cost & lỗi
1. Thêm metric/alert cho chat LLM:
   - Alert: `llm_error_rate > 20%` trong 5 phút (Prometheus).
   - Alert: chi phí/rate tăng bất thường nếu metric có (hoặc log-level detection).
2. Cập nhật `devops/prometheus/alerts.yml` + Grafana dashboard nếu cần.
3. Đảm bảo `error_logger` backend hứng lỗi LLM (AI-A xử lý code; bạn chỉ đảm bảo log shipping).

### NV5 — Kiểm tra CI không vỡ
- `make test-api`, `make test-web`, migration-check vẫn pass với config mới (không cần key thật trong CI — mock).

## 3. Ranh giới
- Chỉ sửa: `devops/`, `.github/`, `Makefile`, `docker-compose.yml`, `.env.example` (tạo mới), Helm templates.
- KHÔNG sửa logic `apps/api/app/**` (chỉ nếu cần sửa config env — ghi chú cho AI-A).
- KHÔNG commit secret thật.

## 4. Định Nghĩa Hoàn Thành
- [ ] `.env.example` + compose passthrough + k8s/Helm placeholder LLM keys.
- [ ] Ingress/Helm annotation tắt proxy-buffering cho SSE (chat stream).
- [ ] Timeout/rate-limit ghi rõ giá trị cấu hình.
- [ ] Prometheus alert llm_error_rate (hoặc tương đương).
- [ ] CI test vẫn xanh.

## 5. MẪU BÁO CÁO
```
=== BÁO CÁO AI-B — PHASE 2 ===
1. LLM keys dev/CI: [file đã tạo/sửa; phương án secret]
2. SSE proxy: [annotation/header cụ thể; áp dụng path nào]
3. Timeout/rate-limit: [giá trị cụ thể]
4. Monitoring: [alert mới; dashboard]
5. Kết quả test: [make test-api/test-web; migration-check]
6. File đã sửa/tạo: [...]
7. Rủi ro/giới hạn: [...]
8. Sẵn sàng Phase 3 (Proactive cron + email): [CÓ/KHÔNG]
=== HẾT BÁO CÁO ===
```

*— Supervisor*