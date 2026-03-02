"""Test the new meteociel scraper"""
import asyncio
import logging

logging.basicConfig(level=logging.INFO, format='%(levelname)s - %(name)s - %(message)s')

async def main():
    print("=" * 70)
    print("🧪 Testing New Meteociel Scraper")
    print("=" * 70)
    print()
    
    from scrapers.meteociel import MeteocielScraper
    
    scraper = MeteocielScraper()
    
    # Test with Arguel
    print("Test: Fetch forecast for Arguel")
    print()
    
    result = await scraper.fetch(
        lat=47.012,  # Not used
        lon=6.789,   # Not used
        site_name="Arguel"
    )
    
    print(f"Success: {result.get('success')}")
    print(f"Source: {result.get('source')}")
    
    if result.get('error'):
        print(f"Error: {result.get('error')}")
    
    if result.get('success'):
        # Extract hourly forecast
        forecasts = scraper.extract_hourly_forecast(result, day_index=0)
        
        print(f"Forecasts extracted: {len(forecasts)}")
        print()
        
        if forecasts:
            print("First 10 forecasts:")
            for forecast in forecasts[:10]:
                hour = forecast.get('hour', 'N/A')
                temp = forecast.get('temperature')
                wind = forecast.get('wind_speed')
                gust = forecast.get('wind_gust')
                precip = forecast.get('precipitation')
                
                temp_str = f"{temp:.1f}°C" if temp is not None else "N/A"
                wind_str = f"{wind:.1f} m/s" if wind is not None else "N/A"
                gust_str = f" (gust: {gust:.1f})" if gust is not None else ""
                precip_str = f" - Rain: {precip:.1f}mm" if precip is not None else ""
                
                print(f"  {hour:02d}:00 - {temp_str} - Wind: {wind_str}{gust_str}{precip_str}")

asyncio.run(main())
