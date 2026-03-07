# 🌡️ Guide de Déploiement - Analyse Émagramme IA

Ce guide explique comment déployer et utiliser le système d'analyse thermique par IA.

---

## 📋 Vue d'Ensemble

Le système d'analyse d'émagramme fournit des prévisions thermiques automatiques pour le parapente en utilisant:

- **Données réelles**: Radiosondages de 5 stations françaises (Wyoming University)
- **IA Vision**: Claude 3.5 Sonnet analyse les diagrammes Skew-T
- **Calculs classiques**: Fallback automatique avec CAPE, LCL, indices de stabilité
- **Automatisation**: 2 analyses/jour (6h15 et 14h15) pour 5 régions
- **Coût**: ~$0.30/mois ($0.003 par analyse)

---

## 🔧 Installation

### 1. Installer les Dépendances Python

Les nouvelles dépendances sont déjà dans `requirements.txt`:

```bash
cd backend
pip install -r requirements.txt
```

**Nouvelles dépendances:**
- `metpy==1.6.3` - Calculs météorologiques
- `matplotlib==3.9.4` - Génération de diagrammes
- `numpy==2.2.3` - Calculs numériques
- `pillow==11.1.0` - Traitement d'images
- `anthropic==0.42.0` - API Claude

### 2. Configurer la Clé API Anthropic

Obtenir une clé: https://console.anthropic.com/

```bash
# Option 1: Variable d'environnement
export ANTHROPIC_API_KEY="sk-ant-api03-..."

# Option 2: Fichier .env
echo 'ANTHROPIC_API_KEY="sk-ant-api03-..."' >> backend/.env

# Option 3: Docker Compose
# Ajouter dans docker-compose.yml:
services:
  backend:
    environment:
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
```

### 3. Exécuter la Migration

La migration se lance automatiquement au démarrage Docker:

```bash
docker compose up -d
```

Ou manuellement:

```bash
cd backend
python migrations/add_emagram_analysis.py
```

### 4. Valider l'Installation

```bash
cd backend
python validate_emagram.py
```

Devrait afficher:
```
✅ EMAGRAM SYSTEM VALIDATION COMPLETE
```

---

## 🚀 Utilisation

### API Endpoints

#### 1. Obtenir la Dernière Analyse

```bash
GET /api/emagram/latest?user_lat=45.76&user_lon=4.84
```

**Réponse:** Objet `EmagramAnalysis` ou `null`

**Exemple curl:**
```bash
curl "http://localhost:8001/api/emagram/latest?user_lat=45.76&user_lon=4.84&max_distance_km=200"
```

#### 2. Obtenir l'Historique

```bash
GET /api/emagram/history?user_lat=45.76&user_lon=4.84&days=7
```

**Réponse:** Array de `EmagramAnalysisListItem`

#### 3. Lancer une Analyse Manuelle

```bash
POST /api/emagram/analyze
Content-Type: application/json

{
  "user_latitude": 45.76,
  "user_longitude": 4.84,
  "force_refresh": false
}
```

**Réponse:** Objet `EmagramAnalysis` complet

**Exemple curl:**
```bash
curl -X POST http://localhost:8001/api/emagram/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "user_latitude": 45.76,
    "user_longitude": 4.84,
    "force_refresh": true
  }'
```

**Note:** La première analyse peut prendre 30-60 secondes (téléchargement sondage + génération diagramme + analyse IA).

---

## ⏰ Analyses Automatiques

### Planning

Le système lance automatiquement des analyses:

- **Matin: 6h15** (heure Paris) - Utilise le sondage 00Z (nuit)
- **Après-midi: 14h15** (heure Paris) - Utilise le sondage 12Z (midi)

### Emplacements Par Défaut

5 emplacements sont analysés automatiquement:

| Ville      | Coordonnées       | Station Radiosonde |
|-----------|-------------------|-------------------|
| Lyon      | 45.76, 4.84       | Lyon-Bron (07481) |
| Paris     | 48.85, 2.35       | Trappes (07145)   |
| Toulouse  | 43.60, 1.44       | Nîmes (07645)     |
| Nice      | 43.70, 7.27       | Nîmes (07645)     |
| Bordeaux  | 44.84, -0.58      | Bordeaux (07510)  |

### Personnaliser les Emplacements

Modifier `backend/scheduler/emagram_scheduler.py`:

```python
DEFAULT_LOCATIONS = [
    (45.76, 4.84, "Lyon"),
    (votre_lat, votre_lon, "Votre Site"),
    # Ajouter d'autres emplacements...
]
```

### Désactiver les Analyses Auto

Commenter dans `backend/main.py`:

```python
# from scheduler.emagram_scheduler import setup_emagram_scheduler, start_scheduler as start_emagram
# emagram_scheduler = setup_emagram_scheduler(app)
# start_emagram(emagram_scheduler)
```

---

## 📊 Stations Radiosonde Disponibles

| Code  | Nom           | Région             | Coordonnées      |
|-------|---------------|--------------------|------------------|
| 07481 | Lyon-Bron     | Rhône-Alpes        | 45.73°N, 5.08°E  |
| 07145 | Trappes       | Île-de-France      | 48.77°N, 2.01°E  |
| 07510 | Bordeaux      | Nouvelle-Aquitaine | 44.83°N, -0.69°E |
| 07645 | Nîmes         | Occitanie          | 43.86°N, 4.40°E  |
| 07761 | Ajaccio       | Corse              | 41.92°N, 8.80°E  |

Le système sélectionne automatiquement la station la plus proche (rayon max: 200km).

---

## 💰 Coûts et Limites

### Claude 3.5 Sonnet Pricing

- **Input:** $3.00 / million tokens (~1000 tokens par image)
- **Output:** $15.00 / million tokens (~500 tokens par réponse)
- **Coût par analyse:** ~$0.003 (0.3 centimes)

### Coût Mensuel Estimé

**Configuration par défaut:**
- 5 emplacements × 2 analyses/jour × 30 jours = 300 analyses/mois
- **Total: ~$0.90/mois** (moins d'1€)

**Mode analyse uniquement manuelle:** Gratuit (utilise calculs classiques)

### Fallback Automatique

Si l'API Claude échoue ou n'est pas configurée:
- Le système utilise automatiquement les **calculs météo classiques**
- CAPE, LCL, LFC, indices de stabilité
- Pas de résumé IA, mais données brutes précises
- **Coût: $0**

---

## 🧪 Tests et Debugging

### Logs

Vérifier les logs du scheduler:

```bash
docker compose logs -f backend | grep emagram
```

Devrait afficher:
```
📅 Emagram scheduler configured
🌡️ Starting scheduled emagram analysis...
✅ Lyon: Score 75/100
```

### Test Manuel Complet

```bash
# 1. Test de la station la plus proche
python -c "
from scrapers.wyoming import find_closest_station
print(find_closest_station(45.76, 4.84))
"

# 2. Test du scraper Wyoming (async)
python -c "
import asyncio
from scrapers.wyoming import fetch_closest_sounding

async def test():
    result = await fetch_closest_sounding(45.76, 4.84, '12')
    print('Success:', result.get('success'))
    print('Station:', result.get('station_name'))
    print('Levels:', len(result.get('data', {}).get('pressure_hpa', [])))

asyncio.run(test())
"

# 3. Test de l'endpoint API
curl -X POST http://localhost:8001/api/emagram/analyze \
  -H "Content-Type: application/json" \
  -d '{"user_latitude": 45.76, "user_longitude": 4.84}'
```

### Erreurs Courantes

**"No module named 'anthropic'"**
```bash
pip install anthropic==0.42.0
```

**"Anthropic API key not configured"**
```bash
export ANTHROPIC_API_KEY="sk-ant-..."
```

**"No sounding data available"**
- Vérifier l'heure: les sondages 00Z et 12Z ne sont disponibles que quelques heures après
- Essayer l'autre horaire (00Z si vous testez le matin, 12Z l'après-midi)

**"Failed to generate Skew-T diagram"**
```bash
pip install metpy matplotlib numpy pillow
```

---

## 📱 Interface Frontend

Le widget apparaît automatiquement sur le Dashboard:

**Affiche:**
- Score de volabilité (0-100) avec jauge circulaire
- Plafond thermique (m)
- Force des thermiques (m/s)
- Heures volables (début - fin)
- Stabilité atmosphérique
- Résumé IA des conditions
- Conseils de vol
- Alertes de sécurité

**Actions:**
- 🔄 Bouton "Actualiser" pour lancer une nouvelle analyse
- Auto-refresh toutes les 10 minutes

---

## 🔄 Workflow Complet

1. **Scheduler déclenche** (6h15 ou 14h15)
2. **Scraper Wyoming** télécharge radiosondage le plus proche
3. **MetPy génère** diagramme Skew-T (PNG)
4. **Claude Vision analyse** l'image
5. **Fallback classique** si Claude échoue
6. **Sauvegarde DB** avec toutes les métadonnées
7. **Frontend affiche** via React Query (auto-refresh)

---

## 🎯 Prochaines Étapes Suggérées

### Court Terme (1-2 semaines)
- [ ] Tester en production avec vraies données
- [ ] Ajuster le prompt Claude si nécessaire
- [ ] Monitorer les coûts API réels
- [ ] Ajouter des tests unitaires

### Moyen Terme (1 mois)
- [ ] Créer une page dédiée "Analyse Thermique" avec historique
- [ ] Afficher les diagrammes Skew-T générés
- [ ] Notifications Telegram pour conditions exceptionnelles
- [ ] Export CSV des analyses

### Long Terme (3+ mois)
- [ ] Machine Learning sur historique pour améliorer prédictions
- [ ] Comparaison IA vs réalité (feedback pilotes)
- [ ] Support d'autres pays (stations européennes)
- [ ] API publique pour autres applications

---

## 📚 Ressources

**Documentation:**
- Wyoming University: http://weather.uwyo.edu/upperair/sounding.html
- MetPy: https://unidata.github.io/MetPy/
- Claude Vision API: https://docs.anthropic.com/claude/docs/vision

**Support:**
- GitHub Issues
- Discord parapente

---

**Développé avec ❤️ pour la communauté parapente française**
