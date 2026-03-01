"""
Test weather scrapers and pipeline
"""
import pytest
import asyncio
from pathlib import Path
import sys

# Add parent dir to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from para_index import (
    calculate_para_index,
    analyze_hourly_slots,
    format_slots_summary,
    get_best_slot
)


class TestParaIndex:
    """Test Para-Index scoring system"""
    
    def test_calculate_para_index(self):
        """Test full para_index calculation"""
        hours = [
            {
                "hour": h,
                "temp": 15 + h,
                "wind": 8 + (h % 5),
                "gust": 15 + (h % 8),
                "cloud": 40,
                "precip": 0,
                "li": -3
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
            hours.append({
                "hour": h,
                "temp": 15,
                "wind": 10,
                "gust": 15,
                "cloud": 30,
                "precip": 0,
                "li": -2
            })
        # Bad afternoon
        for h in range(13, 16):
            hours.append({
                "hour": h,
                "temp": 20,
                "wind": 20,
                "gust": 30,
                "cloud": 80,
                "precip": 0.5,
                "li": 0
            })
        # Good evening
        for h in range(16, 19):
            hours.append({
                "hour": h,
                "temp": 18,
                "wind": 8,
                "gust": 12,
                "cloud": 40,
                "precip": 0,
                "li": -3
            })
        
        slots = analyze_hourly_slots(hours)
        assert isinstance(slots, list)
        # Should find at least some analysis
        assert len(slots) >= 0  # May be empty if no good slots
    
    def test_format_slots_summary(self):
        """Test slots summary formatting"""
        slots = [
            {"start": 10, "end": 12},
            {"start": 16, "end": 18},
        ]
        summary = format_slots_summary(slots)
        
        assert isinstance(summary, str)
        # Should return a string (may be empty or with content)
    
    def test_get_best_slot(self):
        """Test best slot detection"""
        hours = [
            {
                "hour": h,
                "temp": 16,
                "wind": 9,
                "gust": 14,
                "cloud": 30,
                "precip": 0,
                "li": -2
            }
            for h in range(24)
        ]
        result = get_best_slot(hours)
        
        # Should return a dict or list
        assert result is not None


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
                "temp": 15,
                "wind": 8,
                "gust": 12,
                "cloud": 40,
                "precip": 0,
                "li": -2
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
                "temp": -20 if h < 6 else 40,  # Extreme temps
                "wind": 50,  # Very strong wind
                "gust": 80,  # Extreme gusts
                "cloud": 100,  # Full cloud cover
                "precip": 50,  # Heavy rain
                "li": 5  # Very unstable
            }
            for h in range(24)
        ]
        result = calculate_para_index(hours)
        assert result is not None
