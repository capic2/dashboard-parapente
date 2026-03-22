#!/usr/bin/env python3
"""
🪂 Trouve les meilleurs spots volables aujourd'hui !

Ce script combine la recherche de spots avec la météo pour te dire
où tu peux voler MAINTENANT.
"""

import sys

import requests

API_BASE = "http://localhost:8001/api"


def print_verdict_emoji(verdict: str) -> str:
    """Retourne un emoji selon le verdict"""
    verdicts = {
        "EXCELLENT": "🟢 EXCELLENT",
        "BON": "🟢 BON",
        "MOYEN": "🟡 MOYEN",
        "LIMITE": "🟠 LIMITE",
        "MAUVAIS": "🔴 MAUVAIS",
        "DANGEREUX": "⛔ DANGEREUX",
    }
    return verdicts.get(verdict, f"❓ {verdict}")


def print_spot_weather(spot: dict, rank: int):
    """Affiche un spot avec sa météo"""
    print(f"\n{'='*80}")
    print(f"#{rank} - {spot['name']} ({spot['type'].upper()})")
    print(f"{'='*80}")

    # Infos spot
    print(f"📍 Distance:     {spot['distance_km']} km")
    print(f"🗺️  GPS:          {spot['latitude']:.6f}, {spot['longitude']:.6f}")

    if spot.get("elevation_m"):
        print(f"⛰️  Altitude:     {spot['elevation_m']}m")

    if spot.get("orientation"):
        print(f"🧭 Orientation:  {spot['orientation']}")

    if spot.get("rating") is not None and spot["rating"] >= 0:
        stars = "⭐" * spot["rating"]
        print(f"⭐ Note:         {stars} ({spot['rating']}/6)")

    # Météo
    weather = spot.get("weather", {})

    if "error" in weather:
        print(f"\n⚠️  Météo: {weather['error']}")
        return

    print("\n🌤️  MÉTÉO D'AUJOURD'HUI")
    print(f"{'─'*80}")

    para_index = weather.get("para_index")
    verdict = weather.get("verdict", "INCONNU")

    print(f"Para-Index:   {para_index}/100 - {print_verdict_emoji(verdict)}")

    # Raisons
    reasons = weather.get("reasons", [])
    if reasons:
        print("\nPourquoi ce score ?")
        for reason in reasons:
            print(f"  • {reason}")

    # Créneaux volables
    slots = weather.get("flyable_slots", [])
    if slots and isinstance(slots, list) and len(slots) > 0:
        print("\n⏰ Créneaux volables aujourd'hui:")
        for slot in slots:
            if isinstance(slot, dict) and "start" in slot:
                # Format: {start: "10:00", end: "12:00", para_index: 65}
                print(
                    f"  • {slot.get('start', '?')} → {slot.get('end', '?')} "
                    f"(Para-Index: {slot.get('para_index', '?')}/100)"
                )
            elif isinstance(slot, dict) and "time" in slot:
                # Alternative format
                print(
                    f"  • {slot.get('time', '?')} (Para-Index: {slot.get('para_index', '?')}/100)"
                )
    else:
        print("\n⏰ Aucun créneau volable aujourd'hui")

    # Lever/coucher soleil
    sunrise = weather.get("sunrise")
    sunset = weather.get("sunset")
    if sunrise and sunset:
        print(f"\n☀️  Lever: {sunrise} | Coucher: {sunset}")

    print(f"\n💡 ID pour météo détaillée: {spot['id']}")


def find_flyable_spots(
    city: str | None = None,
    lat: float | None = None,
    lon: float | None = None,
    radius_km: int = 50,
    spot_type: str | None = None,
    limit: int = 5,
):
    """Trouve les spots volables"""

    if city:
        print(f"\n🔍 Recherche des meilleurs spots près de {city} (rayon: {radius_km}km)")
    else:
        print(f"\n🔍 Recherche des meilleurs spots à ({lat}, {lon}) (rayon: {radius_km}km)")

    if spot_type:
        print(f"   Filtre: {spot_type} uniquement")

    print(f"   Limite: Top {limit} spots\n")
    print("⏳ Récupération des spots + météo en cours...\n")

    url = f"{API_BASE}/spots/search-with-weather"
    params = {"radius_km": radius_km, "limit": limit}

    if city:
        params["city"] = city
    else:
        params["lat"] = lat
        params["lon"] = lon

    if spot_type:
        params["type"] = spot_type

    try:
        response = requests.get(url, params=params, timeout=30)
        response.raise_for_status()
        data = response.json()

        if "error" in data:
            print(f"❌ Erreur: {data['error']}")
            return

        total = data["total_spots_found"]
        spots = data["spots_with_weather"]
        showing = data["showing"]

        print(f"✅ {total} spot(s) trouvé(s) - Affichage des {showing} meilleurs\n")

        # Trier par para-index décroissant
        spots_sorted = sorted(
            spots, key=lambda x: x.get("weather", {}).get("para_index", -1), reverse=True
        )

        # Afficher chaque spot
        for i, spot in enumerate(spots_sorted, 1):
            print_spot_weather(spot, i)

        # Résumé final
        print(f"\n{'='*80}")
        print("🎯 RÉSUMÉ")
        print(f"{'='*80}")

        best_spot = spots_sorted[0] if spots_sorted else None
        if best_spot:
            weather = best_spot.get("weather", {})
            para_index = weather.get("para_index", 0)
            verdict = weather.get("verdict", "INCONNU")

            print(f"\n🏆 Meilleur spot: {best_spot['name']}")
            print(f"   Para-Index: {para_index}/100 - {print_verdict_emoji(verdict)}")
            print(f"   Distance: {best_spot['distance_km']} km")

            if para_index >= 70:
                print("\n✈️  GO ! Conditions excellentes !")
            elif para_index >= 50:
                print("\n👍 Conditions correctes, vol possible")
            elif para_index >= 30:
                print("\n⚠️  Conditions limites, sois prudent")
            else:
                print("\n🛑 Conditions mauvaises, reste au sol")

        # Commande pour météo détaillée
        if best_spot:
            print("\n💡 Pour météo détaillée du meilleur spot:")
            print(
                f"   curl \"http://localhost:8001/api/spots/weather/{best_spot['id']}?days=3\" | python -m json.tool"
            )

    except requests.RequestException as e:
        print(f"❌ Erreur de connexion: {e}")


def show_help():
    """Affiche l'aide"""
    print("""
🪂 Trouve les Meilleurs Spots Volables Aujourd'hui
===================================================

Usage:
  python find_flyable_spots.py --city VILLE [--radius RAYON] [--type TYPE] [--limit N]
  python find_flyable_spots.py --gps LAT LON [--radius RAYON] [--type TYPE] [--limit N]

Options:
  --city VILLE         Nom de la ville (ex: Besançon, Annecy)
  --gps LAT LON        Coordonnées GPS (ex: 47.1944 5.9896)
  --radius RAYON       Rayon de recherche en km (défaut: 50)
  --type TYPE          Type de spot: "takeoff" ou "landing"
  --limit N            Nombre de spots à afficher (défaut: 5, max: 10)
  --help               Afficher cette aide

Exemples:
  # Meilleurs spots près de Besançon
  python find_flyable_spots.py --city Besançon

  # Top 3 décollages dans 30km
  python find_flyable_spots.py --city Besançon --radius 30 --type takeoff --limit 3

  # Par coordonnées GPS
  python find_flyable_spots.py --gps 47.1944 5.9896 --radius 20

Ce que tu obtiens:
  ✅ Spots triés par conditions (Para-Index)
  ✅ Météo complète pour chaque spot
  ✅ Créneaux horaires volables
  ✅ Verdict clair (BON/MOYEN/MAUVAIS)
  ✅ Distance depuis ta position
""")


def main():
    """Point d'entrée principal"""
    args = sys.argv[1:]

    if not args or "--help" in args:
        show_help()
        return

    # Paramètres
    radius_km = 50
    spot_type = None
    limit = 5

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

    if "--limit" in args:
        try:
            idx = args.index("--limit")
            limit = int(args[idx + 1])
            if limit < 1 or limit > 10:
                print("❌ Limite doit être entre 1 et 10")
                return
        except (IndexError, ValueError):
            print("❌ Usage: --limit N")
            return

    # Recherche par ville
    if "--city" in args:
        try:
            idx = args.index("--city")
            city = args[idx + 1]
            find_flyable_spots(city=city, radius_km=radius_km, spot_type=spot_type, limit=limit)
        except (IndexError, ValueError):
            print("❌ Usage: --city NOM_VILLE")
        return

    # Recherche par GPS
    if "--gps" in args:
        try:
            idx = args.index("--gps")
            lat = float(args[idx + 1])
            lon = float(args[idx + 2])
            find_flyable_spots(
                lat=lat, lon=lon, radius_km=radius_km, spot_type=spot_type, limit=limit
            )
        except (IndexError, ValueError):
            print("❌ Usage: --gps LATITUDE LONGITUDE")
        return

    print("❌ Option non reconnue. Utilise --help pour voir les options disponibles.")


if __name__ == "__main__":
    main()
