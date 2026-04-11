"""Tests for the emagram Redis cache configuration."""

import importlib
import sys
from types import ModuleType, SimpleNamespace
from unittest.mock import MagicMock


def _install_config_stub(monkeypatch, host="redis", port=6379):
    monkeypatch.setitem(
        sys.modules,
        "config",
        SimpleNamespace(REDIS_HOST=host, REDIS_PORT=port),
    )


def _install_redis_stub(monkeypatch, redis_client):
    redis_module = ModuleType("redis")
    redis_module.ConnectionError = type("ConnectionError", (Exception,), {})
    redis_module.TimeoutError = type("TimeoutError", (Exception,), {})
    redis_module.from_url = MagicMock(return_value=redis_client)
    monkeypatch.setitem(sys.modules, "redis", redis_module)
    return redis_module


def _load_module(monkeypatch, host="redis", port=6379, redis_client=None):
    _install_config_stub(monkeypatch, host=host, port=port)
    module = _install_redis_stub(monkeypatch, redis_client or MagicMock())
    sys.modules.pop("cache_emagram.emagram_cache", None)
    emagram_cache = importlib.import_module("cache_emagram.emagram_cache")
    return emagram_cache, module


def test_get_redis_url_uses_backend_config(monkeypatch):
    monkeypatch.delenv("REDIS_URL", raising=False)
    emagram_cache, _ = _load_module(monkeypatch, host="redis", port=6379)

    assert emagram_cache._get_redis_url() == "redis://redis:6379"


def test_get_redis_url_prefers_env_override(monkeypatch):
    monkeypatch.setenv("REDIS_URL", "redis://custom-redis:6380")
    emagram_cache, _ = _load_module(monkeypatch, host="redis", port=6379)

    assert emagram_cache._get_redis_url() == "redis://custom-redis:6380"


def test_emagram_cache_initializes_with_shared_backend_redis(monkeypatch):
    monkeypatch.delenv("REDIS_URL", raising=False)
    redis_client = MagicMock()
    redis_client.ping.return_value = True

    emagram_cache, redis_module = _load_module(
        monkeypatch,
        host="redis",
        port=6379,
        redis_client=redis_client,
    )

    cache = emagram_cache.EmagramCache()

    redis_module.from_url.assert_called_once_with("redis://redis:6379", decode_responses=True)
    assert cache.enabled is True
    assert cache.redis_client is redis_client
