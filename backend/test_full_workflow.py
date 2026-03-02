"""Test workflow complet: recherche + données"""
import asyncio
import httpx
import json
from datetime import datetime, timedelta
import math

async def search_location(site_name: str, lat_hint: float, lon_hint: float):
    """Recherche une ville via l'API autocomplete"""
    url = "https://api-search.meteo-parapente.com/v1/autocomplete"
    params = {
        "text": site_name,
        "focus.point.lat": int(lat_hint),
        "focus.point.lon": int(lon_hint)
    }
    
    async with httpx.AsyncClient() as client:
        response = await client.get(url, params=params)
        data = response.json()
        
        if data.get('features'):
            # Prendre le premier résultat
            coords = data['features'][0]['geometry']['coordinates']
            return coords[1], coords[0]  # lat, lon
        
        return None, None

async def fetch_forecast(lat: float, lon: float):
    """Récupère les prévisions météo"""
    url = "https://data0.meteo-parapente.com/data.php"
    
    # Model run (hier 18:00)
    run_date = datetime.now() - timedelta(hours=12)
    run = run_date.strftime('%Y%m%d18')
    
    # Date aujourd'hui
    date = datetime.now().strftime('%Y%m%d')
    
    params = {
        "run": run,
        "location": f"{lat:.4f},{lon:.4f}",
        "date": date,
        "plot": "windgram"
    }
    
    async with httpx.AsyncClient(timeout=15) as client:
        response = await client.get(url, params=params)
        return response.json()

def calculate_wind(u, v):
    """Calcule vitesse et direction du vent"""
    speed = math.sqrt(u**2 + v**2)
    direction = (math.degrees(math.atan2(u, v)) + 360) % 360
    return speed, int(direction)

async def main():
    print("🧪 Test workflow complet meteo-parapente\n")
    
    # Étape 1: Recherche
    print("1️⃣  Recherche de 'Arguel'...")
    lat, lon = await search_location("Arguel", 47, 6)
    print(f"   ✓ Trouvé: {lat:.4f}, {lon:.4f}\n")
    
    # Étape 2: Récupération données
    print("2️⃣  Récupération des prévisions...")
    data = await fetch_forecast(lat, lon)
    hourly_data = data.get('data', {})
    print(f"   ✓ {len(hourly_data)} heures disponibles\n")
    
    # Étape 3: Parsing
    print("3️⃣  Parsing des données...")
    forecasts = []
    for hour_str in sorted(hourly_data.keys())[:10]:  # Limiter à 10h
        hour_data = hourly_data[hour_str]
        hour = int(hour_str.split(':')[0])
        
        # Niveau de surface (index 0)
        u = hour_data.get('umet', [0])[0]
        v = hour_data.get('vmet', [0])[0]
        
        speed, direction = calculate_wind(u, v)
        
        forecasts.append({
            'hour': hour,
            'wind_speed': speed,
            'wind_direction': direction
        })
        
        print(f"   {hour:02d}h: Vent {speed:.1f} m/s @ {direction}°")
    
    print(f"\n✅ Workflow complet fonctionne!")
    print(f"📊 {len(forecasts)} prévisions horaires extraites")

if __name__ == '__main__':
    asyncio.run(main())
