"""
Test script to find working Wyoming stations for France
"""
import asyncio
import httpx
from datetime import datetime

# Known European WMO station codes to test
FRENCH_STATIONS_TO_TEST = {
    # Germany (usually well covered)
    "10868": "Munich, Germany",
    "10548": "Meiningen, Germany",
    "10739": "Stuttgart, Germany",
    
    # Switzerland
    "06610": "Payerne, Switzerland",
    
    # Austria
    "11120": "Wien (Vienna), Austria",
    
    # France (testing again)
    "07145": "Trappes (Paris), France",
    "07481": "Lyon, France",
}

async def test_station(station_code: str, station_name: str):
    """Test if a station has data"""
    base_url = "http://weather.uwyo.edu/cgi-bin/sounding"
    
    # Try March 2024 12Z
    params = {
        "region": "europe",
        "TYPE": "TEXT:LIST",
        "YEAR": "2024",
        "MONTH": "03",
        "FROM": "0712",
        "TO": "0712",
        "STNM": station_code
    }
    
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(base_url, params=params)
            response.raise_for_status()
            
            text = response.text
            
            # Check if data exists
            if "Can't get" in text or "No valid" in text:
                print(f"❌ {station_code} ({station_name}): NO DATA")
                print(f"   Error: {text[:200]}")
                return False
            elif "<PRE>" in text and "PRES" in text:
                print(f"✅ {station_code} ({station_name}): HAS DATA!")
                # Show first line of data
                lines = text.split('\n')
                for line in lines:
                    if 'hPa' in line or 'PRES' in line:
                        print(f"   Sample: {line[:80]}")
                        break
                return True
            else:
                print(f"⚠️  {station_code} ({station_name}): UNKNOWN RESPONSE")
                return False
                
    except Exception as e:
        print(f"💥 {station_code} ({station_name}): ERROR - {e}")
        return False

async def main():
    print("Testing French radiosonde stations on Wyoming University...")
    print("=" * 60)
    
    results = {}
    for code, name in FRENCH_STATIONS_TO_TEST.items():
        has_data = await test_station(code, name)
        results[code] = has_data
        await asyncio.sleep(0.5)  # Be nice to server
    
    print("\n" + "=" * 60)
    print("SUMMARY:")
    print("=" * 60)
    working = [f"{code} ({FRENCH_STATIONS_TO_TEST[code]})" for code, works in results.items() if works]
    if working:
        print(f"✅ Working stations ({len(working)}):")
        for station in working:
            print(f"   - {station}")
    else:
        print("❌ No working French stations found!")
        print("   Wyoming might not have European data, or region parameter is wrong")

if __name__ == "__main__":
    asyncio.run(main())
