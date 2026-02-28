# Changements : Storybook + Tanstack Router + Cesium

## 📅 Date : 28 février 2026

## 🎯 Objectifs accomplis

1. ✅ Amélioration de la configuration Storybook avec le pattern du router decorator (inspiré de meteo-parapente-new)
2. ✅ Activation complète de Cesium dans FlightViewer3D
3. ✅ Correction des props FlightViewer3D dans FlightHistory
4. ✅ Mise à jour de la documentation

---

## 📦 Phase 1 : Amélioration Storybook Router Decorator

### Changements dans `.storybook/preview.tsx`

#### Avant

```typescript
// Utilisait un loader Storybook pour passer routerConfig
decorators: [
  (Story, { loaded: { routerConfig } }) => {
    const rootRoute = createRootRoute({
      component: () => <div><Story /></div>
    });
    // ...
  }
]
```

#### Après (nouveau pattern)

```typescript
// Utilise parameters.router pour plus de flexibilité
decorators: [
  (Story, { parameters }) => {
    const {
      initialEntries = ['/'],
      initialIndex = 0,
      routes = ['/'],
    } = parameters?.router || {};

    // Root route avec <Outlet />
    const rootRoute = createRootRoute({
      component: () => (
        <div style={{ padding: '1rem' }}>
          <Outlet />
        </div>
      ),
    });

    // Story devient le composant de route
    rootRoute.addChildren(
      routes.map((path: string) =>
        createRoute({
          path,
          getParentRoute: () => rootRoute,
          component: Story,
        })
      )
    );

    // QueryClient injecté dans le contexte du router
    const router = createRouter({
      routeTree: rootRoute,
      history: createMemoryHistory({ initialEntries, initialIndex }),
      context: { queryClient }, // Pour loaders futurs
    });

    return (
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    );
  },
]
```

### Avantages

1. **Support `<Outlet />`** : Les composants peuvent utiliser `<Outlet />` de Tanstack Router
2. **Routes dynamiques** : Spécifier plusieurs routes via `routes: ['/path1', '/path2']`
3. **QueryClient context** : Disponible pour les loaders via `context.queryClient`
4. **Plus flexible** : Simplifie les tests de navigation
5. **Cohérence** : Même pattern que meteo-parapente-new

### Fichiers modifiés

- `.storybook/preview.tsx` : Nouveau decorator avec `<Outlet />` et routes dynamiques
- `src/components/Header.stories.tsx` : Utilise `parameters.router` au lieu de `loaders`
- `.storybook/README.md` : Documentation mise à jour

---

## 📦 Phase 2 : Optimisation FlightViewer3D

### Changements dans `src/components/FlightViewer3D.tsx`

#### Avant (lignes 342-355)

```typescript
<Viewer
  ref={viewerRef}
  full
  /* terrain={Terrain.fromWorldTerrain()}
  animation={false}
  timeline={false}
  baseLayerPicker={false}*/
  /*fullscreenButton={false}
  ...*/
/>
```

#### Après

```typescript
<Viewer
  ref={viewerRef}
  full
  terrain={Terrain.fromWorldTerrain()}        // ✅ Activé
  animation={false}                            // ✅ Activé
  timeline={false}                             // ✅ Activé
  baseLayerPicker={false}                      // ✅ Activé
  fullscreenButton={false}                     // ✅ Activé
  navigationHelpButton={false}                 // ✅ Activé
  sceneModePicker={false}                      // ✅ Activé
  infoBox={false}                              // ✅ Activé
  selectionIndicator={false}                   // ✅ Activé
/>
```

### Bénéfices

- **Terrain 3D** : Affichage du relief mondial (World Terrain)
- **Interface propre** : UI Cesium minimale (pas de timeline, animation, etc.)
- **Performance** : Désactivation des éléments inutiles

---

## 📦 Phase 3 : Correction FlightHistory

### Changements dans `src/pages/FlightHistory.tsx`

#### Avant (lignes 285-290)

```typescript
<FlightViewer3D
  flightId={selectedFlightId}
  flightTitle={selectedFlight.title || ...}
  showReplay={true}              // ❌ Props inexistante
  showElevationChart={true}      // ❌ Props inexistante
/>
```

#### Après

```typescript
<FlightViewer3D
  flightId={selectedFlightId}
  flightTitle={selectedFlight.title || ...}
/>
```

### Interface FlightViewer3DProps

```typescript
export interface FlightViewer3DProps {
  flightId: string;
  flightTitle?: string;
}
```

---

## 📦 Phase 4 : Documentation

### Nouveaux fichiers

1. **`.storybook/README.md`** (mis à jour)
   - Section "Personnaliser la route initiale avec parameters"
   - Avantages du nouveau pattern
   - Exemples d'utilisation

2. **`.storybook/LOADERS.md`** (existant)
   - Guide sur les loaders Storybook
   - Exemples avancés

3. **`.storybook/ROUTE-LOADERS.md`** (existant)
   - Relation avec Tanstack Router loaders
   - Pattern recommandé (React Query dans composants)

4. **`CHANGEMENTS_STORYBOOK_CESIUM.md`** (ce fichier)
   - Résumé des changements
   - Avant/après
   - Guide de migration

---

## 🧪 Tests effectués

### Build Storybook

```bash
npm run build-storybook
# ✅ Storybook build completed successfully
```

### Build Application

```bash
npm run build
# ✅ built in 10.79s
```

### TypeScript

```bash
npm run type-check
# ⚠️ Erreurs pré-existantes dans useFlights.ts (non liées à nos changements)
```

---

## 🚀 Utilisation

### Exemple : Story avec route personnalisée

#### Ancien pattern (avec loader)

```typescript
export const OnFlightsPage = meta.story({
  loaders: [
    async () => ({
      routerConfig: { initialEntries: ['/flights'] },
    }),
  ],
});
```

#### Nouveau pattern (avec parameters)

```typescript
export const OnFlightsPage = meta.story({
  parameters: {
    router: {
      initialEntries: ['/flights'],
      routes: ['/flights'],
    },
  },
});
```

### Exemple : Story avec historique de navigation

```typescript
export const WithNavigationHistory = meta.story({
  parameters: {
    router: {
      initialEntries: ['/', '/flights', '/analytics'],
      initialIndex: 2, // Position actuelle: /analytics
      routes: ['/', '/flights', '/analytics'],
    },
  },
});
```

---

## 📚 Prochaines étapes (optionnelles)

### Améliorations possibles pour FlightViewer3D

1. **Offset d'altitude** : Slider pour ajuster l'altitude (-500m à +500m)
2. **Bouton "Suivre"** : Caméra qui suit le curseur pendant la lecture
3. **Barre de progression** : Indicateur visuel de progression
4. **Export vidéo** : Enregistrer la timeline en WebM
5. **Graphique d'élévation** : Profil altimétrique synchronisé

### Route dédiée

Créer `/flights/:id/3d` pour visualisation plein écran :

```typescript
// src/routes/flights/$id.3d.tsx
export const Route = createFileRoute('/flights/$id/3d')({
  component: FlightViewer3DPage,
});

function FlightViewer3DPage() {
  const { id } = Route.useParams();
  return (
    <div className="h-screen w-screen">
      <FlightViewer3D flightId={id} />
    </div>
  );
}
```

---

## 🐛 Problèmes connus

### TypeScript

Erreurs pré-existantes dans `src/hooks/useFlights.ts` :

- Types `Flight` vs réponse API (incompatibilités `user_id`)
- Types `FlightStats` (incompatibilités `favorite_spot`)

**Solution** : Corriger les types dans `src/types/flight.ts` ou utiliser des type assertions.

### Storybook + Cesium

- **Limitation** : Cesium nécessite WebGL, certaines histoires peuvent ne pas s'afficher correctement dans Chromatic (screenshots)
- **Workaround** : Utiliser `chromatic: { disableSnapshot: true }` pour les stories Cesium

---

## ✅ Résumé

| Composant                  | Status         | Commentaire                          |
| -------------------------- | -------------- | ------------------------------------ |
| Storybook Router Decorator | ✅ Amélioré    | Pattern meteo-parapente-new appliqué |
| FlightViewer3D             | ✅ Optimisé    | Cesium entièrement activé            |
| FlightHistory              | ✅ Corrigé     | Props FlightViewer3D alignées        |
| Documentation              | ✅ Mise à jour | README + guides loaders              |
| Build Storybook            | ✅ Fonctionnel | Compile sans erreur                  |
| Build Application          | ✅ Fonctionnel | Compile sans erreur                  |

---

## 📖 Documentation complète

- `.storybook/README.md` : Configuration générale Storybook
- `.storybook/LOADERS.md` : Guide loaders Storybook
- `.storybook/ROUTE-LOADERS.md` : Relation avec Tanstack Router loaders

---

**Date de création** : 28 février 2026  
**Auteur** : Claude (Assistant IA)  
**Version** : 1.0
