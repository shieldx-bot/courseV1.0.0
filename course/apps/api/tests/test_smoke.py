"""Post-deploy smoke suite — opt-in, runs against a live API.

The hermetic CI suite stays untouched: this module skips entirely unless
``SMOKE_BASE_URL`` is set (see ``make smoke``, which defaults to the local
API at http://localhost:8000/api/v1). The flow walks the critical paths that
must be green right after a deploy:

  1. ``GET /health`` returns 200 + the ``{success, data, error, meta}`` envelope
  2. ``GET /health/ready`` returns 200 (or 503 "degraded" — no hard fail when a
     dependency like Redis is down)
  3. real login with mock credentials (``SMOKE_USER`` / ``SMOKE_PASSWORD``,
     skipped when not provided) -> Bearer token
  4. ``GET /courses`` returns a list
  5. ``GET /adaptive/concepts/{course_id}`` returns data
  6. create a support ticket, then read it back

Every response is validated against the envelope contract.
"""
import os
import uuid

import httpx
import pytest

SMOKE_BASE_URL = os.environ.get("SMOKE_BASE_URL", "").rstrip("/")
SMOKE_USER = os.environ.get("SMOKE_USER", "")
SMOKE_PASSWORD = os.environ.get("SMOKE_PASSWORD", "")

pytestmark = pytest.mark.skipif(
    not SMOKE_BASE_URL,
    reason="SMOKE_BASE_URL not set — smoke suite is opt-in (make smoke)",
)

_AUTH_CREDS = SMOKE_USER and SMOKE_PASSWORD


def _get(path: str, **kwargs) -> httpx.Response:
    return httpx.get(f"{SMOKE_BASE_URL}{path}", timeout=15.0, **kwargs)


def _post(path: str, **kwargs) -> httpx.Response:
    return httpx.post(f"{SMOKE_BASE_URL}{path}", timeout=20.0, **kwargs)


def _assert_envelope(resp: httpx.Response, *, status: int = 200) -> dict:
    assert resp.status_code == status, f"HTTP {resp.status_code}: {resp.text[:500]}"
    body = resp.json()
    assert body.get("success") is True, body
    assert "data" in body, body
    assert body.get("error") is None, body
    return body["data"]


def test_health_returns_ok_envelope():
    data = _assert_envelope(_get("/health"))
    assert data["status"] == "ok"
    assert data.get("version")


def test_readiness_accepts_ok_or_degraded():
    resp = _get("/health/ready")
    assert resp.status_code in (200, 503), f"HTTP {resp.status_code}: {resp.text[:500]}"
    body = resp.json()
    assert body.get("data", {}).get("status") in ("ok", "degraded")
    assert body.get("data", {}).get("checks")


def test_course_catalog_returns_list():
    data = _assert_envelope(_get("/courses?per_page=5"))
    assert isinstance(data, list)


@pytest.mark.skipif(
    not _AUTH_CREDS, reason="SMOKE_USER/SMOKE_PASSWORD not set — skipping authenticated flow"
)
def test_authenticated_critical_path():
    login = _assert_envelope(_post(
        "/auth/login", json={"email": SMOKE_USER, "password": SMOKE_PASSWORD},
    ))
    assert login["access_token"]
    headers = {"Authorization": f"Bearer {login['access_token']}"}

    courses = _assert_envelope(_get("/courses?per_page=5"))
    assert isinstance(courses, list)
    assert courses, "no courses on target — cannot smoke adaptive concepts"
    course_id = courses[0]["id"]

    concepts = _assert_envelope(_get(f"/adaptive/concepts/{course_id}", headers=headers))
    assert isinstance(concepts, list)

    subject = f"Smoke round-trip {uuid.uuid4().hex[:8]}"
    ticket = _assert_envelope(_post(
        "/support/tickets",
        headers=headers,
        json={"subject": subject, "message": "Post-deploy smoke verification.", "category": "other"},
    ))
    assert ticket["id"]

    detail = _assert_envelope(_get(f"/support/tickets/{ticket['id']}", headers=headers))
    assert detail["id"] == ticket["id"]
    assert detail["subject"] == subject
