from unittest.mock import AsyncMock

import pytest

from weather_pipeline import _apply_open_meteo_stale_fallback, calculate_consensus


def test_calculate_consensus_preserves_registered_source_details():
    result = calculate_consensus(
        {
            "success": True,
            "normalized": [
                {
                    "hour": 12,
                    "sources": ["open-meteo", "met-no"],
                    "temperature": [18.0, 20.0],
                    "wind_speed": [12.0, 16.0],
                    "wind_gust": [20.0, 24.0],
                    "wind_direction": [250.0, 260.0],
                    "precipitation": [0.0, 0.2],
                    "cloud_cover": [30.0, 40.0],
                    "cape": [None, None],
                    "lifted_index": [None, None],
                    "source_freshness": {
                        "open-meteo": {
                            "is_stale": True,
                            "stale_reason": "rate_limited",
                            "cached_at": "2026-07-14T10:00:00+00:00",
                        }
                    },
                }
            ],
        }
    )

    assert result["success"] is True
    assert result["total_sources"] == 2
    assert result["consensus"][0]["sources"]["met-no"]["wind_speed"] == 16.0
    assert result["consensus"][0]["sources"]["open-meteo"]["wind_speed"] == 12.0
    assert result["consensus"][0]["sources"]["open-meteo-icon"]["wind_speed"] is None
    assert result["consensus"][0]["source_freshness"]["open-meteo"]["is_stale"] is True


@pytest.mark.asyncio
async def test_open_meteo_429_reuses_last_success(monkeypatch: pytest.MonkeyPatch) -> None:
    cached_result = {
        "success": True,
        "source": "open-meteo",
        "hourly": [{"hour": 12, "temperature": 20.0}],
        "cached_at": "2026-07-14T10:00:00+00:00",
    }
    get_cached = AsyncMock(return_value=cached_result)
    set_cached = AsyncMock()
    monkeypatch.setattr("cache.get_cached", get_cached)
    monkeypatch.setattr("cache.set_cached", set_cached)

    result = await _apply_open_meteo_stale_fallback(
        "open-meteo",
        {
            "success": False,
            "status_code": 429,
            "error": "Rate limit response with arbitrary wording",
        },
        lat=46.9693,
        lon=5.8747,
        day_index=0,
    )

    assert result["success"] is True
    assert result["is_stale"] is True
    assert result["stale_reason"] == "rate_limited"
    assert result["stale_cached_at"] == "2026-07-14T10:00:00+00:00"
    set_cached.assert_not_awaited()


@pytest.mark.asyncio
async def test_successful_open_meteo_result_updates_last_success_cache(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    get_cached = AsyncMock()
    set_cached = AsyncMock()
    monkeypatch.setattr("cache.get_cached", get_cached)
    monkeypatch.setattr("cache.set_cached", set_cached)
    fresh_result = {
        "success": True,
        "source": "open-meteo",
        "hourly": [{"hour": 12, "temperature": 20.0}],
    }

    result = await _apply_open_meteo_stale_fallback(
        "open-meteo", fresh_result, lat=46.9693, lon=5.8747, day_index=0
    )

    assert result["is_stale"] is False
    set_cached.assert_awaited_once()
    get_cached.assert_not_awaited()


@pytest.mark.asyncio
async def test_open_meteo_stale_fallback_accepts_missing_result() -> None:
    result = await _apply_open_meteo_stale_fallback(
        "open-meteo", None, lat=46.9693, lon=5.8747, day_index=0
    )

    assert result is None
