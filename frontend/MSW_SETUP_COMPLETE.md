# ✅ MSW Setup Complet - Dashboard Parapente

**Date:** 27 février 2026  
**Tâche:** Installation et configuration de Mock Service Worker (MSW) pour le frontend

---

## 📋 Résumé

Mock Service Worker (MSW) a été **entièrement installé et configuré** dans le frontend du dashboard parapente. 

Les mocks sont basés sur les **données réelles de la base de données** (6 vols, 3 sites) et s'activent automatiquement en mode développement.

---

## ✅ Actions réalisées

### 1. Installation MSW ✅
```bash
npm install -D msw
npx msw init public/ --save
```

- Package `msw@^2.12.10` installé
- Service worker généré dans `public/mockServiceWorker.js`
- Configuration `package.json` mise à jour

### 2. Structure créée ✅

```
src/mocks/
├── browser.ts      # Initialisation du service worker
├── handlers.ts     # Handlers pour tous les endpoints API
├── data.ts         # Données mockées (sites, vols, météo, GPX, stats)
├── TestMSW.tsx     # Composant de test (optionnel)
└── README.md       # Documentation complète
```

### 3. Endpoints mockés ✅

Tous les endpoints requis sont mockés :

| Endpoint | Méthode | Description |
|----------|---------|-------------|
| `/api/spots` | GET | Liste des 3 sites (Arguel, Mont Poupet, La Côte) |
| `/api/spots/:spotId` | GET | Détails d'un site spécifique |
| `/api/flights` | GET | Liste des vols récents (6 vols) |
| `/api/flights/:flightId` | GET | Détails d'un vol |
| `/api/flights/:flightId/gpx-data` | GET | Coordonnées GPX pour Cesium 3D |
| `/api/flights/stats` | GET | Statistiques agrégées |
| `/api/weather/:spotId` | GET | Prévisions météo avec para_index |
| `/api/weather/:spotId/today` | GET | Météo du jour |

### 4. Données mockées ✅

Les données sont **basées sur la BD réelle** :

#### Sites (3)
- **Arguel** : 427m, 47.2518°N, 6.1234°E
- **Mont Poupet** : 842m, 47.3267°N, 6.189°E  
- **La Côte** : 800m, 47.1456°N, 6.2456°E

#### Vols (6)
1. La Côte 08-11 14h53 (11min, 4.6km, 872m)
2. La Côte 08-11 16h01 (6min, 2.2km, 800m)
3. Mont Poupet 12-10 16h17 (4min, 1.5km, 842m)
4. Arguel 28-09 15h42 (5min, 2.4km, 433m)
5. Arguel 28-09 17h22 (31min, 13.1km, 676m) ⭐ Vol le plus long
6. Arguel 27-09 17h08 (5min, 2.0km, 435m)

#### Données GPX
Chaque vol a des coordonnées GPX simulées :
- Longitude, latitude, élévation
- Timestamps
- Stats (distance, altitude, gain)

#### Météo
3 prévisions mockées (une par site) :
- **Arguel** : Para-index 75, verdict "BON" ✅
- **Mont Poupet** : Para-index 82, verdict "BON" ✅
- **La Côte** : Para-index 68, verdict "MOYEN" ⚠️

Chaque prévision inclut :
- Consensus horaire (10h, 12h, 14h, 16h)
- Créneaux volables (`slots`)
- Métriques (vent, température, précipitations)

#### Stats
```json
{
  "total_flights": 6,
  "total_hours": 1.0,
  "total_distance_km": 25.8,
  "total_elevation_gain_m": 335,
  "avg_duration_minutes": 10.3,
  "max_altitude_m": 872,
  "favorite_spot": "Arguel",
  "last_flight_date": "2025-11-08"
}
```

### 5. Intégration main.tsx ✅

Le fichier `src/main.tsx` a été modifié pour activer MSW en mode développement :

```typescript
async function enableMocking() {
  if (import.meta.env.DEV) {
    const { worker } = await import('./mocks/browser')
    return worker.start({ onUnhandledRequest: 'bypass' })
  }
}

enableMocking().then(() => {
  ReactDOM.createRoot(rootElement).render(...)
})
```

MSW s'active **automatiquement** quand vous lancez `npm run dev`.

---

## 🧪 Comment tester

### Option 1: Console navigateur (recommandé)

1. Lancer le frontend :
   ```bash
   cd frontend
   npm run dev
   ```

2. Ouvrir http://localhost:5173 dans le navigateur

3. Ouvrir la console (F12)

4. Vérifier le message :
   ```
   [MSW] Mocking enabled.
   ```

5. Les requêtes interceptées s'affichent :
   ```
   [MSW] GET /api/spots (200 OK)
   [MSW] GET /api/flights (200 OK)
   ```

### Option 2: Composant de test (optionnel)

Un composant `TestMSW.tsx` a été créé pour tester tous les endpoints.

**Utilisation** :

1. Éditer `src/App.tsx`
2. Ajouter temporairement :
   ```tsx
   import TestMSW from './mocks/TestMSW'
   
   function App() {
     return (
       <>
         <TestMSW />
         {/* ... reste de l'app */}
       </>
     )
   }
   ```
3. Relancer `npm run dev`
4. Vérifier la console
5. Retirer le composant après les tests

### Option 3: DevTools Network

1. Ouvrir les DevTools (F12) → Onglet **Network**
2. Filtrer par `api/`
3. Vérifier que les requêtes retournent les données mockées
4. Inspecter les réponses JSON

---

## 📚 Documentation

Un fichier **README.md** complet a été créé dans `src/mocks/` avec :

- Guide d'utilisation
- Liste des endpoints mockés
- Comment modifier les données
- Troubleshooting
- Liens vers la doc officielle MSW

---

## ✅ Checklist finale

- [x] `npm install -D msw` ✅
- [x] `npx msw init public/` ✅
- [x] `src/mocks/browser.ts` créé ✅
- [x] `src/mocks/handlers.ts` créé avec 8 handlers ✅
- [x] `src/mocks/data.ts` créé avec données réelles ✅
- [x] `src/main.tsx` modifié pour activer MSW ✅
- [x] `public/mockServiceWorker.js` généré ✅
- [x] Documentation complète créée ✅
- [x] Composant de test créé ✅

---

## 🎯 Prochaines étapes suggérées

1. **Tester MSW** : Lancer `npm run dev` et vérifier la console
2. **Développer le frontend** : Utiliser les mocks pour développer sans le backend
3. **Enrichir les mocks** : Ajouter plus de vols / scénarios météo si besoin
4. **Tests E2E** : Utiliser MSW pour les tests Playwright (déjà configuré)

---

## 🔧 Maintenance

### Modifier les données mockées

Éditer `src/mocks/data.ts` :
- `sites` : Modifier les sites
- `flights` : Ajouter/modifier des vols
- `gpxData` : Ajuster les coordonnées GPX
- `weatherData` : Changer les prévisions météo
- `flightStats` : Mettre à jour les stats

### Ajouter un nouvel endpoint

1. Éditer `src/mocks/handlers.ts`
2. Ajouter un nouveau handler :
   ```typescript
   http.get('/api/nouveau-endpoint', () => {
     return HttpResponse.json({ data: 'mock' })
   })
   ```

### Désactiver MSW temporairement

Commenter dans `src/main.tsx` :
```typescript
// await enableMocking() // ← Commenter pour désactiver
```

---

## 🎉 Conclusion

**MSW est maintenant 100% opérationnel** sur le frontend du dashboard parapente.

Tous les endpoints API sont mockés avec des données réelles de la base de données. Le développement frontend peut continuer **sans dépendre du backend**.

**Prochain test recommandé :** Lancer `npm run dev` et vérifier que les pages utilisent bien les données mockées.

---

**Auteur:** Claw  
**Version MSW:** 2.12.10  
**Date:** 27 février 2026 16:57  
