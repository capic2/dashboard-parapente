# Troubleshooting Cesium + Storybook

## 🐛 Problèmes courants

### 1. Error: "recentlyCreatedOwnerStacks"

**Erreur complète** :

```
Cannot read properties of undefined (reading 'recentlyCreatedOwnerStacks')
```

**Causes possibles** :

- Double cleanup des entities
- Accès au viewer après destruction
- Hot-reload/remount trop rapide
- ErrorBoundary qui crée une boucle de remount

**Solutions testées** :

- [x] Cleanup unique (1 seul useEffect)
- [x] Vérification `viewer.entities.contains()` avant suppression
- [x] Flag `isMounted`
- [x] Try/catch dans cleanup
- [x] Key unique sur Viewer (`key={flightId}`)
- [x] Suppression du remount dans ErrorBoundary

---

### 2. Viewer ne s'affiche pas

**Symptômes** :

- Écran blanc
- Loading infini
- Erreur dans console

**Checklist** :

1. ✅ Cesium installé : `npm list cesium resium vite-plugin-cesium`
2. ✅ Plugin Vite configuré : `vite.config.ts` contient `cesium()`
3. ✅ Storybook utilise vite.config : `.storybook/main.ts` → `viteConfigPath`
4. ✅ MSW handlers configurés : `/api/flights/:id/gpx-data` mocké
5. ✅ Données GPX valides : Vérifier `src/mocks/data.ts`

---

### 3. MSW 404 sur gpx-data

**Erreur** :

```
GET /api/flights/xxx/gpx-data → 404 Not Found
```

**Solution** :
Vérifier que `src/mocks/handlers.ts` utilise `createHandlers()` pour supporter chemins relatifs ET absolus.

---

## 🔧 Mode Debug

### Story Simple

Utiliser `FlightViewer3DSimple` pour tester :

```typescript
// Components/FlightViewer3D Simple (Debug)
export const Default = meta.story({
  args: {
    flightId: 'test-001',
  },
});
```

Cette version :

- ✅ Pas de GPX loading
- ✅ Pas d'entities
- ✅ Pas d'animations
- ✅ Juste le viewer Cesium de base

Si cette story fonctionne → Le problème est dans le code métier (GPX, entities, playback)
Si elle ne fonctionne pas → Le problème est dans la config Cesium/Storybook

---

## 📊 Diagnostic étape par étape

### Étape 1 : Vérifier que Cesium fonctionne seul

Créer un composant minimal :

```tsx
import { Viewer } from 'resium';

export function CesiumTest() {
  return <Viewer full />;
}
```

Story :

```tsx
export const CesiumBasic = meta.story({
  render: () => <CesiumTest />,
});
```

**Résultat attendu** : Globe 3D s'affiche

### Étape 2 : Ajouter le terrain

```tsx
<Viewer full terrain={Terrain.fromWorldTerrain()} />
```

**Résultat attendu** : Globe avec relief

### Étape 3 : Ajouter une entity simple

```tsx
const entity = viewer.entities.add({
  position: Cartesian3.fromDegrees(-75.59, 40.03),
  point: { pixelSize: 10, color: Color.RED },
});
```

**Résultat attendu** : Point rouge sur le globe

### Étape 4 : Cleanup

```tsx
React.useEffect(() => {
  // ... add entity

  return () => {
    if (entity && viewer.entities.contains(entity)) {
      viewer.entities.remove(entity);
    }
  };
}, []);
```

**Résultat attendu** : Pas d'erreur au unmount

---

## 🔍 Inspection des erreurs

### Console Browser

Ouvrir DevTools → Console, chercher :

- ❌ Erreurs Cesium (rouge)
- ⚠️ Warnings (jaune)
- 🔵 Network 404

### Network Tab

Vérifier :

- `/api/flights/:id/gpx-data` → 200 OK (mockée par MSW)
- Assets Cesium :
  - `Workers/cesium-web-worker.js`
  - `Assets/...`

### React DevTools

Vérifier :

- Composant `Viewer` monté
- Props correctes
- Pas de boucle de render

---

## 🧪 Tests progressifs

### Test 1 : Build Storybook

```bash
npm run build-storybook
```

**Si échec** → Erreur de compilation (TypeScript, imports, etc.)
**Si succès** → Problème runtime

### Test 2 : Storybook dev

```bash
npm run storybook
```

Ouvrir `http://localhost:6006`

**Tester** :

1. Story "FlightViewer3D Simple" → Doit fonctionner
2. Story "FlightViewer3D" → Peut échouer
3. Changer de story → Vérifier pas d'erreur
4. Hot-reload → Vérifier pas d'erreur

### Test 3 : App dev

```bash
npm run dev
```

Ouvrir `/` → Aller dans Flights → Sélectionner un vol → 3D

**Doit fonctionner** car pas de hot-reload agressif comme Storybook.

---

## 📝 Logs utiles

### Activer debug Cesium

```typescript
// Dans FlightViewer3D.tsx
import { Ion } from 'cesium';

Ion.defaultAccessToken = 'your-token'; // Optionnel

// Debug mode
if (process.env.NODE_ENV === 'development') {
  console.log('[Cesium] Viewer ref:', viewerRef.current);
  console.log('[Cesium] GPX data:', gpxData);
}
```

### Logs cleanup

Dans le cleanup :

```typescript
return () => {
  console.log('[Cleanup] Starting cleanup for flight:', flightId);
  console.log('[Cleanup] Viewer exists:', !!viewer);
  console.log('[Cleanup] Entities count:', viewer?.entities.values.length);

  // ... cleanup code

  console.log('[Cleanup] Cleanup complete');
};
```

---

## 🚨 Solutions d'urgence

### Option 1 : Désactiver terrain

```typescript
<Viewer
  full
  // terrain={Terrain.fromWorldTerrain()}  // ❌ Commenté
  animation={false}
  timeline={false}
/>
```

Terrain = appels réseau = peut causer des problèmes.

### Option 2 : Désactiver hot-reload dans Storybook

`.storybook/main.ts` :

```typescript
viteFinal: async (config) => {
  config.server = {
    ...config.server,
    hmr: false, // Désactive hot-reload
  };
  return config;
};
```

### Option 3 : Lazy load Cesium

```typescript
const CesiumViewer = React.lazy(() => import('./FlightViewer3D'));

export const Default = meta.story({
  render: (args) => (
    <React.Suspense fallback={<div>Loading Cesium...</div>}>
      <CesiumViewer {...args} />
    </React.Suspense>
  ),
});
```

---

## 📞 Support

Si rien ne fonctionne, fournir :

1. **Erreur exacte** (screenshot console)
2. **Moment de l'erreur** (chargement, changement story, etc.)
3. **Browser** (Chrome, Firefox, Safari)
4. **Versions** :
   ```bash
   npm list cesium resium vite-plugin-cesium react
   ```
5. **Story qui pose problème** (nom exact)
6. **Logs console** (copier-coller tout)

---

## ✅ Checklist de vérification

Avant de signaler un bug, vérifier :

- [ ] `npm install` récent
- [ ] Build Storybook réussit
- [ ] Story "Simple" fonctionne
- [ ] MSW handlers corrects (pas de 404)
- [ ] Console propre (pas d'autres erreurs)
- [ ] Testé dans Chrome (meilleur support WebGL)
- [ ] Testé en mode incognito (pas d'extensions)

---

**Dernière mise à jour** : 28 février 2026
