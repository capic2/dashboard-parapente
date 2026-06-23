import asyncio
from datetime import datetime, timezone

import azba_airspace


def test_evaluate_site_azba_constraints_blocks_near_active_zone(monkeypatch):
    azba_airspace._CACHE.clear()

    async def fake_current_range():
        return {"rtba": "2026-06-16"}

    async def fake_active_zones(start, end, latest_azba_date):
        return {
            "hydra:member": [
                {
                    "id": "rtba-near",
                    "name": "RTBA TEST",
                    "valDistVerLower": 0,
                    "uomDistVerLower": "FT",
                    "valDistVerUpper": 4500,
                    "uomDistVerUpper": "FT",
                    "timeSlots": [
                        {
                            "startTime": "2026-06-16T08:00:00Z",
                            "endTime": "2026-06-16T10:00:00Z",
                        }
                    ],
                    "coordinates": [
                        {"latitude": "471200N", "longitude": "0060000E"},
                        {"latitude": "471236N", "longitude": "0060000E"},
                        {"latitude": "471236N", "longitude": "0060036E"},
                    ],
                },
                {
                    "id": "rtba-far",
                    "name": "RTBA FAR",
                    "coordinates": [{"latitude": 44.0, "longitude": 2.0}],
                },
            ]
        }

    monkeypatch.setattr(azba_airspace, "_get_current_range", fake_current_range)
    monkeypatch.setattr(azba_airspace, "_get_active_zones", fake_active_zones)

    result = asyncio.run(
        azba_airspace.evaluate_site_azba_constraints(
            site_id="site-arguel",
            site_name="Arguel",
            site_lat=47.2,
            site_lon=6.0,
            start=datetime(2026, 6, 16, 8, tzinfo=timezone.utc),
            end=datetime(2026, 6, 16, 12, tzinfo=timezone.utc),
            radius_km=10,
        )
    )

    assert result["status"] == "blocking"
    assert result["latest_azba_date"] == "2026-06-16"
    assert [constraint["id"] for constraint in result["constraints"]] == ["rtba-near"]
    assert result["constraints"][0]["distance_km"] == 0
    assert result["constraints"][0]["geometry"]["type"] == "Polygon"


def test_evaluate_site_azba_constraints_returns_clear_without_near_zone(monkeypatch):
    azba_airspace._CACHE.clear()

    async def fake_current_range():
        return {"rtba": "2026-06-16"}

    async def fake_active_zones(start, end, latest_azba_date):
        return {
            "hydra:member": [
                {
                    "id": "rtba-far",
                    "coordinates": [{"latitude": 44.0, "longitude": 2.0}],
                }
            ]
        }

    monkeypatch.setattr(azba_airspace, "_get_current_range", fake_current_range)
    monkeypatch.setattr(azba_airspace, "_get_active_zones", fake_active_zones)

    result = asyncio.run(
        azba_airspace.evaluate_site_azba_constraints(
            site_id="site-arguel",
            site_name="Arguel",
            site_lat=47.2,
            site_lon=6.0,
            start=datetime(2026, 6, 16, 8, tzinfo=timezone.utc),
            end=datetime(2026, 6, 16, 12, tzinfo=timezone.utc),
            radius_km=10,
        )
    )

    assert result["status"] == "clear"
    assert result["constraints"] == []


def test_evaluate_site_azba_constraints_returns_unknown_on_source_error(monkeypatch):
    azba_airspace._CACHE.clear()

    async def fake_current_range():
        raise azba_airspace.AzbaClientError("SIA unavailable")

    monkeypatch.setattr(azba_airspace, "_get_current_range", fake_current_range)

    result = asyncio.run(
        azba_airspace.evaluate_site_azba_constraints(
            site_id="site-arguel",
            site_name="Arguel",
            site_lat=47.2,
            site_lon=6.0,
            start=datetime(2026, 6, 16, 8, tzinfo=timezone.utc),
            end=datetime(2026, 6, 16, 12, tzinfo=timezone.utc),
            radius_km=10,
        )
    )

    assert result["status"] == "unknown"
    assert result["message"]
    assert azba_airspace._CACHE == {}


def test_get_active_zones_uses_sia_v3_interval_params(monkeypatch):
    captured = {}

    async def fake_get_json(path_with_query):
        captured["path_with_query"] = path_with_query
        return {"items": []}

    monkeypatch.setattr(azba_airspace, "_get_json", fake_get_json)

    asyncio.run(
        azba_airspace._get_active_zones(
            datetime(2026, 6, 16, 8, tzinfo=timezone.utc),
            datetime(2026, 6, 16, 12, tzinfo=timezone.utc),
            "2026-06-16",
        )
    )

    assert captured["path_with_query"].startswith("v3/r_t_b_as?")
    assert "itemsPerPage=600" in captured["path_with_query"]
    assert "debutIntervalTemps=2026-06-16T08%3A00%3A00.000Z" in captured["path_with_query"]
    assert "finIntervalTemps=2026-06-16T12%3A00%3A00.000Z" in captured["path_with_query"]
    assert "timeSlots" not in captured["path_with_query"]


def test_extract_coordinates_supports_sia_dms_coordinates():
    assert azba_airspace._extract_coordinates(
        {"coordinates": [{"latitude": "470438.00N", "longitude": "0034000.00E"}]}
    ) == [(47.077222222222225, 3.6666666666666665)]
