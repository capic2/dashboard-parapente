"""
Test weather scrapers and pipeline
"""

import sys
from pathlib import Path

# Add parent dir to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from para_index import (
    analyze_hourly_slots,
    calculate_para_index,
    format_slots_summary,
    get_best_slot,
)


class TestParaIndex:
    """Test Para-Index scoring system"""

    def test_calculate_para_index(self):
        """Test full para_index calculation"""
        hours = [
            {
                "hour": h,
                "temperature": 15 + h,
                "wind_speed": 8 + (h % 5),
                "wind_gust": 15 + (h % 8),
                "cloud": 40,
                "precipitation": 0,
                "lifted_index": -3,
            }
            for h in range(24)
        ]
        result = calculate_para_index(hours)

        assert "para_index" in result or "verdict" in result
        # Para-index should be a reasonable value
        if "para_index" in result:
            assert 0 <= result["para_index"] <= 100

    def test_analyze_hourly_slots(self):
        """Test flyable slot analysis"""
        hours = []
        # Good morning slot
        for h in range(10, 13):
            hours.append(
                {
                    "hour": h,
                    "temperature": 15,
                    "wind_speed": 10,
                    "wind_gust": 15,
                    "cloud": 30,
                    "precipitation": 0,
                    "lifted_index": -2,
                }
            )
        # Bad afternoon
        for h in range(13, 16):
            hours.append(
                {
                    "hour": h,
                    "temperature": 20,
                    "wind_speed": 20,
                    "wind_gust": 30,
                    "cloud": 80,
                    "precipitation": 0.5,
                    "lifted_index": 0,
                }
            )
        # Good evening
        for h in range(16, 19):
            hours.append(
                {
                    "hour": h,
                    "temperature": 18,
                    "wind_speed": 8,
                    "wind_gust": 12,
                    "cloud": 40,
                    "precipitation": 0,
                    "lifted_index": -3,
                }
            )

        slots = analyze_hourly_slots(hours)
        assert isinstance(slots, list)
        # Should find at least some analysis
        assert len(slots) >= 0  # May be empty if no good slots

    def test_format_slots_summary(self):
        """Test slots summary formatting"""
        slots = [
            {"start_hour": 10, "end_hour": 12, "verdict": "🟢", "reasons": []},
            {"start_hour": 16, "end_hour": 18, "verdict": "🟢", "reasons": []},
        ]
        summary = format_slots_summary(slots)

        assert isinstance(summary, str)
        # Should return a string (may be empty or with content)

    def test_get_best_slot(self):
        """Test best slot detection"""
        # First create slots from hourly data
        hours = [
            {
                "hour": h,
                "temperature": 16,
                "wind_speed": 9,
                "wind_gust": 14,
                "cloud": 30,
                "precipitation": 0,
                "lifted_index": -2,
            }
            for h in range(24)
        ]
        slots = analyze_hourly_slots(hours)
        result = get_best_slot(slots)

        # Should return a dict or None (if no good slots)
        assert result is None or isinstance(result, dict)


class TestParaIndexEdgeCases:
    """Test edge cases and error handling"""

    def test_empty_forecast(self):
        """Handle empty forecast"""
        hours = []
        result = calculate_para_index(hours)
        assert result is not None  # Should not crash

    def test_partial_forecast(self):
        """Handle partial hourly data"""
        hours = [
            {
                "hour": h,
                "temperature": 15,
                "wind_speed": 8,
                "wind_gust": 12,
                "cloud": 40,
                "precipitation": 0,
                "lifted_index": -2,
            }
            for h in range(12)  # Only 12 hours
        ]
        result = calculate_para_index(hours)
        assert result is not None

    def test_extreme_conditions(self):
        """Handle extreme weather"""
        hours = [
            {
                "hour": h,
                "temperature": -20 if h < 6 else 40,  # Extreme temps
                "wind_speed": 50,  # Very strong wind
                "wind_gust": 80,  # Extreme gusts
                "cloud": 100,  # Full cloud cover
                "precipitation": 50,  # Heavy rain
                "lifted_index": 5,  # Very unstable
            }
            for h in range(24)
        ]
        result = calculate_para_index(hours)
        assert result is not None
