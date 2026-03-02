# 🪂 Guide d'Utilisation - Système de Recherche de Spots de Parapente

## 📋 Qu'est-ce que c'est ?

Un système complet pour **trouver des spots de parapente** en France avec :
- **3,594 spots** (décollages et atterrissages)
- Recherche par **ville** ou **coordonnées GPS**
- Données provenant de **OpenAIP** et **ParaglidingSpots.com**
- Informations détaillées : altitude, orientation, notes, distance

---

## 🚀 Démarrage Rapide

### 1️⃣ Vérifier que tout fonctionne

```bash
cd backend
python search_spots.py --status
```

**Résultat attendu :**
```
✅ Base de données prête !
Total de spots: 3594
```

### 2️⃣ Chercher des spots près d'une ville

```bash
# Chercher tous les spots dans 50km autour de Besançon
python search_spots.py --city Besançon

# Chercher seulement les décollages dans 30km
python search_spots.py --city Besançon --radius 30 --type takeoff

# Chercher seulement les atterrissages
python search_spots.py --city Annecy --radius 20 --type landing
```

### 3️⃣ Chercher par coordonnées GPS

```bash
# Si tu connais déjà les coordonnées (latitude, longitude)
python search_spots.py --gps 47.1944 5.9896 --radius 10
```

### 4️⃣ Voir les détails d'un spot

```bash
# Utilise l'ID du spot (affiché dans les résultats de recherche)
python search_spots.py --detail merged_884e0213d9116315
```

---

## 📖 Exemples Concrets

### Exemple 1 : Trouver un décollage près de Besançon

```bash
python search_spots.py --city Besançon --radius 30 --type takeoff
```

**Résultat :**
```
✅ 13 spot(s) trouvé(s)

1. TO (SW-S) FORT DE ROSEMONT (takeoff) - 2.63 km
   Note: ⭐⭐ (2/6)

2. TO (NNW-W) MONTFAUCON (takeoff) - 4.36 km
   Note: ⭐⭐⭐ (3/6)

3. DÉCOLLAGE LA MALTOURNÉE NORD (takeoff) - 5.51 km
   Orientation: NNW
   Note: ⭐⭐⭐ (3/6)
```

### Exemple 2 : Spots autour d'Arguel (coordonnées précises)

```bash
python search_spots.py --gps 47.1944 5.9896 --radius 10
```

**Résultat :**
```
✅ 10 spot(s) trouvé(s)

1. DÉCOLLAGE LA MALTOURNÉE NORD (takeoff) - 0.01 km
   Altitude: 462m
   Orientation: NNW

2. ATTERRISSAGE DE PORT-DOUVOT (landing) - 0.76 km
   Altitude: 235m
```

### Exemple 3 : Détails complets d'un spot

```bash
python search_spots.py --detail merged_884e0213d9116315
```

**Résultat :**
```
📍 DÉCOLLAGE LA MALTOURNÉE NORD
Type:        TAKEOFF
Coordonnées: 47.194454, 5.989641
Altitude:    462m
Orientation: NNW
Note:        ⭐⭐⭐ (3/6)
Source:      merged
```

---

## 🌐 Utilisation via l'API REST

Si tu veux intégrer dans ton frontend ou faire des requêtes depuis d'autres outils :

### Recherche par ville
```bash
curl "http://localhost:8001/api/spots/search?city=Besançon&radius_km=50" | python -m json.tool
```

### Recherche par coordonnées
```bash
curl "http://localhost:8001/api/spots/search?lat=47.24&lon=6.02&radius_km=30&type=takeoff" | python -m json.tool
```

### Détails d'un spot
```bash
curl "http://localhost:8001/api/spots/detail/merged_884e0213d9116315" | python -m json.tool
```

### Statut de la base
```bash
curl "http://localhost:8001/api/spots/status" | python -m json.tool
```

---

## 🔧 Commandes Avancées

### Synchroniser les données (mise à jour)

Si tu veux rafraîchir les données depuis OpenAIP et ParaglidingSpots :

```bash
curl -X POST "http://localhost:8001/api/spots/sync"
```

**Note :** La synchronisation est automatique tous les 7 jours. Utilise `?force=true` pour forcer :

```bash
curl -X POST "http://localhost:8001/api/spots/sync?force=true"
```

### Lier tes sites existants aux spots

Pour améliorer tes sites avec les données précises des spots externes :

```bash
curl -X POST "http://localhost:8001/api/admin/sites/link-to-spots"
```

**Effet :** Met à jour Arguel, Mont Poupet, La Côte avec :
- Coordonnées GPS précises
- Altitude exacte
- Orientation du vent
- Note de qualité

---

## 📊 Comprendre les Résultats

### Types de spots
- **`takeoff`** : Décollage
- **`landing`** : Atterrissage  
- **`both`** : Peut servir pour les deux

### Orientation
- **N, NE, E, SE, S, SW, W, NW** : Direction du vent favorable
- Exemple : **NNW** = Nord-Nord-Ouest

### Notes (ratings)
- **⭐** à **⭐⭐⭐⭐⭐⭐** (0 à 6)
- Plus il y a d'étoiles, meilleur est le spot
- `-1` = pas de note disponible

### Sources
- **`openaip`** : Données uniquement d'OpenAIP (GPS précis, altitude)
- **`paraglidingspots`** : Données uniquement de ParaglidingSpots (orientation, notes)
- **`merged`** : Combinaison des deux sources (le meilleur des deux !)

---

## 💡 Astuces

### 1. Chercher un spot précis
Si tu connais le nom d'un spot (ex: "La Maltournée"), utilise la recherche par ville + rayon large, puis lis les résultats.

### 2. Trouver des spots pour une session
```bash
# Cherche des décollages orientés NW dans 50km de ta position
python search_spots.py --gps 47.24 6.02 --radius 50 --type takeoff
# Puis filtre visuellement par orientation dans les résultats
```

### 3. Exporter les résultats
```bash
# Sauvegarde les résultats dans un fichier
python search_spots.py --city Besançon > mes_spots.txt
```

### 4. Intégration dans ton code Python
```python
import requests

response = requests.get(
    "http://localhost:8001/api/spots/search",
    params={
        "city": "Besançon",
        "radius_km": 30,
        "type": "takeoff"
    }
)

spots = response.json()['spots']

for spot in spots:
    print(f"{spot['name']} - {spot['distance_km']}km")
    if spot.get('orientation'):
        print(f"  Orientation: {spot['orientation']}")
```

---

## 🗺️ Cas d'Usage Typiques

### Planifier une sortie
1. Cherche les décollages dans 30km de ta position
2. Filtre par orientation selon la météo du jour
3. Vérifie l'altitude et les notes
4. Récupère les coordonnées GPS pour ton GPS/smartphone

### Découvrir de nouveaux spots
1. Cherche dans un rayon large (50-100km)
2. Regarde les spots bien notés (⭐⭐⭐ ou plus)
3. Note les coordonnées pour une future exploration

### Vérifier un spot avant d'y aller
1. Utilise `--detail SPOT_ID` pour avoir toutes les infos
2. Vérifie l'altitude, l'orientation, la source des données
3. Compare avec plusieurs sources si disponible (merged)

---

## 🆘 Dépannage

### "City not found"
La ville n'est pas dans la base OpenStreetMap. Solutions :
- Essaye une ville plus grande à proximité
- Utilise directement les coordonnées GPS (`--gps`)

### "No spots found"
Aucun spot dans le rayon de recherche. Solutions :
- Augmente le rayon : `--radius 100`
- Vérifie que la base est synchronisée : `--status`

### "Connection error"
Le serveur ne répond pas. Solutions :
```bash
# Vérifie que le serveur tourne
ps aux | grep uvicorn

# Redémarre le serveur si besoin
cd backend
source venv/bin/activate
uvicorn main:app --host 0.0.0.0 --port 8001 --reload
```

---

## 📚 Référence Complète

### Options du script

| Option | Description | Exemple |
|--------|-------------|---------|
| `--city VILLE` | Nom de la ville | `--city Besançon` |
| `--gps LAT LON` | Coordonnées GPS | `--gps 47.1944 5.9896` |
| `--radius RAYON` | Rayon en km (défaut: 50) | `--radius 30` |
| `--type TYPE` | `takeoff` ou `landing` | `--type takeoff` |
| `--detail ID` | Détails d'un spot | `--detail merged_...` |
| `--status` | Statut de la base | `--status` |
| `--help` | Aide | `--help` |

### Endpoints API

| Endpoint | Méthode | Description |
|----------|---------|-------------|
| `/api/spots/search` | GET | Recherche de spots |
| `/api/spots/detail/{id}` | GET | Détails d'un spot |
| `/api/spots/status` | GET | Statut de la base |
| `/api/spots/sync` | POST | Synchronisation |
| `/api/admin/sites/link-to-spots` | POST | Lier les sites |

---

## 🎯 Prochaines Étapes

1. **Frontend** : Interface web avec carte interactive
2. **Intégration météo** : Afficher les conditions par spot
3. **Matching vent** : Suggérer les meilleurs spots selon le vent prévu
4. **Favoris** : Sauvegarder tes spots préférés
5. **Photos** : Ajouter des photos de spots

---

## 📞 Support

Pour toute question ou problème :
1. Vérifie ce guide
2. Consulte `backend/SPOTS_SYSTEM_SUMMARY.md` pour les détails techniques
3. Regarde les logs du serveur : `tail -f /tmp/server_output.log`

---

## ✨ Résumé en Une Page

```bash
# 1. Vérifier le statut
python search_spots.py --status

# 2. Chercher près de Besançon (50km)
python search_spots.py --city Besançon

# 3. Décollages uniquement (30km)  
python search_spots.py --city Besançon --radius 30 --type takeoff

# 4. Par GPS (rayon 10km)
python search_spots.py --gps 47.1944 5.9896 --radius 10

# 5. Détails d'un spot
python search_spots.py --detail merged_884e0213d9116315
```

**Base de données : 3,594 spots en France ! 🇫🇷**

Bon vol ! 🪂☀️
