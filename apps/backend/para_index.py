"""
Para-Index Algorithm (0-100 scoring)
Based on generate-weather-report-v5.js logic
"""

from typing import Dict, List, Any, Tuple
import statistics


def calculate_para_index(
    consensus_hours: List[Dict[str, Any]]
) -> Dict[str, Any]:
    """
    Calculate Para-Index (0-100 score) based on consensus forecast
    
    Scoring logic (from generate-weather-report-v5.js):
    - Optimal wind: 8-15 km/h (+40 points) - BEST for thermals
    - Wind < 3 km/h: -40 points (insufficient)
    - Wind 3-5 km/h: -20 points (too light)
    - Wind 5-8 km/h: +10 points (acceptable, light)
    - Wind 15-20 km/h: +10 points (strong but OK)
    - Wind > 20 km/h: -50 points (too strong - DANGEROUS)
    - Gusts < 15 km/h: +30 points
    - Gusts 15-20 km/h: +20 points
    - Gusts 20-25 km/h: +10 points
    - Gusts > 25 km/h: -50 points (DANGEROUS)
    - No rain: +20 points
    - Rain < 1mm: +10 points
    - Lifted Index > -1: +20 points (stable)
    - Lifted Index -1 to -3: +10 points
    - Lifted Index < -5: problematic (too unstable)
    - Temperature > 10°C: +10 points
    - Temperature > 5°C: +5 points
    
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
            "explanation": "Pas de données pour les heures volables"
        }
    
    # Calculate averages
    avg_wind = statistics.mean([h["wind_speed"] for h in consensus_hours if h.get("wind_speed")])
    max_gust = max([h["wind_gust"] for h in consensus_hours if h.get("wind_gust")], default=0)
    total_rain = sum([h["precipitation"] for h in consensus_hours if h.get("precipitation")] or [0])
    avg_temp = statistics.mean([h["temperature"] for h in consensus_hours if h.get("temperature")])
    avg_li = statistics.mean([h["lifted_index"] for h in consensus_hours if h.get("lifted_index")] or [0])
    
    # Start scoring
    score = 0
    reasons = []
    
    # === WIND SCORING (most important) ===
    if avg_wind < 3:
        score -= 40
        reasons.append(f"Vent beaucoup trop insuffisant ({avg_wind:.1f} km/h < 3)")
    elif avg_wind < 5:
        score -= 20
        reasons.append(f"Vent insuffisant ({avg_wind:.1f} km/h < 5)")
    elif avg_wind < 8:
        score += 10
        reasons.append(f"Vent faible ({avg_wind:.1f} km/h)")
    elif avg_wind <= 15:  # OPTIMAL RANGE
        score += 40
        reasons.append(f"Vent optimal pour thermiques ({avg_wind:.1f} km/h)")
    elif avg_wind <= 20:
        score += 10
        reasons.append(f"Vent élevé ({avg_wind:.1f} km/h)")
    else:  # > 20 km/h
        score -= 50
        reasons.append(f"Vent trop fort - DANGEREUX ({avg_wind:.1f} km/h > 20)")
    
    # === GUST SCORING ===
    if max_gust < 15:
        score += 30
    elif max_gust < 20:
        score += 20
    elif max_gust < 25:
        score += 10
    else:  # >= 25 km/h
        score -= 50
        reasons.append(f"Rafales dangereuses ({max_gust:.1f} km/h > 25)")
    
    # === RAIN SCORING ===
    if total_rain == 0:
        score += 20
    elif total_rain < 1:
        score += 10
    elif total_rain > 2:
        reasons.append(f"Pluie importante ({total_rain:.1f}mm)")
    
    # === STABILITY SCORING (Lifted Index) ===
    if avg_li > -1:
        score += 20
        # Stable conditions
    elif avg_li > -3:
        score += 10
        # Moderately stable
    elif avg_li < -5:
        reasons.append(f"Thermiques très forts (LI {avg_li:.1f} - instable)")
    
    # === TEMPERATURE SCORING ===
    if avg_temp > 10:
        score += 10
    elif avg_temp > 5:
        score += 5
    
    # Clamp score to 0-100
    para_index = max(0, min(100, score))
    
    # === VERDICT ===
    if para_index >= 65:
        verdict = "BON"
        emoji = "🟢"
        if not reasons or all("optimal" in r.lower() for r in reasons):
            reasons = ["Vent modéré, conditions favorables"]
    elif para_index >= 45:
        verdict = "MOYEN"
        emoji = "🟡"
    elif para_index >= 30:
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
            "avg_lifted_index": round(avg_li, 1)
        }
    }


def analyze_hourly_slots(consensus_hours: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Analyze each hour and group into flyable/non-flyable slots
    
    Args:
        consensus_hours: Consensus hourly forecasts
    
    Returns:
        List of time slots with verdicts
    """
    if not consensus_hours:
        return []
    
    # Analyze each hour
    hourly_verdicts = []
    
    for hour in consensus_hours:
        wind = hour.get("wind_speed") or 0
        gust = hour.get("wind_gust") or 0
        precip = hour.get("precipitation") or 0
        li = hour.get("lifted_index") or 0
        
        verdict = "🟢"
        reasons = []
        
        # Wind checks
        if wind < 5:
            verdict = "🔴"
            reasons.append("Vent insuffisant")
        elif wind < 8:
            verdict = "🟡"
            reasons.append("Vent faible")
        elif wind > 20:
            verdict = "🔴"
            reasons.append("Vent trop fort")
        elif wind > 15:
            verdict = "🟡"
            reasons.append("Vent élevé")
        # 8-15: stays 🟢 (optimal)
        
        # Gust checks
        if gust > 25:
            verdict = "🔴" if verdict == "🟡" else verdict
            reasons.append("Rafales")
        
        # Rain checks
        if precip > 0.5:
            verdict = "🟡" if verdict == "🟢" else verdict
            reasons.append("Pluie")
        
        # Instability checks
        if li < -5:
            verdict = "🔴"
            reasons.append("Instabilité")
        
        hourly_verdicts.append({
            "hour": hour["hour"],
            "verdict": verdict,
            "reasons": reasons
        })
    
    # Group consecutive hours with same verdict
    slots = []
    if hourly_verdicts:
        current_slot = hourly_verdicts[0].copy()
        
        for i in range(1, len(hourly_verdicts)):
            current = hourly_verdicts[i]
            reasons_match = current_slot["reasons"] == current["reasons"]
            
            if current["verdict"] != current_slot["verdict"] or not reasons_match:
                # Save current slot
                slots.append({
                    "start_hour": current_slot["hour"],
                    "end_hour": hourly_verdicts[i - 1]["hour"],
                    "verdict": current_slot["verdict"],
                    "reasons": current_slot["reasons"]
                })
                current_slot = current.copy()
        
        # Add last slot
        slots.append({
            "start_hour": current_slot["hour"],
            "end_hour": hourly_verdicts[-1]["hour"],
            "verdict": current_slot["verdict"],
            "reasons": current_slot["reasons"]
        })
    
    return slots


def get_best_slot(slots: List[Dict[str, Any]]) -> Dict[str, Any]:
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
    best = max(
        flyable_slots,
        key=lambda s: s["end_hour"] - s["start_hour"]
    )
    
    return best


def format_slots_summary(slots: List[Dict[str, Any]]) -> str:
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


def calculate_hourly_para_index(hour: Dict[str, Any]) -> int:
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
    
    score = 0
    
    # === WIND SCORING (most important) ===
    if wind < 3:
        score -= 40
    elif wind < 5:
        score -= 20
    elif wind < 8:
        score += 10
    elif wind <= 15:  # OPTIMAL RANGE
        score += 40
    elif wind <= 20:
        score += 10
    else:  # > 20 km/h
        score -= 50
    
    # === GUST SCORING ===
    if gust < 15:
        score += 30
    elif gust < 20:
        score += 20
    elif gust < 25:
        score += 10
    else:  # >= 25 km/h
        score -= 50
    
    # === RAIN SCORING ===
    if precip == 0:
        score += 20
    elif precip < 1:
        score += 10
    elif precip > 2:
        score -= 10
    
    # === STABILITY SCORING (Lifted Index) ===
    if li > -1:
        score += 20
    elif li > -3:
        score += 10
    elif li < -5:
        score -= 10  # Too unstable
    
    # === TEMPERATURE SCORING ===
    if temp > 10:
        score += 10
    elif temp > 5:
        score += 5
    
    # Clamp score to 0-100
    return max(0, min(100, score))


def get_hourly_verdict(para_index: int) -> str:
    """
    Get verdict label from para-index score
    
    Args:
        para_index: Score 0-100
    
    Returns:
        "BON", "MOYEN", "LIMITE", or "MAUVAIS"
    """
    if para_index >= 65:
        return "BON"
    elif para_index >= 45:
        return "MOYEN"
    elif para_index >= 30:
        return "LIMITE"
    else:
        return "MAUVAIS"
