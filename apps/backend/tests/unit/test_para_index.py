"""
Unit tests for para_index.py - Para-Index algorithm (0-100 scoring)

Tests the core logic for calculating flyability scores based on:
- Wind speed and gusts
- Rain/precipitation
- Stability (Lifted Index)
- Temperature
- Time slot grouping
"""

import pytest
from para_index import (
    calculate_para_index,
    analyze_hourly_slots,
    get_best_slot,
    get_thermal_strength,
    calculate_hourly_para_index,
    get_hourly_verdict,
    format_slots_summary
)


@pytest.mark.unit
class TestCalculateParaIndex:
    """Test main Para-Index calculation function"""
    
    def test_excellent_conditions(self):
        """Optimal conditions: Wind 12 km/h, no rain, stable → score ≥ 70"""
        consensus_hours = [
            {
                "hour": 12,
                "temperature": 18.0,
                "wind_speed": 12.0,  # Optimal range (8-15)
                "wind_gust": 18.0,   # < 20
                "precipitation": 0.0,
                "lifted_index": 0.0,  # Stable
            },
            {
                "hour": 13,
                "temperature": 19.0,
                "wind_speed": 13.0,
                "wind_gust": 19.0,
                "precipitation": 0.0,
                "lifted_index": -0.5,
            }
        ]
        
        result = calculate_para_index(consensus_hours)
        
        assert result["para_index"] >= 70
        assert result["verdict"] == "BON"
        assert result["emoji"] == "🟢"
        # Check for positive indicators (optimal, favorable, etc.)
        assert any(word in result["explanation"].lower() for word in ["optimal", "favorable", "modéré"])
    
    def test_poor_conditions_strong_wind(self):
        """Strong wind > 20 km/h → score < 30"""
        consensus_hours = [
            {
                "hour": 12,
                "temperature": 15.0,
                "wind_speed": 25.0,  # Too strong (DANGEROUS)
                "wind_gust": 35.0,   # Dangerous gusts
                "precipitation": 0.0,
                "lifted_index": 0.0,
            }
        ]
        
        result = calculate_para_index(consensus_hours)
        
        assert result["para_index"] < 30
        assert result["verdict"] in ["MAUVAIS", "LIMITE"]
        assert result["emoji"] in ["🔴", "🟠"]
        assert "dangereux" in result["explanation"].lower() or "fort" in result["explanation"].lower()
    
    def test_poor_conditions_no_wind(self):
        """Wind < 3 km/h → score low (insufficient for thermals)"""
        consensus_hours = [
            {
                "hour": 12,
                "temperature": 20.0,
                "wind_speed": 2.0,   # Too weak
                "wind_gust": 4.0,
                "precipitation": 0.0,
                "lifted_index": -2.0,
            }
        ]
        
        result = calculate_para_index(consensus_hours)
        
        assert result["para_index"] < 50
        assert result["verdict"] in ["MAUVAIS", "LIMITE", "MOYEN"]
        assert "insuffisant" in result["explanation"].lower()
    
    def test_dangerous_gusts(self):
        """Gusts > 25 km/h → score reduced (dangerous)"""
        consensus_hours = [
            {
                "hour": 12,
                "temperature": 15.0,
                "wind_speed": 10.0,  # OK
                "wind_gust": 30.0,   # DANGEROUS!
                "precipitation": 0.0,
                "lifted_index": 0.0,
            }
        ]
        
        result = calculate_para_index(consensus_hours)
        
        # Dangerous gusts should penalize score significantly
        assert result["para_index"] <= 50
        assert "rafales" in result["explanation"].lower() or "dangereux" in result["explanation"].lower()
    
    def test_rain_penalty(self):
        """Rain > 2mm → lower score"""
        consensus_hours_rain = [
            {
                "hour": 12,
                "temperature": 15.0,
                "wind_speed": 12.0,
                "wind_gust": 18.0,
                "precipitation": 3.0,  # Significant rain
                "lifted_index": 0.0,
            }
        ]
        
        consensus_hours_no_rain = [
            {
                "hour": 12,
                "temperature": 15.0,
                "wind_speed": 12.0,
                "wind_gust": 18.0,
                "precipitation": 0.0,
                "lifted_index": 0.0,
            }
        ]
        
        result_rain = calculate_para_index(consensus_hours_rain)
        result_no_rain = calculate_para_index(consensus_hours_no_rain)
        
        assert result_no_rain["para_index"] > result_rain["para_index"]
        assert "pluie" in result_rain["explanation"].lower()
    
    def test_empty_consensus_hours(self):
        """No data → special verdict"""
        result = calculate_para_index([])
        
        assert result["para_index"] == 0
        assert result["verdict"] == "DONNÉES INSUFFISANTES"
        assert result["emoji"] == "❌"
    
    def test_medium_conditions(self):
        """Borderline conditions → not excellent"""
        consensus_hours = [
            {
                "hour": 12,
                "temperature": 12.0,
                "wind_speed": 7.0,   # Low but acceptable
                "wind_gust": 12.0,
                "precipitation": 0.0,
                "lifted_index": 1.0,
            }
        ]
        
        result = calculate_para_index(consensus_hours)
        
        # Should be reasonable but not perfect
        assert result["para_index"] >= 30
        assert result["verdict"] in ["BON", "MOYEN", "LIMITE"]
        assert result["emoji"] in ["🟢", "🟡", "🟠"]
    
    def test_temperature_bonus(self):
        """Temperature > 10°C → score bonus"""
        consensus_warm = [
            {
                "hour": 12,
                "temperature": 20.0,  # Warm
                "wind_speed": 12.0,
                "wind_gust": 18.0,
                "precipitation": 0.0,
                "lifted_index": 0.0,
            }
        ]
        
        consensus_cold = [
            {
                "hour": 12,
                "temperature": 2.0,   # Cold
                "wind_speed": 12.0,
                "wind_gust": 18.0,
                "precipitation": 0.0,
                "lifted_index": 0.0,
            }
        ]
        
        result_warm = calculate_para_index(consensus_warm)
        result_cold = calculate_para_index(consensus_cold)
        
        # Warm should have higher score
        assert result_warm["para_index"] >= result_cold["para_index"]
    
    def test_metrics_included(self):
        """Result includes detailed metrics"""
        consensus_hours = [
            {
                "hour": 12,
                "temperature": 18.0,
                "wind_speed": 12.0,
                "wind_gust": 18.0,
                "precipitation": 0.0,
                "lifted_index": -1.0,
            }
        ]
        
        result = calculate_para_index(consensus_hours)
        
        assert "metrics" in result
        assert "avg_wind_kmh" in result["metrics"]
        assert "max_gust_kmh" in result["metrics"]
        assert "total_rain_mm" in result["metrics"]
        assert "avg_temp_c" in result["metrics"]
        assert "avg_lifted_index" in result["metrics"]


@pytest.mark.unit
class TestAnalyzeHourlySlots:
    """Test hourly slot grouping logic"""
    
    def test_single_green_slot(self):
        """All hours optimal → single green slot"""
        consensus_hours = [
            {"hour": 12, "wind_speed": 12.0, "wind_gust": 18.0, "precipitation": 0.0, "lifted_index": 0.0},
            {"hour": 13, "wind_speed": 13.0, "wind_gust": 19.0, "precipitation": 0.0, "lifted_index": 0.0},
            {"hour": 14, "wind_speed": 14.0, "wind_gust": 20.0, "precipitation": 0.0, "lifted_index": 0.0},
        ]
        
        slots = analyze_hourly_slots(consensus_hours)
        
        assert len(slots) >= 1
        # First slot should be green (optimal conditions)
        green_slots = [s for s in slots if s["verdict"] == "🟢"]
        assert len(green_slots) >= 1
        
        # Check slot structure
        first_slot = slots[0]
        assert "start_hour" in first_slot
        assert "end_hour" in first_slot
        assert "verdict" in first_slot
        assert "reasons" in first_slot
    
    def test_multiple_slots(self):
        """Mixed conditions → multiple slots"""
        consensus_hours = [
            {"hour": 10, "wind_speed": 3.0, "wind_gust": 8.0, "precipitation": 0.0, "lifted_index": 0.0},  # Too weak
            {"hour": 11, "wind_speed": 7.0, "wind_gust": 12.0, "precipitation": 0.0, "lifted_index": 0.0},  # Weak
            {"hour": 12, "wind_speed": 12.0, "wind_gust": 18.0, "precipitation": 0.0, "lifted_index": 0.0},  # Optimal
            {"hour": 13, "wind_speed": 22.0, "wind_gust": 30.0, "precipitation": 0.0, "lifted_index": 0.0},  # Too strong
        ]
        
        slots = analyze_hourly_slots(consensus_hours)
        
        # Should have multiple slots with different verdicts
        assert len(slots) > 1
        verdicts = [s["verdict"] for s in slots]
        assert len(set(verdicts)) > 1  # At least 2 different verdicts
    
    def test_no_flyable_hours(self):
        """All hours bad → all red slots"""
        consensus_hours = [
            {"hour": 12, "wind_speed": 25.0, "wind_gust": 35.0, "precipitation": 0.0, "lifted_index": 0.0},
            {"hour": 13, "wind_speed": 26.0, "wind_gust": 36.0, "precipitation": 0.0, "lifted_index": 0.0},
        ]
        
        slots = analyze_hourly_slots(consensus_hours)
        
        assert len(slots) >= 1
        # All should be red
        for slot in slots:
            assert slot["verdict"] == "🔴"
    
    def test_empty_hours(self):
        """Empty input → empty slots"""
        slots = analyze_hourly_slots([])
        assert slots == []


@pytest.mark.unit
class TestGetBestSlot:
    """Test best slot selection"""
    
    def test_select_longest_green_slot(self):
        """Select longest green period"""
        slots = [
            {"start_hour": 10, "end_hour": 11, "verdict": "🟢", "reasons": []},
            {"start_hour": 12, "end_hour": 15, "verdict": "🟢", "reasons": []},  # Longest green
            {"start_hour": 16, "end_hour": 16, "verdict": "🟡", "reasons": []},
        ]
        
        best = get_best_slot(slots)
        
        assert best is not None
        assert best["start_hour"] == 12
        assert best["end_hour"] == 15
    
    def test_no_green_slots(self):
        """No green slots → None or yellow"""
        slots = [
            {"start_hour": 10, "end_hour": 11, "verdict": "🔴", "reasons": []},
            {"start_hour": 12, "end_hour": 13, "verdict": "🟡", "reasons": []},
        ]
        
        best = get_best_slot(slots)
        
        # Should return None or yellow slot (depends on implementation)
        if best is not None:
            assert best["verdict"] in ["🟡", "🔴"]
    
    def test_empty_slots(self):
        """Empty slots → None"""
        best = get_best_slot([])
        assert best is None


@pytest.mark.unit
class TestGetThermalStrength:
    """Test thermal strength classification"""
    
    def test_strong_thermals(self):
        """CAPE > 1000 → Fort"""
        result = get_thermal_strength(cape=1200, lifted_index=-4)
        assert "fort" in result.lower()
    
    def test_moderate_thermals(self):
        """CAPE 200-500, LI -1 to -3 → Moyen"""
        result = get_thermal_strength(cape=350, lifted_index=-2)
        assert "moyen" in result.lower() or "modér" in result.lower()
    
    def test_weak_thermals(self):
        """CAPE < 200, LI > -1 → Faible"""
        result = get_thermal_strength(cape=100, lifted_index=0)
        assert "faible" in result.lower() or "absent" in result.lower()
    
    def test_none_values(self):
        """Handle None values gracefully"""
        result = get_thermal_strength(cape=None, lifted_index=None)
        assert result is not None
        assert isinstance(result, str)


@pytest.mark.unit
class TestCalculateHourlyParaIndex:
    """Test hourly scoring function"""
    
    def test_optimal_hour(self):
        """Optimal conditions → high score"""
        hour = {
            "wind_speed": 12.0,
            "wind_gust": 18.0,
            "precipitation": 0.0,
            "lifted_index": -1.0,
            "temperature": 18.0
        }
        
        score = calculate_hourly_para_index(hour)
        
        assert score >= 70
        assert 0 <= score <= 100
    
    def test_poor_hour(self):
        """Poor conditions → low score"""
        hour = {
            "wind_speed": 25.0,
            "wind_gust": 35.0,
            "precipitation": 5.0,
            "lifted_index": 0.0,
            "temperature": 8.0
        }
        
        score = calculate_hourly_para_index(hour)
        
        assert score < 40
        assert score >= 0


@pytest.mark.unit
class TestGetHourlyVerdict:
    """Test verdict from score"""
    
    def test_bon_verdict(self):
        """Score ≥ 65 → BON"""
        verdict = get_hourly_verdict(75)
        assert verdict == "BON"
    
    def test_moyen_verdict(self):
        """Score 45-64 → MOYEN"""
        verdict = get_hourly_verdict(55)
        assert verdict == "MOYEN"
    
    def test_limite_verdict(self):
        """Score 30-44 → LIMITE"""
        verdict = get_hourly_verdict(35)
        assert verdict == "LIMITE"
    
    def test_mauvais_verdict(self):
        """Score < 30 → MAUVAIS"""
        verdict = get_hourly_verdict(20)
        assert verdict == "MAUVAIS"
    
    def test_boundary_values(self):
        """Test exact boundary values"""
        assert get_hourly_verdict(65) == "BON"
        assert get_hourly_verdict(64) == "MOYEN"
        assert get_hourly_verdict(45) == "MOYEN"
        assert get_hourly_verdict(44) == "LIMITE"
        assert get_hourly_verdict(30) == "LIMITE"
        assert get_hourly_verdict(29) == "MAUVAIS"


@pytest.mark.unit
class TestFormatSlotsSummary:
    """Test slot summary formatting"""
    
    def test_format_single_slot(self):
        """Format single time slot"""
        slots = [
            {"start_hour": 12, "end_hour": 14, "verdict": "🟢", "reasons": []}
        ]
        
        summary = format_slots_summary(slots)
        
        assert summary is not None
        assert isinstance(summary, str)
        assert "12" in summary or "14" in summary
    
    def test_format_multiple_slots(self):
        """Format multiple slots"""
        slots = [
            {"start_hour": 10, "end_hour": 12, "verdict": "🟢", "reasons": []},
            {"start_hour": 13, "end_hour": 15, "verdict": "🟡", "reasons": ["Vent faible"]},
        ]
        
        summary = format_slots_summary(slots)
        
        assert summary is not None
        assert len(summary) > 0
    
    def test_empty_slots(self):
        """Empty slots → appropriate message"""
        summary = format_slots_summary([])
        assert summary is not None
        assert isinstance(summary, str)


@pytest.mark.unit
class TestEdgeCases:
    """Test edge cases and error handling"""
    
    def test_partial_wind_data(self):
        """Partial wind data → use available data"""
        consensus_hours = [
            {
                "hour": 12,
                "temperature": 15.0,
                "wind_speed": 10.0,  # Has wind
                "wind_gust": 15.0,
                "precipitation": 0.0,
                "lifted_index": 0.0,
            },
            {
                "hour": 13,
                "temperature": 16.0,
                "wind_speed": 12.0,
                "wind_gust": 18.0,
                "precipitation": 0.0,
                "lifted_index": 0.0,
            }
        ]
        
        # Should work fine with valid data
        result = calculate_para_index(consensus_hours)
        assert result is not None
        assert "para_index" in result
        assert result["para_index"] > 0
    
    def test_extreme_values(self):
        """Extreme but valid values"""
        consensus_hours = [
            {
                "hour": 12,
                "temperature": 40.0,  # Very hot
                "wind_speed": 50.0,   # Hurricane force
                "wind_gust": 80.0,
                "precipitation": 100.0,  # Heavy rain
                "lifted_index": -10.0,   # Very unstable
            }
        ]
        
        result = calculate_para_index(consensus_hours)
        
        # Score should be clamped to 0-100
        assert 0 <= result["para_index"] <= 100
        assert result["verdict"] == "MAUVAIS"
    
    def test_score_clamping(self):
        """Para-index always 0-100"""
        # Perfect conditions (should not exceed 100)
        perfect = [
            {
                "hour": h,
                "temperature": 25.0,
                "wind_speed": 12.0,
                "wind_gust": 15.0,
                "precipitation": 0.0,
                "lifted_index": -2.0,
            }
            for h in range(10, 18)
        ]
        
        result = calculate_para_index(perfect)
        assert 0 <= result["para_index"] <= 100
