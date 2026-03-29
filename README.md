# 🪂 Dashboard Parapente

Tableau de bord météo personnel pour sites de parapente avec agrégation multi-sources et calcul de Para-Index.

![Python](https://img.shields.io/badge/Python-3.13-blue?logo=python)
![FastAPI](https://img.shields.io/badge/FastAPI-0.135-green?logo=fastapi)
![React](https://img.shields.io/badge/React-18.3-blue?logo=react)
![Redis](https://img.shields.io/badge/Redis-8.6-red?logo=redis)
![Docker](https://img.shields.io/badge/Docker-Compose%203.9-blue?logo=docker)

---

## 🚀 Stack Technique (Mars 2026)

### Backend

- **Python** 3.13 LTS (support jusqu'en 2028)
- **FastAPI** 0.135 (framework async moderne)
- **SQLAlchemy** 2.0.48 (ORM)
- **Pydantic** 2.12 (validation données)
- **Playwright** 1.58 (web scraping)
- **Redis** 8.6 (cache ultra-rapide)

### Frontend

- **React** 18.3
- **Node.js** 24 LTS (Krypton)
- **Ky** 1.14 (HTTP client moderne)
- **TanStack Router** 1.163 (routing)
- **TanStack Query** 5.90 (data fetching)
- **Tailwind CSS** 4.2
- **Vite** 7.3
- **Cesium** 1.139 (cartographie 3D)

### Infrastructure

- **Nx** 20.4 (monorepo intelligent)
- **Nx Cloud** (distributed caching)
- Docker multi-stage builds
- Docker Compose 3.9
- SQLite (base légère)
- Nginx (reverse proxy)
- Portainer (déploiement)

---

## ✨ Fonctionnalités

### 🌤️ Météo & Prévisions

- **Météo multi-sources** : 5 sources agrégées (WeatherAPI, Meteoblue, etc.)
- **Para-Index** : Score 0-100 de volabilité en temps réel
- **6 sites pré-configurés** : Région Besançon (Arguel, Mont Poupet, La Côte)
- **Refresh automatique** : Toutes les heures
- **Cache Redis** : Performances optimales

### 📊 Analytics & Statistiques (Mars 2026)

- **Filtres dynamiques** : Filtrer par site et plage de dates avec persistence
- **Dashboard records** : 4 records personnels (durée, altitude, distance, vitesse)
- **Analyses temporelles** :
  - Heures de vol préférées (matin/après-midi/soirée/nuit)
  - Jours de semaine préférés (Lun-Dim)
- **Progression** :
  - Graphique altitude par vol
  - Graphique durée avec moyenne glissante (10 vols)
  - Stats mensuelles (nb vols + heures)
  - Répartition par site (pie chart)
- **Gamification** : 11 badges d'achievements avec progression
  - Milestones de vols (1, 5, 20, 50, 100)
  - Heures de vol (10h, 50h, 100h)
  - Altitude (1000m, 2000m, 3000m)

### 🔗 Intégrations

- **Strava** : Sync automatique des vols avec GPX
- **Telegram** : Alertes météo (optionnel)

---

## 🏃 Démarrage Rapide

### Développement Local

```bash
# Cloner
git clone https://github.com/capic2/dashboard-parapente.git
cd dashboard-parapente

# Démarrer
docker-compose up --build

# Accès
# - Application: http://localhost:8001
# - API Docs: http://localhost:8001/docs
```

### Production (Portainer)

1. **Portainer** → **Stacks** → **Add Stack**
2. **Git Repository**: `https://github.com/capic2/dashboard-parapente`
3. **Branch**: `main`
4. **Compose path**: `docker-compose.yml`
5. **Deploy the stack**
6. Configurer Nginx (voir `NGINX_CONFIG.md`)

**Accès:** https://parapente.capic.ignorelist.com

---

## 📊 Architecture

### Monorepo Structure (Nx)

```
dashboard-parapente/
├── apps/
│   ├── frontend/          # React 19 + Vite
│   ├── backend/           # FastAPI + Python
│   └── e2e/              # Playwright E2E tests
├── libs/
│   └── shared-types/     # Shared Zod schemas (TypeScript)
└── tools/scripts/        # Utility scripts
```

### Infrastructure

```
Internet → Nginx (HTTPS) → Docker Network
                              ├── Redis 8.6 (cache)
                              └── Backend (FastAPI + React SPA)
                                    └── SQLite (6 sites)
```

---

## 🔧 Configuration

### Variables d'Environnement

Pré-configurées dans `docker-compose.yml`:

```yaml
ENVIRONMENT=production
REDIS_HOST=redis
WEATHERAPI_KEY=***
METEOBLUE_API_KEY=***
```

### Sites Pré-Configurés

6 sites région Besançon auto-initialisés:

1. Arguel (462m, NNW)
2. Mont Poupet Nord (795m, N)
3. Mont Poupet Nord-Ouest (795m, NW)
4. Mont Poupet Ouest (795m, W)
5. Mont Poupet Sud (795m, S)
6. La Côte (800m, N)

---

## 📡 API Endpoints

- `GET /` - Status & version
- `GET /api/sites` - Liste sites
- `GET /api/weather/{site_id}` - Météo site
- `GET /api/para-index/{site_id}` - Para-Index
- `GET /docs` - Documentation API

---

## 🛠️ Développement

> **Note:** Ce projet utilise [Nx](https://nx.dev) pour le monorepo. Voir `NX_MIGRATION.md` pour la documentation complète.

### Installation

```bash
npm install
```

### Commandes Nx

#### Frontend

```bash
# Développement
nx serve frontend              # http://localhost:5173

# Build
nx build frontend              # Production build
nx build frontend --configuration=production

# Tests
nx test frontend               # Unit tests (Vitest)
nx test frontend --watch       # Watch mode
nx test frontend --coverage    # With coverage

# Lint & Type-check
nx lint frontend
nx type-check frontend

# Storybook
nx storybook frontend          # http://localhost:6006
```

#### Backend

```bash
# Développement
nx serve backend               # http://localhost:8001

# Tests
nx test backend                # Unit tests (pytest)
nx test:integration backend    # Integration tests
nx test backend --coverage     # With coverage

# Lint & Format
nx lint backend                # Ruff linting
nx format backend              # Black formatting
```

#### E2E Tests

```bash
nx e2e e2e                     # Run all E2E tests
nx e2e:ui e2e                  # Interactive UI mode
nx e2e:debug e2e               # Debug mode
nx e2e:report e2e              # Show HTML report
```

#### Shared Types Library

```bash
nx build shared-types          # Build shared Zod schemas
nx lint shared-types
nx type-check shared-types
```

### Commandes Nx Avancées

```bash
# Afficher tous les projets
nx show projects

# Graphe de dépendances
nx graph

# Exécuter seulement les projets affectés
nx affected -t build           # Build seulement ce qui a changé
nx affected -t test            # Test seulement ce qui a changé
nx affected -t lint            # Lint seulement ce qui a changé

# Exécuter en parallèle
nx run-many -t build test --parallel=3

# Cache local
nx reset                       # Clear cache
```

### Configuration Traditionnelle (alternative)

Si vous préférez les commandes traditionnelles:

#### Frontend (apps/frontend)

```bash
cd apps/frontend
npm run dev                    # http://localhost:5173
npm run build
npm run test
```

#### Backend (apps/backend)

```bash
cd apps/backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8001
```

---

## 📝 Documentation

- **`NX_MIGRATION.md`** : Guide complet du monorepo Nx
- **`NGINX_CONFIG.md`** : Configuration reverse proxy
- **`.env.example`** : Variables disponibles
- **`/docs`** : API Swagger UI
- **`/redoc`** : API ReDoc

---

## 🔄 Mises à Jour

```bash
git pull origin main
docker-compose up --build -d
docker-compose logs -f backend
```

---

## 🐛 Troubleshooting

### Database non initialisée

```bash
docker-compose down -v
docker-compose up --build
```

### Redis connection refused

```bash
docker-compose restart redis
docker inspect parapente-redis | grep -A 10 Health
```

### Frontend 404

```bash
docker-compose build --no-cache backend
docker-compose up -d backend
```

---

## 📄 License

**Private Project** - Tous droits réservés

---

## 👤 Auteur

Développé pour usage personnel - Région de Besançon, France

**Support:** Voir section Troubleshooting ci-dessus

---

**Version:** 1.0.0  
**Dernière mise à jour:** Mars 2026  
**Stack:** Python 3.13 + React 18 + Redis 8.6 + Ky
