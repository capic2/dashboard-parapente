"""Test du nouveau scraper meteo-parapente avec l'API"""
import asyncio
import sys
import json

# Ajouter le path pour les imports
sys.path.insert(0, '/home/capic/developements/dashboard-parapente/backend')

from scrapers.meteo_parapente import fetch_meteo_parapente, extract_hourly_forecast

async def test():
    print("🧪 Test du nouveau scraper meteo-parapente (API REST)\n")
    
    # Arguel: 47.012, 6.789, elevation 427m
    result = await fetch_meteo_parapente(
        lat=47.012,
        lon=6.789,
        elevation_m=427
    )
    
    print("📊 Résultat fetch:")
    print(f"  Success: {result['success']}")
    print(f"  Source: {result['source']}")
    print(f"  Error: {result.get('error', 'None')}")
    print()
    
    if result['success']:
        # Extract hourly
        hourly = extract_hourly_forecast(result)
        print(f"✅ {len(hourly)} heures extraites\n")
        
        # Afficher les 5 premières heures
        print("📋 Aperçu des 5 premières heures:")
        for h in hourly[:5]:
            print(f"  {h['hour']:02d}h: Vent {h['wind_speed']:.1f} m/s @ {h['wind_direction']}°, Temp {h.get('temperature', 'N/A')}°C")
        
        # Sauvegarder
        with open('test_scraper_result.json', 'w') as f:
            json.dump({
                'fetch_result': result,
                'hourly_forecast': hourly
            }, f, indent=2)
        print("\n💾 Résultat complet sauvegardé dans test_scraper_result.json")
    else:
        print(f"❌ Erreur: {result.get('error')}")

if __name__ == '__main__':
    asyncio.run(test())
