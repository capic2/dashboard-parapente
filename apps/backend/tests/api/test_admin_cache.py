"""
Tests for admin cache endpoints (GET/DELETE /api/admin/cache)
"""

import json
from unittest.mock import patch

import pytest
from fakeredis import FakeAsyncRedis


@pytest.fixture
def fake_async_redis():
    """Create a FakeAsyncRedis instance for testing."""
    redis = FakeAsyncRedis(decode_responses=True)
    return redis


@pytest.fixture(autouse=True)
def patch_get_redis(fake_async_redis):
    """Patch get_redis to return our FakeAsyncRedis for all tests in this module."""
    import cache

    # Reset the singleton so it doesn't persist between tests
    old_pool = cache._redis_pool
    cache._redis_pool = None

    async def mock_get_redis():
        return fake_async_redis

    with patch("cache.get_redis", side_effect=mock_get_redis):
        yield

    cache._redis_pool = old_pool


@pytest.fixture
def seeded_redis(fake_async_redis):
    """Return the redis instance for seeding in async tests."""
    return fake_async_redis


class TestGetCacheOverview:
    """Tests for GET /api/admin/cache"""

    def test_cache_overview_empty(self, client, db_session):
        """Empty cache returns zero keys and no groups."""
        response = client.get("/api/admin/cache")
        assert response.status_code == 200
        data = response.json()
        assert data["total_keys"] == 0
        assert data["groups"] == {}

    @pytest.mark.anyio
    async def test_cache_overview_with_keys(self, client, db_session, seeded_redis):
        """Seeded cache returns grouped keys with TTL and size."""
        r = seeded_redis
        # Seed data
        for i in range(3):
            await r.setex(
                f"weather:forecast:hash{i}",
                3600,
                json.dumps({"temperature": 15 + i, "cached_at": "2026-01-15T10:00:00+00:00"}),
            )
        await r.setex(
            "best_spot:day_0",
            3600,
            json.dumps({"site": "arguel", "cached_at": "2026-01-15T10:00:00+00:00"}),
        )
        await r.setex(
            "best_spot:day_1",
            1800,
            json.dumps({"site": "chalais", "cached_at": "2026-01-15T10:00:00+00:00"}),
        )
        await r.setex(
            "emagram:sounding:07145:12:2026-01-15",
            86400,
            json.dumps({"success": True, "cached_at": "2026-01-15T10:00:00+00:00"}),
        )

        response = client.get("/api/admin/cache")
        assert response.status_code == 200
        data = response.json()

        assert data["total_keys"] == 6
        assert "weather:forecast" in data["groups"]
        assert data["groups"]["weather:forecast"]["count"] == 3
        assert "best_spot" in data["groups"]
        assert data["groups"]["best_spot"]["count"] == 2
        assert "emagram:sounding" in data["groups"]
        assert data["groups"]["emagram:sounding"]["count"] == 1

        # Check key metadata
        for k in data["groups"]["weather:forecast"]["keys"]:
            assert "key" in k
            assert "ttl" in k
            assert "size" in k
            assert k["ttl"] > 0
            assert k["size"] > 0

    def test_cache_overview_has_memory_usage_field(self, client, db_session):
        """Memory usage field is present (may be None with fakeredis)."""
        response = client.get("/api/admin/cache")
        assert response.status_code == 200
        assert "memory_usage" in response.json()


class TestGetCacheKeyDetail:
    """Tests for GET /api/admin/cache/{key}"""

    @pytest.mark.anyio
    async def test_key_detail_found(self, client, db_session, seeded_redis):
        """Existing JSON key returns parsed value with metadata."""
        await seeded_redis.setex(
            "best_spot:day_0",
            3600,
            json.dumps({"site": "arguel", "score": 75, "cached_at": "2026-01-15T10:00:00+00:00"}),
        )

        response = client.get("/api/admin/cache/best_spot:day_0")
        assert response.status_code == 200
        data = response.json()

        assert data["key"] == "best_spot:day_0"
        assert data["type"] == "json"
        assert data["ttl"] > 0
        assert data["size"] > 0
        assert data["value"]["site"] == "arguel"
        assert data["value"]["score"] == 75

    def test_key_detail_not_found(self, client, db_session):
        """Non-existent key returns 404."""
        response = client.get("/api/admin/cache/nonexistent:key")
        assert response.status_code == 404

    @pytest.mark.anyio
    async def test_key_detail_non_json(self, client, db_session, seeded_redis):
        """Non-JSON value returns type=string."""
        await seeded_redis.setex("test:plain", 300, "just a string value")

        response = client.get("/api/admin/cache/test:plain")
        assert response.status_code == 200
        data = response.json()

        assert data["type"] == "string"
        assert data["value"] == "just a string value"


class TestDeleteCacheKey:
    """Tests for DELETE /api/admin/cache/{key}"""

    @pytest.mark.anyio
    async def test_delete_single_key(self, client, db_session, seeded_redis):
        """Deleting a single key removes it from cache."""
        await seeded_redis.setex("best_spot:day_0", 3600, json.dumps({"site": "arguel"}))

        response = client.delete("/api/admin/cache/best_spot:day_0")
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["keys_deleted"] == 1

        # Verify key is gone
        val = await seeded_redis.get("best_spot:day_0")
        assert val is None

    @pytest.mark.anyio
    async def test_delete_pattern(self, client, db_session, seeded_redis):
        """Deleting with wildcard pattern removes matching keys."""
        for i in range(3):
            await seeded_redis.setex(f"weather:forecast:hash{i}", 3600, json.dumps({"temp": i}))
        await seeded_redis.setex("best_spot:day_0", 3600, json.dumps({"site": "arguel"}))

        response = client.delete("/api/admin/cache/weather:forecast:*")
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["keys_deleted"] == 3

        # Other keys should still exist
        val = await seeded_redis.get("best_spot:day_0")
        assert val is not None

    def test_delete_nonexistent_key(self, client, db_session):
        """Deleting non-existent key returns 0 deleted, no error."""
        response = client.delete("/api/admin/cache/nonexistent:key")
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["keys_deleted"] == 0
