"""Test geocoding APIs to get INSEE code from coordinates"""
import asyncio
import httpx

async def test_api_geo():
    """Test api-adresse.data.gouv.fr for reverse geocoding"""
    lat, lon = 47.012, 6.789
    
    url = "https://api-adresse.data.gouv.fr/reverse/"
    params = {
        "lon": lon,
        "lat": lat
    }
    
    print("Testing api-adresse.data.gouv.fr")
    print(f"Coordinates: {lat}, {lon}")
    print()
    
    async with httpx.AsyncClient() as client:
        response = await client.get(url, params=params)
        
        if response.status_code == 200:
            data = response.json()
            
            print(f"✓ Success!")
            print(f"Response: {data}")
            print()
            
            if 'features' in data and data['features']:
                feature = data['features'][0]
                properties = feature.get('properties', {})
                
                print("Location info:")
                print(f"  City: {properties.get('city')}")
                print(f"  Postcode: {properties.get('postcode')}")
                print(f"  CityCode: {properties.get('citycode')}")  # This is INSEE code!
                print(f"  Context: {properties.get('context')}")
                
                return properties.get('citycode')
        else:
            print(f"✗ Failed with status {response.status_code}")
            return None

async def test_geo_api_gouv():
    """Test geo.api.gouv.fr for communes"""
    lat, lon = 47.012, 6.789
    
    # First get commune from coordinates
    url = "https://geo.api.gouv.fr/communes"
    params = {
        "lat": lat,
        "lon": lon
    }
    
    print("\nTesting geo.api.gouv.fr")
    print(f"Coordinates: {lat}, {lon}")
    print()
    
    async with httpx.AsyncClient() as client:
        response = await client.get(url, params=params)
        
        if response.status_code == 200:
            data = response.json()
            
            print(f"✓ Success!")
            
            if data and len(data) > 0:
                commune = data[0]
                print("Commune info:")
                print(f"  Name: {commune.get('nom')}")
                print(f"  Code: {commune.get('code')}")  # INSEE code
                print(f"  Code Postal: {commune.get('codesPostaux')}")
                print(f"  Population: {commune.get('population')}")
                
                return commune.get('code')
        else:
            print(f"✗ Failed with status {response.status_code}")
            return None

async def main():
    print("=" * 70)
    print("🔍 Testing Geocoding APIs for INSEE Code")
    print("=" * 70)
    print()
    
    insee1 = await test_api_geo()
    insee2 = await test_geo_api_gouv()
    
    print()
    print("=" * 70)
    print("Results:")
    print(f"  api-adresse: {insee1}")
    print(f"  geo.api.gouv: {insee2}")
    print("=" * 70)

asyncio.run(main())
