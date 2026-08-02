"""Tests for multi-process runtime (PROCESS_MODE selection)."""
import os

from app.runtime import resolve_mode, PROCESS_MODES


def test_default_mode_is_api():
    os.environ.pop("PROCESS_MODE", None)
    assert resolve_mode() == "api"


def test_valid_modes():
    for mode in PROCESS_MODES:
        os.environ["PROCESS_MODE"] = mode.upper()  # case-insensitive
        assert resolve_mode() == mode


def test_invalid_mode_raises():
    os.environ["PROCESS_MODE"] = "bogus"
    try:
        resolve_mode()
        assert False, "expected ValueError"
    except ValueError:
        pass
    finally:
        os.environ.pop("PROCESS_MODE", None)


def test_runtime_settings_defaults():
    """12-Factor runtime config defaults preserve legacy behavior."""
    from app.core.config import settings

    assert settings.log_level == "INFO"
    assert settings.app_timezone == ""
