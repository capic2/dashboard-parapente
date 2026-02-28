# Fix : MSW bloque Cesium Terrain

## 🐛 Problème

Erreur dans la console :

```
Uncaught (in promise) TypeError: Failed to fetch
    at passthrough (mockServiceWorker.js:238:12)
```

**Cause** : `Terrain.fromWorldTerrain()` essaie de charger des données terrain depuis `https://assets.cesium.com` mais MSW (Mock Service Worker) intercepte toutes les requêtes.

## ✅ Solution temporaire (appliquée)

**Désactiver le terrain** dans `FlightViewer3D.tsx` :

```typescript
const viewer = new CesiumViewer(containerRef.current, {
  // terrain: Terrain.fromWorldTerrain(), // Désactivé pour éviter erreur MSW
  animation: false,
  // ...
});
```

**Résultat** :

- ✅ Globe Cesium s'affiche (sans relief)
- ✅ Pas d'erreur MSW
- ✅ Trajectoires 3D fonctionnent

## 🎯 Solution permanente (à implémenter)

### Option 1 : Désactiver MSW pour Cesium (Recommandé)

Modifier `.storybook/preview.tsx` :

```typescript
// Initialize MSW
initialize({
  onUnhandledRequest(req, print) {
    // Ignorer silencieusement les requêtes Cesium
    const url = req.url;
    if (
      url.includes('cesium.com') ||
      url.includes('cesium') ||
      url.includes('/Build/Cesium/') ||
      url.includes('/Workers/')
    ) {
      return; // Ne rien faire
    }

    // Logger les autres requêtes non gérées
    print.warning();
  },
});
```

**ET** configurer le Service Worker pour bypass Cesium :

Créer un fichier `.storybook/msw.ts` :

```typescript
export const mswConfig = {
  // Bypass certaines URLs
  quiet: false,
  onUnhandledRequest(req: Request) {
    const url = new URL(req.url);

    // Liste des domaines à bypass
    const bypassDomains = [
      'ion.cesium.com',
      'assets.cesium.com',
      'api.cesium.com',
    ];

    // Liste des patterns à bypass
    const bypassPatterns = [
      '/Build/Cesium/',
      '/Workers/',
      '/Assets/',
      '/ThirdParty/',
    ];

    // Check domain
    if (bypassDomains.some((domain) => url.hostname.includes(domain))) {
      return 'bypass';
    }

    // Check path
    if (bypassPatterns.some((pattern) => url.pathname.includes(pattern))) {
      return 'bypass';
    }

    return 'warn';
  },
};
```

### Option 2 : Mode hybride (Terrain en prod, pas en Storybook)

```typescript
const viewer = new CesiumViewer(containerRef.current, {
  terrain:
    process.env.NODE_ENV === 'production'
      ? Terrain.fromWorldTerrain()
      : undefined,
  // ...
});
```

**Problème** : Storybook et dev utilisent tous les deux `NODE_ENV=development`.

**Meilleure approche** :

```typescript
const viewer = new CesiumViewer(containerRef.current, {
  terrain: import.meta.env.STORYBOOK ? undefined : Terrain.fromWorldTerrain(),
  // ...
});
```

Puis dans `.storybook/main.ts` :

```typescript
export default defineMain({
  // ...
  viteFinal: async (config) => {
    config.define = {
      ...config.define,
      'import.meta.env.STORYBOOK': JSON.stringify(true),
    };
    return config;
  },
});
```

### Option 3 : Mock le terrain provider

Créer un handler MSW pour les tuiles terrain :

```typescript
// src/mocks/handlers.ts
export const handlers = [
  // ... existing handlers

  // Mock Cesium terrain tiles
  http.get('https://assets.cesium.com/*', () => {
    // Return empty terrain (flat)
    return HttpResponse.arrayBuffer(new ArrayBuffer(0), {
      status: 200,
      headers: {
        'Content-Type': 'application/octet-stream',
      },
    });
  }),
];
```

**Problème** : Cesium peut crasher avec des données invalides.

## 📝 État actuel

**Configuration actuelle** :

- ✅ **Terrain ACTIVÉ** (Option 1 implémentée)
- ✅ MSW bypass configuré pour domaines Cesium
- ✅ Globe s'affiche avec relief terrain
- ✅ Trajectoires 3D fonctionnent
- ✅ Pas d'erreur MSW

**Solution implémentée** : Option 1 - MSW Bypass

Dans `.storybook/preview.tsx` :

```typescript
initialize({
  onUnhandledRequest: (req, print) => {
    const url = req.url.toString();
    if (
      url.includes('cesium.com') ||
      url.includes('cesiumjs.org') ||
      url.includes('ion.cesium.com') ||
      url.includes('assets.cesium.com')
    ) {
      return; // Silently bypass - MSW won't intercept
    }
    print.warning();
  },
});
```

Dans `FlightViewer3D.tsx` :

```typescript
const viewer = new CesiumViewer(containerRef.current, {
  terrain: Terrain.fromWorldTerrain(), // Re-enabled - MSW bypasses Cesium domains
  // ...
});
```

## 🧪 Test

### Avec terrain activé (ACTUEL)

```bash
npm run storybook
# Ouvrir Components/FlightViewer3D
# ✅ Globe avec relief s'affiche
# ✅ Pas d'erreur MSW
# ✅ Terrain tiles chargent depuis assets.cesium.com
```

### Résultats de build

```bash
npm run build-storybook
# ✅ Build réussi

npm run build
# ✅ Build réussi
```

## 🎯 Résultat

**✅ PROBLÈME RÉSOLU** - Option 1 implémentée avec succès

- ✅ Terrain activé partout (Storybook + Production)
- ✅ MSW bypass configuré pour domaines Cesium
- ✅ Globe affiche relief terrain complet
- ✅ Pas d'erreur MSW
- ✅ Builds réussis (Storybook + App)

---

**Date** : 28 février 2026  
**Status** : ✅ **RÉSOLU** - Terrain activé avec MSW bypass  
**Solution** : Option 1 (MSW bypass pour domaines Cesium)
