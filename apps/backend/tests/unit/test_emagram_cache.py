"""Tests for emagram cache using shared backend Redis client."""

from datetime import datetime
from types import SimpleNamespace

import pytest

from cache_emagram.emagram_cache import EmagramCache, get_cache


def test_get_cache_returns_singleton_instance():
    first = get_cache()
    second = get_cache()

    assert first is second


@pytest.mark.asyncio
async def test_emagram_cache_reads_written_value_from_shared_backend_client(monkeypatch):
    calls = []
    store = {}

    async def fake_get(key):
        calls.append(("get", key))
        return store.get(key)

    async def fake_setex(key, ttl, value):
        calls.append(("setex", key, ttl))
        store[key] = value

    fake_client = SimpleNamespace(get=fake_get, setex=fake_setex)

    async def fake_get_redis():
        return fake_client

    monkeypatch.setattr("cache.get_redis", fake_get_redis)

    cache = EmagramCache()
    date = datetime(2026, 1, 15)

    written = await cache.set_sounding(
        "07145",
        "12",
        date,
        {
            "success": True,
            "station_code": "07145",
            "sounding_date": "2026-01-15",
        },
        ttl_hours=24,
    )

    payload = await cache.get_sounding("07145", "12", date)

    assert written is True
    assert payload is not None
    assert payload["success"] is True
    assert payload["cached_at"]
    assert ("setex", "emagram:sounding:07145:12:2026-01-15", 86400) in calls
    assert ("get", "emagram:sounding:07145:12:2026-01-15") in calls


@pytest.mark.asyncio
async def test_emagram_cache_skips_failed_payloads(monkeypatch):
    called = False

    async def fake_setex(*args, **kwargs):
        nonlocal called
        called = True

    fake_client = SimpleNamespace(setex=fake_setex)

    async def fake_get_redis():
        return fake_client

    monkeypatch.setattr("cache.get_redis", fake_get_redis)

    cache = EmagramCache()
    result = await cache.set_sounding(
        "07145",
        "12",
        datetime(2026, 1, 15),
        {"success": False},
    )

    assert result is False
    assert called is False
