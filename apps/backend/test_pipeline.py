#!/usr/bin/env python3
"""
Quick test script for pipeline and para_index
"""

import asyncio

from para_index import analyze_hourly_slots, calculate_para_index, format_slots_summary
from weather_pipeline import get_normalized_forecast

# Test site: Arguel
ARGUEL_LAT = 46.98897
ARGUEL_LON = 5.82095


async def test_pipeline():

    # Fetch normalized forecast
    result = await get_normalized_forecast(ARGUEL_LAT, ARGUEL_LON, day_index=0)

    if not result.get("success"):
        return

    consensus = result.get("consensus", [])
    total_sources = result.get("total_sources", 0)

    # Calculate para_index
    para_result = calculate_para_index(consensus)

    for key, value in para_result["metrics"].items():
        pass

    # Analyze slots
    slots = analyze_hourly_slots(consensus)
    slots_summary = format_slots_summary(slots)

    # Show detailed hourly data
    for hour in consensus:
        print(
            f"Temp {hour['temperature']:.1f}°C, "
            f"Conf {hour['wind_confidence']:.0%}, "
            f"Sources: {hour['num_sources']}"
        )


if __name__ == "__main__":
    asyncio.run(test_pipeline())
