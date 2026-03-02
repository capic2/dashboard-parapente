"""Test avec les bons paramètres API"""
import httpx
import json
import math

url = "https://data0.meteo-parapente.com/data.php"

# Params CORRECTS selon le status
params = {
    "run": "2026022818",  # Run du 28 février 18:00
    "location": "47.1982,6.0018",  # Arguel
    "date": "20260303",  # 3 mars (J+2)
    "plot": "windgram"
}

print(f"🔍 Test avec paramètres corrects")
print(f"Run: {params['run']}")
print(f"Date: {params['date']}")
print(f"Location: {params['location']}\n")

with httpx.Client(timeout=15) as client:
    response = client.get(url, params=params)
    data = response.json()
    
    hourly = data.get('data', {})
    print(f"📊 {len(hourly)} heures reçues\n")
    
    # Test première heure
    first_hour = list(sorted(hourly.keys()))[0]
    hour_data = hourly[first_hour]
    
    print(f"Exemple {first_hour}:")
    print(f"  Altitudes: {hour_data.get('z', [])[:5]}")
    print(f"  U components: {hour_data.get('umet', [])[:5]}")
    print(f"  V components: {hour_data.get('vmet', [])[:5]}\n")
    
    # Calculer vent pour niveau surface
    if hour_data.get('umet') and hour_data.get('vmet'):
        u = hour_data['umet'][0]
        v = hour_data['vmet'][0]
        speed = math.sqrt(u**2 + v**2)
        direction = (math.degrees(math.atan2(u, v)) + 360) % 360
        
        print(f"✅ Vent niveau surface: {speed:.1f} m/s @ {int(direction)}°")
    
    # Sauvegarder
    with open('correct_api_response.json', 'w') as f:
        json.dump(data, f, indent=2)
    print(f"💾 Sauvegardé dans correct_api_response.json")
