# MSW (Mock Service Worker) - Configuration

## 📦 Installation

MSW est déjà installé et configuré dans ce projet.

## 🎯 Utilisation

MSW s'active **automatiquement en mode développement** (`npm run dev`).

Quand vous lancez le frontend en dev, MSW intercepte les requêtes API et retourne les données mockées définies dans `data/`.

## 📁 Structure des fichiers

```
frontend/mocks/
├── data/
│   ├── flights.ts         # Mock data vols
│   ├── sites.ts           # Mock data sites
│   ├── weather.ts         # Mock data météo
│   ├── weatherSources.ts  # Mock data sources météo
│   ├── gpx.ts             # Mock data GPX (coordonnées)
│   └── stats.ts           # Mock data statistiques
├── handlers.ts            # Définition des handlers pour chaque endpoint API
├── browser.ts             # Initialisation du service worker MSW pour le navigateur
├── server.ts              # Initialisation du service worker MSW pour les tests
└── README.md              # Ce fichier
```

## 🔌 Endpoints mockés

### Sites (Spots)

- `GET /api/spots` → Liste des 3 sites (Arguel, Mont Poupet, La Côte)
- `GET /api/spots/:spotId` → Détails d'un site spécifique
- `POST /api/spots` → Créer un nouveau site
- `PATCH /api/sites/:siteId` → Mettre à jour un site
- `DELETE /api/sites/:siteId` → Supprimer un site
- `GET /api/spots/best` → Retourne le meilleur spot du jour

### Vols (Flights)

- `GET /api/flights?limit=10` → Liste des vols récents (7 vols mockés, dont 1 sans GPX)
- `GET /api/flights/:flightId` → Détails d'un vol
- `GET /api/flights/:flightId/gpx-data` → Coordonnées GPX d'un vol (pour Cesium 3D)
- `GET /api/flights/stats` → Statistiques agrégées
- `GET /api/flights/records` → Records de vols (plus long, plus haut, etc.)
- `POST /api/flights` → Créer un nouveau vol
- `PATCH /api/flights/:flightId` → Mettre à jour un vol
- `DELETE /api/flights/:flightId` → Supprimer un vol
- `POST /api/flights/sync-strava` → Synchroniser les vols Strava (mock: 2 importés, 3 ignorés)
- `POST /api/flights/:flightId/upload-gpx` → Uploader un GPX sur un vol existant

### Météo (Weather)

- `GET /api/weather/:spotId?day_index=0` → Prévisions météo pour un site
- `GET /api/weather/:spotId/today` → Météo d'aujourd'hui
- `GET /api/weather/:spotId/summary` → Résumé météo

### Sources météo (Weather Sources)

- `GET /api/weather-sources` → Liste des sources météo
- `GET /api/weather-sources/stats` → Statistiques des sources météo
- `GET /api/weather-sources/:sourceName` → Détails d'une source spécifique
- `POST /api/weather-sources` → Créer une nouvelle source météo
- `PATCH /api/weather-sources/:sourceName` → Mettre à jour une source météo
- `DELETE /api/weather-sources/:sourceName` → Supprimer une source météo
- `POST /api/weather-sources/:sourceName/test` → Tester une source météo

### Alertes (Alerts)

- `GET /api/alerts` → Liste des alertes
- `POST /api/alerts` → Créer une nouvelle alerte

## 📊 Données mockées

Les données dans `data/` sont **basées sur les données réelles de la base de données** :

- **3 sites** : Arguel (427m), Mont Poupet (842m), La Côte (800m)
- **7 vols** : Vols réels de septembre à novembre 2025
- **Données GPX** : Coordonnées simulées pour chaque vol (pour le viewer 3D)
- **Météo** : Prévisions mockées avec para_index, verdict, créneaux volables
- **Sources météo** : Open-Meteo configuré et actif
- **Statistiques** : Stats agrégées des vols

## 🧪 Comment tester

### Dans le navigateur

1. Lancer le frontend en dev :

   ```bash
   npm run dev
   ```

2. Ouvrir la console du navigateur (F12)

3. Vous devriez voir dans la console :

   ```
   [MSW] Mocking enabled.
   ```

4. Les requêtes interceptées s'affichent dans la console :
   ```
   [MSW] GET /api/spots (200 OK)
   [MSW] GET /api/flights (200 OK)
   ```

### Avec curl (backend réel)

Si le backend est en cours d'exécution, curl appellera le backend réel, pas les mocks MSW.

MSW ne fonctionne **que dans le navigateur** (via le service worker) et dans les tests (via Node.js).

## 🔧 Modification des données

Pour changer les données mockées :

1. Éditer les fichiers dans `frontend/mocks/data/`
   - `sites.ts` → Modifier les sites de vol
   - `flights.ts` → Modifier les vols
   - `weather.ts` → Modifier les prévisions météo
   - `gpx.ts` → Modifier les coordonnées GPX
   - `stats.ts` → Modifier les statistiques
   - `weatherSources.ts` → Modifier les sources météo

2. Sauvegarder (hot reload automatique)

## 🚀 Activation/Désactivation

### Basculer entre mocks et API réelle

Modifier le fichier `.env` à la racine du frontend :

```bash
# Utiliser les mocks MSW
VITE_ENABLE_MSW=true

# Utiliser l'API réelle (backend sur localhost:8001)
VITE_ENABLE_MSW=false
```

Redémarrer le serveur Vite après modification.

### Désactiver MSW temporairement (dans le code)

Dans `src/main.tsx`, commenter l'import et l'appel :

```typescript
// await enableMocking() // ← Commenter cette ligne
```

⚠️ **Attention** : MSW ne devrait être utilisé qu'en développement ou pour les tests.

## 📚 Documentation officielle

- [MSW Documentation](https://mswjs.io/)
- [MSW Quick Start](https://mswjs.io/docs/quick-start)
- [MSW API Reference](https://mswjs.io/docs/api)

## ✅ Checklist de vérification

- [x] `npm install -D msw` installé
- [x] `npx msw init public/` exécuté
- [x] `frontend/mocks/browser.ts` créé
- [x] `frontend/mocks/server.ts` créé pour les tests
- [x] `frontend/mocks/handlers.ts` créé avec tous les endpoints
- [x] `frontend/mocks/data/` créé avec les données réelles structurées
- [x] `src/main.tsx` modifié pour activer MSW en dev
- [x] Service worker `public/mockServiceWorker.js` généré

## 🎉 Prêt à utiliser !

MSW est maintenant configuré et prêt. Lancez `npm run dev` et profitez des mocks !
