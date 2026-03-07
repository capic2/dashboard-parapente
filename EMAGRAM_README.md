# 🌡️ Système d'Analyse Thermique IA - Émagramme

## 🎯 Qu'est-ce que c'est ?

Un système d'analyse météorologique avancé qui utilise l'**intelligence artificielle** pour analyser des radiosondages réels et fournir des prévisions thermiques précises pour le parapente.

### ✨ Fonctionnalités Principales

- 🤖 **Analyse IA** - Claude 3.5 Sonnet analyse les diagrammes Skew-T
- 📊 **Calculs Classiques** - Fallback automatique avec CAPE, LCL, indices de stabilité
- ⏰ **Automatisation** - 2 analyses/jour (matin + après-midi) pour 5 régions françaises
- 🎯 **Score 0-100** - Évaluation globale de la "volabilité"
- 🌍 **5 Stations** - Couverture nationale (Lyon, Paris, Bordeaux, Nîmes, Ajaccio)
- 💰 **Économique** - ~$0.30/mois avec Claude API

---

## 📦 Contenu du Système

### Backend (Python/FastAPI)

**Nouvelles dépendances:**
```
metpy==1.6.3          # Calculs météo
matplotlib==3.9.4     # Diagrammes Skew-T
numpy==2.2.3          # Calculs numériques
pillow==11.1.0        # Images
anthropic==0.42.0     # Claude AI
```

**Nouveaux fichiers:**
```
backend/
├── migrations/add_emagram_analysis.py     # Migration DB (35 colonnes)
├── models.py                              # +EmagramAnalysis model
├── schemas.py                             # +5 schemas Pydantic
├── routes.py                              # +3 endpoints API
├── scrapers/
│   ├── wyoming.py                         # Scraper radiosonde (359 lignes)
│   └── emagram_generator.py               # Générateur Skew-T (257 lignes)
├── meteorology/
│   └── classic_analysis.py                # Calculs CAPE/LCL/etc (449 lignes)
├── llm/
│   └── vision_analyzer.py                 # Claude Vision (347 lignes)
├── scheduler/
│   └── emagram_scheduler.py               # APScheduler 2x/jour (229 lignes)
└── validate_emagram.py                    # Script de validation
```

### Frontend (React/TypeScript)

**Nouveaux fichiers:**
```
frontend/src/
├── types/emagram.ts                       # TypeScript types (145 lignes)
├── hooks/useEmagramAnalysis.ts            # React Query hooks (108 lignes)
├── components/EmagramWidget.tsx           # Widget principal (336 lignes)
└── pages/Dashboard.tsx                    # +intégration widget
```

### Documentation

```
EMAGRAM_DEPLOYMENT.md    # Guide de déploiement complet
EMAGRAM_TODO.md          # Roadmap et améliorations futures
EMAGRAM_README.md        # Ce fichier
test_emagram.sh          # Script de test rapide
```

---

## 🚀 Quick Start

### 1. Installation

```bash
# Installer dépendances
cd backend
pip install -r requirements.txt

# Configurer API key
export ANTHROPIC_API_KEY="sk-ant-api03-..."

# Démarrer avec Docker
docker compose up -d
```

### 2. Test Rapide

```bash
./test_emagram.sh
```

### 3. Utilisation

**Obtenir analyse:**
```bash
curl "http://localhost:8001/api/emagram/latest?user_lat=45.76&user_lon=4.84"
```

**Lancer analyse manuelle:**
```bash
curl -X POST http://localhost:8001/api/emagram/analyze \
  -H "Content-Type: application/json" \
  -d '{"user_latitude": 45.76, "user_longitude": 4.84}'
```

**Frontend:** Ouvrir http://localhost:5173 et voir le widget sur le Dashboard

---

## 📊 Données Analysées

### Stations Radiosonde (Wyoming University)

| Station | Ville     | Région             | WMO   |
|---------|-----------|-------------------|-------|
| 🔴      | Lyon      | Rhône-Alpes       | 07481 |
| 🔵      | Paris     | Île-de-France     | 07145 |
| 🟢      | Bordeaux  | Nouvelle-Aquitaine| 07510 |
| 🟡      | Nîmes     | Occitanie         | 07645 |
| 🟣      | Ajaccio   | Corse             | 07761 |

**Sondages disponibles:**
- **00Z** (00h UTC / 01h-02h Paris) - Nuit
- **12Z** (12h UTC / 13h-14h Paris) - Midi

### Métriques Calculées

**Thermique:**
- Plafond thermique (m) - Altitude max des ascendances
- Force thermique (m/s) - Taux de montée moyen
- Heures volables - Période d'activité thermique

**Stabilité:**
- CAPE (J/kg) - Énergie convective
- LCL (m) - Base des cumulus
- Lifted Index - Indice de stabilité
- K-Index - Risque orage

**Score Global:**
- 0-20: Non volable 🔴
- 20-40: Limite 🟠
- 40-60: Moyen 🟡
- 60-80: Bon 🟢
- 80-100: Excellent 🌟

---

## ⏰ Analyses Automatiques

**Planning:**
- **Matin: 6h15** (Paris) → Utilise sondage 00Z
- **Après-midi: 14h15** (Paris) → Utilise sondage 12Z

**Emplacements:**
- Lyon (45.76, 4.84)
- Paris (48.85, 2.35)
- Toulouse (43.60, 1.44)
- Nice (43.70, 7.27)
- Bordeaux (44.84, -0.58)

**Personnalisation:** Modifier `backend/scheduler/emagram_scheduler.py`

---

## 💡 Comment Ça Marche ?

### Pipeline d'Analyse

```
1. 🌐 Scraper Wyoming
   ↓ Télécharge radiosondage (pression, température, vent)
   
2. 📊 Générateur Skew-T
   ↓ Crée diagramme avec MetPy + Matplotlib
   
3. 🤖 Analyse IA (Claude Vision)
   ↓ Extrait métriques + génère résumé
   ↓ (Fallback calculs classiques si échec)
   
4. 💾 Sauvegarde DB
   ↓ Stocke résultats + métadonnées
   
5. 🎨 Affichage Frontend
   ✅ Widget React avec score + conseils
```

### Fallback Automatique

Si Claude API échoue:
1. Système détecte l'erreur
2. Lance calculs météo classiques (CAPE, LCL, etc.)
3. Génère résumé basique
4. Score calculé avec algorithme heuristique
5. **Résultat:** Données précises sans IA, coût $0

---

## 💰 Coûts

### Claude 3.5 Sonnet

**Par analyse:**
- Input: ~1000 tokens × $3/MTok = $0.003
- Output: ~500 tokens × $15/MTok = $0.0075
- **Total: ~$0.003** (0.3 centimes)

**Mensuel (5 sites × 2/jour × 30j):**
- 300 analyses × $0.003 = **~$0.90/mois**

### Alternative Gratuite

Mode "calculs classiques" uniquement:
- Désactiver `ANTHROPIC_API_KEY`
- Système utilise automatiquement fallback
- **Coût: $0** (pas d'appel API)

---

## 🧪 Tests & Validation

### Test Complet

```bash
# Validation des imports
cd backend
python validate_emagram.py

# Test API
./test_emagram.sh

# Logs scheduler
docker compose logs -f backend | grep emagram
```

### Vérification Manuelle

```python
# Test station la plus proche
from scrapers.wyoming import find_closest_station
print(find_closest_station(45.76, 4.84))

# Test calculs classiques
from meteorology.classic_analysis import calculate_stability_indices
result = calculate_stability_indices(
    pressure_hpa=[1000, 925, 850, 700, 500],
    temperature_c=[15, 10, 5, -5, -20],
    dewpoint_c=[10, 7, 3, -8, -25]
)
print(result)
```

---

## 📚 Documentation Complète

- **[EMAGRAM_DEPLOYMENT.md](./EMAGRAM_DEPLOYMENT.md)** - Guide de déploiement détaillé
- **[EMAGRAM_TODO.md](./EMAGRAM_TODO.md)** - Roadmap et améliorations futures
- **[validate_emagram.py](./backend/validate_emagram.py)** - Script de validation
- **[test_emagram.sh](./test_emagram.sh)** - Tests automatisés

---

## 🐛 Troubleshooting

### Erreurs Communes

**"No module named 'anthropic'"**
```bash
pip install anthropic==0.42.0
```

**"API key not configured"**
```bash
export ANTHROPIC_API_KEY="sk-ant-..."
```

**"No sounding data available"**
- Vérifier l'heure (sondages disponibles quelques heures après 00Z/12Z)
- Essayer l'autre horaire

**"Failed to generate Skew-T"**
```bash
pip install metpy matplotlib numpy pillow
```

### Logs Utiles

```bash
# Logs complets
docker compose logs -f backend

# Logs emagram uniquement
docker compose logs backend | grep -i emagram

# Erreurs uniquement
docker compose logs backend | grep -i error
```

---

## 🎯 Prochaines Étapes

### Immédiat
1. ✅ Tester en production
2. ✅ Monitorer coûts API
3. ✅ Collecter feedback pilotes

### Court Terme (1 mois)
- Page "Analyse Thermique" dédiée
- Affichage des diagrammes Skew-T
- Historique graphique
- Export CSV

### Moyen Terme (3 mois)
- Comparaison prévisions vs réalité
- Machine Learning sur historique
- Support stations européennes
- Notifications Telegram

### Long Terme
- API publique
- Mobile app
- Intégration XCTrack/XCsoar
- Communauté pilotes

---

## 🤝 Contribution

**Suggestions bienvenues:**
- GitHub Issues
- Pull Requests
- Discord parapente

---

## 📄 Licence

Projet open-source pour la communauté parapente 🪂

---

**Version:** 1.0.0  
**Date:** 2025-03-07  
**Auteur:** Dashboard Parapente Team  
**Contact:** [GitHub](https://github.com/yourusername/dashboard-parapente)
