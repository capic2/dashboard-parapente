import pytest

import config


def test_required_env_rejects_missing_variable(monkeypatch):
    monkeypatch.delenv("BACKEND_MISSING_PATH", raising=False)

    with pytest.raises(ValueError, match="BACKEND_MISSING_PATH environment variable is required"):
        config.required_env("BACKEND_MISSING_PATH")


def test_required_env_rejects_empty_variable(monkeypatch):
    monkeypatch.setenv("BACKEND_EMPTY_PATH", "   ")

    with pytest.raises(ValueError, match="BACKEND_EMPTY_PATH environment variable is required"):
        config.required_env("BACKEND_EMPTY_PATH")
