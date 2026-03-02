"""Test with explicit autocomplete"""
import asyncio
import logging

logging.basicConfig(level=logging.DEBUG, format='%(levelname)s - %(name)s - %(message)s')

async def main():
    from scrapers.meteo_parapente import MeteoParapenteScraper
    
    scraper = MeteoParapenteScraper()
    
    # Test WITH site_name (should trigger autocomplete)
    print("=" * 70)
    print("TEST: Fetch with site_name (should use autocomplete)")
    print("=" * 70)
    
    result = await scraper.fetch(
        lat=47.012,  # Database coords
        lon=6.789,
        site_name="Arguel",  # This should trigger autocomplete
        elevation_m=427
    )
    
    print(f"Success: {result['success']}")
    if result['success']:
        forecasts = scraper.extract_hourly_forecast(result)
        print(f"Forecasts extracted: {len(forecasts)}")
        if forecasts:
            print(f"First forecast: {forecasts[0]}")

asyncio.run(main())
