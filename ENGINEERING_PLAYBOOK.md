# Ascendly Engineering Playbook

Living set of engineering standards and architectural guardrails.
Every future contribution should naturally follow these rules.

---

## 1. Architecture

### Layering

- **Routers** (app/api/v1/*.py): HTTP concerns only. Parse/validate request params, call exactly one service function, wrap the result.
- **Services** (app/services/*.py): business logic, data access, domain rules. Never import FastAPI, never return HTTP objects.
- **Core** (app/core/*.py): cross-cutting shared abstractions (response envelopes, auth deps, config, rate-limit, telemetry).
- **DB** (app/db/*.py): persistence adapters (MongoDB/in-memory), index definitions, seeding.

**Rule:** Services must not leak persistence details. Routers must not contain business logic.

### Shared Abstractions Over Duplication

When a pattern appears in 2+ places, extract a shared abstraction:

| Pattern | Shared home | Notes |
|---|---|---|
| Service-result → HTTP envelope | `app/core/response.py::service_response()` | Converts `{"error": True}` into 400/404/200. Never write a local `_or_error` again. |
| Batch loading | `app/services/ecosystem.py::_load_users_batch / _load_challenges_batch` | Eliminates N+1. Add `_load_X_batch` for new collections. |
| Notification creation | `app/services/notifications.py::create_notification()` | Every meaningful action should emit one. |

---

## 2. API Design

- All responses use the `{success, data, error, meta}` envelope from `app/core/response.py`.
- **Never return HTTP 200 + success:true when a service reported an error.** Always use `service_response(result)` on any endpoint whose service can return `{"error": True, ...}`.
- Query params follow: `limit` (capped), `page`/`before` for pagination, `sort`, `status`, `event_type` for filters.
- Route prefixes: `/api/v1/<domain>`; admin routes under `/api/v1/admin/<domain>` guarded by `require_admin`.
- Versioning strategy: keep `/api/v1` stable; additive changes only; breaking changes get a new segment.

---

## 3. Database Access

- **Never** query collections with per-row `find_one` inside a `for` loop in a list endpoint. Batch-load first, then enrich in memory.
- Prefer `get_read_db()` (replica) for read-heavy list endpoints and `get_db()` (primary) for writes.
- All timestamps stored ISO-8601 UTC via `_now()` convention.
- Cap list sizes: default 50, hard max 100.

---

## 4. Error Handling

- Service functions return `{"error": True, "message": "..."}` for *expected* domain failures.
- Routers convert via `service_response(result)` — never inline the conversion.
- Unexpected exceptions: let the global handler in `app/main.py` log + return 500.

---

## 5. Performance Standards

| Endpoint class | Query count budget |
|---|---|
| List/feed endpoints | ≤ 5 total DB round-trips |
| Single-entity endpoints | ≤ 3 |
| Notification fan-out | batch > sequential; cap at 200-500 |

Pagination defaults: `limit=50`, `max=100`. Payload budgets: challenge lists ~10KB, feed ~20KB.

---

## 6. Security

- All protected routes use `get_current_user` / `require_admin` from `app/core/deps.py`.
- Ownership checks inside services: creator content actions verify `challenge.get("creator_id") == user_id`.
- Never trust client-supplied IDs for authorization — verify ownership in the service layer.
- Input validation: use FastAPI `Query(ge=.., le=..)` bounds on all numeric params.

---

## 7. Observability

- Every mutation that produces user-visible events must call `create_activity(...)` (public feed) and, where relevant, `create_notification(...)` (retention loop).
- The `error_logger` in `app/core/error_logger.py` automatically captures HTTP/validation/500 errors — do not duplicate manual logging.

---

## 8. Event-Driven Architecture

**Guiding principle:** this is a **modular monolith**, not a microservice system. Use events ONLY when they remove measurable cross-domain coupling. Never introduce Kafka/RabbitMQ/external infrastructure — everything stays in-process.

- **Publish, don't call across domains.** When a business action triggers 2+ unrelated systems (feed, stats, notifications, reputation), publish a domain event instead of invoking them directly.
- **Event bus:** `app/core/events.py::Event` + `bus.publish(event)`. Bus is in-process, synchronous, failure-isolated, and deduplicated per correlation.
- **Handlers:** live in `app/services/event_handlers.py`, registered at startup via `register_default_handlers(bus)` in `app/main.py` lifespan.
- **Handlers must be idempotent.** Payloads should carry a unique business ID (e.g. `attempt_id`, `event_id`) so duplicate deliveries never double side-effects.
- **Publish from services:** `await bus.publish(Event(name="ChallengeCompleted", producer="...", payload={...}))` — never call handlers directly.
- **Event naming:** `PascalCase` domain nouns (`ChallengeCompleted`, `CreatorVerified`, `EventCreated`). Version field defaults to 1 for backward-compat.

### Migrations so far (why, what removed)

1. **`ChallengeCompleted`** — `submit_challenge` no longer directly calls activity feed + creator stats. Listeners: activity, creator stats. Removed 2 cross-domain calls.
2. **`EventCreated`** — `create_event` no longer directly calls creator tracking (events_hosted), refresh-achievements, public feed, and notify-followers. Listeners: creator tracking, activity, notifications. Removed **4 cross-domain calls**, 3 domains decoupled (Creator/Achievements, Community, Notifications).

**Quality gate for a migration:** code simpler, workflow easier to understand, dependencies decreased, tests increased, behavior unchanged.

**When NOT to use events:** single-domain side-effects, transactional writes that must be atomic with the producer, simple in-service workflows. Keep it a monolith unless the coupling is real.

## 9. Testing

- API contract tests live in `apps/api/tests/` and use `MONGODB_URI=memory://test`
  (see `test_ecosystem.py` — setup sets the env var before importing `app`).
- The `service_response` guardrail contract is tested in `test_service_response_guardrail_contract`.
- When adding an endpoint that can return `{"error": True}`, add a test asserting the correct 4xx status.

---

## 10. Accessibility & UX

- Every interactive element carries `aria-label`.
- Loading states: show `<Skeleton>`; empty states: honest, actionable message.
- Buttons: use shared `Button` from `components/ui/button.tsx` — never raw `<button>` for primary actions.
- Dark mode: use `useTheme` provider; avoid hardcoded light-only colors.

---

## 11. Developer Experience

- Run `python3 -m py_compile` on changed service/router files.
- Run `npx tsc --noEmit` from `apps/web` after web changes.
- Full test suite: `cd apps/api && .venv/bin/python -m pytest tests/ -q`.
- New top-level abstractions belong in `app/core`; new list-batch helpers belong beside their primary consumer until they earn a shared home.