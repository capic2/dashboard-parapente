from datetime import datetime
from types import SimpleNamespace
from zoneinfo import ZoneInfo

from flight_decision import build_flight_decision


def _site(orientation: str | None = "SW"):
    return SimpleNamespace(
        id="site-arguel",
        name="Arguel",
        usage_type="takeoff",
        orientation=orientation,
    )


def _payload(consensus: list[dict], total_sources: int = 4):
    return {
        "site_id": "site-arguel",
        "site_name": "Arguel",
        "day_index": 1,
        "sunrise": "08:00",
        "sunset": "18:00",
        "consensus": consensus,
        "total_sources": total_sources,
        "cached_at": "2026-05-30T10:00:00Z",
    }


def _hour(hour: int, **overrides):
    data = {
        "hour": hour,
        "num_sources": 4,
        "temperature": 18,
        "wind_speed": 12,
        "wind_gust": 16,
        "wind_direction": 225,
        "precipitation": 0,
        "cloud_cover": 30,
        "cape": 100,
        "lifted_index": 0,
        "thermal_strength": "faible",
    }
    data.update(overrides)
    return data


def test_builds_favorable_window_for_quiet_objective():
    result = build_flight_decision(
        site=_site(),
        weather_payload=_payload([_hour(11), _hour(12)]),
        objective="tranquille",
        now=datetime(2026, 5, 30, 9, tzinfo=ZoneInfo("Europe/Paris")),
    )

    assert result["summary"]["level"] == "favorable"
    assert result["best_window"]["start_hour"] == 11
    assert result["best_window"]["end_hour"] == 12
    assert result["best_window"]["score_objectif"] >= result["hourly"][0]["para_index"]


def test_blocking_gust_prevents_recommended_window():
    result = build_flight_decision(
        site=_site(),
        weather_payload=_payload([_hour(11, wind_gust=38)]),
        objective="progression",
        now=datetime(2026, 5, 30, 9, tzinfo=ZoneInfo("Europe/Paris")),
    )

    assert result["best_window"] is None
    assert result["least_unfavorable_window"]["level"] == "limite"
    assert any(risk["code"] == "gust_high" for risk in result["hourly"][0]["risks"])


def test_tailwind_is_blocking_for_decollage_orientation():
    result = build_flight_decision(
        site=_site("SW"),
        weather_payload=_payload([_hour(11, wind_direction=45)]),
        objective="progression",
        now=datetime(2026, 5, 30, 9, tzinfo=ZoneInfo("Europe/Paris")),
    )

    assert result["hourly"][0]["wind_decollage"]["status"] == "cul"
    assert result["hourly"][0]["level"] == "limite"
    assert result["best_window"] is None


def test_objective_changes_thermal_score_without_changing_para_index():
    payload = _payload([_hour(11, thermal_strength="fort", cape=700, lifted_index=-1)])
    quiet = build_flight_decision(
        site=_site(),
        weather_payload=payload,
        objective="tranquille",
        now=datetime(2026, 5, 30, 9, tzinfo=ZoneInfo("Europe/Paris")),
    )
    thermal = build_flight_decision(
        site=_site(),
        weather_payload=payload,
        objective="thermique",
        now=datetime(2026, 5, 30, 9, tzinfo=ZoneInfo("Europe/Paris")),
    )

    assert quiet["hourly"][0]["para_index"] == thermal["hourly"][0]["para_index"]
    assert quiet["hourly"][0]["score_objectif"] < thermal["hourly"][0]["score_objectif"]


def test_unavailable_when_no_hourly_weather():
    result = build_flight_decision(
        site=_site(),
        weather_payload=_payload([]),
        objective="tranquille",
        now=datetime(2026, 5, 30, 9, tzinfo=ZoneInfo("Europe/Paris")),
    )

    assert result["summary"]["level"] == "unavailable"
    assert result["hourly"] == []
    assert result["risks"][0]["translation_key"] == "flightDecision.risk.weatherUnavailable"
