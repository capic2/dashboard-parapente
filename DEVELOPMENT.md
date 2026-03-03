# 🚀 Development Guide / Guide de Développement

> **Quick start for local development using FakeRedis (no Redis server needed!)**  
> **Démarrage rapide pour le développement local avec FakeRedis (pas besoin de serveur Redis !)**

---

## 🇬🇧 English Version

### Prerequisites

Before you begin, ensure you have:

- **Python 3.10+** installed
- **Node.js 18+** and npm installed
- **Git** for version control
- A terminal/command prompt

Optional (for testing with real Redis):
- **Docker** (if you want to test with a real Redis server)

### Quick Start (5 minutes)

#### 1. Clone the Repository

```bash
git clone <your-repo-url>
cd dashboard-parapente
```

#### 2. Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv venv

# Activate it (Linux/Mac)
source venv/bin/activate
# Or on Windows:
# venv\Scripts\activate

# Install dependencies (includes fakeredis)
pip install -r requirements.txt

# Copy environment template
cp .env.example .env

# Edit .env if needed (defaults work fine for dev)
# ENVIRONMENT=development  ← Already set
# USE_FAKE_REDIS=true      ← Already set (uses in-memory cache)
```

#### 3. Initialize Database

```bash
# Create database schema
python -c "from database import Base, engine; Base.metadata.create_all(bind=engine)"

# Seed with initial sites
python init_db.py
```

#### 4. Start Backend Server

```bash
# Start with auto-reload
python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

You should see:
```
INFO:     Using FakeRedis (in-memory mock) for development
INFO:     Uvicorn running on http://0.0.0.0:8000
```

✅ **Backend is ready!** Test it: `curl http://localhost:8000/api/sites`

#### 5. Frontend Setup (New Terminal)

```bash
cd frontend

# Install dependencies
npm install

# Start dev server
npm run dev
```

Frontend will be available at: **http://localhost:5173**

### Project Structure

```
dashboard-parapente/
├── backend/              # Python FastAPI backend
│   ├── cache.py         # Redis/FakeRedis cache layer
│   ├── main.py          # FastAPI app entry point
│   ├── routes.py        # API endpoints
│   ├── models.py        # SQLAlchemy ORM models
│   ├── scheduler.py     # Weather data polling (APScheduler)
│   ├── weather_pipeline.py  # Data aggregation & consensus
│   └── scrapers/        # Weather source scrapers
├── frontend/            # React + TypeScript frontend
│   ├── src/
│   │   ├── components/  # Reusable UI components
│   │   ├── pages/       # Page components
│   │   ├── hooks/       # Custom React hooks
│   │   └── types/       # TypeScript definitions
└── docs/               # Documentation
```

### How It Works: FakeRedis in Development

**FakeRedis** is an in-memory implementation of Redis that requires no server:

- ✅ **Automatic**: When `ENVIRONMENT=development`, FakeRedis is used by default
- ✅ **Fast**: All cache operations happen in Python memory
- ✅ **Isolated**: Each process has its own cache (perfect for single-process dev)
- ⚠️ **Ephemeral**: Cache is cleared when you restart the server
- ⚠️ **Single-process**: Not shared between multiple workers

**Production uses real Redis** for persistence and multi-process caching.

#### Cache Strategy

**TTL (Time To Live):** 60 minutes  
**Scheduler Interval:** Every hour (at :00)  
**Synchronization:** Cache TTL matches polling interval to eliminate gaps

**Why 60 minutes?**
- Weather conditions change gradually (no 5-minute precision needed)
- Aligned with hourly polling prevents cache misses
- Reduces API calls to external providers
- Instant responses for users (always cache hit)

**Note:** In development with FakeRedis, cache is cleared on server restart.

### Common Development Tasks

#### Run Tests

```bash
# Backend tests
cd backend
pytest

# Frontend tests
cd frontend
npm run test

# Type checking (TypeScript)
npm run type-check
```

#### View Storybook (UI Components)

```bash
cd frontend
npm run storybook
# Opens at http://localhost:6006
```

#### Check Code Quality

```bash
# Python linting
cd backend
flake8 .

# TypeScript/React linting
cd frontend
npm run lint
```

#### Database Management

```bash
# View database
sqlite3 backend/db/dashboard.db

# Reset database
rm backend/db/dashboard.db
python -c "from database import Base, engine; Base.metadata.create_all(bind=engine)"
python init_db.py
```

### Optional: Testing with Real Redis

If you want to test with a real Redis server (closer to production):

#### Option A: Using Docker Compose

```bash
# Start only Redis
docker-compose up redis

# In another terminal, configure backend
cd backend
# Edit .env:
# USE_FAKE_REDIS=false
# REDIS_HOST=localhost
# REDIS_PORT=6379

# Restart backend
python -m uvicorn main:app --reload
```

#### Option B: Local Redis Installation

```bash
# Ubuntu/Debian
sudo apt install redis-server
sudo systemctl start redis-server

# macOS
brew install redis
brew services start redis

# Then configure backend .env as above
```

### Troubleshooting

#### "ModuleNotFoundError: No module named 'fakeredis'"

```bash
cd backend
pip install fakeredis
```

#### "Failed to connect to Redis"

Check your `.env` file:
- For development: `ENVIRONMENT=development` and `USE_FAKE_REDIS=true`
- FakeRedis doesn't require a server connection

#### "Port 8000 already in use"

```bash
# Find and kill the process
lsof -ti:8000 | xargs kill -9
# Or use a different port
python -m uvicorn main:app --reload --port 8001
```

#### Frontend can't reach backend API

- Ensure backend is running on `http://localhost:8000`
- Check `frontend/.env`: `VITE_API_URL=http://localhost:8000`
- Check browser console for CORS errors

### Next Steps

- 📖 Read [USER_GUIDE.md](USER_GUIDE.md) to understand the dashboard features
- 🚢 See [DEPLOYMENT.md](DEPLOYMENT.md) for production deployment
- 🤝 Check [CONTRIBUTING.md](CONTRIBUTING.md) to contribute code

---

## 🇫🇷 Version Française

### Prérequis

Avant de commencer, assurez-vous d'avoir :

- **Python 3.10+** installé
- **Node.js 18+** et npm installés
- **Git** pour le contrôle de version
- Un terminal/invite de commandes

Optionnel (pour tester avec un vrai Redis) :
- **Docker** (si vous voulez tester avec un vrai serveur Redis)

### Démarrage Rapide (5 minutes)

#### 1. Cloner le Dépôt

```bash
git clone <url-de-votre-repo>
cd dashboard-parapente
```

#### 2. Configuration Backend

```bash
cd backend

# Créer l'environnement virtuel
python -m venv venv

# L'activer (Linux/Mac)
source venv/bin/activate
# Ou sous Windows :
# venv\Scripts\activate

# Installer les dépendances (inclut fakeredis)
pip install -r requirements.txt

# Copier le template d'environnement
cp .env.example .env

# Éditer .env si besoin (les valeurs par défaut fonctionnent)
# ENVIRONMENT=development  ← Déjà configuré
# USE_FAKE_REDIS=true      ← Déjà configuré (cache en mémoire)
```

#### 3. Initialiser la Base de Données

```bash
# Créer le schéma de base de données
python -c "from database import Base, engine; Base.metadata.create_all(bind=engine)"

# Ajouter les sites initiaux
python init_db.py
```

#### 4. Démarrer le Serveur Backend

```bash
# Démarrer avec rechargement automatique
python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

Vous devriez voir :
```
INFO:     Using FakeRedis (in-memory mock) for development
INFO:     Uvicorn running on http://0.0.0.0:8000
```

✅ **Le backend est prêt !** Testez-le : `curl http://localhost:8000/api/sites`

#### 5. Configuration Frontend (Nouveau Terminal)

```bash
cd frontend

# Installer les dépendances
npm install

# Démarrer le serveur de dev
npm run dev
```

Le frontend sera disponible sur : **http://localhost:5173**

### Structure du Projet

```
dashboard-parapente/
├── backend/              # Backend Python FastAPI
│   ├── cache.py         # Couche cache Redis/FakeRedis
│   ├── main.py          # Point d'entrée FastAPI
│   ├── routes.py        # Points de terminaison API
│   ├── models.py        # Modèles ORM SQLAlchemy
│   ├── scheduler.py     # Polling données météo (APScheduler)
│   ├── weather_pipeline.py  # Agrégation & consensus des données
│   └── scrapers/        # Scrapers sources météo
├── frontend/            # Frontend React + TypeScript
│   ├── src/
│   │   ├── components/  # Composants UI réutilisables
│   │   ├── pages/       # Composants de pages
│   │   ├── hooks/       # Hooks React personnalisés
│   │   └── types/       # Définitions TypeScript
└── docs/               # Documentation
```

### Comment Ça Marche : FakeRedis en Développement

**FakeRedis** est une implémentation en mémoire de Redis qui ne nécessite aucun serveur :

- ✅ **Automatique** : Quand `ENVIRONMENT=development`, FakeRedis est utilisé par défaut
- ✅ **Rapide** : Toutes les opérations de cache se font en mémoire Python
- ✅ **Isolé** : Chaque processus a son propre cache (parfait pour le dev mono-processus)
- ⚠️ **Éphémère** : Le cache est vidé quand vous redémarrez le serveur
- ⚠️ **Mono-processus** : Non partagé entre plusieurs workers

**La production utilise un vrai Redis** pour la persistance et le cache multi-processus.

### Tâches de Développement Courantes

#### Lancer les Tests

```bash
# Tests backend
cd backend
pytest

# Tests frontend
cd frontend
npm run test

# Vérification des types (TypeScript)
npm run type-check
```

#### Voir Storybook (Composants UI)

```bash
cd frontend
npm run storybook
# S'ouvre sur http://localhost:6006
```

#### Vérifier la Qualité du Code

```bash
# Linting Python
cd backend
flake8 .

# Linting TypeScript/React
cd frontend
npm run lint
```

#### Gestion de la Base de Données

```bash
# Voir la base de données
sqlite3 backend/db/dashboard.db

# Réinitialiser la base de données
rm backend/db/dashboard.db
python -c "from database import Base, engine; Base.metadata.create_all(bind=engine)"
python init_db.py
```

### Optionnel : Tester avec un Vrai Redis

Si vous voulez tester avec un vrai serveur Redis (plus proche de la production) :

#### Option A : Utiliser Docker Compose

```bash
# Démarrer seulement Redis
docker-compose up redis

# Dans un autre terminal, configurer le backend
cd backend
# Éditer .env :
# USE_FAKE_REDIS=false
# REDIS_HOST=localhost
# REDIS_PORT=6379

# Redémarrer le backend
python -m uvicorn main:app --reload
```

#### Option B : Installation Redis Locale

```bash
# Ubuntu/Debian
sudo apt install redis-server
sudo systemctl start redis-server

# macOS
brew install redis
brew services start redis

# Puis configurer backend .env comme ci-dessus
```

### Dépannage

#### "ModuleNotFoundError: No module named 'fakeredis'"

```bash
cd backend
pip install fakeredis
```

#### "Failed to connect to Redis"

Vérifiez votre fichier `.env` :
- Pour le développement : `ENVIRONMENT=development` et `USE_FAKE_REDIS=true`
- FakeRedis ne nécessite pas de connexion serveur

#### "Port 8000 already in use"

```bash
# Trouver et tuer le processus
lsof -ti:8000 | xargs kill -9
# Ou utiliser un port différent
python -m uvicorn main:app --reload --port 8001
```

#### Le frontend ne peut pas joindre l'API backend

- Assurez-vous que le backend tourne sur `http://localhost:8000`
- Vérifiez `frontend/.env` : `VITE_API_URL=http://localhost:8000`
- Vérifiez la console du navigateur pour les erreurs CORS

### Prochaines Étapes

- 📖 Lisez [USER_GUIDE.md](USER_GUIDE.md) pour comprendre les fonctionnalités du dashboard
- 🚢 Voir [DEPLOYMENT.md](DEPLOYMENT.md) pour le déploiement en production
- 🤝 Consultez [CONTRIBUTING.md](CONTRIBUTING.md) pour contribuer au code

---

**Happy coding! / Bon développement ! 🪂**
