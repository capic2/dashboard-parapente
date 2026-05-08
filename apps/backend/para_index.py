"""
Para-Index Algorithm (0-100 scoring)
Based on generate-weather-report-v5.js logic
"""

import statistics
from typing import Any

from app_settings import get_setting

_THUNDERSTORM_RISK_LABELS = {
    "nul": "Risque d'orage nul",
    "faible": "Risque d'orage faible",
    "modere": "Risque d'orage modéré",
    "eleve": "Risque d'orage élevé",
}

_THUNDERSTORM_RISK_RANKS = {
    "nul": 0,
    "faible": 1,
    "modere": 2,
    "eleve": 3,
}

_THRESHOLD_DEFAULTS: dict[str, float] = {
    "para_wind_very_low_max": 3.0,
    "para_wind_low_max": 5.0,
    "para_wind_weak_max": 8.0,
    "para_wind_optimal_max": 15.0,
    "para_wind_high_max": 20.0,
    "para_gust_low_max": 15.0,
    "para_gust_moderate_max": 20.0,
    "para_gust_high_max": 25.0,
    "para_precip_none_max": 0.0,
    "para_precip_light_max": 1.0,
    "para_precip_heavy_min": 2.0,
    "para_slot_precipitation_max": 0.5,
    "para_li_stable_min": -1.0,
    "para_li_slightly_unstable_min": -3.0,
    "para_li_very_unstable_max": -5.0,
    "para_temp_cool_min": 5.0,
    "para_temp_warm_min": 10.0,
    "para_verdict_good_min": 65.0,
    "para_verdict_medium_min": 45.0,
    "para_verdict_limit_min": 30.0,
}


def get_para_index_thresholds() -> dict[str, float]:
    """Load Para-Index thresholds from settings with safe numeric fallbacks."""
    thresholds: dict[str, float] = {}
    for key, default in _THRESHOLD_DEFAULTS.items():
        raw_value = get_setting(key, default=str(default))
        try:
            thresholds[key] = float(raw_value)
        except (TypeError, ValueError):
            thresholds[key] = default

    return thresholds


def _get_thunderstorm_risk(cape: float | None, lifted_index: float | None) -> str:
    """Estimate thunderstorm risk from convective energy and instability."""
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


def _get_highest_thunderstorm_risk(hours: list[dict[str, Any]]) -> str:
    risks = [_get_thunderstorm_risk(h.get("cape"), h.get("lifted_index")) for h in hours]
    return max(risks, key=lambda risk: _THUNDERSTORM_RISK_RANKS[risk], default="nul")


def calculate_para_index(consensus_hours: list[dict[str, Any]]) -> dict[str, Any]:
    """
    Calculate daily Para-Index (0-100 score) as the average of hourly scores.

    This ensures consistency between the daily score shown on week cards
    and the individual hourly scores shown in the detailed view.

    Args:
        consensus_hours: List of consensus hourly forecasts

    Returns:
        Dict with para_index (0-100), verdict, and explanation
    """
    if not consensus_hours:
        return {
            "para_index": 0,
            "verdict": "DONNÉES INSUFFISANTES",
            "emoji": "❌",
            "explanation": "Pas de données pour les heures volables",
        }

    thresholds = get_para_index_thresholds()

    # Calculate daily score as average of hourly scores
    hourly_scores = [calculate_hourly_para_index(h, thresholds=thresholds) for h in consensus_hours]
    para_index = round(statistics.mean(hourly_scores))

    # Calculate metrics for explanation
    avg_wind = statistics.mean([h["wind_speed"] for h in consensus_hours if h.get("wind_speed")])
    max_gust = max([h["wind_gust"] for h in consensus_hours if h.get("wind_gust")], default=0)
    total_rain = sum([h["precipitation"] for h in consensus_hours if h.get("precipitation")] or [0])
    avg_temp = statistics.mean([h["temperature"] for h in consensus_hours if h.get("temperature")])
    avg_li = statistics.mean(
        [h["lifted_index"] for h in consensus_hours if h.get("lifted_index")] or [0]
    )
    thunderstorm_risk = _get_highest_thunderstorm_risk(consensus_hours)

    # Build explanation from metrics
    reasons = []
    wind_very_low_max = thresholds["para_wind_very_low_max"]
    wind_low_max = thresholds["para_wind_low_max"]
    wind_weak_max = thresholds["para_wind_weak_max"]
    wind_optimal_max = thresholds["para_wind_optimal_max"]
    wind_high_max = thresholds["para_wind_high_max"]
    gust_high_max = thresholds["para_gust_high_max"]
    precip_heavy_min = thresholds["para_precip_heavy_min"]
    li_very_unstable_max = thresholds["para_li_very_unstable_max"]

    if avg_wind < wind_very_low_max:
        reasons.append(
            f"Vent beaucoup trop insuffisant ({avg_wind:.1f} km/h < {wind_very_low_max:g})"
        )
    elif avg_wind < wind_low_max:
        reasons.append(f"Vent insuffisant ({avg_wind:.1f} km/h < {wind_low_max:g})")
    elif avg_wind < wind_weak_max:
        reasons.append(f"Vent faible ({avg_wind:.1f} km/h)")
    elif avg_wind <= wind_optimal_max:
        reasons.append(f"Vent optimal pour thermiques ({avg_wind:.1f} km/h)")
    elif avg_wind <= wind_high_max:
        reasons.append(f"Vent élevé ({avg_wind:.1f} km/h)")
    else:
        reasons.append(f"Vent trop fort - DANGEREUX ({avg_wind:.1f} km/h > {wind_high_max:g})")

    if max_gust >= gust_high_max:
        reasons.append(f"Rafales dangereuses ({max_gust:.1f} km/h >= {gust_high_max:g})")
    if total_rain > precip_heavy_min:
        reasons.append(f"Pluie importante ({total_rain:.1f}mm)")
    if avg_li < li_very_unstable_max:
        reasons.append(f"Thermiques très forts (LI {avg_li:.1f} - instable)")
    if thunderstorm_risk in {"modere", "eleve"}:
        reasons.append(_THUNDERSTORM_RISK_LABELS[thunderstorm_risk])

    # === VERDICT ===
    if para_index >= thresholds["para_verdict_good_min"]:
        verdict = "BON"
        emoji = "🟢"
        if not reasons or all("optimal" in r.lower() for r in reasons):
            reasons = ["Vent modéré, conditions favorables"]
    elif para_index >= thresholds["para_verdict_medium_min"]:
        verdict = "MOYEN"
        emoji = "🟡"
    elif para_index >= thresholds["para_verdict_limit_min"]:
        verdict = "LIMITE"
        emoji = "🟠"
    else:
        verdict = "MAUVAIS"
        emoji = "🔴"

    explanation = " — ".join(reasons) if reasons else "Conditions normales"

    return {
        "para_index": para_index,
        "verdict": verdict,
        "emoji": emoji,
        "explanation": explanation,
        "metrics": {
            "avg_wind_kmh": round(avg_wind, 1),
            "max_gust_kmh": round(max_gust, 1),
            "total_rain_mm": round(total_rain, 1),
            "avg_temp_c": round(avg_temp, 1),
            "avg_lifted_index": round(avg_li, 1),
            "thunderstorm_risk": thunderstorm_risk,
        },
    }


def analyze_hourly_slots(consensus_hours: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """
    Analyze each hour and group into flyable/non-flyable slots

    Args:
        consensus_hours: Consensus hourly forecasts

    Returns:
        List of time slots with verdicts
    """
    if not consensus_hours:
        return []

    thresholds = get_para_index_thresholds()
    wind_low_max = thresholds["para_wind_low_max"]
    wind_weak_max = thresholds["para_wind_weak_max"]
    wind_optimal_max = thresholds["para_wind_optimal_max"]
    wind_high_max = thresholds["para_wind_high_max"]
    gust_high_max = thresholds["para_gust_high_max"]
    slot_precipitation_max = thresholds["para_slot_precipitation_max"]
    li_very_unstable_max = thresholds["para_li_very_unstable_max"]

    # Analyze each hour
    hourly_verdicts = []

    for hour in consensus_hours:
        wind = hour.get("wind_speed") or 0
        gust = hour.get("wind_gust") or 0
        precip = hour.get("precipitation") or 0
        li = hour.get("lifted_index") or 0
        thunderstorm_risk = _get_thunderstorm_risk(hour.get("cape"), hour.get("lifted_index"))

        verdict = "🟢"
        reasons = []

        # Wind checks
        if wind < wind_low_max:
            verdict = "🔴"
            reasons.append("Vent insuffisant")
        elif wind < wind_weak_max:
            verdict = "🟡"
            reasons.append("Vent faible")
        elif wind > wind_high_max:
            verdict = "🔴"
            reasons.append("Vent trop fort")
        elif wind > wind_optimal_max:
            verdict = "🟡"
            reasons.append("Vent élevé")
        # Optimal range stays 🟢

        # Gust checks
        if gust >= gust_high_max:
            verdict = "🔴"
            reasons.append("Rafales")

        # Rain checks
        if precip > slot_precipitation_max:
            verdict = "🟡" if verdict == "🟢" else verdict
            reasons.append("Pluie")

        # Instability checks
        if li < li_very_unstable_max:
            verdict = "🔴"
            reasons.append("Instabilité")

        # Thunderstorm checks
        if thunderstorm_risk == "eleve":
            verdict = "🔴"
            reasons.append("Orage")
        elif thunderstorm_risk == "modere":
            verdict = "🟡" if verdict == "🟢" else verdict
            reasons.append("Risque d'orage")

        hourly_verdicts.append({"hour": hour["hour"], "verdict": verdict, "reasons": reasons})

    # Group consecutive hours with same verdict
    slots = []
    if hourly_verdicts:
        current_slot = hourly_verdicts[0].copy()

        for i in range(1, len(hourly_verdicts)):
            current = hourly_verdicts[i]
            reasons_match = current_slot["reasons"] == current["reasons"]

            if current["verdict"] != current_slot["verdict"] or not reasons_match:
                # Save current slot
                slots.append(
                    {
                        "start_hour": current_slot["hour"],
                        "end_hour": hourly_verdicts[i - 1]["hour"],
                        "verdict": current_slot["verdict"],
                        "reasons": current_slot["reasons"],
                    }
                )
                current_slot = current.copy()

        # Add last slot
        slots.append(
            {
                "start_hour": current_slot["hour"],
                "end_hour": hourly_verdicts[-1]["hour"],
                "verdict": current_slot["verdict"],
                "reasons": current_slot["reasons"],
            }
        )

    return slots


def get_best_slot(slots: list[dict[str, Any]]) -> dict[str, Any]:
    """
    Find the best flyable time slot (longest green period)

    Args:
        slots: Output from analyze_hourly_slots()

    Returns:
        Best slot or None
    """
    flyable_slots = [s for s in slots if s["verdict"] == "🟢"]

    if not flyable_slots:
        return None

    # Find longest duration
    best = max(flyable_slots, key=lambda s: s["end_hour"] - s["start_hour"])

    return best


def format_slots_summary(slots: list[dict[str, Any]]) -> str:
    """
    Format slots into a human-readable summary

    Args:
        slots: Output from analyze_hourly_slots()

    Returns:
        Formatted string
    """
    if not slots:
        return "❌ Pas de créneau volable"

    flyable = [s for s in slots if s["verdict"] == "🟢"]

    if not flyable:
        return "❌ Pas de créneau volable"

    # Format time ranges
    time_ranges = []
    for slot in flyable:
        if slot["start_hour"] == slot["end_hour"]:
            time_ranges.append(f"{slot['start_hour']}h")
        else:
            time_ranges.append(f"{slot['start_hour']}h-{slot['end_hour']}h")

    summary = "✅ Volable: " + ", ".join(time_ranges)

    # Add best slot
    best = get_best_slot(slots)
    if best:
        if best["start_hour"] == best["end_hour"]:
            best_range = f"{best['start_hour']}h"
        else:
            best_range = f"{best['start_hour']}h-{best['end_hour']}h"
        summary += f"\n⭐ Meilleur créneau: {best_range}"

    return summary


def get_thermal_strength(cape: float | None, lifted_index: float | None) -> str:
    """
    Determine thermal strength based on CAPE and Lifted Index

    Args:
        cape: Convective Available Potential Energy (J/kg)
        lifted_index: Lifted Index (negative = unstable)

    Returns:
        "Faible", "Modérée", or "Forte"
    """
    if cape is None and lifted_index is None:
        return "Faible"

    # Primary indicator: CAPE
    if cape is not None:
        if cape < 200:
            return "Faible"
        elif cape < 1000:
            return "Modérée"
        else:
            return "Forte"

    # Fallback: Lifted Index (if CAPE unavailable)
    if lifted_index is not None:
        if lifted_index > 0:
            return "Faible"  # Stable
        elif lifted_index > -3:
            return "Faible"  # Slightly unstable
        elif lifted_index > -6:
            return "Modérée"
        else:
            return "Forte"  # Very unstable

    return "Faible"


def calculate_hourly_para_index(
    hour: dict[str, Any], thresholds: dict[str, float] | None = None
) -> int:
    """
    Calculate Para-Index for a single hour (0-100 score)

    This is the SAME algorithm as calculate_para_index() but for one hour instead of averaging

    Args:
        hour: Single consensus hour with weather data

    Returns:
        Para-Index score (0-100)
    """
    wind = hour.get("wind_speed") or 0
    gust = hour.get("wind_gust") or 0
    precip = hour.get("precipitation") or 0
    temp = hour.get("temperature") or 0
    li = hour.get("lifted_index") or 0
    thunderstorm_risk = _get_thunderstorm_risk(hour.get("cape"), hour.get("lifted_index"))

    if thresholds is None:
        thresholds = get_para_index_thresholds()

    score = 0

    # === WIND SCORING (most important) ===
    if wind < thresholds["para_wind_very_low_max"]:
        score -= 40
    elif wind < thresholds["para_wind_low_max"]:
        score -= 20
    elif wind < thresholds["para_wind_weak_max"]:
        score += 10
    elif wind <= thresholds["para_wind_optimal_max"]:  # OPTIMAL RANGE
        score += 40
    elif wind <= thresholds["para_wind_high_max"]:
        score += 10
    else:
        score -= 50

    # === GUST SCORING ===
    if gust < thresholds["para_gust_low_max"]:
        score += 30
    elif gust < thresholds["para_gust_moderate_max"]:
        score += 20
    elif gust < thresholds["para_gust_high_max"]:
        score += 10
    else:
        score -= 50

    # === RAIN SCORING ===
    if precip <= thresholds["para_precip_none_max"]:
        score += 20
    elif precip < thresholds["para_precip_light_max"]:
        score += 10
    elif precip > thresholds["para_precip_heavy_min"]:
        score -= 10

    # === STABILITY SCORING (Lifted Index) ===
    if li > thresholds["para_li_stable_min"]:
        score += 20
    elif li > thresholds["para_li_slightly_unstable_min"]:
        score += 10
    elif li < thresholds["para_li_very_unstable_max"]:
        score -= 10  # Too unstable

    # === TEMPERATURE SCORING ===
    if temp > thresholds["para_temp_warm_min"]:
        score += 10
    elif temp > thresholds["para_temp_cool_min"]:
        score += 5

    # === THUNDERSTORM RISK SCORING ===
    if thunderstorm_risk == "eleve":
        score = min(score - 60, 25)
    elif thunderstorm_risk == "modere":
        score = min(score - 25, 55)
    elif thunderstorm_risk == "faible":
        score -= 5

    # Clamp score to 0-100
    return max(0, min(100, score))


def get_hourly_verdict(para_index: int, thresholds: dict[str, float] | None = None) -> str:
    """
    Get verdict label from para-index score

    Args:
        para_index: Score 0-100

    Returns:
        "BON", "MOYEN", "LIMITE", or "MAUVAIS"
    """
    if thresholds is None:
        thresholds = get_para_index_thresholds()

    if para_index >= thresholds["para_verdict_good_min"]:
        return "BON"
    elif para_index >= thresholds["para_verdict_medium_min"]:
        return "MOYEN"
    elif para_index >= thresholds["para_verdict_limit_min"]:
        return "LIMITE"
    else:
        return "MAUVAIS"
