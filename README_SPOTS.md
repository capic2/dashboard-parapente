# 🪂 Système de Recherche de Spots de Parapente

## ✨ Ce qui a été fait

Un **système complet de recherche de spots de parapente** pour toute la France :

### 📊 Chiffres Clés
- ✅ **3,594 spots** en base de données
- ✅ **2 sources de données** intégrées (OpenAIP + ParaglidingSpots.com)
- ✅ **331 spots fusionnés** (meilleur des deux sources)
- ✅ **1,824 décollages** + **320 atterrissages**
- ✅ Recherche en **<100ms**

### 🎯 Fonctionnalités
1. **Recherche par ville** - "Trouve-moi des spots près de Besançon"
2. **Recherche par GPS** - Coordonnées précises
3. **Filtrage par type** - Décollages ou atterrissages
4. **Rayon personnalisable** - 10km, 30km, 50km, 100km...
5. **Données enrichies** - Altitude, orientation, notes, distance

---

## 🚀 Utilisation Rapide

### Via le script Python (recommandé)

```bash
cd backend

# Vérifier le statut
python search_spots.py --status

# Chercher des spots
python search_spots.py --city Besançon --radius 30 --type takeoff

# Chercher par GPS
python search_spots.py --gps 47.1944 5.9896 --radius 10

# Voir les détails
python search_spots.py --detail merged_884e0213d9116315
```

### Via l'API REST

```bash
# Recherche par ville
curl "http://localhost:8001/api/spots/search?city=Besançon&radius_km=50"

# Recherche par GPS
curl "http://localhost:8001/api/spots/search?lat=47.24&lon=6.02&radius_km=30&type=takeoff"

# Détails d'un spot
curl "http://localhost:8001/api/spots/detail/merged_884e0213d9116315"

# Statut
curl "http://localhost:8001/api/spots/status"
```

---

## 📖 Documentation

### Pour Utilisateurs
👉 **[GUIDE_UTILISATION_SPOTS.md](GUIDE_UTILISATION_SPOTS.md)** - Guide complet avec exemples

### Pour Développeurs
👉 **[backend/SPOTS_SYSTEM_SUMMARY.md](backend/SPOTS_SYSTEM_SUMMARY.md)** - Architecture technique

---

## 🗂️ Structure des Données

### Informations par Spot
```json
{
  "id": "merged_884e0213d9116315",
  "name": "DÉCOLLAGE LA MALTOURNÉE NORD",
  "type": "takeoff",
  "latitude": 47.1944542,
  "longitude": 5.9896408,
  "elevation_m": 462,
  "orientation": "NNW",
  "rating": 3,
  "country": "FR",
  "source": "merged",
  "distance_km": 0.01
}
```

### Types de Données
- **`type`**: `takeoff` (décollage), `landing` (atterrissage), `both`
- **`orientation`**: Direction du vent favorable (N, NE, E, SE, S, SW, W, NW)
- **`rating`**: Note de 0 à 6 (⭐ à ⭐⭐⭐⭐⭐⭐)
- **`source`**: `openaip`, `paraglidingspots`, ou `merged`

---

## 🛠️ Administration

### Synchroniser les Données

```bash
# Sync automatique tous les 7 jours
curl -X POST "http://localhost:8001/api/spots/sync"

# Forcer la sync
curl -X POST "http://localhost:8001/api/spots/sync?force=true"
```

### Lier les Sites Existants

```bash
# Met à jour Arguel, Mont Poupet, La Côte avec les données précises
curl -X POST "http://localhost:8001/api/admin/sites/link-to-spots"
```

**Résultat** :
- ✅ Arguel lié à "DÉCOLLAGE LA MALTOURNÉE NORD"
- ✅ Coordonnées mises à jour (47.1944, 5.9896)
- ✅ Altitude: 462m, Orientation: NNW, Note: 3/6

---

## 🎯 Exemples Concrets

### Exemple 1: Planifier une sortie depuis Besançon

```bash
# Étape 1: Voir tous les décollages dans 30km
python search_spots.py --city Besançon --radius 30 --type takeoff
```

**Résultat** : 13 décollages trouvés, triés par distance

```
1. TO (SW-S) FORT DE ROSEMONT - 2.63 km ⭐⭐
2. TO (NNW-W) MONTFAUCON - 4.36 km ⭐⭐⭐
3. DÉCOLLAGE LA MALTOURNÉE NORD - 5.51 km ⭐⭐⭐ (NNW)
```

```bash
# Étape 2: Voir les détails du spot qui t'intéresse
python search_spots.py --detail merged_884e0213d9116315
```

**Résultat** : Infos complètes avec GPS exact, altitude, orientation

### Exemple 2: Trouver un atterrissage d'urgence

```bash
# Position actuelle en vol (GPS)
python search_spots.py --gps 47.20 6.00 --radius 5 --type landing
```

**Résultat** : Tous les atterrissages dans 5km

```
1. ATTERRISSAGE DE PORT-DOUVOT - 0.8 km (Altitude: 235m)
2. ATTERRISSAGE DE LA MALCOMBE - 3.2 km (Altitude: 260m)
```

---

## 📊 Statistiques de la Base

```bash
python search_spots.py --status
```

```
Total de spots: 3594

Par source:
  - OpenAIP:          118
  - ParaglidingSpots: 3145
  - Fusionnés:        331

Par type:
  - Décollages:     1824
  - Atterrissages:   320

✅ Base de données prête !
```

---

## 🔍 Endpoints API Disponibles

| Endpoint | Méthode | Description |
|----------|---------|-------------|
| `/api/spots/search` | GET | Recherche par ville ou GPS |
| `/api/spots/detail/{id}` | GET | Détails complets d'un spot |
| `/api/spots/status` | GET | Statut et statistiques |
| `/api/spots/sync` | POST | Synchronisation des données |
| `/api/admin/sites/link-to-spots` | POST | Lier sites → spots |

### Paramètres de Recherche

| Paramètre | Type | Description | Exemple |
|-----------|------|-------------|---------|
| `city` | string | Nom de ville | `Besançon` |
| `lat` | float | Latitude | `47.1944` |
| `lon` | float | Longitude | `5.9896` |
| `radius_km` | int | Rayon (défaut: 50) | `30` |
| `type` | string | `takeoff` ou `landing` | `takeoff` |

---

## 🎨 Intégration Future

### Frontend Web (À Venir)
```javascript
// Exemple d'intégration React/Vue
fetch('http://localhost:8001/api/spots/search?city=Besançon&radius_km=50')
  .then(res => res.json())
  .then(data => {
    // Afficher les spots sur une carte
    displaySpotsOnMap(data.spots);
  });
```

### Carte Interactive
- Afficher les spots sur OpenStreetMap ou Google Maps
- Cliquer sur un spot → voir détails
- Filtrer en temps réel (type, rayon, orientation)

### Matching Météo
- Croiser orientation du spot avec vent prévu
- Suggérer les meilleurs spots du jour
- Alertes conditions favorables

---

## 📁 Fichiers Importants

```
dashboard-parapente/
├── README_SPOTS.md                    # Ce fichier
├── GUIDE_UTILISATION_SPOTS.md         # Guide utilisateur détaillé
│
├── backend/
│   ├── search_spots.py                # Script de recherche
│   ├── SPOTS_SYSTEM_SUMMARY.md        # Doc technique
│   │
│   ├── spots/                         # Module de recherche
│   │   ├── distance.py                # Calculs géographiques
│   │   ├── geocoding.py               # Ville → GPS
│   │   ├── data_fetcher.py            # Sync OpenAIP + PGS
│   │   ├── search.py                  # Moteur de recherche
│   │   └── site_updater.py            # Liaison sites
│   │
│   ├── db/
│   │   ├── dashboard.db               # Base SQLite (3594 spots)
│   │   └── migrations/
│   │       └── 001_add_paragliding_spots.sql
│   │
│   └── routes.py                      # API endpoints
```

---

## 🆘 Problèmes Courants

### La ville n'est pas trouvée
```bash
# Solution 1: Essaye une ville plus grande
python search_spots.py --city Besançon  # au lieu d'Arguel

# Solution 2: Utilise les coordonnées GPS
python search_spots.py --gps 47.1944 5.9896
```

### Aucun spot trouvé
```bash
# Augmente le rayon de recherche
python search_spots.py --city Besançon --radius 100
```

### Le serveur ne répond pas
```bash
# Vérifie qu'il tourne
ps aux | grep uvicorn

# Redémarre si besoin
cd backend
source venv/bin/activate
uvicorn main:app --host 0.0.0.0 --port 8001 --reload
```

---

## 🎯 Cas d'Usage Réels

### 1. Découverte de Nouveaux Spots
"Je veux découvrir tous les bons spots autour de Besançon"

```bash
python search_spots.py --city Besançon --radius 50
# → 59 spots trouvés, triés par distance
# → Filtre ceux notés ⭐⭐⭐ ou plus
```

### 2. Planification de Cross
"Je veux faire un cross, quels atterrissages sur ma route ?"

```bash
# Point A
python search_spots.py --gps 47.19 5.99 --radius 10 --type landing

# Point B  
python search_spots.py --gps 47.35 6.15 --radius 10 --type landing
```

### 3. Vérification Météo
"Il y a du vent de NW, quels spots sont favorables ?"

```bash
python search_spots.py --city Besançon --radius 40
# → Regarde la colonne "Orientation"
# → Cherche NW, NNW, WNW
```

---

## 🚀 Prochaines Améliorations

### Court Terme
- [ ] Export CSV/JSON des résultats
- [ ] Sauvegarde des favoris
- [ ] Historique des recherches

### Moyen Terme
- [ ] Interface web avec carte
- [ ] Intégration météo en direct
- [ ] Suggestions intelligentes (vent + spot)

### Long Terme
- [ ] App mobile
- [ ] Photos des spots
- [ ] Commentaires communautaires
- [ ] Conditions en temps réel

---

## 📞 Support & Contribution

### Questions
1. Consulte [GUIDE_UTILISATION_SPOTS.md](GUIDE_UTILISATION_SPOTS.md)
2. Regarde [backend/SPOTS_SYSTEM_SUMMARY.md](backend/SPOTS_SYSTEM_SUMMARY.md)
3. Check les logs: `tail -f /tmp/server_output.log`

### Rapporter un Bug
Décris :
- Ce que tu voulais faire
- La commande utilisée
- L'erreur obtenue
- Les logs du serveur

---

## ✅ Checklist de Démarrage

- [ ] Serveur démarré (`uvicorn main:app`)
- [ ] Base synchronisée (`python search_spots.py --status`)
- [ ] Test de recherche (`python search_spots.py --city Besançon`)
- [ ] Sites liés (`curl -X POST .../admin/sites/link-to-spots`)

---

## 🎉 Résumé

Tu as maintenant accès à :

✅ **3,594 spots** de parapente en France  
✅ **Recherche rapide** par ville ou GPS  
✅ **Données riches** (altitude, orientation, notes)  
✅ **Script pratique** (`search_spots.py`)  
✅ **API REST** pour intégration  
✅ **Documentation complète**  

**Bon vol ! 🪂☀️**

---

*Dernière mise à jour: 1er mars 2026*
