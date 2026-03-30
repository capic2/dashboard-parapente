"""
Tests for weather_pipeline.py cache behavior.

Covers:
- Cache HIT returns cached data (with and without sunrise/sunset)
- Cache MISS triggers live fetch and caches result
- extract_sunrise_sunset uses logger instead of file writes
"""

from unittest.mock import AsyncMock, patch

import pytest


@pytest.fixture
def mock_redis():
    """Create a mock Redis client."""
    redis = AsyncMock()
    redis.get = AsyncMock(return_value=None)
    redis.setex = AsyncMock()
    return redis


def _make_cached_forecast(*, sunrise="07:15", sunset="19:30"):
    """Helper to build a cached forecast result."""
    return {
        "success": True,
        "consensus": [{"hour": 12, "wind_speed": 15, "wind_direction": 270, "temperature": 18}],
        "sunrise": sunrise,
        "sunset": sunset,
        "cached_at": "2026-03-30T10:00:00+00:00",
    }


@pytest.mark.asyncio
async def test_cache_hit_with_sunrise_returns_cached(mock_redis):
    """Cache HIT with sunrise/sunset should return cached data without refetching."""
    from weather_pipeline import get_normalized_forecast

    cached = _make_cached_forecast(sunrise="07:15", sunset="19:30")

    with patch("cache.get_cached", new=AsyncMock(return_value=cached)):
        with patch("weather_pipeline.aggregate_forecasts", new=AsyncMock()) as mock_agg:
            result = await get_normalized_forecast(lat=47.2, lon=6.0, day_index=0)

            assert result == cached
            # aggregate_forecasts should NOT have been called
            mock_agg.assert_not_called()


@pytest.mark.asyncio
async def test_cache_hit_without_sunrise_still_returns_cached(mock_redis):
    """
    Cache HIT with sunrise=None should still return cached data.
    This is the regression test for the stale cache loop bug:
    previously, missing sunrise would cause infinite refetch loops.
    """
    from weather_pipeline import get_normalized_forecast

    cached = _make_cached_forecast(sunrise=None, sunset=None)

    with patch("cache.get_cached", new=AsyncMock(return_value=cached)):
        with patch("weather_pipeline.aggregate_forecasts", new=AsyncMock()) as mock_agg:
            result = await get_normalized_forecast(lat=47.2, lon=6.0, day_index=0)

            assert result == cached
            assert result["sunrise"] is None
            # aggregate_forecasts should NOT have been called — cache is valid
            mock_agg.assert_not_called()


@pytest.mark.asyncio
async def test_cache_miss_fetches_and_caches(mock_redis):
    """Cache MISS should trigger live fetch and store result in cache."""
    from weather_pipeline import get_normalized_forecast

    aggregated = {
        "sources": {
            "open-meteo": {
                "success": True,
                "data": {
                    "daily": {
                        "sunrise": ["2026-03-30T07:15"],
                        "sunset": ["2026-03-30T19:30"],
                    }
                },
                "hourly": [
                    {"hour": 12, "temperature": 18, "wind_speed": 15, "wind_direction": 270}
                ],
            }
        }
    }

    normalized = {
        "success": True,
        "normalized": [
            {
                "hour": 12,
                "temperature": [18],
                "wind_speed": [15],
                "wind_direction": [270],
                "sources": ["open-meteo"],
            }
        ],
    }

    consensus = {
        "success": True,
        "consensus": [{"hour": 12, "temperature": 18, "wind_speed": 15, "wind_direction": 270}],
        "total_sources": 1,
    }

    with (
        patch("cache.get_cached", new=AsyncMock(return_value=None)),
        patch("cache.set_cached", new=AsyncMock()) as mock_set,
        patch("weather_pipeline.aggregate_forecasts", new=AsyncMock(return_value=aggregated)),
        patch("weather_pipeline.normalize_data", return_value=normalized),
        patch("weather_pipeline.calculate_consensus", return_value=consensus),
        patch("weather_pipeline.extract_sunrise_sunset", return_value=("07:15", "19:30")),
    ):
        result = await get_normalized_forecast(lat=47.2, lon=6.0, day_index=0)

        assert result["success"] is True
        assert result["sunrise"] == "07:15"
        assert result["sunset"] == "19:30"

        # Verify set_cached was called
        mock_set.assert_called_once()
        call_args = mock_set.call_args
        assert call_args[0][0].startswith("weather:forecast:")
        assert call_args[0][2] == 3600  # TTL


@pytest.mark.asyncio
async def test_cache_error_falls_back_to_live_fetch():
    """If cache read raises an exception, should fall back to live fetch."""
    from weather_pipeline import get_normalized_forecast

    aggregated = {
        "sources": {
            "open-meteo": {
                "success": True,
                "data": {
                    "daily": {"sunrise": ["2026-03-30T07:15"], "sunset": ["2026-03-30T19:30"]}
                },
                "hourly": [
                    {"hour": 12, "temperature": 18, "wind_speed": 15, "wind_direction": 270}
                ],
            }
        }
    }

    consensus = {
        "success": True,
        "consensus": [{"hour": 12, "temperature": 18}],
        "total_sources": 1,
    }

    with (
        patch("cache.get_cached", new=AsyncMock(side_effect=ConnectionError("Redis down"))),
        patch("cache.set_cached", new=AsyncMock()),
        patch("weather_pipeline.aggregate_forecasts", new=AsyncMock(return_value=aggregated)),
        patch("weather_pipeline.normalize_data", return_value={"success": True, "normalized": []}),
        patch("weather_pipeline.calculate_consensus", return_value=consensus),
        patch("weather_pipeline.extract_sunrise_sunset", return_value=("07:15", "19:30")),
    ):
        result = await get_normalized_forecast(lat=47.2, lon=6.0, day_index=0)

        # Should still return a result despite cache error
        assert result["success"] is True


def test_extract_sunrise_sunset_does_not_write_files(tmp_path):
    """extract_sunrise_sunset should use logger, not write to /tmp files."""
    from weather_pipeline import extract_sunrise_sunset

    aggregated = {
        "sources": {
            "open-meteo": {
                "success": True,
                "data": {
                    "daily": {
                        "sunrise": ["2026-03-30T07:15"],
                        "sunset": ["2026-03-30T19:30"],
                    }
                },
            }
        }
    }

    import os

    debug_log = "/tmp/extract_sunrise_sunset_debug.log"
    # Remove if exists from previous runs
    if os.path.exists(debug_log):
        os.remove(debug_log)

    sunrise, sunset = extract_sunrise_sunset(aggregated, day_index=0)

    assert sunrise == "07:15"
    assert sunset == "19:30"
    # Should NOT have created the debug log file
    assert not os.path.exists(debug_log), "extract_sunrise_sunset should not write debug files"


def test_extract_sunrise_sunset_no_open_meteo():
    """extract_sunrise_sunset returns (None, None) when open-meteo data is missing."""
    from weather_pipeline import extract_sunrise_sunset

    aggregated = {"sources": {"weatherapi": {"success": True}}}

    sunrise, sunset = extract_sunrise_sunset(aggregated, day_index=0)

    assert sunrise is None
    assert sunset is None
