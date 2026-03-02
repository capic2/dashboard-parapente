# 🪂 Utilisation Simple - Dashboard Météo Parapente

## ⚡ En 1 Commande

```bash
cd backend
python find_flyable_spots.py --city Besançon
```

**→ Trouve les meilleurs spots près de Besançon AVEC leur météo !**

---

## 🎯 Les 3 Commandes Essentielles

### 1️⃣ Où voler aujourd'hui ?

```bash
python find_flyable_spots.py --city TaVille --limit 5
```

**Résultat :** Top 5 spots triés par conditions météo

### 2️⃣ Chercher un spot précis

```bash
python search_spots.py --city TaVille --type takeoff
```

**Résultat :** Tous les décollages dans la zone

### 3️⃣ Météo détaillée d'un spot

```bash
curl "http://localhost:8001/api/spots/weather/SPOT_ID?days=3"
```

**Résultat :** Météo complète sur 3 jours

---

## 📖 Options Pratiques

### Par ville
```bash
python find_flyable_spots.py --city Besançon
```

### Par GPS
```bash
python find_flyable_spots.py --gps 47.1944 5.9896 --radius 20
```

### Décollages uniquement
```bash
python find_flyable_spots.py --city Annecy --type takeoff
```

### Top 3 seulement
```bash
python find_flyable_spots.py --city Besançon --limit 3
```

---

## 🌟 Ce Que Tu Obtiens

Pour chaque spot :
- ✅ **Nom et type** (décollage/atterrissage)
- ✅ **Distance** depuis ta position
- ✅ **GPS précis** et altitude
- ✅ **Orientation** du vent
- ✅ **Note** de qualité (⭐ à ⭐⭐⭐⭐⭐⭐)
- ✅ **Para-Index** (score météo 0-100)
- ✅ **Verdict** (BON/MOYEN/MAUVAIS)
- ✅ **Créneaux volables** (heures)
- ✅ **Lever/coucher** soleil

**Exemple de résultat :**
```
#1 - DÉCOLLAGE LA MALTOURNÉE NORD (TAKEOFF)
📍 Distance:     5.5 km
⛰️  Altitude:     462m
🧭 Orientation:  NNW
⭐ Note:         ⭐⭐⭐ (3/6)

🌤️  MÉTÉO D'AUJOURD'HUI
Para-Index:   75/100 - 🟢 BON
✈️  GO ! Conditions excellentes !
```

---

## 💡 Aide

### Voir toutes les options
```bash
python find_flyable_spots.py --help
```

### Problème ?
1. Vérifie que le serveur tourne : `ps aux | grep uvicorn`
2. Regarde les logs : `tail -f /tmp/server_output.log`
3. Redémarre si besoin : `cd backend && uvicorn main:app --port 8001`

---

## 📚 Documentation Complète

Pour aller plus loin :
- **[GUIDE_DASHBOARD_METEO.md](GUIDE_DASHBOARD_METEO.md)** - Guide complet
- **[README_SPOTS.md](README_SPOTS.md)** - Système de spots

---

**Base de données : 3,594 spots en France ! 🇫🇷**

**Météo de 5 sources agrégées ! ☀️**

Bon vol ! 🪂
