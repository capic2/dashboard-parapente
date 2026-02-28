# Fix : 404 sur /api/flights/:id/gpx-data dans Storybook

## 🐛 Problème

Dans Storybook, les requêtes vers `/api/flights/:flightId/gpx-data` retournaient des **404 Not Found**.

### Cause

Les handlers MSW (Mock Service Worker) n'interceptaient que les URLs absolues :

```typescript
http.get('http://localhost:6006/api/flights/:id/gpx-data', ...)
```

Mais `axios` dans `useFlightGPX` fait des requêtes avec des chemins **relatifs** :

```typescript
const API = axios.create({
  baseURL: '/api', // Chemin relatif !
});
```

Résultat : MSW ne matchait pas les requêtes et laissait passer → **404**

---

## ✅ Solution

### Approche : Double enregistrement des handlers

Créer une fonction helper qui enregistre **2 handlers** pour chaque endpoint :

1. Un avec l'URL absolue (pour certains cas Storybook)
2. Un avec le chemin relatif (pour axios et autres)

### Code

**Avant** (`src/mocks/handlers.ts`) :

```typescript
const API_BASE = 'http://localhost:6006/api';

export const handlers = [
  http.get(`${API_BASE}/flights/:flightId/gpx-data`, ({ params }) => {
    // ...
  }),
];
```

**Après** :

```typescript
type HandlerFunction = Parameters<typeof http.get>[1];

const createHandlers = (
  path: string,
  handler: HandlerFunction
): HttpHandler[] => {
  return [
    http.get(`http://localhost:6006/api${path}`, handler),
    http.get(`/api${path}`, handler), // ✅ Support chemin relatif
  ];
};

export const handlers = [
  ...createHandlers('/flights/:flightId/gpx-data', ({ params }) => {
    // ...
  }),
];
```

### Endpoints modifiés

Tous les endpoints ont été migrés vers le pattern `createHandlers` :

- ✅ `/api/spots`
- ✅ `/api/spots/:spotId`
- ✅ `/api/flights`
- ✅ `/api/flights/:flightId`
- ✅ `/api/flights/:flightId/gpx-data` (celui qui posait problème)
- ✅ `/api/flights/stats`
- ✅ `/api/weather/:spotId`
- ✅ `/api/weather/:spotId/today`

---

## 🧪 Test

### Build Storybook

```bash
npm run build-storybook
# ✅ Storybook build completed successfully
```

### Vérification manuelle

1. Lancer Storybook : `npm run storybook`
2. Ouvrir la story `Components/FlightViewer3D`
3. Vérifier dans la console réseau (DevTools) :
   - ✅ `GET /api/flights/flight-001/gpx-data` → **200 OK** (mockée)
   - ✅ Pas de 404
   - ✅ Le viewer Cesium affiche la trajectoire 3D

---

## 📚 Pourquoi cette approche ?

### Alternative 1 : Forcer axios à utiliser des URLs absolues

```typescript
// ❌ Pas idéal
const API = axios.create({
  baseURL: 'http://localhost:6006/api',
});
```

**Problème** : Casse l'app en production ou développement (mauvaise URL).

### Alternative 2 : Configurer MSW pour matcher tous les chemins

```typescript
// ❌ Plus complexe
http.get(/\/api\/flights\/.*\/gpx-data/, ...)
```

**Problème** : Perd la capture des paramètres de route (`:flightId`).

### ✅ Notre solution : Double handlers

- Simple
- Supporte chemins relatifs ET absolus
- Capture les paramètres de route
- Fonctionne partout (Storybook, app, tests)

---

## 📝 Notes

### MSW et chemins relatifs

MSW (v2.x) matche les requêtes par **URL complète**, pas juste le chemin. Quand axios fait :

```javascript
axios.get('/api/flights/123/gpx-data');
```

En interne, le navigateur résout ça en :

```
http://localhost:6006/api/flights/123/gpx-data  (dans Storybook)
http://localhost:5173/api/flights/123/gpx-data  (dans l'app dev)
```

Donc il faut enregistrer les 2 patterns pour couvrir tous les cas.

### Pourquoi pas un wildcard sur le host ?

MSW ne supporte pas de wildcards sur le hostname dans `http.get()`. Il faut enregistrer explicitement chaque URL.

---

## ✅ Résultat

- ✅ Plus de 404 dans Storybook
- ✅ FlightViewer3D fonctionne correctement
- ✅ Tous les endpoints mockés disponibles
- ✅ Compatible avec l'app dev et prod

---

**Date** : 28 février 2026  
**Fichier modifié** : `src/mocks/handlers.ts`
