"""Test API directe de meteo-parapente"""
import httpx
import json
from datetime import datetime

# URL trouvée: data.php avec params run, location, date, plot
url = "https://data0.meteo-parapente.com/data.php"

# Params pour Arguel (47.1982, 6.0018)
params = {
    "run": "2026022818",  # Run de modèle (date+heure)
    "location": "47.1982,6.0018",  # Lat,Lon d'Arguel
    "date": "20260301",  # Date aujourd'hui
    "plot": "windgram"  # Type de graphique
}

print("🔍 Test API directe meteo-parapente.com")
print(f"URL: {url}")
print(f"Params: {params}\n")

with httpx.Client(timeout=30) as client:
    response = client.get(url, params=params)
    print(f"Status: {response.status_code}")
    print(f"Content-Type: {response.headers.get('content-type')}")
    print(f"Taille: {len(response.content)} bytes\n")
    
    # Essayer de parser en JSON
    try:
        data = response.json()
        print("✅ C'est du JSON!")
        print(f"Type: {type(data)}")
        print(f"Clés: {list(data.keys()) if isinstance(data, dict) else 'Liste'}\n")
        
        # Sauvegarder
        with open('api_response.json', 'w') as f:
            json.dump(data, f, indent=2)
        print("💾 Sauvegardé dans api_response.json")
        
        # Afficher un aperçu
        print("\n📄 Aperçu des données:")
        print(json.dumps(data, indent=2)[:1000])
        print("...")
        
    except:
        print("⚠️  Pas du JSON, probablement binaire ou autre format")
        print(f"Début du contenu: {response.text[:500]}")
