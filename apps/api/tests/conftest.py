"""Shared pytest fixtures for deterministic, isolated test runs.

This module is loaded automatically by pytest. The `autouse` fixture below
disables the SlowAPI rate limiter for the *entire* test session so that the
combined CI test suite never trips the default 5 requests/minute threshold
(which would surface as flaky `429 Rate Limit Exceeded` failures).
"""
import os

# Force the in-memory MongoDB backend before any `app.*` import happens.
# This keeps the test environment hermetic regardless of which test module
# pytest loads first.
os.environ.setdefault("MONGODB_URI", "memory://test")

import pytest  # noqa: E402


@pytest.fixture(autouse=True)
def disable_rate_limiter():
    """Temporarily disable SlowAPI rate limiting for every test.

    Why autouse=True?
      - It applies to every test in the suite with zero per-test boilerplate.
      - It guarantees the full CI pipeline is deterministic — tests never
        depend on wall-clock time or on how many requests earlier tests fired.

    How it works:
      - `app.state.limiter` is the SlowAPI `Limiter` instance attached in
        `app.main` (see `app.state.limiter = limiter`).
      - Flipping `limiter.enabled = False` makes SlowAPI skip the rate-limit
        check while the application still runs all other middleware normally.
      - We restore the original value after the test completes so a developer
        running tests with `--override` (or future test logic) can still
        exercise the limiter explicitly if desired.
    """
    from app.main import app

    limiter = getattr(app.state, "limiter", None)
    original_enabled = None
    if limiter is not None:
        original_enabled = limiter.enabled
        limiter.enabled = False

    yield

    if limiter is not None and original_enabled is not None:
        limiter.enabled = original_enabled