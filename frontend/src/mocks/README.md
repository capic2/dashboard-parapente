# MSW (Mock Service Worker) - Configuration

## 📦 Installation

MSW est déjà installé et configuré dans ce projet.

## 🎯 Utilisation

MSW s'active **automatiquement en mode développement** (`npm run dev`).

Quand vous lancez le frontend en dev, MSW intercepte les requêtes API et retourne les données mockées définies dans `data.ts`.

## 📁 Structure des fichiers

```
src/mocks/
├── browser.ts      # Initialisation du service worker MSW
├── handlers.ts     # Définition des handlers pour chaque endpoint API
├── data.ts         # Données mockées (sites, vols, météo, stats)
└── README.md       # Ce fichier
```

## 🔌 Endpoints mockés

### Sites (Spots)
- `GET /api/spots` → Liste des 3 sites (Arguel, Mont Poupet, La Côte)
- `GET /api/spots/:spotId` → Détails d'un site spécifique

### Vols (Flights)
- `GET /api/flights?limit=10` → Liste des vols récents (6 vols mockés)
- `GET /api/flights/:flightId` → Détails d'un vol
- `GET /api/flights/:flightId/gpx-data` → Coordonnées GPX d'un vol (pour Cesium 3D)
- `GET /api/flights/stats` → Statistiques agrégées

### Météo (Weather)
- `GET /api/weather/:spotId?day_index=0` → Prévisions météo pour un site
- `GET /api/weather/:spotId/today` → Météo d'aujourd'hui

## 📊 Données mockées

Les données dans `data.ts` sont **basées sur les données réelles de la base de données** :

- **3 sites** : Arguel (427m), Mont Poupet (842m), La Côte (800m)
- **6 vols** : Vols réels de septembre à novembre 2025
- **Données GPX** : Coordonnées simulées pour chaque vol (pour le viewer 3D)
- **Météo** : Prévisions mockées avec para_index, verdict, créneaux volables

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

MSW ne fonctionne **que dans le navigateur** (via le service worker).

## 🔧 Modification des données

Pour changer les données mockées :

1. Éditer `src/mocks/data.ts`
2. Modifier les objets `sites`, `flights`, `gpxData`, `weatherData`, `flightStats`
3. Sauvegarder (hot reload automatique)

## 🚀 Activation/Désactivation

### Désactiver MSW temporairement

Dans `src/main.tsx`, commenter l'import et l'appel :
```typescript
// await enableMocking() // ← Commenter cette ligne
```

### Activer MSW en production (pas recommandé)

Changer la condition dans `main.tsx` :
```typescript
if (import.meta.env.DEV) { // ← Enlever cette condition
```

⚠️ **Attention** : MSW ne devrait être utilisé qu'en développement ou pour les tests.

## 📚 Documentation officielle

- [MSW Documentation](https://mswjs.io/)
- [MSW Quick Start](https://mswjs.io/docs/quick-start)
- [MSW API Reference](https://mswjs.io/docs/api)

## ✅ Checklist de vérification

- [x] `npm install -D msw` installé
- [x] `npx msw init public/` exécuté
- [x] `src/mocks/browser.ts` créé
- [x] `src/mocks/handlers.ts` créé avec tous les endpoints
- [x] `src/mocks/data.ts` créé avec les données réelles
- [x] `src/main.tsx` modifié pour activer MSW en dev
- [x] Service worker `public/mockServiceWorker.js` généré

## 🎉 Prêt à utiliser !

MSW est maintenant configuré et prêt. Lancez `npm run dev` et profitez des mocks !
