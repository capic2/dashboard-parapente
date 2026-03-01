#!/usr/bin/env python3
"""
Quick test of the weather pipeline with all 5 sources
"""
import asyncio
import sys
sys.path.insert(0, '/home/capic/.openclaw/workspace/paragliding/dashboard/backend')

from weather_pipeline import aggregate_forecasts, normalize_data, calculate_consensus

async def test_pipeline():
    """Test with Arguel (46.98897, 5.82095)"""
    
    print("=" * 60)
    print("Testing Weather Pipeline - Arguel (46.98897, 5.82095)")
    print("=" * 60)
    
    lat, lon = 46.98897, 5.82095
    day_index = 0
    
    # Step 1: Aggregate
    print("\n[1] Aggregating from all 5 sources...")
    aggregated = await aggregate_forecasts(lat, lon, day_index)
    
    print(f"\nAggregated result keys: {aggregated.keys()}")
    print(f"Sources found: {list(aggregated['sources'].keys())}")
    
    # Check each source
    for source_name, source_data in aggregated['sources'].items():
        success = source_data.get('success', False)
        hourly_count = len(source_data.get('hourly', [])) if source_data.get('hourly') else 0
        
        status = "✅ SUCCESS" if success else "❌ FAILED"
        print(f"\n  {source_name:20} {status}")
        print(f"    Hourly entries: {hourly_count}")
        
        if not success:
            error = source_data.get('error', 'Unknown error')
            print(f"    Error: {error}")
        elif hourly_count > 0:
            # Show a sample entry
            sample = source_data['hourly'][0]
            print(f"    Sample (hour {sample.get('hour')}): wind={sample.get('wind_speed')} m/s, temp={sample.get('temperature')}°C")
    
    # Step 2: Normalize
    print("\n[2] Normalizing data...")
    normalized = normalize_data(aggregated)
    
    if normalized.get('success'):
        hours_count = len(normalized.get('normalized', []))
        print(f"✅ Normalized {hours_count} hours (11-18)")
        
        if normalized.get('normalized'):
            sample_hour = normalized['normalized'][0]
            print(f"\n  Hour {sample_hour['hour']}: {sample_hour['num_sources']} sources")
    else:
        print(f"❌ Normalization failed: {normalized.get('error')}")
    
    # Step 3: Consensus
    print("\n[3] Calculating consensus...")
    consensus = calculate_consensus(normalized)
    
    if consensus.get('success'):
        print(f"✅ Consensus calculated from {consensus.get('total_sources')} unique sources")
        
        consensus_hours = consensus.get('consensus', [])
        print(f"  {len(consensus_hours)} hours with consensus data")
        
        # Show 12h consensus
        for hour_data in consensus_hours:
            if hour_data['hour'] == 12:
                print(f"\n  Hour 12 consensus:")
                print(f"    Wind: {hour_data['wind_speed']} m/s (confidence: {hour_data['wind_confidence']})")
                print(f"    Temp: {hour_data['temperature']}°C")
                print(f"    Gust: {hour_data['wind_gust']} m/s")
                break
    else:
        print(f"❌ Consensus failed: {consensus.get('error')}")
    
    print("\n" + "=" * 60)

if __name__ == "__main__":
    asyncio.run(test_pipeline())
