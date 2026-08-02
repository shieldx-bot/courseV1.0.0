# PROMPT GIAO VIỆC — AI-B (DevOps) — PHASE 3: Proactive Support — Email Dev + Cron + Monitoring

> **Từ:** Supervisor
> **Cho:** AI-B — Chuyên viên DevOps
> **Bối cảnh:** Phases 0–2 đã sign-off. AI-A đang mở rộng Proactive Support: job sẽ gửi email intervention (learning_stall), cron proactive (đã có `run_proactive_support_checks`), expose metric `llm_*`. Nhiệm vụ của bạn: hạ tầng email dev, đảm bảo cron/schedule, và monitoring. KHÔNG làm lại những gì đã có.

---

## 1. Trạng thái ĐÃ CÓ (verified)

| Thành phần | Hiện trạng |
|---|---|
| Email backend | ✅ `services/email.py` có SMTP thật + `[DEV EMAIL]` fallback (smtp_host/user/pass trong config) |
| Docker compose | ✅ Có mongo, redis, (meili nếu có) — **CHƯA có mailhog/mailpit** |
| Cron worker | ✅ `apps/api/app/worker.py` có cron `run_proactive_support_checks` (hour 3) + `run_email_campaigns_task` (minute 30), `run_analytics_task` (hour 2) |
| Prometheus/Grafana | ✅ Đã có alerts `llm_*` từ Phase 2 (chờ metric backend export) |
| K8s/Helm | ✅ Đã verify helm lint/template + kubeconform; network policy có egress HTTPS 443 + SMTP 587 |

## 2. Nhiệm vụ

### NV1 — Mailpit cho email dev
1. Thêm **Mailpit** vào `docker-compose.yml` (service `mailpit`, port 1025 SMTP / 8025 UI).
2. Thêm env cho API worker: `SMTP_HOST=mailpit`, `SMTP_PORT=1025`, `SMTP_USER=` (rỗng), `SMTP_PASSWORD=` (rỗng) — cho dev.
3. Cập nhật `Makefile` target `compose-up` để bật cả mailpit (hoặc ghi chú `compose-up-all` nếu tách). Cập nhật `devops/README.md`: cách mở `http://localhost:8025` xem email.
4. Đảm bảo `email.py` khi không config SMTP thật vẫn print `[DEV EMAIL]` (đã có) — không vỡ.

### NV2 — Cron/schedule proactive
1. Xác nhận `run_proactive_support_checks` cron hiện tại (hour 3) phù hợp — AI-A sẽ mở rộng nội dung (4 detect + batch). Bạn chỉ cần:
   - Đảm bảo cron không trùng lặp (arq cron chạy 1 lần; nếu dùng CronJob k8s → `ttlSecondsAfterFinished` nếu có).
   - Nếu cần đổi schedule (vd chạy 15 phút/lần theo file 15) — quyết định: **giữ hour 3** để an toàn cost lúc đầu; ghi chú cho AI-A/Supervisor nếu muốn tăng tần suất sau.
2. K8s: nếu CronJob/worker deployment phải chạy proactive job riêng → kiểm tra `devops/k8s/cron-deployment.yaml` + Helm `ascendly-runtime` (PROCESS_MODE=cron) đã đúng chưa. Không tự ý đổi schedule nếu chưa bàn.

### NV3 — Monitoring & metric LLM
1. Xác nhận alerts `llm_*` trong `devops/prometheus/alerts.yml` + `devops/docker/prometheus/alerts.yml` đúng tên metric AI-A sẽ export: `llm_requests_total{provider,status}`, `llm_tokens_total{provider}`, `llm_cost_total_usd{provider}`. Nếu tên khác → ghi chú cho AI-A.
2. Thêm alert (nếu chưa có) cho **proactive job**: `ProactiveCheckJobFailed` — dùng metric hiện có của worker (nếu có) hoặc ghi chú cần thêm metric `proactive_checks_total{status}` từ backend.
3. Cập nhật Grafana dashboard nếu cần panel proactive (interventions triggered, email sent).

### NV4 — CI không vỡ
- `make test-api`, `make test-web`, migration-check, helm/kubeconform vẫn pass với compose thay đổi.
- CI không cần Mailpit (backend test không gửi email thật).

## 3. Ranh giới
- Chỉ sửa: `docker-compose.yml`, `Makefile`, `devops/**`, `.github/**`, `.env.example` (thêm SMTP vars nếu cần).
- KHÔNG sửa logic `apps/api/**` (email.py, tasks.py là của AI-A).
- KHÔNG commit secret SMTP thật (chỉ placeholder).

## 4. Định Nghĩa Hoàn Thành
- [ ] Mailpit có trong compose + SMTP env dev cho API/worker + doc.
- [ ] Makefile/compose-up bật mailpit.
- [ ] Cron proactive schedule xác nhận không trùng lặp + ghi chú.
- [ ] Alert proactive job (hoặc ghi chú metric cần từ backend).
- [ ] CI test xanh.

## 5. MẪU BÁO CÁO
```
=== BÁO CÁO AI-B — PHASE 3 ===
1. Mailpit: [service + port + env + cách xem mail]
2. Cron proactive: [xác nhận schedule; k8s/helm cron đúng chưa]
3. Monitoring: [alert proactive; tên metric chờ AI-A]
4. Metric llm_: [tên khớp chưa]
5. CI: [kết quả test]
6. File đã sửa/tạo: [...]
7. Rủi ro/giới hạn: [...]
8. Sẵn sàng Phase 4 (Adaptive Learning infra): [CÓ/KHÔNG]
=== HẾT BÁO CÁO ===
```

*— Supervisor. Lưu ý: AI-A dùng `email.py` hiện có (fallback DEV) — bạn chỉ cần Mailpit để dev có UI xem email.*