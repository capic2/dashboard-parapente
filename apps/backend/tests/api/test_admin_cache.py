"""
Tests for admin cache endpoints (GET/DELETE /api/admin/cache)
"""

import json
from unittest.mock import patch

import pytest
from fakeredis import FakeAsyncRedis

from cache import generate_cache_key


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

    @pytest.mark.anyio
    async def test_cache_overview_resolves_known_keys(
        self,
        client,
        db_session,
        seeded_redis,
        arguel_site,
    ):
        forecast_key = generate_cache_key(
            "forecast",
            lat=round(arguel_site.latitude, 4),
            lon=round(arguel_site.longitude, 4),
            day_index=2,
        )

        await seeded_redis.setex(
            forecast_key,
            3600,
            json.dumps({"temperature": 16, "cached_at": "2026-01-15T10:00:00+00:00"}),
        )
        await seeded_redis.setex(
            "best_spot:day_2",
            3600,
            json.dumps({"site": "arguel", "cached_at": "2026-01-15T10:00:00+00:00"}),
        )
        await seeded_redis.setex(
            "emagram:sounding:07145:12:2026-01-15",
            3600,
            json.dumps({"station_code": "07145", "cached_at": "2026-01-15T10:00:00+00:00"}),
        )

        response = client.get("/api/admin/cache")
        assert response.status_code == 200
        data = response.json()

        forecast_entry = next(
            item
            for item in data["groups"]["weather:forecast"]["keys"]
            if item["key"] == forecast_key
        )
        best_spot_entry = next(
            item for item in data["groups"]["best_spot"]["keys"] if item["key"] == "best_spot:day_2"
        )
        emagram_entry = next(
            item
            for item in data["groups"]["emagram:sounding"]["keys"]
            if item["key"] == "emagram:sounding:07145:12:2026-01-15"
        )

        assert forecast_entry["resolved"]["label"] == "weather_forecast"
        assert forecast_entry["resolved"]["details"]["site_code"] == "ARG"
        assert forecast_entry["resolved"]["details"]["day_index"] == 2

        assert best_spot_entry["resolved"]["label"] == "best_spot_for_day"
        assert best_spot_entry["resolved"]["details"]["day_index"] == 2

        assert emagram_entry["resolved"]["label"] == "emagram_sounding"
        assert emagram_entry["resolved"]["details"]["station"] == "07145"

    @pytest.mark.anyio
    async def test_cache_overview_unresolved_key(self, client, db_session, seeded_redis):
        """Unknown cache keys keep compatibility by returning null resolution."""
        await seeded_redis.setex(
            "custom:key:raw",
            300,
            json.dumps({"payload": "value"}),
        )

        response = client.get("/api/admin/cache")
        assert response.status_code == 200
        data = response.json()

        assert "custom:key" in data["groups"]
        entry = data["groups"]["custom:key"]["keys"][0]
        assert entry["resolved"] is None

    def test_cache_overview_has_memory_usage_field(self, client, db_session):
        """Memory usage field is present (may be None with fakeredis)."""
        response = client.get("/api/admin/cache")
        assert response.status_code == 200
        assert "memory_usage" in response.json()

    @pytest.mark.anyio
    async def test_cache_overview_uses_empty_resolution_map_on_error(
        self,
        client,
        db_session,
        seeded_redis,
    ):
        await seeded_redis.setex(
            "weather:forecast:abc123",
            3600,
            json.dumps({"temperature": 16, "cached_at": "2026-01-15T10:00:00+00:00"}),
        )

        with patch(
            "routes._build_forecast_cache_signature_map", side_effect=RuntimeError("timeout")
        ):
            response = client.get("/api/admin/cache")

        assert response.status_code == 200
        data = response.json()
        assert "weather:forecast" in data["groups"]
        entry = data["groups"]["weather:forecast"]["keys"][0]
        assert entry["resolved"] is None


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

    @pytest.mark.anyio
    async def test_key_detail_unknown_key_no_resolution(
        self,
        client,
        db_session,
        seeded_redis,
    ):
        await seeded_redis.setex("custom:key:raw", 300, json.dumps({"payload": "value"}))

        response = client.get("/api/admin/cache/custom:key:raw")
        assert response.status_code == 200
        data = response.json()

        assert data["resolved"] is None

    @pytest.mark.anyio
    async def test_key_detail_includes_resolution(
        self, client, db_session, seeded_redis, arguel_site
    ):
        forecast_key = generate_cache_key(
            "forecast",
            lat=round(arguel_site.latitude, 4),
            lon=round(arguel_site.longitude, 4),
            day_index=1,
        )

        await seeded_redis.setex(
            forecast_key,
            3600,
            json.dumps({"site": "arguel", "cached_at": "2026-01-15T10:00:00+00:00"}),
        )

        response = client.get(f"/api/admin/cache/{forecast_key}")
        assert response.status_code == 200
        data = response.json()

        assert data["resolved"]["label"] == "weather_forecast"
        assert data["resolved"]["details"]["site_code"] == "ARG"
        assert data["resolved"]["details"]["day_index"] == 1

    @pytest.mark.anyio
    async def test_key_detail_best_spot_includes_resolution(self, client, db_session, seeded_redis):
        await seeded_redis.setex(
            "best_spot:day_3",
            3600,
            json.dumps({"site": "arguel", "cached_at": "2026-01-15T10:00:00+00:00"}),
        )

        response = client.get("/api/admin/cache/best_spot:day_3")
        assert response.status_code == 200
        data = response.json()

        assert data["resolved"]["label"] == "best_spot_for_day"
        assert data["resolved"]["details"]["day_index"] == 3

    @pytest.mark.anyio
    async def test_key_detail_falls_back_to_null_when_resolution_map_fails(
        self,
        client,
        db_session,
        seeded_redis,
    ):
        await seeded_redis.setex(
            "weather:forecast:abc123",
            3600,
            json.dumps({"temperature": 16, "cached_at": "2026-01-15T10:00:00+00:00"}),
        )

        with patch(
            "routes._build_forecast_cache_signature_map", side_effect=RuntimeError("timeout")
        ):
            response = client.get("/api/admin/cache/weather:forecast:abc123")

        assert response.status_code == 200
        data = response.json()
        assert data["resolved"] is None

    @pytest.mark.anyio
    async def test_key_detail_emagram_includes_resolution(self, client, db_session, seeded_redis):
        await seeded_redis.setex(
            "emagram:sounding:07145:12:2026-01-15",
            3600,
            json.dumps({"station_code": "07145", "cached_at": "2026-01-15T10:00:00+00:00"}),
        )

        response = client.get("/api/admin/cache/emagram:sounding:07145:12:2026-01-15")
        assert response.status_code == 200
        data = response.json()

        assert data["resolved"]["label"] == "emagram_sounding"
        assert data["resolved"]["details"]["station"] == "07145"
        assert data["resolved"]["details"]["sounding_hour"] == "12"
        assert data["resolved"]["details"]["date"] == "2026-01-15"


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
