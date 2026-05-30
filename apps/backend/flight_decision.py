from __future__ import annotations

from datetime import datetime
from typing import Any, Literal
from zoneinfo import ZoneInfo

from para_index import calculate_hourly_para_index, get_para_index_thresholds

DecisionLevel = Literal["favorable", "vigilance", "limite", "deconseille", "unavailable"]
RiskSeverity = Literal["info", "vigilance", "limiting", "blocking"]
FlightObjective = Literal["tranquille", "progression", "thermique"]

PARIS_TZ = ZoneInfo("Europe/Paris")
EXPECTED_SOURCE_COUNT = 5

_LEVEL_RANK: dict[DecisionLevel, int] = {
    "unavailable": -1,
    "deconseille": 0,
    "limite": 1,
    "vigilance": 2,
    "favorable": 3,
}

_CARDINAL_TO_DEGREES = {
    "N": 0,
    "NNE": 22.5,
    "NE": 45,
    "ENE": 67.5,
    "E": 90,
    "ESE": 112.5,
    "SE": 135,
    "SSE": 157.5,
    "S": 180,
    "SSW": 202.5,
    "SW": 225,
    "WSW": 247.5,
    "W": 270,
    "WNW": 292.5,
    "NW": 315,
    "NNW": 337.5,
}


def normalize_objective(value: str | None) -> FlightObjective:
    return value if value in {"tranquille", "progression", "thermique"} else "tranquille"


def build_flight_decision(
    *,
    site: Any,
    weather_payload: dict[str, Any],
    objective: FlightObjective,
    landing_associations: list[Any] | None = None,
    now: datetime | None = None,
) -> dict[str, Any]:
    thresholds = get_para_index_thresholds()
    current_time = now.astimezone(PARIS_TZ) if now else datetime.now(PARIS_TZ)
    day_index = int(weather_payload.get("day_index") or 0)
    consensus = list(weather_payload.get("consensus") or [])
    flyable_hours = _filter_daylight_hours(
        consensus,
        weather_payload.get("sunrise"),
        weather_payload.get("sunset"),
    )

    if not flyable_hours:
        risks = [
            _diagnostic(
                "weather_unavailable",
                "blocking",
                "flightDecision.risk.weatherUnavailable",
            )
        ]
        return _empty_response(
            site=site,
            objective=objective,
            day_index=day_index,
            cached_at=weather_payload.get("cached_at"),
            risks=risks,
        )

    hourly = [
        _build_hour_decision(
            hour=hour,
            site_orientation=getattr(site, "orientation", None),
            objective=objective,
            thresholds=thresholds,
            day_index=day_index,
            current_time=current_time,
        )
        for hour in flyable_hours
    ]
    global_risks = _global_risks(hourly)
    confidence = _build_confidence(weather_payload, hourly)
    landing_safety = _build_landing_safety(landing_associations or [])
    global_risks.extend(landing_safety.get("decision_risks", []))

    if confidence["level"] in {"low", "very_low"}:
        global_risks.append(
            _diagnostic(
                "forecast_confidence_low",
                "vigilance",
                "flightDecision.confidence.lowDiagnostic",
                {"confidence": confidence["score"]},
            )
        )

    best_window = _select_best_window(hourly)
    least_unfavorable = None if best_window else _select_least_unfavorable_window(hourly)
    summary_level: DecisionLevel = "unavailable"
    summary_score = 0
    main_risk_code = global_risks[0]["code"] if global_risks else None

    if best_window:
        summary_level = best_window["level"]
        summary_score = best_window["score_objectif"]
        main_risk_code = (
            best_window["main_risk_codes"][0] if best_window["main_risk_codes"] else main_risk_code
        )
    elif least_unfavorable:
        summary_level = least_unfavorable["level"]
        summary_score = least_unfavorable["score_objectif"]
        main_risk_code = (
            least_unfavorable["main_risk_codes"][0]
            if least_unfavorable["main_risk_codes"]
            else main_risk_code
        )

    return {
        "site": {
            "id": getattr(site, "id", ""),
            "name": getattr(site, "name", ""),
            "usage_type": getattr(site, "usage_type", None),
            "orientation": getattr(site, "orientation", None),
        },
        "objective": objective,
        "timezone": "Europe/Paris",
        "day_index": day_index,
        "summary": {
            "level": summary_level,
            "translation_key": _level_key(summary_level),
            "score_objectif": summary_score,
            "title_key": f"flightDecision.summary.{summary_level}.title",
            "message_key": f"flightDecision.summary.{summary_level}.message",
            "message_params": _summary_params(best_window, least_unfavorable, main_risk_code),
            "main_risk_code": main_risk_code,
            "has_recommended_window": best_window is not None,
        },
        "best_window": best_window,
        "least_unfavorable_window": least_unfavorable,
        "hourly": hourly,
        "risks": global_risks,
        "confidence": confidence,
        "landing_safety": {
            key: value for key, value in landing_safety.items() if key != "decision_risks"
        },
        "live_wind": {
            "status": "not_evaluated",
            "influences_confidence": False,
            "stations": [],
            "diagnostics": [],
        },
        "alternatives": [],
        "cached_at": weather_payload.get("cached_at"),
    }


def _empty_response(
    *,
    site: Any,
    objective: FlightObjective,
    day_index: int,
    cached_at: str | None,
    risks: list[dict[str, Any]],
) -> dict[str, Any]:
    return {
        "site": {
            "id": getattr(site, "id", ""),
            "name": getattr(site, "name", ""),
            "usage_type": getattr(site, "usage_type", None),
            "orientation": getattr(site, "orientation", None),
        },
        "objective": objective,
        "timezone": "Europe/Paris",
        "day_index": day_index,
        "summary": {
            "level": "unavailable",
            "translation_key": _level_key("unavailable"),
            "score_objectif": 0,
            "title_key": "flightDecision.summary.unavailable.title",
            "message_key": "flightDecision.summary.unavailable.message",
            "message_params": {},
            "main_risk_code": risks[0]["code"] if risks else None,
            "has_recommended_window": False,
        },
        "best_window": None,
        "least_unfavorable_window": None,
        "hourly": [],
        "risks": risks,
        "confidence": {
            "level": "very_low",
            "score": 0,
            "translation_key": "flightDecision.confidence.veryLow",
            "source_count": 0,
            "expected_source_count": EXPECTED_SOURCE_COUNT,
            "freshness": {"cached_at": cached_at, "age_minutes": None, "status": "unknown"},
            "diagnostics": risks,
        },
        "landing_safety": {
            "status": "unavailable",
            "level": "unavailable",
            "translation_key": "flightDecision.landingSafety.unavailable",
            "summary_key": "flightDecision.landingSafety.unavailableSummary",
            "summary_params": {},
            "landings": [],
        },
        "live_wind": {
            "status": "not_evaluated",
            "influences_confidence": False,
            "stations": [],
            "diagnostics": [],
        },
        "alternatives": [],
        "cached_at": cached_at,
    }


def _filter_daylight_hours(
    consensus: list[dict[str, Any]], sunrise: str | None, sunset: str | None
) -> list[dict[str, Any]]:
    if not sunrise or not sunset:
        return consensus
    try:
        sunrise_hour = int(sunrise.split(":", maxsplit=1)[0])
        sunset_hour = int(sunset.split(":", maxsplit=1)[0])
    except (ValueError, IndexError):
        return consensus
    return [h for h in consensus if sunrise_hour <= int(h.get("hour", 0)) <= sunset_hour]


def _build_hour_decision(
    *,
    hour: dict[str, Any],
    site_orientation: str | None,
    objective: FlightObjective,
    thresholds: dict[str, float],
    day_index: int,
    current_time: datetime,
) -> dict[str, Any]:
    hour_num = int(hour.get("hour") or 0)
    para_index = int(hour.get("para_index") or calculate_hourly_para_index(hour, thresholds))
    score = _score_for_objective(para_index, hour, objective)
    risks = _hour_risks(hour, thresholds)
    wind_decollage = _wind_decollage(hour.get("wind_direction"), site_orientation)
    if wind_decollage["severity"] != "info":
        risks.append(
            _diagnostic(
                f"wind_decollage_{wind_decollage['status']}",
                wind_decollage["severity"],
                wind_decollage["translation_key"],
                {
                    "angle_deviation_deg": wind_decollage.get("angle_deviation_deg"),
                    "selected_orientation": wind_decollage.get("selected_orientation"),
                },
            )
        )

    level = _resolve_level(score, risks, thresholds)
    thermal = _thermal(hour, objective)

    return {
        "hour": hour_num,
        "is_past": day_index == 0 and hour_num < current_time.hour,
        "level": level,
        "translation_key": _level_key(level),
        "score_objectif": score,
        "para_index": para_index,
        "risks": risks,
        "wind": {
            "speed_kmh": hour.get("wind_speed"),
            "gust_kmh": hour.get("wind_gust"),
            "direction_deg": hour.get("wind_direction"),
            "direction_label": _direction_label(hour.get("wind_direction")),
        },
        "wind_decollage": wind_decollage,
        "thermal": thermal,
        "confidence": _hour_confidence(hour),
    }


def _score_for_objective(para_index: int, hour: dict[str, Any], objective: FlightObjective) -> int:
    strength = str(hour.get("thermal_strength") or "faible").lower()
    thunderstorm = _thunderstorm_risk(hour.get("cape"), hour.get("lifted_index"))
    adjustment = 0
    if objective == "tranquille":
        adjustment = 5 if strength == "faible" else -5 if strength == "modere" else -15
    elif objective == "progression":
        adjustment = 0 if strength == "faible" else 7 if strength == "modere" else -5
    elif objective == "thermique":
        adjustment = -8 if strength == "faible" else 8 if strength == "modere" else 10
    if thunderstorm in {"modere", "eleve"}:
        adjustment = min(adjustment, 0)
    return max(0, min(100, round(para_index + adjustment)))


def _hour_risks(hour: dict[str, Any], thresholds: dict[str, float]) -> list[dict[str, Any]]:
    risks: list[dict[str, Any]] = []
    wind = hour.get("wind_speed")
    gust = hour.get("wind_gust")
    precipitation = hour.get("precipitation") or 0
    thunderstorm = _thunderstorm_risk(hour.get("cape"), hour.get("lifted_index"))

    if wind is None:
        risks.append(_diagnostic("wind_missing", "limiting", "flightDecision.risk.windMissing"))
    elif wind > thresholds["para_wind_high_max"]:
        risks.append(
            _diagnostic(
                "wind_too_strong",
                "blocking",
                "flightDecision.risk.windTooStrong",
                {"wind_kmh": round(wind, 1), "threshold_kmh": thresholds["para_wind_high_max"]},
            )
        )
    elif wind < thresholds["para_wind_low_max"]:
        risks.append(
            _diagnostic(
                "wind_too_weak",
                "limiting",
                "flightDecision.risk.windTooWeak",
                {"wind_kmh": round(wind, 1), "threshold_kmh": thresholds["para_wind_low_max"]},
            )
        )
    elif wind < thresholds["para_wind_weak_max"]:
        risks.append(
            _diagnostic(
                "wind_weak",
                "vigilance",
                "flightDecision.risk.windWeak",
                {"wind_kmh": round(wind, 1), "threshold_kmh": thresholds["para_wind_weak_max"]},
            )
        )

    if gust is not None and gust >= thresholds["para_gust_high_max"]:
        risks.append(
            _diagnostic(
                "gust_high",
                "blocking",
                "flightDecision.risk.gustHigh",
                {"gust_kmh": round(gust, 1), "threshold_kmh": thresholds["para_gust_high_max"]},
            )
        )

    if precipitation > thresholds["para_slot_precipitation_max"]:
        risks.append(
            _diagnostic(
                "rain_significant",
                "blocking",
                "flightDecision.risk.rainSignificant",
                {
                    "precipitation_mm": round(precipitation, 1),
                    "threshold_mm": thresholds["para_slot_precipitation_max"],
                },
            )
        )

    if thunderstorm == "faible":
        risks.append(
            _diagnostic("thunderstorm_low", "vigilance", "flightDecision.risk.thunderstormLow")
        )
    elif thunderstorm == "modere":
        risks.append(
            _diagnostic(
                "thunderstorm_moderate", "limiting", "flightDecision.risk.thunderstormModerate"
            )
        )
    elif thunderstorm == "eleve":
        risks.append(
            _diagnostic("thunderstorm_high", "blocking", "flightDecision.risk.thunderstormHigh")
        )

    return risks


def _resolve_level(
    score: int, risks: list[dict[str, Any]], thresholds: dict[str, float]
) -> DecisionLevel:
    if score >= thresholds["para_verdict_good_min"]:
        level: DecisionLevel = "favorable"
    elif score >= thresholds["para_verdict_medium_min"]:
        level = "vigilance"
    elif score >= thresholds["para_verdict_limit_min"]:
        level = "limite"
    else:
        level = "deconseille"

    severities = {risk["severity"] for risk in risks}
    if "blocking" in severities:
        return "limite" if score >= thresholds["para_verdict_limit_min"] else "deconseille"
    if "limiting" in severities and level == "favorable":
        return "vigilance"
    if "vigilance" in severities and level == "favorable":
        return "vigilance"
    return level


def _wind_decollage(direction_deg: float | None, orientation: str | None) -> dict[str, Any]:
    if direction_deg is None:
        return {
            "status": "not_evaluated",
            "translation_key": "flightDecision.windDecollage.not_evaluated",
            "angle_deviation_deg": None,
            "selected_orientation": None,
            "severity": "vigilance",
        }

    orientations = _parse_orientations(orientation)
    if not orientations:
        return {
            "status": "orientation_unknown",
            "translation_key": "flightDecision.windDecollage.orientation_unknown",
            "angle_deviation_deg": None,
            "selected_orientation": None,
            "severity": "vigilance",
        }

    selected, deviation = min(
        ((label, _angle_delta(direction_deg, degrees)) for label, degrees in orientations),
        key=lambda item: item[1],
    )
    if deviation <= 30:
        status, severity = "face", "info"
    elif deviation <= 60:
        status, severity = "travers_acceptable", "vigilance"
    elif deviation <= 100:
        status, severity = "travers_fort", "limiting"
    else:
        status, severity = "cul", "blocking"

    return {
        "status": status,
        "translation_key": f"flightDecision.windDecollage.{status}",
        "angle_deviation_deg": round(deviation),
        "selected_orientation": selected,
        "severity": severity,
    }


def _parse_orientations(value: str | None) -> list[tuple[str, float]]:
    if not value:
        return []
    normalized = value.upper().replace("/", ",").replace(";", ",").replace(" ", ",")
    labels = [part.strip() for part in normalized.split(",") if part.strip()]
    return [
        (label, _CARDINAL_TO_DEGREES[label]) for label in labels if label in _CARDINAL_TO_DEGREES
    ]


def _angle_delta(a: float, b: float) -> float:
    return abs((a - b + 180) % 360 - 180)


def _direction_label(degrees: float | None) -> str | None:
    if degrees is None:
        return None
    labels = ["N", "NE", "E", "SE", "S", "SO", "O", "NO"]
    return labels[round((degrees % 360) / 45) % 8]


def _thermal(hour: dict[str, Any], objective: FlightObjective) -> dict[str, Any]:
    strength = str(hour.get("thermal_strength") or "faible").lower()
    if objective == "tranquille":
        effect = (
            "positive"
            if strength == "faible"
            else "vigilance" if strength == "modere" else "limiting"
        )
    elif objective == "progression":
        effect = (
            "neutral"
            if strength == "faible"
            else "positive" if strength == "modere" else "vigilance"
        )
    else:
        effect = "limiting" if strength == "faible" else "positive"
    return {
        "strength": strength,
        "cape": hour.get("cape"),
        "lifted_index": hour.get("lifted_index"),
        "objective_effect": effect,
        "translation_key": f"flightDecision.thermal.{objective}.{effect}",
    }


def _hour_confidence(hour: dict[str, Any]) -> dict[str, Any]:
    source_count = int(hour.get("num_sources") or len(hour.get("sources") or {}) or 0)
    score = min(100, max(20, source_count * 20)) if source_count else 20
    return {"level": _confidence_level(score), "score": score, "source_count": source_count}


def _build_confidence(
    weather_payload: dict[str, Any], hourly: list[dict[str, Any]]
) -> dict[str, Any]:
    total_sources = weather_payload.get("total_sources")
    source_count = (
        int(total_sources)
        if total_sources is not None
        else max(
            (h["confidence"]["source_count"] for h in hourly),
            default=0,
        )
    )
    score = min(100, max(10, source_count * 20)) if source_count else 10
    diagnostics: list[dict[str, Any]] = []
    if source_count <= 1:
        diagnostics.append(
            _diagnostic(
                "single_forecast_source",
                "vigilance",
                "flightDecision.confidence.singleForecastSource",
                {"source_count": source_count},
            )
        )
        score = min(score, 45)
    cached_at = weather_payload.get("cached_at")
    freshness = {"cached_at": cached_at, "age_minutes": None, "status": "unknown"}
    return {
        "level": _confidence_level(score),
        "score": score,
        "translation_key": f"flightDecision.confidence.{_confidence_level(score)}",
        "source_count": source_count,
        "expected_source_count": EXPECTED_SOURCE_COUNT,
        "freshness": freshness,
        "diagnostics": diagnostics,
    }


def _confidence_level(score: int) -> str:
    if score >= 80:
        return "high"
    if score >= 55:
        return "medium"
    if score >= 30:
        return "low"
    return "very_low"


def _build_landing_safety(associations: list[Any]) -> dict[str, Any]:
    if not associations:
        risk = _diagnostic(
            "landing_not_configured",
            "vigilance",
            "flightDecision.landingSafety.notConfiguredDiagnostic",
        )
        return {
            "status": "not_configured",
            "level": "vigilance",
            "translation_key": "flightDecision.landingSafety.notConfigured",
            "summary_key": "flightDecision.landingSafety.notConfiguredSummary",
            "summary_params": {},
            "landings": [],
            "decision_risks": [risk],
        }

    landings = []
    for assoc in associations:
        landing = getattr(assoc, "landing_site", None)
        landings.append(
            {
                "site_id": getattr(landing, "id", getattr(assoc, "landing_site_id", "")),
                "name": getattr(landing, "name", getattr(assoc, "landing_site_id", "")),
                "distance_km": getattr(assoc, "distance_km", None),
                "is_primary": bool(getattr(assoc, "is_primary", False)),
                "level": "unavailable",
                "score_objectif": None,
                "risks": [
                    _diagnostic(
                        "landing_weather_not_evaluated",
                        "vigilance",
                        "flightDecision.landingSafety.weatherNotEvaluated",
                    )
                ],
            }
        )

    risk = _diagnostic(
        "landing_weather_not_evaluated",
        "vigilance",
        "flightDecision.landingSafety.weatherNotEvaluated",
    )
    return {
        "status": "unavailable",
        "level": "vigilance",
        "translation_key": "flightDecision.landingSafety.unavailable",
        "summary_key": "flightDecision.landingSafety.unavailableSummary",
        "summary_params": {"total_count": len(landings)},
        "landings": landings,
        "decision_risks": [risk],
    }


def _select_best_window(hourly: list[dict[str, Any]]) -> dict[str, Any] | None:
    windows = _build_windows(
        [h for h in hourly if not h["is_past"] and h["level"] in {"favorable", "vigilance"}]
    )
    if not windows:
        return None
    return max(
        windows,
        key=lambda window: (
            _LEVEL_RANK[window["level"]],
            window["score_objectif"],
            len(window["hours"]),
            -window["start_hour"],
        ),
    )


def _select_least_unfavorable_window(hourly: list[dict[str, Any]]) -> dict[str, Any] | None:
    candidates = [h for h in hourly if not h["is_past"] and h["level"] != "unavailable"]
    if not candidates:
        return None
    best_hour = max(candidates, key=lambda h: (_LEVEL_RANK[h["level"]], h["score_objectif"]))
    return _window_from_hours([best_hour])


def _build_windows(hours: list[dict[str, Any]]) -> list[dict[str, Any]]:
    if not hours:
        return []
    sorted_hours = sorted(hours, key=lambda h: h["hour"])
    groups: list[list[dict[str, Any]]] = [[sorted_hours[0]]]
    for hour in sorted_hours[1:]:
        if hour["hour"] == groups[-1][-1]["hour"] + 1:
            groups[-1].append(hour)
        else:
            groups.append([hour])
    return [_window_from_hours(group) for group in groups]


def _window_from_hours(hours: list[dict[str, Any]]) -> dict[str, Any]:
    min_level = min(hours, key=lambda h: _LEVEL_RANK[h["level"]])["level"]
    min_score = min(int(h["score_objectif"]) for h in hours)
    ordered_risks = sorted(
        (risk for h in hours for risk in h["risks"]),
        key=lambda risk: _severity_rank(risk["severity"]),
        reverse=True,
    )
    main_risks = list(dict.fromkeys(risk["code"] for risk in ordered_risks))
    start_hour = min(h["hour"] for h in hours)
    end_hour = max(h["hour"] for h in hours)
    return {
        "start_hour": start_hour,
        "end_hour": end_hour,
        "level": min_level,
        "translation_key": _level_key(min_level),
        "score_objectif": min_score,
        "min_score_objectif": min_score,
        "hours": [h["hour"] for h in hours],
        "main_risk_codes": main_risks,
        "summary_key": f"flightDecision.window.{min_level}",
        "summary_params": {"start_hour": start_hour, "end_hour": end_hour, "score": min_score},
    }


def _global_risks(hourly: list[dict[str, Any]]) -> list[dict[str, Any]]:
    by_code: dict[str, dict[str, Any]] = {}
    for hour in hourly:
        for risk in hour["risks"]:
            current = by_code.get(risk["code"])
            if current is None or _severity_rank(risk["severity"]) > _severity_rank(
                current["severity"]
            ):
                by_code[risk["code"]] = risk
    return sorted(by_code.values(), key=lambda risk: _severity_rank(risk["severity"]), reverse=True)


def _severity_rank(severity: str) -> int:
    return {"info": 0, "vigilance": 1, "limiting": 2, "blocking": 3}.get(severity, 0)


def _summary_params(
    best_window: dict[str, Any] | None,
    least_unfavorable: dict[str, Any] | None,
    main_risk_code: str | None,
) -> dict[str, Any]:
    window = best_window or least_unfavorable
    if not window:
        return {"main_reason": main_risk_code}
    return {
        "main_reason": main_risk_code,
        "start_hour": window["start_hour"],
        "end_hour": window["end_hour"],
    }


def _diagnostic(
    code: str,
    severity: RiskSeverity,
    translation_key: str,
    params: dict[str, Any] | None = None,
) -> dict[str, Any]:
    return {
        "code": code,
        "severity": severity,
        "translation_key": translation_key,
        "params": params or {},
    }


def _level_key(level: DecisionLevel) -> str:
    return f"flightDecision.level.{level}"


def _thunderstorm_risk(cape: float | None, lifted_index: float | None) -> str:
    if cape is None and lifted_index is None:
        return "nul"
    if cape is None:
        if lifted_index is not None and lifted_index <= -7:
            return "eleve"
        if lifted_index is not None and lifted_index <= -5:
            return "modere"
        if lifted_index is not None and lifted_index <= -3:
            return "faible"
        return "nul"
    if cape >= 2500 or (cape >= 1500 and lifted_index is not None and lifted_index <= -4):
        return "eleve"
    if cape >= 1500 or (cape >= 800 and lifted_index is not None and lifted_index <= -2):
        return "modere"
    if cape >= 300 or (lifted_index is not None and lifted_index <= -3):
        return "faible"
    return "nul"
