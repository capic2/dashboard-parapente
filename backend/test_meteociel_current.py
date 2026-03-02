"""Test the current meteociel scraper to see what's broken"""
import asyncio
import logging

logging.basicConfig(level=logging.INFO, format='%(levelname)s - %(name)s - %(message)s')

async def main():
    print("=" * 70)
    print("🧪 Testing Current Meteociel Scraper")
    print("=" * 70)
    print()
    
    from scrapers.meteociel import fetch_meteociel
    
    # Test with Arguel
    print("Testing with Arguel (lat=47.012, lon=6.789)")
    print()
    
    result = await fetch_meteociel(
        lat=47.012,
        lon=6.789,
        location_name="Arguel"
    )
    
    print(f"Success: {result.get('success')}")
    print(f"Source: {result.get('source')}")
    
    if result.get('error'):
        print(f"Error: {result.get('error')}")
    
    data = result.get('data', [])
    print(f"Data points: {len(data)}")
    
    if data:
        print("\nFirst 5 data points:")
        for item in data[:5]:
            print(f"  {item}")

asyncio.run(main())
