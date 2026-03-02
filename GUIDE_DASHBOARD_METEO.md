# 🪂 Guide Complet - Dashboard Météo + Spots

## 🎯 Ce Que Tu Peux Faire Maintenant

Tu as **2 systèmes puissants** intégrés ensemble :

1. **Recherche de spots** (3,594 spots en France)
2. **Météo multi-sources** (5 sources + Para-Index)

**→ Résultat : Tu peux trouver ET évaluer n'importe quel spot en France ! 🚀**

---

## 🌟 Nouveau : Spots + Météo en 1 Commande !

### Option 1 : Script "Où Voler Aujourd'hui ?"

```bash
cd backend

# Trouve les 3 meilleurs spots près de Besançon AVEC leur météo
python find_flyable_spots.py --city Besançon --limit 3

# Décollages uniquement dans 30km
python find_flyable_spots.py --city Besançon --radius 30 --type takeoff --limit 5

# Par GPS
python find_flyable_spots.py --gps 47.1944 5.9896 --radius 20 --limit 3
```

**Ce que tu obtiens :**
```
✅ 7 spot(s) trouvé(s) - Affichage des 3 meilleurs

#1 - DÉCOLLAGE LA MALTOURNÉE NORD (TAKEOFF)
📍 Distance:     0.01 km
🗺️  GPS:          47.194454, 5.989641
⛰️  Altitude:     462m
🧭 Orientation:  NNW
⭐ Note:         ⭐⭐⭐ (3/6)

🌤️  MÉTÉO D'AUJOURD'HUI
Para-Index:   25/100 - 🔴 MAUVAIS
⏰ Aucun créneau volable aujourd'hui
☀️  Lever: 07:15 | Coucher: 18:20

🎯 RÉSUMÉ
🏆 Meilleur spot: DÉCOLLAGE LA MALTOURNÉE NORD
   Para-Index: 25/100 - 🔴 MAUVAIS
🛑 Conditions mauvaises, reste au sol
```

---

## 📡 API Endpoints Disponibles

### 1. Rechercher des spots SANS météo (rapide)

```bash
# Par ville
curl "http://localhost:8001/api/spots/search?city=Besançon&radius_km=50"

# Par GPS
curl "http://localhost:8001/api/spots/search?lat=47.24&lon=6.02&radius_km=30&type=takeoff"
```

### 2. Météo pour UN spot spécifique

```bash
# Météo complète sur 3 jours pour un spot
curl "http://localhost:8001/api/spots/weather/merged_884e0213d9116315?days=3"
```

### 3. Rechercher spots AVEC météo (complet) ⭐ NOUVEAU

```bash
# Top 5 spots avec leur météo
curl "http://localhost:8001/api/spots/search-with-weather?city=Besançon&limit=5"

# Décollages uniquement avec météo
curl "http://localhost:8001/api/spots/search-with-weather?lat=47.24&lon=6.02&radius_km=30&type=takeoff&limit=3"
```

**Réponse JSON :**
```json
{
  "total_spots_found": 56,
  "showing": 5,
  "spots_with_weather": [
    {
      "id": "merged_884e0213d9116315",
      "name": "DÉCOLLAGE LA MALTOURNÉE NORD",
      "type": "takeoff",
      "distance_km": 5.51,
      "latitude": 47.194454,
      "longitude": 5.989641,
      "elevation_m": 462,
      "orientation": "NNW",
      "rating": 3,
      "weather": {
        "para_index": 25,
        "verdict": "MAUVAIS",
        "reasons": [...],
        "flyable_slots": [],
        "sunrise": "07:15",
        "sunset": "18:20"
      }
    }
  ]
}
```

---

## 🎯 Cas d'Usage

### Cas 1 : "Je veux voler demain, où aller ?"

```bash
# Trouve les meilleurs spots avec météo
python find_flyable_spots.py --city Besançon --limit 10
```

**Résultat :** Liste triée par Para-Index (meilleurs en premier) avec verdict clair

### Cas 2 : "Météo détaillée pour Arguel ?"

```bash
# Option A : Si tu connais l'ID du spot
curl "http://localhost:8001/api/spots/weather/merged_884e0213d9116315?days=3" | python -m json.tool

# Option B : Cherche d'abord le spot
python search_spots.py --gps 47.1944 5.9896 --radius 1
# → Copie l'ID
# → Utilise l'API météo
```

### Cas 3 : "Découvrir de nouveaux spots"

```bash
# Étape 1 : Cherche les spots (rapide)
python search_spots.py --city Annecy --radius 50 --type takeoff

# Étape 2 : Météo pour un spot qui t'intéresse
curl "http://localhost:8001/api/spots/weather/SPOT_ID"
```

### Cas 4 : "Conditions actuelles partout"

```bash
# Top 10 spots avec météo dans 100km
python find_flyable_spots.py --city Besançon --radius 100 --limit 10
```

---

## 🔄 Workflow Complet

### Matin : Planifier la Journée

```bash
# 1. Voir les conditions générales autour de Besançon
python find_flyable_spots.py --city Besançon --limit 5

# 2. Si bon Para-Index, récupérer météo détaillée
curl "http://localhost:8001/api/spots/weather/SPOT_ID?days=1" > meteo_spot.json

# 3. Vérifier créneaux horaires et lever/coucher soleil
cat meteo_spot.json | python -m json.tool | grep -E "flyable_slots|sunrise|sunset"
```

### Sur Place : Vérification Dernière Minute

```bash
# Météo actuelle pour le spot
curl "http://localhost:8001/api/spots/weather/merged_884e0213d9116315" | python -m json.tool

# Chercher atterrissages de secours
python search_spots.py --gps 47.1944 5.9896 --radius 10 --type landing
```

---

## 📊 Comprendre les Données

### Para-Index
- **70-100** : 🟢 EXCELLENT - Go !
- **50-69** : 🟢 BON - Conditions idéales
- **30-49** : 🟡 MOYEN - Volable avec prudence
- **15-29** : 🟠 LIMITE - Pilotes confirmés seulement
- **0-14** : 🔴 MAUVAIS - Reste au sol

### Verdict
- **EXCELLENT** : Jackpot ! Conditions rêvées
- **BON** : Très bonnes conditions
- **MOYEN** : Conditions acceptables
- **LIMITE** : Seulement si expérimenté
- **MAUVAIS** : Vol déconseillé
- **DANGEREUX** : Interdiction de vol

### Orientation
- **N, NE, E, SE, S, SW, W, NW** : Direction du vent favorable
- Compare avec la météo du jour pour savoir si le spot est adapté

---

## 🛠️ Scripts Disponibles

### `search_spots.py` - Recherche Simple
```bash
# Trouve des spots (SANS météo - ultra rapide)
python search_spots.py --city Besançon
python search_spots.py --gps 47.1944 5.9896 --radius 10
python search_spots.py --detail merged_884e0213d9116315
```

### `find_flyable_spots.py` - Recherche + Météo ⭐
```bash
# Trouve les meilleurs spots AVEC météo (plus lent mais complet)
python find_flyable_spots.py --city Besançon --limit 5
python find_flyable_spots.py --gps 47.24 6.02 --radius 30 --type takeoff
```

---

## 🌐 Intégration Frontend (À Venir)

### Vue.js / React Example

```javascript
// Recherche spots avec météo
const response = await fetch(
  'http://localhost:8001/api/spots/search-with-weather?city=Besançon&limit=5'
);
const data = await response.json();

// Afficher sur une carte
data.spots_with_weather.forEach(spot => {
  const marker = {
    lat: spot.latitude,
    lon: spot.longitude,
    name: spot.name,
    paraIndex: spot.weather.para_index,
    verdict: spot.weather.verdict,
    color: spot.weather.para_index >= 50 ? 'green' : 'red'
  };
  
  map.addMarker(marker);
});
```

### Carte Interactive Idéale

```
┌─────────────────────────────────────────────────┐
│  🗺️  Carte de France                            │
│                                                  │
│  🟢 Spot A (Para-Index: 75)                     │
│  🟢 Spot B (Para-Index: 62)                     │
│  🟡 Spot C (Para-Index: 45)                     │
│  🔴 Spot D (Para-Index: 18)                     │
│                                                  │
│  [Filtres]                                       │
│  ☐ Décollages  ☐ Atterrissages                 │
│  Rayon: [50km] ▼                                │
│  Para-Index min: [30] ────────                  │
└─────────────────────────────────────────────────┘
```

---

## 🔧 Configuration

### Synchroniser les Données

```bash
# Sync spots (tous les 7 jours automatiquement)
curl -X POST "http://localhost:8001/api/spots/sync"

# Force sync
curl -X POST "http://localhost:8001/api/spots/sync?force=true"
```

### Lier Tes Sites Personnels

```bash
# Améliore Arguel, Mont Poupet, La Côte avec données précises
curl -X POST "http://localhost:8001/api/admin/sites/link-to-spots"
```

---

## 📈 Performance

### Temps de Réponse

| Opération | Temps |
|-----------|-------|
| Recherche spots seuls | <100ms |
| Météo 1 spot (1 jour) | ~2s |
| Météo 1 spot (3 jours) | ~5s |
| Recherche + météo (5 spots) | ~10s |
| Sync complète (3,594 spots) | ~30s |

### Optimisations

- **Bounding box** : Filtre rapide avant haversine
- **Parallel fetching** : Météo de tous les spots en parallèle
- **Geocoding cache** : Villes cachées 7 jours
- **Database indexes** : Lat/lon indexés

---

## 💡 Astuces Pro

### 1. Export des Résultats

```bash
# Sauvegarde météo de plusieurs jours
curl "http://localhost:8001/api/spots/weather/SPOT_ID?days=7" > meteo_semaine.json

# Liste spots en CSV (à faire manuellement)
python search_spots.py --city Besançon > spots.txt
```

### 2. Comparaison de Spots

```bash
# Compare 3 spots différents
for id in merged_884e0213d9116315 pgs_4732 openaip_xyz; do
  echo "=== Spot $id ==="
  curl -s "http://localhost:8001/api/spots/weather/$id" | python -m json.tool | grep para_index
done
```

### 3. Alertes Conditions Favorables

```bash
# Cron job journalier (à 7h du matin)
0 7 * * * cd /path/to/backend && python find_flyable_spots.py --city Besançon --limit 3 | mail -s "Météo Parapente" ton@email.com
```

---

## 🆘 Problèmes Courants

### "Aucun créneau volable"
→ Para-Index trop bas. Conditions météo défavorables aujourd'hui.

### "Weather error"
→ Problème avec sources météo. Vérifie logs : `tail -f /tmp/server_output.log`

### "Spot not found"
→ ID invalide. Cherche d'abord le spot avec `search_spots.py`

### Réponses lentes
→ Normal pour météo multi-sources (5 sources × N spots). Réduis `--limit`.

---

## 📚 Documentation Complète

- **[COMMENT_UTILISER.md](COMMENT_UTILISER.md)** - Démarrage ultra-rapide
- **[README_SPOTS.md](README_SPOTS.md)** - Système de spots
- **[GUIDE_UTILISATION_SPOTS.md](GUIDE_UTILISATION_SPOTS.md)** - Recherche détaillée
- **[backend/SPOTS_SYSTEM_SUMMARY.md](backend/SPOTS_SYSTEM_SUMMARY.md)** - Architecture technique

---

## ✅ Checklist de Démarrage

- [x] Serveur démarré (`uvicorn main:app --port 8001`)
- [x] Base spots synchronisée (3,594 spots)
- [x] Sites liés (Arguel → La Maltournée Nord)
- [x] Test recherche simple (`search_spots.py`)
- [x] Test recherche + météo (`find_flyable_spots.py`)

---

## 🎉 Résumé

Tu as maintenant **LE** système ultime pour le parapente :

✅ **3,594 spots** en base de données  
✅ **Recherche géographique** (ville ou GPS)  
✅ **Météo multi-sources** (5 sources)  
✅ **Para-Index automatique** (score de volabilité)  
✅ **Intégration complète** (spots + météo)  
✅ **Scripts pratiques** (Python CLI)  
✅ **API REST** (pour frontend)  

**Une seule commande pour tout savoir :**

```bash
python find_flyable_spots.py --city Besançon
```

**→ Spots trouvés, météo analysée, verdict donné ! 🚀**

Bon vol ! ☀️🪂

---

*Dernière mise à jour: 1er mars 2026*
