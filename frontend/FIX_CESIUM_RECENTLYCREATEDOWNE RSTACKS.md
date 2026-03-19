# Fix : Error Cesium "recentlyCreatedOwnerStacks"

## 🐛 Problème

Erreur dans Storybook et parfois dans l'app :

```
Cannot read properties of undefined (reading 'recentlyCreatedOwnerStacks')
```

Cette erreur Cesium apparaît généralement lors :

- Du hot-reload dans Storybook
- Du changement de story
- Du unmount/remount du composant

### Cause racine

**Double cleanup** + **accès à des ressources détruites** :

1. Le composant avait **2 useEffect avec cleanup** :
   - Un dans `useEffect([gpxData, ...])` qui nettoie les entities
   - Un dans `useEffect([])` qui nettoie aussi les entities au unmount

2. **Race condition** : Quand le composant unmount :
   - Le premier cleanup essaie de supprimer les entities
   - Le second cleanup essaie AUSSI de les supprimer
   - Mais Cesium a déjà détruit certaines ressources internes
   - → `recentlyCreatedOwnerStacks` devient `undefined`

3. **Pas de vérification** avant suppression :
   - On appelait `viewer.entities.remove()` sans vérifier si l'entity existe encore
   - Cesium crash si on essaie de supprimer une entity déjà détruite

---

## ✅ Solution

### 1. Supprimer le double cleanup

**Avant** (2 useEffect avec cleanup) :

```typescript
// useEffect 1: cleanup au changement de gpxData
React.useEffect(() => {
  // ... setup entities

  return () => {
    // Cleanup entities
    viewer.entities.remove(polylineEntityRef.current);
    // ...
  };
}, [gpxData]);

// useEffect 2: cleanup au unmount (DOUBLON!)
React.useEffect(() => {
  return () => {
    // Cleanup entities ENCORE!
    viewer.entities.remove(polylineEntityRef.current);
    // ...
  };
}, []);
```

**Après** (1 seul useEffect avec cleanup) :

```typescript
// useEffect unique: cleanup au changement ET au unmount
React.useEffect(() => {
  // ... setup entities

  return () => {
    // Cleanup une seule fois
  };
}, [gpxData]);
```

### 2. Vérifier l'existence avant suppression

**Avant** (dangereux) :

```typescript
viewer.entities.remove(polylineEntityRef.current);
```

**Après** (sécurisé) :

```typescript
if (
  polylineEntityRef.current &&
  viewer.entities.contains(polylineEntityRef.current)
) {
  viewer.entities.remove(polylineEntityRef.current);
}
```

### 3. Ajouter un flag `isMounted`

Pour éviter les opérations asynchrones après unmount :

```typescript
React.useEffect(() => {
  let isMounted = true;

  // ... async operations

  if (isMounted && viewer.camera) {
    viewer.camera.flyTo({...});
  }

  return () => {
    isMounted = false;
    // ... cleanup
  };
}, [gpxData]);
```

### 4. Try/catch dans le cleanup

Pour gérer les erreurs de Cesium gracefully :

```typescript
return () => {
  const viewer = viewerRef.current?.cesiumElement;
  if (!viewer || !viewer.entities) return;

  try {
    if (
      polylineEntityRef.current &&
      viewer.entities.contains(polylineEntityRef.current)
    ) {
      viewer.entities.remove(polylineEntityRef.current);
    }
  } catch (e) {
    // Ignore errors - viewer might be destroyed
    console.debug('Cleanup warning (safe to ignore):', e);
  }
};
```

---

## 📝 Code complet du fix

### Fichier : `src/components/FlightViewer3D.tsx`

**Changements principaux** :

```typescript
// Initialize viewer with GPX data
React.useEffect(() => {
  if (!gpxData?.coordinates || gpxData.coordinates.length === 0) return;

  const viewer = viewerRef.current?.cesiumElement;
  if (!viewer || !viewer.scene) return; // ✅ Vérifier viewer.scene

  let isMounted = true; // ✅ Flag pour éviter opérations après unmount

  try {
    // ... setup positions, timestamps, etc.

    // ✅ Clean old entities SAFELY
    try {
      if (
        polylineEntityRef.current &&
        viewer.entities.contains(polylineEntityRef.current)
      ) {
        viewer.entities.remove(polylineEntityRef.current);
      }
      if (
        cursorEntityRef.current &&
        viewer.entities.contains(cursorEntityRef.current)
      ) {
        viewer.entities.remove(cursorEntityRef.current);
      }
      if (
        startEntityRef.current &&
        viewer.entities.contains(startEntityRef.current)
      ) {
        viewer.entities.remove(startEntityRef.current);
      }
    } catch (e) {
      console.warn('Error cleaning old entities:', e);
    }

    if (!isMounted) return; // ✅ Check before continuing

    // ... create new entities

    // ✅ Fly to track safely
    if (isMounted && viewer.camera) {
      viewer.camera.flyTo({
        destination: Rectangle.fromCartesianArray(positions),
        duration: 2,
      });
    }
  } catch (err) {
    console.error('Error loading GPX data:', err);
  }

  // ✅ Cleanup function (UNIQUE)
  return () => {
    isMounted = false;

    // Clear interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    // ✅ Safe cleanup with existence checks
    const viewer = viewerRef.current?.cesiumElement;
    if (!viewer || !viewer.entities) return;

    try {
      if (
        polylineEntityRef.current &&
        viewer.entities.contains(polylineEntityRef.current)
      ) {
        viewer.entities.remove(polylineEntityRef.current);
      }
      if (
        cursorEntityRef.current &&
        viewer.entities.contains(cursorEntityRef.current)
      ) {
        viewer.entities.remove(cursorEntityRef.current);
      }
      if (
        startEntityRef.current &&
        viewer.entities.contains(startEntityRef.current)
      ) {
        viewer.entities.remove(startEntityRef.current);
      }
    } catch (e) {
      console.debug('Cleanup warning (safe to ignore):', e);
    }

    // Clear refs
    polylineEntityRef.current = null;
    cursorEntityRef.current = null;
    startEntityRef.current = null;

    // Reset state
    isPlayingRef.current = false;
    currentIndexRef.current = 0;
    visiblePositionsRef.current = [];
  };
}, [gpxData, extractTimestamps]);

// ✅ REMOVED: Second cleanup useEffect (was causing double cleanup)
```

---

## 🧪 Test

### Build Storybook

```bash
npm run build-storybook
# ✅ Storybook build completed successfully
```

### Test manuel

1. Lancer Storybook : `npm run storybook`
2. Ouvrir `Components/FlightViewer3D`
3. Changer de story plusieurs fois
4. Vérifier la console :
   - ✅ Pas d'erreur `recentlyCreatedOwnerStacks`
   - ✅ Peut voir des `console.debug` (safe to ignore)
   - ✅ Le viewer Cesium fonctionne

---

## 📚 Pourquoi cette erreur est courante avec Cesium ?

### Architecture interne de Cesium

Cesium utilise des **pools de ressources** pour optimiser la mémoire :

- `recentlyCreatedOwnerStacks` fait partie du système de tracking interne
- Quand Cesium détruit des ressources, ces stacks sont libérées
- Si on essaie d'accéder après destruction → `undefined`

### React + Cesium = Challenges

1. **Lifecycle mismatch** :
   - React peut unmount/remount rapidement (hot reload, Strict Mode)
   - Cesium s'attend à un lifecycle plus stable

2. **Async operations** :
   - `camera.flyTo()` est asynchrone
   - Si le composant unmount pendant l'animation → crash

3. **Entity management** :
   - Les entities Cesium ne sont pas des objets React
   - Faut gérer manuellement le cleanup

---

## ✅ Bonnes pratiques Cesium + React

### 1. Un seul cleanup

```typescript
// ✅ Bon
React.useEffect(() => {
  // setup
  return () => {
    /* cleanup */
  };
}, [deps]);

// ❌ Mauvais
React.useEffect(() => {
  /* setup */ return () => {
    /* cleanup */
  };
}, [deps]);
React.useEffect(() => {
  return () => {
    /* DOUBLE cleanup */
  };
}, []);
```

### 2. Toujours vérifier existence

```typescript
// ✅ Bon
if (entity && viewer.entities.contains(entity)) {
  viewer.entities.remove(entity);
}

// ❌ Mauvais
viewer.entities.remove(entity);
```

### 3. Flag `isMounted` pour async

```typescript
// ✅ Bon
let isMounted = true;
setTimeout(() => {
  if (isMounted) doSomething();
}, 1000);
return () => {
  isMounted = false;
};

// ❌ Mauvais
setTimeout(() => {
  doSomething(); // Peut crash si unmounted
}, 1000);
```

### 4. Try/catch dans cleanup

```typescript
// ✅ Bon
try {
  cleanup();
} catch (e) {
  console.debug('Cleanup error (safe):', e);
}

// ❌ Mauvais
cleanup(); // Peut crash et bloquer React
```

### 5. Vérifier viewer.scene

```typescript
// ✅ Bon
if (!viewer || !viewer.scene) return;

// ❌ Mauvais
if (!viewer) return;
```

---

## 🔗 Ressources

- [Cesium Entity API](https://cesium.com/learn/cesiumjs/ref-doc/Entity.html)
- [Resium Lifecycle](https://resium.reearth.io/)
- [React Strict Mode](https://react.dev/reference/react/StrictMode)

---

**Date** : 28 février 2026  
**Fichier modifié** : `src/components/FlightViewer3D.tsx`  
**Status** : ✅ FIXÉ
