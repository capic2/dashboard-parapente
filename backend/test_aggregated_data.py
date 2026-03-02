"""Test the aggregated data structure"""
import asyncio
import json
import logging

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(levelname)s - %(name)s - %(message)s')

async def main():
    from weather_pipeline import aggregate_forecasts
    
    # Test data - Arguel site
    lat, lon = 47.012, 6.789
    site_name = "Arguel"
    elevation_m = 427
    
    print("Testing aggregated forecast data...")
    print()
    
    aggregated = await aggregate_forecasts(
        lat=lat,
        lon=lon,
        day_index=0,
        sources=["meteo-parapente"],
        site_name=site_name,
        elevation_m=elevation_m
    )
    
    print(json.dumps(aggregated, indent=2, default=str))

asyncio.run(main())
