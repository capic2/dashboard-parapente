"""Test meteo-parapente with temperature (sounding plot)"""
import asyncio
import logging

logging.basicConfig(level=logging.INFO, format='%(levelname)s - %(name)s - %(message)s')

async def main():
    print("=" * 70)
    print("🧪 Testing Meteo-Parapente with Temperature")
    print("=" * 70)
    print()
    
    from scrapers.meteo_parapente import MeteoParapenteScraper
    
    scraper = MeteoParapenteScraper()
    
    # Test with Arguel
    print("Test: Fetch forecast with temperature for Arguel")
    print()
    
    result = await scraper.fetch(
        lat=47.012,
        lon=6.789,
        site_name="Arguel",
        elevation_m=427
    )
    
    print(f"Success: {result.get('success')}")
    
    if result.get('success'):
        forecasts = scraper.extract_hourly_forecast(result, day_index=0)
        
        print(f"Forecasts extracted: {len(forecasts)}")
        print()
        
        # Check for temperature data
        temps_available = [f for f in forecasts if f.get('temperature') is not None]
        
        print(f"✓ Forecasts with temperature: {len(temps_available)}/{len(forecasts)}")
        print()
        
        if temps_available:
            print("Sample forecasts (first 10):")
            for f in forecasts[:10]:
                hour = f.get('hour', 'N/A')
                temp = f.get('temperature')
                wind = f.get('wind_speed')
                
                temp_str = f"{temp:.1f}°C" if temp is not None else "N/A"
                wind_str = f"{wind:.1f} m/s" if wind is not None else "N/A"
                
                status = "✓" if temp is not None else "✗"
                print(f"  {status} {hour:02d}:00 - Temp: {temp_str} - Wind: {wind_str}")
        else:
            print("✗ No temperature data found!")
    else:
        print(f"✗ Error: {result.get('error')}")

asyncio.run(main())
