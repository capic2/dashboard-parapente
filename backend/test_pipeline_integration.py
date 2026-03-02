"""Test the complete pipeline integration with meteo-parapente"""
import asyncio
import sys
import logging

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(levelname)s - %(name)s - %(message)s')

async def main():
    print("=" * 70)
    print("🧪 Testing Complete Pipeline Integration")
    print("=" * 70)
    print()
    
    # Import pipeline
    from weather_pipeline import get_normalized_forecast
    
    # Test data - Arguel site
    lat, lon = 47.012, 6.789
    site_name = "Arguel"
    elevation_m = 427
    
    print(f"Testing for site: {site_name}")
    print(f"Coordinates: {lat}, {lon}")
    print(f"Elevation: {elevation_m}m")
    print()
    
    # Test 1: Get normalized forecast with all sources
    print("-" * 70)
    print("TEST 1: Get normalized forecast (all default sources)")
    print("-" * 70)
    
    try:
        forecast = await get_normalized_forecast(
            lat=lat,
            lon=lon,
            day_index=0,
            site_name=site_name,
            elevation_m=elevation_m
        )
        
        if forecast:
            print(f"✓ Forecast received!")
            print(f"  Success: {forecast.get('success', False)}")
            print(f"  Total sources: {forecast.get('total_sources', 0)}")
            print(f"  Sunrise: {forecast.get('sunrise', 'N/A')}")
            print(f"  Sunset: {forecast.get('sunset', 'N/A')}")
            
            # Show sample hourly data
            consensus = forecast.get('consensus', [])
            if consensus:
                print(f"  Hourly forecasts: {len(consensus)}")
                print()
                print("  Sample forecast (first 5 hours):")
                for hour_data in consensus[:5]:
                    hour = hour_data.get('hour', 'N/A')
                    wind_speed = hour_data.get('wind_speed')
                    wind_dir = hour_data.get('wind_direction')
                    temp = hour_data.get('temperature')
                    
                    wind_str = f"{wind_speed:.1f} m/s @ {wind_dir:.0f}°" if wind_speed else "N/A"
                    temp_str = f"{temp:.1f}°C" if temp else "N/A"
                    
                    print(f"    {hour:02d}:00 - Wind: {wind_str} - Temp: {temp_str}")
                
                # Check if meteo-parapente contributed
                print()
                # Check the first hour's sources
                if consensus:
                    first_hour_sources = consensus[0].get('sources', {})
                    if 'meteo-parapente' in first_hour_sources:
                        mp_data = first_hour_sources['meteo-parapente']
                        print(f"  ✓ meteo-parapente contributed!")
                        print(f"    Wind speed: {mp_data.get('wind_speed')} m/s")
                        print(f"    Wind direction: {mp_data.get('wind_direction')}°")
                    else:
                        print("  ✗ meteo-parapente did not contribute")
            else:
                print("  ✗ No consensus forecasts")
        else:
            print("✗ No forecast received")
    
    except Exception as e:
        print(f"✗ Test failed with exception: {e}")
        import traceback
        traceback.print_exc()
    
    print()
    
    # Test 2: Get forecast with only meteo-parapente
    print("-" * 70)
    print("TEST 2: Get forecast (only meteo-parapente)")
    print("-" * 70)
    
    try:
        forecast = await get_normalized_forecast(
            lat=lat,
            lon=lon,
            day_index=0,
            sources=["meteo-parapente"],
            site_name=site_name,
            elevation_m=elevation_m
        )
        
        if forecast:
            print(f"✓ Forecast received!")
            consensus = forecast.get('consensus', [])
            print(f"  Consensus forecasts: {len(consensus)}")
            
            if consensus:
                first_hour_sources = consensus[0].get('sources', {})
                if 'meteo-parapente' in first_hour_sources:
                    mp_data = first_hour_sources['meteo-parapente']
                    print(f"  ✓ meteo-parapente contributed!")
                    print(f"    Wind speed: {mp_data.get('wind_speed')} m/s")
                else:
                    print("  ✗ meteo-parapente not in sources")
        else:
            print("✗ No forecast received")
    
    except Exception as e:
        print(f"✗ Test failed with exception: {e}")
        import traceback
        traceback.print_exc()
    
    print()
    print("=" * 70)
    print("✅ Testing Complete!")
    print("=" * 70)

if __name__ == '__main__':
    asyncio.run(main())
