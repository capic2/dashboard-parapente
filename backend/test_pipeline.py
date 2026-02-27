#!/usr/bin/env python3
"""
Quick test script for pipeline and para_index
"""

import asyncio
from weather_pipeline import get_normalized_forecast
from para_index import calculate_para_index, analyze_hourly_slots, format_slots_summary

# Test site: Arguel
ARGUEL_LAT = 46.98897
ARGUEL_LON = 5.82095


async def test_pipeline():
    print("🧪 Testing pipeline for Arguel (today)...\n")
    
    # Fetch normalized forecast
    result = await get_normalized_forecast(ARGUEL_LAT, ARGUEL_LON, day_index=0)
    
    if not result.get("success"):
        print(f"❌ Failed: {result.get('error')}")
        return
    
    consensus = result.get("consensus", [])
    total_sources = result.get("total_sources", 0)
    
    print(f"✅ Got {len(consensus)} hourly forecasts from {total_sources} sources\n")
    
    # Calculate para_index
    para_result = calculate_para_index(consensus)
    
    print(f"📊 Para-Index: {para_result['para_index']}/100")
    print(f"{para_result['emoji']} Verdict: {para_result['verdict']}")
    print(f"💭 {para_result['explanation']}\n")
    
    print("📈 Metrics:")
    for key, value in para_result['metrics'].items():
        print(f"  - {key}: {value}")
    
    # Analyze slots
    slots = analyze_hourly_slots(consensus)
    slots_summary = format_slots_summary(slots)
    
    print(f"\n🕐 Time Slots:")
    print(slots_summary)
    
    # Show detailed hourly data
    print(f"\n📋 Hourly Details (11h-18h):")
    for hour in consensus:
        print(f"  {hour['hour']}h: Wind {hour['wind_speed']:.1f} km/h, "
              f"Temp {hour['temperature']:.1f}°C, "
              f"Conf {hour['wind_confidence']:.0%}, "
              f"Sources: {hour['num_sources']}")


if __name__ == "__main__":
    asyncio.run(test_pipeline())
