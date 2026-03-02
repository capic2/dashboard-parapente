# 🪂 Comment Utiliser le Système de Spots

## 🎯 En 3 Commandes

```bash
# 1. Aller dans le dossier backend
cd backend

# 2. Chercher des spots près de ta ville
python search_spots.py --city Besançon

# 3. Voir l'aide complète
python search_spots.py --help
```

**C'est tout ! 🎉**

---

## 📖 Exemples Rapides

### Chercher des décollages
```bash
python search_spots.py --city Besançon --type takeoff
```

### Chercher dans un rayon précis
```bash
python search_spots.py --city Besançon --radius 30
```

### Chercher par GPS
```bash
python search_spots.py --gps 47.1944 5.9896 --radius 10
```

### Voir les détails d'un spot
```bash
python search_spots.py --detail merged_884e0213d9116315
```

---

## 🗺️ Ce Que Tu Obtiens

Pour chaque spot :
- ✅ **Nom** du spot
- ✅ **Type** (décollage/atterrissage)
- ✅ **Distance** depuis ta position
- ✅ **Altitude** (si disponible)
- ✅ **Orientation** du vent (N, NE, SE, etc.)
- ✅ **Note** de qualité (⭐ à ⭐⭐⭐⭐⭐⭐)
- ✅ **Coordonnées GPS** précises

---

## 📚 Documentation Complète

- **Guide utilisateur détaillé** : [GUIDE_UTILISATION_SPOTS.md](GUIDE_UTILISATION_SPOTS.md)
- **Vue d'ensemble** : [README_SPOTS.md](README_SPOTS.md)
- **Documentation technique** : [backend/SPOTS_SYSTEM_SUMMARY.md](backend/SPOTS_SYSTEM_SUMMARY.md)

---

## 🎯 Cas d'Usage Typiques

### "Je veux voler demain, où aller ?"
```bash
python search_spots.py --city Besançon --radius 30 --type takeoff
```
→ Liste tous les décollages dans 30km, triés par distance

### "Je suis en vol, où puis-je atterrir ?"
```bash
python search_spots.py --gps 47.20 6.00 --radius 5 --type landing
```
→ Atterrissages dans 5km de ta position actuelle

### "Je veux découvrir de nouveaux spots"
```bash
python search_spots.py --city Besançon --radius 50
```
→ Tous les spots dans 50km, avec notes et orientations

---

## 🚀 Prêt à Décoller ?

```bash
cd backend
python search_spots.py --city Besançon
```

**Base de données : 3,594 spots en France ! 🇫🇷**

Bon vol ! ☀️🪂
