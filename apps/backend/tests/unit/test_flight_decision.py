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


def _payload(consensus: list[dict], total_sources: int | None = 4):
    payload = {
        "site_id": "site-arguel",
        "site_name": "Arguel",
        "day_index": 1,
        "sunrise": "08:00",
        "sunset": "18:00",
        "consensus": consensus,
        "cached_at": "2026-05-30T10:00:00Z",
    }
    if total_sources is not None:
        payload["total_sources"] = total_sources
    return payload


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


def test_summary_uses_highest_severity_window_risk_first():
    result = build_flight_decision(
        site=_site(),
        weather_payload=_payload([_hour(11, wind_speed=2, wind_gust=38)]),
        objective="progression",
        now=datetime(2026, 5, 30, 9, tzinfo=ZoneInfo("Europe/Paris")),
    )

    assert result["best_window"] is None
    assert result["least_unfavorable_window"]["main_risk_codes"][0] == "gust_high"
    assert result["summary"]["main_risk_code"] == "gust_high"


def test_confidence_keeps_zero_source_hours_when_total_sources_missing():
    result = build_flight_decision(
        site=_site(),
        weather_payload=_payload([_hour(11, num_sources=0)], total_sources=None),
        objective="tranquille",
        now=datetime(2026, 5, 30, 9, tzinfo=ZoneInfo("Europe/Paris")),
    )

    assert result["hourly"][0]["confidence"]["source_count"] == 0
    assert result["confidence"]["source_count"] == 0
    assert result["confidence"]["score"] == 10


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


def test_displayed_risks_are_scoped_to_recommended_window():
    payload = _payload(
        [
            _hour(12, wind_speed=8.6, wind_direction=263.8, para_index=80),
            _hour(13, wind_speed=9.8, wind_direction=266.4, para_index=80),
            _hour(14, wind_speed=9.7, wind_direction=269.6, para_index=80),
            _hour(15, wind_speed=8.9, wind_direction=269.7, para_index=80),
            _hour(16, wind_speed=8.2, wind_direction=277.0, para_index=80),
            _hour(17, wind_speed=8.0, wind_direction=281.0, para_index=90),
            _hour(18, wind_speed=6.1, wind_direction=290.1, para_index=90),
            _hour(19, wind_speed=5.0, wind_direction=296.1, para_index=90),
            _hour(20, wind_speed=4.4, wind_direction=6.3, para_index=60),
            _hour(21, wind_speed=4.5, wind_direction=63.9, para_index=60),
        ]
    )
    payload.update({"day_index": 0, "sunrise": "05:00", "sunset": "21:00"})

    result = build_flight_decision(
        site=_site("SW"),
        weather_payload=payload,
        objective="tranquille",
        now=datetime(2026, 5, 30, 12, tzinfo=ZoneInfo("Europe/Paris")),
    )

    assert result["best_window"]["hours"] == [12, 13, 14, 15, 16, 17, 18, 19]
    risk_codes = [risk["code"] for risk in result["risks"]]
    assert "wind_decollage_travers_fort" in risk_codes
    assert "wind_decollage_cul" not in risk_codes
    assert "wind_too_weak" not in risk_codes


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


def test_preserves_explicit_zero_para_index():
    result = build_flight_decision(
        site=_site(),
        weather_payload=_payload([_hour(11, para_index=0)]),
        objective="tranquille",
        now=datetime(2026, 5, 30, 9, tzinfo=ZoneInfo("Europe/Paris")),
    )

    assert result["hourly"][0]["para_index"] == 0


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
