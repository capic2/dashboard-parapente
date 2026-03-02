"""Test the updated meteo-parapente scraper with all new features"""
import asyncio
import sys
import logging
from datetime import datetime

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(levelname)s - %(name)s - %(message)s')

async def main():
    print("=" * 70)
    print("🧪 Testing Updated Meteo-Parapente Scraper")
    print("=" * 70)
    print()
    
    # Import scraper
    try:
        from scrapers.meteo_parapente import MeteoParapenteScraper
        print("✓ Successfully imported MeteoParapenteScraper")
    except ImportError as e:
        print(f"✗ Failed to import scraper: {e}")
        return
    
    # Create scraper instance
    scraper = MeteoParapenteScraper()
    print(f"✓ Created scraper instance")
    print()
    
    # Test 1: Fetch with site_name (should use autocomplete)
    print("-" * 70)
    print("TEST 1: Fetch forecast for Arguel (with autocomplete)")
    print("-" * 70)
    
    # Database coordinates for Arguel (approximate)
    db_lat, db_lon = 47.012, 6.789
    
    try:
        result = await scraper.fetch(
            lat=db_lat,
            lon=db_lon,
            site_name="Arguel",
            elevation_m=427
        )
        
        if result["success"]:
            print(f"✓ Fetch successful!")
            print(f"  Source: {result['source']}")
            print(f"  Timestamp: {result['timestamp']}")
            
            # Extract hourly forecast
            forecasts = scraper.extract_hourly_forecast(result, day_index=0)
            
            if forecasts:
                print(f"✓ Extracted {len(forecasts)} hourly forecasts")
                print()
                print("  Sample forecasts (first 5 hours):")
                for forecast in forecasts[:5]:
                    hour = forecast.get('hour', 'N/A')
                    wind_speed = forecast.get('wind_speed', 0)
                    wind_dir = forecast.get('wind_direction', 0)
                    temp = forecast.get('temperature')
                    temp_str = f"{temp:.1f}°C" if temp is not None else "N/A"
                    
                    print(f"    {hour:02d}:00 - Wind: {wind_speed:.1f} m/s @ {wind_dir}° - Temp: {temp_str}")
            else:
                print("✗ No forecasts extracted")
        else:
            print(f"✗ Fetch failed: {result.get('error')}")
    
    except Exception as e:
        print(f"✗ Test failed with exception: {e}")
        import traceback
        traceback.print_exc()
    
    print()
    
    # Test 2: Fetch without site_name (should use provided coordinates)
    print("-" * 70)
    print("TEST 2: Fetch forecast without site_name (direct coordinates)")
    print("-" * 70)
    
    # Precise coordinates from autocomplete
    precise_lat, precise_lon = 47.1982, 6.0018
    
    try:
        result = await scraper.fetch(
            lat=precise_lat,
            lon=precise_lon,
            elevation_m=427
        )
        
        if result["success"]:
            print(f"✓ Fetch successful!")
            forecasts = scraper.extract_hourly_forecast(result, day_index=0)
            print(f"✓ Extracted {len(forecasts)} hourly forecasts")
        else:
            print(f"✗ Fetch failed: {result.get('error')}")
    
    except Exception as e:
        print(f"✗ Test failed with exception: {e}")
    
    print()
    print("=" * 70)
    print("✅ Testing Complete!")
    print("=" * 70)

if __name__ == '__main__':
    asyncio.run(main())
