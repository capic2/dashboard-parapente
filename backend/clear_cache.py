#!/usr/bin/env python3
"""
Script to clear Redis cache - run this inside the backend container
Usage: python clear_cache.py
"""

import asyncio
import os
import sys

# Set environment to production to use real Redis
os.environ['ENVIRONMENT'] = 'production'
os.environ['USE_FAKE_REDIS'] = 'false'

async def clear_cache():
    from cache import get_redis
    
    try:
        print("🔌 Connecting to Redis...")
        redis_client = await get_redis()
        
        print("🔍 Finding cache keys...")
        weather_keys = await redis_client.keys("weather:*")
        best_spot_keys = await redis_client.keys("best_spot:*")
        all_keys = weather_keys + best_spot_keys
        
        print(f"📋 Found {len(all_keys)} cache entries:")
        print(f"   - Weather keys: {len(weather_keys)}")
        print(f"   - Best spot keys: {len(best_spot_keys)}")
        
        if all_keys:
            print(f"\n🗑️  Deleting {len(all_keys)} cache entries...")
            deleted = await redis_client.delete(*all_keys)
            print(f"✅ Successfully cleared {deleted} cache entries!")
            
            # Verify
            remaining = await redis_client.keys("weather:*")
            if not remaining:
                print("✅ Cache is now empty!")
            else:
                print(f"⚠️  Warning: {len(remaining)} keys still remain")
        else:
            print("ℹ️  Cache is already empty")
        
        return True
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = asyncio.run(clear_cache())
    sys.exit(0 if success else 1)
