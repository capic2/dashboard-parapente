"""Test meteociel integration with the weather pipeline"""
import asyncio
import logging

logging.basicConfig(level=logging.INFO, format='%(levelname)s - %(name)s - %(message)s')

async def main():
    print("=" * 70)
    print("🧪 Testing Meteociel Pipeline Integration")
    print("=" * 70)
    print()
    
    from weather_pipeline import get_normalized_forecast
    
    # Test data - Arguel site
    lat, lon = 47.012, 6.789
    site_name = "Arguel"
    elevation_m = 427
    
    print(f"Testing for site: {site_name}")
    print(f"Coordinates: {lat}, {lon}")
    print(f"Elevation: {elevation_m}m")
    print()
    
    # Test 1: Get normalized forecast with all default sources (should include meteociel now)
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
            
            # Show consensus data
            consensus = forecast.get('consensus', [])
            if consensus:
                print(f"  Consensus forecasts: {len(consensus)}")
                
                # Check if meteociel contributed
                first_hour = consensus[0] if consensus else {}
                sources_data = first_hour.get('sources', {})
                
                print()
                print("  Sources contributing:")
                for source_name in ['open-meteo', 'weatherapi', 'meteo-parapente', 'meteociel']:
                    if source_name in sources_data:
                        source_info = sources_data[source_name]
                        has_data = any([
                            source_info.get('wind_speed') is not None,
                            source_info.get('temperature') is not None
                        ])
                        status = "✓" if has_data else "○"
                        print(f"    {status} {source_name}")
                        
                        if source_name == 'meteociel' and has_data:
                            print(f"        Wind: {source_info.get('wind_speed')} m/s")
                            print(f"        Temp: {source_info.get('temperature')} °C")
                            print(f"        Gust: {source_info.get('wind_gust')} m/s")
                
                # Show sample forecast
                print()
                print("  Sample forecast (first 3 hours):")
                for hour_data in consensus[:3]:
                    hour = hour_data.get('hour', 'N/A')
                    wind_speed = hour_data.get('wind_speed')
                    temp = hour_data.get('temperature')
                    
                    wind_str = f"{wind_speed:.1f} m/s" if wind_speed else "N/A"
                    temp_str = f"{temp:.1f}°C" if temp else "N/A"
                    
                    print(f"    {hour:02d}:00 - Wind: {wind_str} - Temp: {temp_str}")
            else:
                print("  ✗ No consensus forecasts")
        else:
            print("✗ No forecast received")
    
    except Exception as e:
        print(f"✗ Test failed with exception: {e}")
        import traceback
        traceback.print_exc()
    
    print()
    
    # Test 2: Get forecast with only meteociel
    print("-" * 70)
    print("TEST 2: Get forecast (only meteociel)")
    print("-" * 70)
    
    try:
        forecast = await get_normalized_forecast(
            lat=lat,
            lon=lon,
            day_index=0,
            sources=["meteociel"],
            site_name=site_name,
            elevation_m=elevation_m
        )
        
        if forecast:
            print(f"✓ Forecast received!")
            consensus = forecast.get('consensus', [])
            print(f"  Consensus forecasts: {len(consensus)}")
            
            if consensus:
                print()
                print("  Sample forecast (first 5 hours):")
                for hour_data in consensus[:5]:
                    hour = hour_data.get('hour', 'N/A')
                    wind_speed = hour_data.get('wind_speed')
                    wind_gust = hour_data.get('wind_gust')
                    temp = hour_data.get('temperature')
                    
                    wind_str = f"{wind_speed:.1f} m/s" if wind_speed else "N/A"
                    gust_str = f" (gust: {wind_gust:.1f})" if wind_gust else ""
                    temp_str = f"{temp:.1f}°C" if temp else "N/A"
                    
                    print(f"    {hour:02d}:00 - {temp_str} - Wind: {wind_str}{gust_str}")
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

asyncio.run(main())
