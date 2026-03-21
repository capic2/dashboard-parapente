#!/usr/bin/env python3
"""
Test all backend endpoints
Verifies Week 2 implementation
"""

import asyncio
import sys

import httpx

BASE_URL = "http://localhost:8000"


async def test_endpoints():
    """Test all API endpoints"""
    async with httpx.AsyncClient() as client:
        tests_passed = 0
        tests_failed = 0

        # Test 1: Health Check
        try:
            response = await client.get(f"{BASE_URL}/api/health")
            if response.status_code == 200:
                tests_passed += 1
            else:
                tests_failed += 1
        except Exception:
            tests_failed += 1

        # Test 2: Get Sites
        try:
            response = await client.get(f"{BASE_URL}/api/spots")
            if response.status_code == 200:
                data = response.json()
                sites = data.get("sites", [])
                if sites:
                    first_site_id = sites[0]["id"]
                tests_passed += 1
            else:
                tests_failed += 1
                first_site_id = None
        except Exception:
            tests_failed += 1
            first_site_id = None

        # Test 3: Get Weather (requires site)
        if first_site_id:
            try:
                response = await client.get(
                    f"{BASE_URL}/api/weather/{first_site_id}?day_index=0", timeout=30.0
                )
                if response.status_code == 200:
                    data = response.json()
                    tests_passed += 1
                else:
                    tests_failed += 1
            except Exception:
                tests_failed += 1
        else:
            tests_failed += 1

        # Test 4: Get Flights
        try:
            response = await client.get(f"{BASE_URL}/api/flights?limit=10")
            if response.status_code == 200:
                data = response.json()
                flights = data.get("flights", [])
                if flights:
                    first_flight_id = flights[0]["id"]
                else:
                    first_flight_id = None
                tests_passed += 1
            else:
                tests_failed += 1
                first_flight_id = None
        except Exception:
            tests_failed += 1
            first_flight_id = None

        # Test 5: Get Flight Stats
        try:
            response = await client.get(f"{BASE_URL}/api/flights/stats")
            if response.status_code == 200:
                data = response.json()
                tests_passed += 1
            else:
                tests_failed += 1
        except Exception:
            tests_failed += 1

        # Test 6: Get Flight GPX Data
        if first_flight_id:
            try:
                response = await client.get(f"{BASE_URL}/api/flights/{first_flight_id}/gpx-data")
                if response.status_code == 200:
                    data = response.json()
                    gpx_data = data.get("data", {})
                    coords = gpx_data.get("coordinates", [])
                    tests_passed += 1
                else:
                    if response.status_code == 404:
                        pass
                    tests_failed += 1
            except Exception:
                tests_failed += 1
        else:
            tests_failed += 1

        # Test 7: Get Alerts
        try:
            response = await client.get(f"{BASE_URL}/api/alerts")
            if response.status_code == 200:
                alerts = response.json()
                tests_passed += 1
            else:
                tests_failed += 1
        except Exception:
            tests_failed += 1

        # Summary

        if tests_failed == 0:
            return 0
        else:
            return 1


if __name__ == "__main__":

    try:
        exit_code = asyncio.run(test_endpoints())
        sys.exit(exit_code)
    except KeyboardInterrupt:
        sys.exit(1)
    except Exception:
        sys.exit(1)
