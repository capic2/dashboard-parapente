"""Test meteociel AROME hourly scraper"""
import asyncio
import logging

logging.basicConfig(level=logging.INFO, format='%(levelname)s - %(name)s - %(message)s')

async def main():
    print("=" * 70)
    print("🧪 Testing Meteociel AROME Hourly Scraper")
    print("=" * 70)
    print()
    
    from scrapers.meteociel import MeteocielScraper
    
    scraper = MeteocielScraper()
    
    # Test with Arguel
    print("Test: Fetch AROME hourly forecast for Arguel")
    print()
    
    result = await scraper.fetch(
        lat=47.012,
        lon=6.789,
        site_name="Arguel"
    )
    
    print(f"Success: {result.get('success')}")
    print(f"Source: {result.get('source')}")
    
    if result.get('error'):
        print(f"Error: {result.get('error')}")
    
    if result.get('success'):
        # Extract all forecasts
        all_forecasts = result['data']['hourly']
        print(f"Total forecasts extracted: {len(all_forecasts)}")
        
        # Get day 0 forecasts
        day0_forecasts = scraper.extract_hourly_forecast(result, day_index=0)
        print(f"Day 0 forecasts: {len(day0_forecasts)}")
        print()
        
        # Show hours available
        hours = sorted(set([f['hour'] for f in day0_forecasts]))
        print(f"Hours available for day 0: {hours}")
        print()
        
        if day0_forecasts:
            print("First 10 forecasts:")
            for forecast in day0_forecasts[:10]:
                hour = forecast.get('hour', 'N/A')
                temp = forecast.get('temperature')
                wind = forecast.get('wind_speed')
                gust = forecast.get('wind_gust')
                
                temp_str = f"{temp:.1f}°C" if temp is not None else "N/A"
                wind_str = f"{wind:.1f} m/s" if wind is not None else "N/A"
                gust_str = f" (gust: {gust:.1f})" if gust is not None else ""
                
                print(f"  {hour:02d}:00 - {temp_str} - Wind: {wind_str}{gust_str}")

asyncio.run(main())
