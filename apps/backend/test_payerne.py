"""
Test Payerne station (closest to Arguel/Mont Poupet) with different dates
"""

import asyncio
from datetime import datetime

import httpx


async def test_payerne_date(date_str: str, sounding_time: str):
    """Test Payerne for a specific date"""
    station_code = "06610"
    base_url = "http://weather.uwyo.edu/cgi-bin/sounding"

    # Parse date
    dt = datetime.strptime(date_str, "%Y-%m-%d")

    params = {
        "region": "europe",
        "TYPE": "TEXT:LIST",
        "YEAR": dt.strftime("%Y"),
        "MONTH": dt.strftime("%m"),
        "FROM": dt.strftime("%d") + sounding_time,
        "TO": dt.strftime("%d") + sounding_time,
        "STNM": station_code,
    }

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(base_url, params=params)
            text = response.text

            if "Can't get" in text or "No valid" in text:
                print(f"❌ {date_str} {sounding_time}Z: NO DATA")
                return False
            elif "<PRE>" in text and "PRES" in text:
                print(f"✅ {date_str} {sounding_time}Z: HAS DATA!")
                return True
            else:
                print(f"⚠️  {date_str} {sounding_time}Z: UNKNOWN")
                return False
    except Exception as e:
        print(f"💥 {date_str} {sounding_time}Z: ERROR - {e}")
        return False


async def main():
    print("Testing Payerne (06610) - Closest to Arguel/Mont Poupet")
    print("Location: 46.81°N, 6.94°E (Switzerland)")
    print("Distance from Arguel: ~80km")
    print("=" * 60)

    # Test recent dates
    dates_to_test = [
        "2024-12-15",
        "2024-11-01",
        "2024-10-01",
        "2024-09-01",
        "2024-08-01",
        "2024-03-07",
        "2023-12-01",
        "2023-06-01",
    ]

    for date_str in dates_to_test:
        await test_payerne_date(date_str, "12")
        await asyncio.sleep(0.3)

    print("\n" + "=" * 60)
    print("Testing German stations (alternatives)")
    print("=" * 60)

    # Test Stuttgart (closest German station)
    print("\nStuttgart (10739) - ~200km from Arguel:")
    await test_station("10739", "2024-03-07", "12")

    print("\nMunich (10868) - ~300km from Arguel:")
    await test_station("10868", "2024-03-07", "12")


async def test_station(code: str, date_str: str, sounding_time: str):
    dt = datetime.strptime(date_str, "%Y-%m-%d")
    base_url = "http://weather.uwyo.edu/cgi-bin/sounding"

    params = {
        "region": "europe",
        "TYPE": "TEXT:LIST",
        "YEAR": dt.strftime("%Y"),
        "MONTH": dt.strftime("%m"),
        "FROM": dt.strftime("%d") + sounding_time,
        "TO": dt.strftime("%d") + sounding_time,
        "STNM": code,
    }

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(base_url, params=params)
            text = response.text

            if "<PRE>" in text and "PRES" in text:
                print("   ✅ HAS DATA!")
            else:
                print("   ❌ NO DATA")
    except Exception as e:
        print(f"   💥 ERROR: {e}")


if __name__ == "__main__":
    asyncio.run(main())
