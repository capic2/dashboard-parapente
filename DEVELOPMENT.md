# Guide de Développement - Dashboard Parapente

## 🚀 Démarrage rapide

### Option 1 : Mode Mock (MSW) - Recommandé pour le frontend seul

**Avantages :**
- Pas besoin de lancer le backend
- Données cohérentes et prévisibles
- Rapide à démarrer
- Idéal pour travailler sur l'UI/UX

**Démarrage :**

1. Configurer le frontend pour utiliser MSW :
   ```bash
   cd frontend
   # Créer/modifier .env
   echo "VITE_ENABLE_MSW=true" > .env
   ```

2. Lancer le frontend :
   ```bash
   npm run dev
   ```

3. Ouvrir http://localhost:5173

**Données disponibles :**
- 3 sites (Arguel, Mont Poupet, La Côte)
- 7 vols (dont 1 sans GPX pour tester l'upload)
- Météo mockée pour chaque site
- Sync Strava mockée (retourne 2 importés, 3 ignorés)

---

### Option 2 : Mode API réelle - Pour tester le backend

**Avantages :**
- Teste l'intégration complète frontend/backend
- Utilise la vraie base de données SQLite
- Teste les vraies API Strava (avec credentials)
- Idéal pour tester les nouvelles fonctionnalités backend

**Démarrage :**

1. Configurer le backend (.env déjà configuré) :
   ```bash
   cd backend
   cat .env  # Vérifier que ENVIRONMENT=development et USE_FAKE_REDIS=true
   ```

2. Lancer le backend :
   ```bash
   cd backend
   source venv/bin/activate
   uvicorn main:app --reload --port 8001
   ```

3. Configurer le frontend pour utiliser l'API réelle :
   ```bash
   cd frontend
   echo "VITE_ENABLE_MSW=false" > .env
   echo "VITE_API_URL=http://localhost:8001/api" >> .env
   ```

4. Lancer le frontend :
   ```bash
   npm run dev
   ```

5. Ouvrir http://localhost:5173 (ou 5174)

**URLs :**
- Frontend : http://localhost:5173
- Backend API : http://localhost:8001
- API Docs (Swagger) : http://localhost:8001/docs

---

## 🧪 Tester les nouvelles fonctionnalités

### 1️⃣ Synchronisation Strava

**Prérequis :** API réelle avec credentials Strava configurés

**Test :**
1. Aller sur "Historique des vols"
2. Cliquer sur "🔄 Sync Strava"
3. Sélectionner une période (ex: 90 derniers jours)
4. Cliquer "Synchroniser"
5. Vérifier le résumé (X importés, Y ignorés)

**Avec mocks :** Retourne toujours "2 importés, 3 ignorés, 0 échecs"

---

### 2️⃣ Upload GPX

**Test avec mocks :**
1. Chercher le vol "Mont Poupet 15-09 14h30 (sans GPX)" avec badge orange
2. Cliquer dessus pour voir les détails
3. Cliquer "📎 Ajouter GPX"
4. Sélectionner n'importe quel fichier GPX
5. Vérifier que le badge passe au vert ✅

**Test avec API réelle :**
1. Trouver un vol sans GPX (ou créer un vol manuel)
2. Upload un vrai fichier GPX
3. Vérifier dans `backend/db/gpx/` que le fichier a été sauvegardé
4. Vérifier que la visualisation 3D fonctionne dans Cesium

---

## 📂 Structure du projet

```
dashboard-parapente/
├── backend/
│   ├── venv/                    # Virtual environment Python
│   ├── .env                     # Config backend (ENVIRONMENT=development, credentials Strava)
│   ├── main.py                  # Point d'entrée FastAPI
│   ├── routes.py                # Endpoints API (dont sync-strava et upload-gpx)
│   ├── strava.py                # Fonctions Strava (get_activities_by_period)
│   ├── cache.py                 # Redis/FakeRedis
│   └── db/
│       ├── dashboard.db         # Base SQLite
│       └── gpx/                 # Fichiers GPX uploadés
│
└── frontend/
    ├── .env                     # Config frontend (VITE_ENABLE_MSW, VITE_API_URL)
    ├── src/
    │   ├── mocks/               # MSW (Mock Service Worker)
    │   │   ├── handlers.ts      # Handlers API mockés
    │   │   ├── data.ts          # Données mockées
    │   │   └── README.md        # Doc MSW
    │   ├── components/
    │   │   ├── ui/              # Composants UI réutilisables
    │   │   │   ├── Modal.tsx
    │   │   │   ├── DatePicker.tsx
    │   │   │   └── Toast.tsx
    │   │   └── StravaSyncModal.tsx
    │   ├── hooks/
    │   │   ├── useFlights.ts    # Hooks React Query (dont useStravaSyncMutation)
    │   │   └── useToast.ts      # Hook Zustand pour les toasts
    │   └── pages/
    │       └── FlightHistory.tsx # Page avec sync Strava et upload GPX
    └── public/
        └── mockServiceWorker.js # Service Worker MSW
```

---

## 🛠️ Commandes utiles

### Backend

```bash
# Activer venv
cd backend && source venv/bin/activate

# Lancer en dev (avec auto-reload)
uvicorn main:app --reload --port 8001

# Voir les logs
tail -f logs/dashboard.log

# Tester un endpoint
curl http://localhost:8001/
curl http://localhost:8001/api/flights
```

### Frontend

```bash
# Installer les dépendances
npm install

# Lancer en dev
npm run dev

# Build pour production
npm run build

# Preview du build
npm run preview
```

### Basculer entre mocks et API

```bash
# Activer MSW (mocks)
cd frontend
echo "VITE_ENABLE_MSW=true" > .env

# Utiliser l'API réelle
echo "VITE_ENABLE_MSW=false" > .env
echo "VITE_API_URL=http://localhost:8001/api" >> .env

# Redémarrer Vite après changement
npm run dev
```

---

## 🐛 Troubleshooting

### Backend ne démarre pas

**Erreur : "externally-managed-environment"**
→ Utiliser le venv : `source backend/venv/bin/activate`

**Erreur : "redis.exceptions.ConnectionError"**
→ Vérifier `.env` : `ENVIRONMENT=development` et `USE_FAKE_REDIS=true`

**Erreur : "python-multipart not found"**
→ Réinstaller : `pip install -r requirements.txt`

### Frontend ne se connecte pas à l'API

**Vérifier MSW :**
→ Ouvrir la console (F12), chercher `[MSW] Mocking enabled`

**Si MSW est activé mais vous voulez l'API réelle :**
→ Modifier `.env` : `VITE_ENABLE_MSW=false`

**Erreur CORS :**
→ Vérifier que le backend tourne sur le bon port (8001)

### Sync Strava ne fonctionne pas

**Avec mocks :** Devrait toujours fonctionner (retourne données mockées)

**Avec API réelle :**
1. Vérifier credentials dans `backend/.env`
2. Vérifier logs backend : `tail -f backend/logs/dashboard.log`
3. Tester manuellement : `curl -X POST http://localhost:8001/api/flights/sync-strava -H "Content-Type: application/json" -d '{"date_from":"2025-01-01","date_to":"2025-03-04"}'`

---

## 📝 Notes importantes

1. **Base de données :** SQLite à `/home/capic/.openclaw/workspace/paragliding/db/dashboard.db`
2. **Fichiers GPX :** Stockés dans `backend/db/gpx/`
3. **Redis :** FakeRedis en dev (in-memory), pas besoin de Redis externe
4. **Credentials Strava :** Déjà configurés dans `backend/.env` (Client ID: 73115)
5. **Port frontend :** 5173 par défaut (ou 5174 si 5173 occupé)

---

## 🎯 Workflow recommandé

### Pour développer l'UI uniquement
→ **Option 1 (MSW)** - Rapide, pas besoin du backend

### Pour tester l'intégration complète
→ **Option 2 (API réelle)** - Lancer backend + frontend

### Pour tester Strava sync avec vraies données
→ **Option 2** + vérifier credentials Strava dans `.env`

---

## ✅ Checklist avant de commit

- [ ] Les mocks MSW sont à jour (`frontend/src/mocks/handlers.ts`)
- [ ] Le backend démarre sans erreur
- [ ] Le frontend démarre sans erreur
- [ ] Les deux nouveaux endpoints fonctionnent (sync-strava, upload-gpx)
- [ ] Les toasts s'affichent correctement
- [ ] Le badge "GPX manquant" s'affiche
- [ ] La documentation est à jour

---

Bon développement ! 🚀
