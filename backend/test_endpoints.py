#!/usr/bin/env python3
"""
Test all backend endpoints
Verifies Week 2 implementation
"""
import asyncio
import httpx
import sys
from pathlib import Path

BASE_URL = "http://localhost:8000"

async def test_endpoints():
    """Test all API endpoints"""
    async with httpx.AsyncClient() as client:
        tests_passed = 0
        tests_failed = 0
        
        print("🧪 Testing Backend Endpoints\n")
        print("=" * 60)
        
        # Test 1: Health Check
        print("\n1️⃣  Testing Health Check")
        try:
            response = await client.get(f"{BASE_URL}/api/health")
            if response.status_code == 200:
                print(f"   ✅ Health check passed: {response.json()}")
                tests_passed += 1
            else:
                print(f"   ❌ Health check failed: {response.status_code}")
                tests_failed += 1
        except Exception as e:
            print(f"   ❌ Error: {e}")
            tests_failed += 1
        
        # Test 2: Get Sites
        print("\n2️⃣  Testing GET /api/spots")
        try:
            response = await client.get(f"{BASE_URL}/api/spots")
            if response.status_code == 200:
                data = response.json()
                sites = data.get('sites', [])
                print(f"   ✅ Found {len(sites)} sites")
                if sites:
                    first_site_id = sites[0]['id']
                    print(f"   First site: {sites[0]['name']} (ID: {first_site_id})")
                tests_passed += 1
            else:
                print(f"   ❌ Failed: {response.status_code}")
                tests_failed += 1
                first_site_id = None
        except Exception as e:
            print(f"   ❌ Error: {e}")
            tests_failed += 1
            first_site_id = None
        
        # Test 3: Get Weather (requires site)
        if first_site_id:
            print(f"\n3️⃣  Testing GET /api/weather/{first_site_id}?day_index=0")
            try:
                response = await client.get(f"{BASE_URL}/api/weather/{first_site_id}?day_index=0", timeout=30.0)
                if response.status_code == 200:
                    data = response.json()
                    print(f"   ✅ Weather data received")
                    print(f"   Para-Index: {data.get('para_index', 'N/A')}/100")
                    print(f"   Verdict: {data.get('verdict', 'N/A')}")
                    print(f"   Consensus hours: {len(data.get('consensus', []))}")
                    tests_passed += 1
                else:
                    print(f"   ❌ Failed: {response.status_code}")
                    tests_failed += 1
            except Exception as e:
                print(f"   ❌ Error: {e}")
                tests_failed += 1
        else:
            print("\n3️⃣  Skipping weather test (no sites found)")
            tests_failed += 1
        
        # Test 4: Get Flights
        print("\n4️⃣  Testing GET /api/flights")
        try:
            response = await client.get(f"{BASE_URL}/api/flights?limit=10")
            if response.status_code == 200:
                data = response.json()
                flights = data.get('flights', [])
                print(f"   ✅ Found {len(flights)} flights")
                if flights:
                    first_flight_id = flights[0]['id']
                    print(f"   First flight: {flights[0].get('title', 'Untitled')}")
                else:
                    print("   ⚠️  No flights found (run seed_flights.py)")
                    first_flight_id = None
                tests_passed += 1
            else:
                print(f"   ❌ Failed: {response.status_code}")
                tests_failed += 1
                first_flight_id = None
        except Exception as e:
            print(f"   ❌ Error: {e}")
            tests_failed += 1
            first_flight_id = None
        
        # Test 5: Get Flight Stats
        print("\n5️⃣  Testing GET /api/flights/stats")
        try:
            response = await client.get(f"{BASE_URL}/api/flights/stats")
            if response.status_code == 200:
                data = response.json()
                print(f"   ✅ Stats received")
                print(f"   Total flights: {data.get('total_flights', 0)}")
                print(f"   Total hours: {data.get('total_hours', 0)}h")
                print(f"   Total distance: {data.get('total_distance', 0)} km")
                print(f"   Favorite spot: {data.get('favorite_spot', 'N/A')}")
                tests_passed += 1
            else:
                print(f"   ❌ Failed: {response.status_code}")
                tests_failed += 1
        except Exception as e:
            print(f"   ❌ Error: {e}")
            tests_failed += 1
        
        # Test 6: Get Flight GPX Data
        if first_flight_id:
            print(f"\n6️⃣  Testing GET /api/flights/{first_flight_id}/gpx-data")
            try:
                response = await client.get(f"{BASE_URL}/api/flights/{first_flight_id}/gpx-data")
                if response.status_code == 200:
                    data = response.json()
                    gpx_data = data.get('data', {})
                    coords = gpx_data.get('coordinates', [])
                    print(f"   ✅ GPX data received")
                    print(f"   Coordinates: {len(coords)} points")
                    print(f"   Max altitude: {gpx_data.get('max_altitude_m', 0)} m")
                    print(f"   Distance: {gpx_data.get('total_distance_km', 0)} km")
                    tests_passed += 1
                else:
                    print(f"   ❌ Failed: {response.status_code}")
                    if response.status_code == 404:
                        print(f"   (This is expected if flight has no GPX file)")
                    tests_failed += 1
            except Exception as e:
                print(f"   ❌ Error: {e}")
                tests_failed += 1
        else:
            print("\n6️⃣  Skipping GPX test (no flights found)")
            tests_failed += 1
        
        # Test 7: Get Alerts
        print("\n7️⃣  Testing GET /api/alerts")
        try:
            response = await client.get(f"{BASE_URL}/api/alerts")
            if response.status_code == 200:
                alerts = response.json()
                print(f"   ✅ Alerts received: {len(alerts)} alerts")
                tests_passed += 1
            else:
                print(f"   ❌ Failed: {response.status_code}")
                tests_failed += 1
        except Exception as e:
            print(f"   ❌ Error: {e}")
            tests_failed += 1
        
        # Summary
        print("\n" + "=" * 60)
        print(f"\n📊 Test Results:")
        print(f"   ✅ Passed: {tests_passed}")
        print(f"   ❌ Failed: {tests_failed}")
        
        if tests_failed == 0:
            print("\n🎉 All tests passed! Backend is ready.")
            return 0
        else:
            print("\n⚠️  Some tests failed. Check the output above.")
            return 1


if __name__ == "__main__":
    print("Starting backend endpoint tests...")
    print("Make sure the backend server is running: uvicorn main:app --reload\n")
    
    try:
        exit_code = asyncio.run(test_endpoints())
        sys.exit(exit_code)
    except KeyboardInterrupt:
        print("\n\n⚠️  Tests interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n\n❌ Fatal error: {e}")
        sys.exit(1)
