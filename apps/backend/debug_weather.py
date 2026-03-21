#!/usr/bin/env python3
"""
Debug script to understand why weather data returns None
Run with: python debug_weather.py
"""

import asyncio
import os

# Set environment
os.environ["ENVIRONMENT"] = "development"
os.environ["USE_FAKE_REDIS"] = "true"


async def debug_weather():
    from database import SessionLocal
    from models import Site
    from weather_pipeline import get_daily_aggregate, get_normalized_forecast

    db = SessionLocal()

    try:
        # Get Arguel site
        site = db.query(Site).filter(Site.id == "site-arguel").first()
        if not site:
            print("❌ Site not found!")
            return

        print(f"🏔️  Testing site: {site.name}")
        print(f"📍 Coordinates: {site.latitude}, {site.longitude}")
        print(f"📏 Elevation: {site.elevation_m}m")
        print()

        # Test get_normalized_forecast
        print("=" * 60)
        print("TEST 1: get_normalized_forecast(day_index=0)")
        print("=" * 60)

        result = await get_normalized_forecast(
            lat=site.latitude,
            lon=site.longitude,
            day_index=0,
            site_name=site.name,
            elevation_m=site.elevation_m,
        )

        print(f"✅ Success: {result.get('success')}")
        print(f"❌ Error: {result.get('error')}")
        print(f"📊 Consensus hours: {len(result.get('consensus', []))}")
        print(f"🌐 Sources: {list(result.get('sources', {}).keys())}")

        if result.get("sources"):
            print("\nSource details:")
            for source_name, source_data in result.get("sources", {}).items():
                if isinstance(source_data, dict):
                    success = source_data.get("success", False)
                    error = source_data.get("error", "None")
                    hourly = len(source_data.get("hourly", []))
                    print(
                        f"  - {source_name:20} Success: {success:5}  Hours: {hourly:3}  Error: {error[:50]}"
                    )

        print()
        print("=" * 60)
        print("TEST 2: get_daily_aggregate(day_index=0)")
        print("=" * 60)

        daily = await get_daily_aggregate(
            lat=site.latitude,
            lon=site.longitude,
            day_index=0,
            min_wind=2.8,
            max_wind=8.3,
            optimal_directions="N,NE,E,SE,S,SW,W,NW",
            site_name=site.name,
            elevation_m=site.elevation_m,
        )

        if daily:
            print("✅ SUCCESS! Got daily data:")
            print(f"   Date: {daily['date']}")
            print(f"   Para-Index: {daily['para_index']}")
            print(f"   Verdict: {daily['verdict']}")
            print(f"   Temp: {daily['temp_min']}°C - {daily['temp_max']}°C")
            print(f"   Wind: {daily['wind_avg']} km/h")
        else:
            print("❌ FAILED! get_daily_aggregate returned None")
            print("\nDebugging why it returned None...")

            # Check each condition that causes None
            if not result.get("success"):
                print("   ⚠️  forecast_result.get('success') is False")

            consensus = result.get("consensus", [])
            if not consensus:
                print("   ⚠️  consensus is empty")
            else:
                print(f"   ✅ consensus has {len(consensus)} hours")

            # Check flyable hours filtering
            sunrise = result.get("sunrise")
            sunset = result.get("sunset")
            print(f"   🌅 Sunrise: {sunrise}, Sunset: {sunset}")

            if sunrise and sunset and consensus:
                try:
                    sunrise_hour = int(sunrise.split(":")[0])
                    sunset_hour = int(sunset.split(":")[0])
                    flyable = [
                        h for h in consensus if sunrise_hour <= h.get("hour", 0) <= sunset_hour
                    ]
                    print(
                        f"   ✅ Flyable hours ({sunrise_hour}h-{sunset_hour}h): {len(flyable)} hours"
                    )

                    if not flyable:
                        print("   ⚠️  No flyable hours!")
                    else:
                        # Check temps and winds
                        temps = [
                            h.get("temperature")
                            for h in flyable
                            if h.get("temperature") is not None
                        ]
                        winds = [
                            h.get("wind_speed") for h in flyable if h.get("wind_speed") is not None
                        ]
                        print(f"   📊 Temps: {len(temps)} values")
                        print(f"   💨 Winds: {len(winds)} values")

                        if not temps:
                            print("   ⚠️  No temperature data!")
                        if not winds:
                            print("   ⚠️  No wind data!")

                        # Show sample hour
                        if flyable:
                            sample = flyable[0]
                            print("\n   Sample hour data:")
                            for key, value in sample.items():
                                print(f"     {key}: {value}")

                except Exception as e:
                    print(f"   ⚠️  Error parsing sunrise/sunset: {e}")

    except Exception as e:
        print(f"❌ Exception: {e}")
        import traceback

        traceback.print_exc()
    finally:
        db.close()


if __name__ == "__main__":
    asyncio.run(debug_weather())
