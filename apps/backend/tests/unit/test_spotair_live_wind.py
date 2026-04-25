"""Unit tests for SpotAiR live wind normalization logic."""

from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from spotair_live_wind import (
    _build_source_url,
    build_bbox,
    fetch_live_wind_stations,
    haversine_distance_km,
)


def test_build_bbox_returns_expected_bounds():
    south, north, west, east = build_bbox(47.0, 6.0, 10.0)

    assert south == pytest.approx(46.9099, rel=0, abs=1e-3)
    assert north == pytest.approx(47.0901, rel=0, abs=1e-3)
    assert west < 6.0
    assert east > 6.0


def test_haversine_distance_known_route():
    # Paris (48.8566, 2.3522) -> London (51.5074, -0.1278) ~343 km
    distance = haversine_distance_km(48.8566, 2.3522, 51.5074, -0.1278)

    assert distance == pytest.approx(343, rel=0.03)


@pytest.mark.parametrize(
    ("provider", "balise_id", "expected"),
    [
        ("ffvl", "5043", "https://balisemeteo.com/balise.php?idBalise=5043"),
        ("pioupiou", "12", "https://www.openwindmap.org/PP12"),
        ("romma", "99", "https://www.romma.fr/station_24.php?id=99"),
        ("holfuy", "1234", "https://holfuy.com/fr/weather/1234"),
        (None, "123", None),
        ("ffvl", None, None),
        ("unknown", "1", None),
    ],
)
def test_build_source_url(provider, balise_id, expected):
    assert _build_source_url(provider, balise_id) == expected


@pytest.mark.asyncio
async def test_fetch_live_wind_stations_normalizes_and_sorts():
    fixed_now = datetime(2026, 1, 1, 12, 0, tzinfo=timezone.utc)
    fixed_now_ts = int(fixed_now.timestamp())

    payload = {
        "code": 0,
        "data": [
            {
                "provider_key": "ffvl",
                "balise_id": 42,
                "nom": "Fresh station",
                "latitude": 47.0,
                "longitude": 6.0,
                "altitude": 450,
                "releves": [
                    {
                        "date_releve": fixed_now_ts,
                        "vmoy": 18,
                        "vmin": 9,
                        "vmax": 24,
                        "direction": 185,
                        "temperature": 13,
                        "plafond_nuages": 2100,
                    }
                ],
            },
            {
                "provider_key": "romma",
                "balise_id": 99,
                "nom": "Older station",
                "latitude": 47.0,
                "longitude": 6.0,
                "altitude": 470,
                "releves": [
                    {
                        "date_releve": fixed_now_ts - 5 * 60,
                        "vmoy": 14,
                        "vmin": 8,
                        "vmax": 21,
                        "direction": 200,
                        "temperature": 11,
                        "plafond_nuages": 1800,
                    }
                ],
            },
            {
                "provider_key": "holfuy",
                "balise_id": 1234,
                "nom": "Unknown age station",
                "latitude": 47.0,
                "longitude": 6.0,
                "altitude": 490,
                "releves": [{"vmoy": 11, "vmax": 17}],
            },
            {
                "provider_key": None,
                "balise_id": 777,
                "nom": "Invalid station",
                "latitude": 47.0,
                "longitude": 6.0,
                "releves": [],
            },
        ],
    }

    response = MagicMock()
    response.raise_for_status = MagicMock()
    response.json = MagicMock(return_value=payload)
    response.text = "ok"

    client = MagicMock()
    client.post = AsyncMock(return_value=response)

    class FrozenDateTime(datetime):
        @classmethod
        def now(cls, tz=None):  # noqa: ARG003
            return fixed_now

    with (
        patch("spotair_live_wind.config.SPOTAIR_BALISES_API_KEY", "spotair-key"),
        patch("spotair_live_wind.datetime", FrozenDateTime),
        patch("spotair_live_wind.httpx.AsyncClient") as async_client_cls,
    ):
        async_client_cls.return_value.__aenter__.return_value = client

        stations = await fetch_live_wind_stations(site_lat=47.0, site_lon=6.0, radius_km=10.0)

    assert len(stations) == 3
    assert [s["name"] for s in stations] == [
        "Fresh station",
        "Older station",
        "Unknown age station",
    ]

    fresh = stations[0]
    assert fresh["id"] == "ffvl_42"
    assert fresh["provider"] == "ffvl"
    assert fresh["provider_id"] == "42"
    assert fresh["age_minutes"] == 0
    assert fresh["is_outdated"] is False
    assert fresh["last_report_at"] == fixed_now.isoformat()
    assert fresh["source_url"] == "https://balisemeteo.com/balise.php?idBalise=42"

    older = stations[1]
    assert older["age_minutes"] == 5
    assert older["is_outdated"] is False

    unknown_age = stations[2]
    assert unknown_age["age_minutes"] is None
    assert unknown_age["is_outdated"] is True

    called_headers = client.post.await_args.kwargs["headers"]
    assert called_headers["X-Spotair-Apikey"] == "spotair-key"
