"""Test de l'API de recherche pour trouver les bonnes coordonnées"""
import httpx
import json

# API de recherche autocomplete
url = "https://api-search.meteo-parapente.com/v1/autocomplete"

params = {
    "text": "Arguel",
    "focus.point.lat": 47,
    "focus.point.lon": 6
}

print("🔍 Test API de recherche meteo-parapente\n")

with httpx.Client() as client:
    response = client.get(url, params=params)
    data = response.json()
    
    print(f"Status: {response.status_code}")
    print(f"Résultats trouvés: {len(data.get('features', []))}\n")
    
    for feature in data.get('features', [])[:3]:
        props = feature.get('properties', {})
        coords = feature.get('geometry', {}).get('coordinates', [])
        
        print(f"📍 {props.get('name', 'Unknown')}")
        print(f"   Label: {props.get('label', '')}")
        print(f"   Coords: {coords}")
        print()
    
    # Sauvegarder
    with open('search_api_result.json', 'w') as f:
        json.dump(data, f, indent=2)
    print("💾 Sauvegardé dans search_api_result.json")
    
    # Retourner les coordonnées du premier résultat
    if data.get('features'):
        coords = data['features'][0]['geometry']['coordinates']
        print(f"\n✅ Coordonnées à utiliser pour Arguel: {coords[1]:.4f}, {coords[0]:.4f}")
