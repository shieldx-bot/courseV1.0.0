"""NV4 — LLM Prometheus metric exposure tests.

Verifies the three ``llm_*`` counters are registered and actually exported
from ``GET /metrics``:

- ``llm_requests_total{provider, status}``
- ``llm_tokens_total{provider}``
- ``llm_cost_usd_total{provider}``

Note: prometheus_client appends ``_total`` to Counter names, so the cost
counter is defined with base name ``llm_cost_usd`` and exposed as
``llm_cost_usd_total`` (see app/core/telemetry.py).
"""

import os

os.environ["MONGODB_URI"] = "memory://test"

from fastapi.testclient import TestClient

from app.core.telemetry import LLM_COST_USD, LLM_REQUESTS, LLM_TOKENS
from app.main import app


def test_llm_metric_definitions():
    assert LLM_REQUESTS._name == "llm_requests"
    assert LLM_REQUESTS._labelnames == ("provider", "status")
    assert LLM_TOKENS._name == "llm_tokens"
    assert LLM_TOKENS._labelnames == ("provider",)
    assert LLM_COST_USD._name == "llm_cost_usd"
    assert LLM_COST_USD._labelnames == ("provider",)


def test_metrics_endpoint_exposes_llm_series():
    LLM_REQUESTS.labels(provider="openrouter", status="success").inc()
    LLM_REQUESTS.labels(provider="openrouter", status="error").inc()
    LLM_TOKENS.labels(provider="openrouter").inc(100)
    LLM_COST_USD.labels(provider="openrouter").inc(0.5)

    with TestClient(app) as client:
        res = client.get("/metrics")
        assert res.status_code == 200
        body = res.text

    assert "llm_requests_total{provider=\"openrouter\",status=\"success\"}" in body
    assert "llm_requests_total{provider=\"openrouter\",status=\"error\"}" in body
    assert "llm_tokens_total{provider=\"openrouter\"}" in body
    assert "llm_cost_usd_total{provider=\"openrouter\"}" in body
