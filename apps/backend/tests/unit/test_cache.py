"""Tests for cache.py - cached_at timestamp injection and cache lifecycle."""

from datetime import datetime
from unittest.mock import AsyncMock, patch

import pytest

from cache import close_redis, generate_cache_key, get_cached, set_cached


@pytest.fixture
def mock_redis():
    """Create a mock Redis client."""
    redis = AsyncMock()
    redis.get = AsyncMock(return_value=None)
    redis.setex = AsyncMock()
    return redis


@pytest.mark.asyncio
async def test_set_cached_injects_cached_at(mock_redis):
    """set_cached should inject cached_at ISO timestamp into dict data."""
    data = {"temperature": 15, "wind_speed": 12}

    with patch("cache.get_redis", return_value=mock_redis):
        await set_cached("test:key", data, ttl=3600)

    # Verify cached_at was injected
    assert "cached_at" in data
    # Verify it's a valid ISO timestamp
    parsed = datetime.fromisoformat(data["cached_at"])
    assert parsed.tzinfo is not None  # timezone-aware

    # Verify Redis was called with the data including cached_at
    mock_redis.setex.assert_called_once()
    import json

    stored_data = json.loads(mock_redis.setex.call_args[0][2])
    assert "cached_at" in stored_data
    assert stored_data["temperature"] == 15


@pytest.mark.asyncio
async def test_set_cached_does_not_break_non_dict(mock_redis):
    """set_cached should not crash if data is not a dict (e.g., list or string)."""
    data_list = [1, 2, 3]

    with patch("cache.get_redis", return_value=mock_redis):
        await set_cached("test:key", data_list, ttl=3600)

    # Should still store the data
    mock_redis.setex.assert_called_once()


@pytest.mark.asyncio
async def test_get_cached_returns_cached_at(mock_redis):
    """get_cached should return data including cached_at from Redis."""
    import json

    stored = json.dumps({"temp": 10, "cached_at": "2026-03-29T12:00:00+00:00"})
    mock_redis.get = AsyncMock(return_value=stored)

    with patch("cache.get_redis", return_value=mock_redis):
        result = await get_cached("test:key")

    assert result is not None
    assert result["cached_at"] == "2026-03-29T12:00:00+00:00"
    assert result["temp"] == 10


@pytest.mark.asyncio
async def test_get_cached_returns_none_on_miss(mock_redis):
    """get_cached should return None on cache miss."""
    mock_redis.get = AsyncMock(return_value=None)

    with patch("cache.get_redis", return_value=mock_redis):
        result = await get_cached("test:key")

    assert result is None


@pytest.mark.asyncio
async def test_close_redis_resets_pool():
    """close_redis should close connection and reset _redis_pool to None."""
    import cache

    mock_pool = AsyncMock()
    cache._redis_pool = mock_pool

    await close_redis()

    mock_pool.close.assert_called_once()
    assert cache._redis_pool is None


@pytest.mark.asyncio
async def test_close_redis_noop_when_no_pool():
    """close_redis should do nothing when no pool exists."""
    import cache

    cache._redis_pool = None

    await close_redis()  # Should not raise

    assert cache._redis_pool is None


def test_generate_cache_key_deterministic():
    """generate_cache_key should produce the same key for the same params."""
    key1 = generate_cache_key("forecast", lat=47.2, lon=6.0, day_index=0)
    key2 = generate_cache_key("forecast", lat=47.2, lon=6.0, day_index=0)

    assert key1 == key2
    assert key1.startswith("weather:forecast:")


def test_generate_cache_key_differs_for_different_params():
    """generate_cache_key should produce different keys for different params."""
    key_day0 = generate_cache_key("forecast", lat=47.2, lon=6.0, day_index=0)
    key_day1 = generate_cache_key("forecast", lat=47.2, lon=6.0, day_index=1)

    assert key_day0 != key_day1


def test_generate_cache_key_order_independent():
    """generate_cache_key should produce the same key regardless of param order."""
    key1 = generate_cache_key("forecast", lat=47.2, lon=6.0, day_index=0)
    key2 = generate_cache_key("forecast", day_index=0, lon=6.0, lat=47.2)

    assert key1 == key2
