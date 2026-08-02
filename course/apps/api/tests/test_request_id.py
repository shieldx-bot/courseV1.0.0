"""Tests for Phase 7 request-ID / trace correlation (NV1).

Covers the RequestIDMiddleware contract:
  1. A client-supplied ``X-Request-ID`` header is echoed back unchanged.
  2. A missing header results in a generated UUID4 echoed in the response.
  3. The request id reaches the error logger (trace correlation) — the
     ``error_logs`` record for a failed request carries the same id.
"""
import uuid

from fastapi.testclient import TestClient


def test_echo_client_supplied_request_id():
    from app.main import app

    sent = "trace-12345-abcde"
    with TestClient(app) as client:
        resp = client.get("/api/v1/health", headers={"X-Request-ID": sent})
    assert resp.status_code == 200
    assert resp.headers.get("x-request-id") == sent


def test_generates_request_id_when_header_missing():
    from app.main import app

    with TestClient(app) as client:
        resp = client.get("/api/v1/health")
    rid = resp.headers.get("x-request-id")
    assert rid, "response must carry an X-Request-ID header"
    parsed = uuid.UUID(rid)
    assert parsed.version == 4


def test_request_id_propagates_to_error_logs():
    """A 404 must be logged in error_logs with the same request id."""
    from app.db.mongodb import get_db
    from app.main import app

    sent = "trace-error-404"
    with TestClient(app) as client:
        resp = client.get("/api/v1/definitely-not-an-endpoint", headers={"X-Request-ID": sent})
    assert resp.status_code == 404

    db = get_db()
    records = [d for d in db.error_logs.data if d.get("request_id") == sent]
    assert records, f"no error_logs record found for request_id {sent}"
    assert records[0]["status_code"] == 404
    assert records[0]["url"] == "/api/v1/definitely-not-an-endpoint"


def test_request_id_differs_between_requests():
    from app.main import app

    with TestClient(app) as client:
        r1 = client.get("/api/v1/health")
        r2 = client.get("/api/v1/health")
    assert r1.headers.get("x-request-id") != r2.headers.get("x-request-id")
