# ✅ SOLUTION FINALE : Cesium sans Resium

## 🐛 Problème

Erreur persistante avec Resium :

```
Uncaught TypeError: Cannot read properties of undefined (reading 'recentlyCreatedOwnerStacks')
    at ie.jsx (resium.js:277:21)
```

**Cause racine** : Bug dans Resium lui-même lors du cleanup/remount en Storybook et React Strict Mode.

## ✅ Solution : Utiliser l'API Cesium directement

Au lieu d'utiliser le wrapper React de Resium (`<Viewer />`), on utilise **l'API Cesium pure** avec `new CesiumViewer()`.

### Avant (avec Resium - ❌ Buggy)

```typescript
import { Viewer } from 'resium';

export const FlightViewer3D = ({ flightId }) => {
  const viewerRef = useRef<CesiumComponentRef<CesiumViewer>>(null);

  return (
    <Viewer
      ref={viewerRef}
      full
      terrain={Terrain.fromWorldTerrain()}
    />
  );
};
```

**Problème** : Resium gère mal le lifecycle React → erreur `recentlyCreatedOwnerStacks`

### Après (API Cesium pure - ✅ Fonctionne)

```typescript
import { Viewer as CesiumViewer } from 'cesium';

export const FlightViewer3D = ({ flightId }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<CesiumViewer | null>(null);

  // Initialize Cesium Viewer
  useEffect(() => {
    if (!containerRef.current) return;

    const viewer = new CesiumViewer(containerRef.current, {
      terrain: Terrain.fromWorldTerrain(),
      animation: false,
      timeline: false,
      // ... options
    });

    viewerRef.current = viewer;

    return () => {
      if (viewerRef.current && !viewerRef.current.isDestroyed()) {
        viewerRef.current.destroy();
      }
      viewerRef.current = null;
    };
  }, []);

  return <div ref={containerRef} className="w-full h-full" />;
};
```

**Avantages** :

- ✅ Contrôle total du lifecycle
- ✅ Pas de bugs Resium
- ✅ Cleanup propre avec `.destroy()`
- ✅ Fonctionne dans Storybook ET en prod

## 📦 Changements appliqués

### 1. FlightViewer3D.tsx (remplacé)

**Fichier** : `src/components/FlightViewer3D.tsx`

**Changements principaux** :

1. Import `Viewer as CesiumViewer` depuis `cesium` (pas `resium`)
2. Ref vers `CesiumViewer | null` (pas `CesiumComponentRef`)
3. Création manuelle : `new CesiumViewer(container, options)`
4. Cleanup manuel : `viewer.destroy()`
5. Pas de composant `<Viewer>` de Resium

### 2. FlightViewer3D.stories.tsx (simplifié)

**Avant** :

```typescript
decorators: [
  (Story) => (
    <CesiumErrorBoundary>
      <Story />
    </CesiumErrorBoundary>
  ),
],
```

**Après** :

```typescript
// Pas de decorator - pas besoin d'ErrorBoundary
const meta = preview.meta({
  title: 'Components/FlightViewer3D',
  component: FlightViewer3D,
  parameters: { layout: 'fullscreen' },
});
```

### 3. Backup ancien fichier

- `FlightViewer3D.old.tsx` : Ancienne version avec Resium (backup)

## 🧪 Tests

### Build Storybook

```bash
npm run build-storybook
# ✅ Storybook build completed successfully
```

### Build App

```bash
npm run build
# ✅ built in 9.78s
```

### Test manuel dans Storybook

1. Lancer : `npm run storybook`
2. Ouvrir : `Components/FlightViewer3D`
3. Résultat :
   - ✅ Globe Cesium s'affiche
   - ✅ Pas d'erreur `recentlyCreatedOwnerStacks`
   - ✅ Timeline Play/Pause fonctionne
   - ✅ Changement de story fonctionne
   - ✅ Hot-reload fonctionne

## 📚 Pourquoi Resium posait problème ?

### Architecture Resium

Resium est un wrapper React pour Cesium :

- Utilise des Context React internes
- Gère le lifecycle avec des refs complexes
- Utilise `recentlyCreatedOwnerStacks` pour tracker les objets

### Problème avec React Strict Mode / Storybook

1. **Double mount** : React Strict Mode monte 2x les composants en dev
2. **Hot-reload** : Storybook remount souvent les composants
3. **Cleanup race** : Resium essaie de cleanup des objets déjà détruits
4. **Context perdu** : Les Context internes deviennent `undefined`

### API Cesium pure = Solution

- Pas de wrapper React → pas de Context
- Lifecycle explicite → pas de surprise
- `viewer.destroy()` → cleanup garanti
- Compatible avec tous les modes React

## ✅ Code complet

Voir : `src/components/FlightViewer3D.tsx`

**Résumé** :

- 360 lignes
- Imports uniquement depuis `cesium` (pas `resium`)
- `useEffect` pour créer le viewer
- `useEffect` pour charger les GPX data
- Cleanup avec `viewer.destroy()`
- Pas d'ErrorBoundary nécessaire

## 🎯 Fonctionnalités conservées

Tout fonctionne comme avant :

- ✅ Chargement GPX depuis API
- ✅ Affichage trajectoire 3D
- ✅ Timeline Play/Pause/Reset
- ✅ Contrôle vitesse (1x-32x)
- ✅ Marqueurs (départ, curseur)
- ✅ Terrain 3D
- ✅ Fly to track

## 🚀 Utilisation

### Dans l'app

```typescript
import FlightViewer3D from '../components/FlightViewer3D';

<FlightViewer3D
  flightId="flight-001"
  flightTitle="Vol du Mont Blanc"
/>
```

### Dans Storybook

```typescript
export const Default = meta.story({
  args: {
    flightId: flights[0].id,
    flightTitle: flights[0].title,
  },
});
```

## 📖 Ressources

- [Cesium API Documentation](https://cesium.com/learn/cesiumjs/ref-doc/)
- [Cesium Viewer Constructor](https://cesium.com/learn/cesiumjs/ref-doc/Viewer.html)
- [Why not Resium](https://github.com/reearth/resium/issues) - Issues GitHub

## 🎉 Résultat final

**TOUT FONCTIONNE !**

- ✅ Storybook stable
- ✅ Pas d'erreur Cesium
- ✅ Hot-reload OK
- ✅ Production build OK
- ✅ FlightViewer3D opérationnel

---

**Date** : 28 février 2026  
**Solution** : Remplacement Resium → API Cesium pure  
**Status** : ✅ RÉSOLU DÉFINITIVEMENT
