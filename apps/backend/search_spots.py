#!/usr/bin/env python3
"""
Script pratique pour rechercher des spots de parapente
Usage: python search_spots.py [options]
"""

import requests
import json
import sys
from typing import Optional

API_BASE = "http://localhost:8001/api"

def print_spot(spot: dict, show_details: bool = False):
    """Affiche un spot de manière lisible"""
    distance = spot.get('distance_km', 'N/A')
    
    print(f"\n{'='*70}")
    print(f"📍 {spot['name']}")
    print(f"{'='*70}")
    print(f"Type:        {spot['type'].upper()}")
    print(f"Distance:    {distance} km")
    print(f"Coordonnées: {spot['latitude']:.6f}, {spot['longitude']:.6f}")
    
    if spot.get('elevation_m'):
        print(f"Altitude:    {spot['elevation_m']}m")
    
    if spot.get('orientation'):
        print(f"Orientation: {spot['orientation']}")
    
    if spot.get('rating') is not None and spot['rating'] >= 0:
        stars = '⭐' * spot['rating']
        print(f"Note:        {stars} ({spot['rating']}/6)")
    
    print(f"Source:      {spot['source']}")
    
    if show_details:
        print(f"ID:          {spot['id']}")

def search_by_city(city: str, radius_km: int = 50, spot_type: Optional[str] = None):
    """Recherche des spots près d'une ville"""
    print(f"\n🔍 Recherche des spots près de {city} (rayon: {radius_km}km)")
    if spot_type:
        print(f"   Filtre: {spot_type} uniquement")
    print()
    
    url = f"{API_BASE}/spots/search"
    params = {
        "city": city,
        "radius_km": radius_km
    }
    
    if spot_type:
        params["type"] = spot_type
    
    try:
        response = requests.get(url, params=params, timeout=10)
        response.raise_for_status()
        data = response.json()
        
        if "error" in data:
            print(f"❌ Erreur: {data['error']}")
            return
        
        total = data['total']
        spots = data['spots']
        
        print(f"✅ {total} spot(s) trouvé(s)\n")
        
        if total == 0:
            print("Aucun spot trouvé dans ce rayon. Essaye d'augmenter le rayon de recherche.")
            return
        
        # Afficher les 10 premiers résultats
        for i, spot in enumerate(spots[:10], 1):
            print(f"\n{i}. {spot['name']} ({spot['type']}) - {spot['distance_km']} km")
            if spot.get('orientation'):
                print(f"   Orientation: {spot['orientation']}")
            if spot.get('rating') is not None and spot['rating'] >= 0:
                print(f"   Note: {'⭐' * spot['rating']} ({spot['rating']}/6)")
        
        if total > 10:
            print(f"\n... et {total - 10} autres spots")
        
        # Proposer d'afficher les détails
        print(f"\n💡 Pour voir les détails d'un spot, utilise:")
        print(f"   python search_spots.py --detail {spots[0]['id']}")
        
    except requests.RequestException as e:
        print(f"❌ Erreur de connexion: {e}")
        print(f"   Vérifie que le serveur tourne sur {API_BASE}")

def search_by_coordinates(lat: float, lon: float, radius_km: int = 50, spot_type: Optional[str] = None):
    """Recherche des spots par coordonnées GPS"""
    print(f"\n🔍 Recherche des spots à ({lat}, {lon}) dans un rayon de {radius_km}km")
    if spot_type:
        print(f"   Filtre: {spot_type} uniquement")
    print()
    
    url = f"{API_BASE}/spots/search"
    params = {
        "lat": lat,
        "lon": lon,
        "radius_km": radius_km
    }
    
    if spot_type:
        params["type"] = spot_type
    
    try:
        response = requests.get(url, params=params, timeout=10)
        response.raise_for_status()
        data = response.json()
        
        total = data['total']
        spots = data['spots']
        
        print(f"✅ {total} spot(s) trouvé(s)\n")
        
        for i, spot in enumerate(spots[:10], 1):
            print(f"\n{i}. {spot['name']} ({spot['type']}) - {spot['distance_km']} km")
            if spot.get('elevation_m'):
                print(f"   Altitude: {spot['elevation_m']}m")
            if spot.get('orientation'):
                print(f"   Orientation: {spot['orientation']}")
        
        if total > 10:
            print(f"\n... et {total - 10} autres spots")
        
    except requests.RequestException as e:
        print(f"❌ Erreur de connexion: {e}")

def get_spot_details(spot_id: str):
    """Affiche les détails complets d'un spot"""
    print(f"\n🔍 Récupération des détails du spot {spot_id}\n")
    
    url = f"{API_BASE}/spots/detail/{spot_id}"
    
    try:
        response = requests.get(url, timeout=10)
        response.raise_for_status()
        spot = response.json()
        
        print_spot(spot, show_details=True)
        
        # Informations supplémentaires
        print(f"\n📊 Informations complémentaires:")
        if spot.get('openaip_id'):
            print(f"   OpenAIP ID: {spot['openaip_id']}")
        if spot.get('paraglidingspots_id'):
            print(f"   ParaglidingSpots ID: {spot['paraglidingspots_id']}")
        
        if spot.get('last_synced'):
            print(f"   Dernière sync: {spot['last_synced']}")
        
    except requests.RequestException as e:
        print(f"❌ Erreur: {e}")

def show_status():
    """Affiche le statut de la base de données"""
    print("\n📊 Statut de la base de données des spots\n")
    
    url = f"{API_BASE}/spots/status"
    
    try:
        response = requests.get(url, timeout=10)
        response.raise_for_status()
        data = response.json()
        
        print(f"Total de spots: {data['total_spots']}")
        print(f"\nPar source:")
        print(f"  - OpenAIP:          {data['by_source']['openaip']}")
        print(f"  - ParaglidingSpots: {data['by_source']['paraglidingspots']}")
        print(f"  - Fusionnés:        {data['by_source']['merged']}")
        
        print(f"\nPar type:")
        print(f"  - Décollages:  {data['by_type']['takeoff']}")
        print(f"  - Atterrissages: {data['by_type']['landing']}")
        
        if data.get('last_sync'):
            print(f"\nDernière synchronisation: {data['last_sync']}")
        
        if data['database_ready']:
            print("\n✅ Base de données prête !")
        else:
            print("\n⚠️  Base de données vide. Lance une synchronisation:")
            print("   curl -X POST http://localhost:8001/api/spots/sync")
        
    except requests.RequestException as e:
        print(f"❌ Erreur: {e}")

def show_help():
    """Affiche l'aide"""
    print("""
🪂 Recherche de Spots de Parapente
==================================

Usage:
  python search_spots.py --city VILLE [--radius RAYON] [--type TYPE]
  python search_spots.py --gps LAT LON [--radius RAYON] [--type TYPE]
  python search_spots.py --detail SPOT_ID
  python search_spots.py --status

Options:
  --city VILLE         Nom de la ville (ex: Besançon, Annecy)
  --gps LAT LON        Coordonnées GPS (ex: 47.1944 5.9896)
  --radius RAYON       Rayon de recherche en km (défaut: 50)
  --type TYPE          Type de spot: "takeoff" ou "landing"
  --detail SPOT_ID     Afficher les détails d'un spot
  --status             Afficher le statut de la base de données
  --help               Afficher cette aide

Exemples:
  # Chercher tous les spots près de Besançon
  python search_spots.py --city Besançon

  # Chercher les décollages dans un rayon de 30km
  python search_spots.py --city Besançon --radius 30 --type takeoff

  # Chercher par coordonnées GPS
  python search_spots.py --gps 47.1944 5.9896 --radius 20

  # Voir les détails d'un spot
  python search_spots.py --detail merged_884e0213d9116315

  # Vérifier le statut
  python search_spots.py --status
""")

def main():
    """Point d'entrée principal"""
    args = sys.argv[1:]
    
    if not args or "--help" in args:
        show_help()
        return
    
    if "--status" in args:
        show_status()
        return
    
    if "--detail" in args:
        try:
            idx = args.index("--detail")
            spot_id = args[idx + 1]
            get_spot_details(spot_id)
        except (IndexError, ValueError):
            print("❌ Usage: --detail SPOT_ID")
        return
    
    # Paramètres communs
    radius_km = 50
    spot_type = None
    
    if "--radius" in args:
        try:
            idx = args.index("--radius")
            radius_km = int(args[idx + 1])
        except (IndexError, ValueError):
            print("❌ Usage: --radius RAYON_EN_KM")
            return
    
    if "--type" in args:
        try:
            idx = args.index("--type")
            spot_type = args[idx + 1]
            if spot_type not in ["takeoff", "landing"]:
                print("❌ Type doit être 'takeoff' ou 'landing'")
                return
        except (IndexError, ValueError):
            print("❌ Usage: --type {takeoff|landing}")
            return
    
    # Recherche par ville
    if "--city" in args:
        try:
            idx = args.index("--city")
            city = args[idx + 1]
            search_by_city(city, radius_km, spot_type)
        except (IndexError, ValueError):
            print("❌ Usage: --city NOM_VILLE")
        return
    
    # Recherche par GPS
    if "--gps" in args:
        try:
            idx = args.index("--gps")
            lat = float(args[idx + 1])
            lon = float(args[idx + 2])
            search_by_coordinates(lat, lon, radius_km, spot_type)
        except (IndexError, ValueError):
            print("❌ Usage: --gps LATITUDE LONGITUDE")
        return
    
    # Aucune option reconnue
    print("❌ Option non reconnue. Utilise --help pour voir les options disponibles.")

if __name__ == "__main__":
    main()
