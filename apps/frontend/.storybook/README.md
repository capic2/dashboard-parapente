# Configuration Storybook

## Vue d'ensemble

Storybook est configuré avec les providers suivants :

- ✅ **Tanstack Router** - RouterProvider avec mémoire history (via loaders)
- ✅ **React Query** - QueryClientProvider
- ✅ **MSW** (Mock Service Worker) - Pour mocker les requêtes API

## Configuration Tanstack Router

Les stories sont automatiquement wrappées avec un `RouterProvider` qui :

- Utilise `createMemoryHistory` pour éviter les interactions avec l'URL du navigateur
- Crée une route root simple pour **isoler les composants** (pas le routeTree complet de l'app)
- Permet l'utilisation de `<Link>`, `useNavigate()`, et autres hooks/composants du router
- Est créé via un **loader** Storybook pour chaque story (isolation complète)

### ⚠️ Important : Route Loaders

Les **route loaders de Tanstack Router** (définis dans `src/routes/*.tsx`) **ne sont PAS exécutés** dans Storybook. C'est intentionnel pour l'isolation des composants.

**Pour mocker les données** qui viendraient normalement d'un loader de route :

- Utilisez **MSW** pour mocker les requêtes API
- Passez les données via **args** au composant
- Utilisez les **parameters** de la story pour configuration

### Exemple d'utilisation basique

```tsx
import preview from '../../.storybook/preview';
import MyComponent from './MyComponent';

const meta = preview.meta({
  title: 'Components/MyComponent',
  component: MyComponent,
});

export const Default = meta.story({
  args: {
    // vos props
  },
});

export default meta;
```

### Personnaliser la route initiale avec parameters

Par défaut, le router est initialisé avec la route `/`. Vous pouvez personnaliser cela avec `parameters.router` au niveau de la story :

```tsx
export const OnSettingsPage = meta.story({
  args: {},
  parameters: {
    router: {
      initialEntries: ['/settings'],
      initialIndex: 0,
      routes: ['/settings'], // Routes to register
    },
  },
});
```

### Avantages du nouveau pattern

1. **Support `<Outlet />`** : Les composants peuvent utiliser `<Outlet />` de Tanstack Router
2. **Routes dynamiques** : Spécifier plusieurs routes via `routes: ['/path1', '/path2']`
3. **QueryClient context** : Disponible pour les loaders futurs via `context.queryClient`
4. **Plus flexible** : Facilite les tests de navigation complexes

### Exemple complet avec plusieurs routes

```tsx
import preview from '../../.storybook/preview';
import Header from './Header';

const meta = preview.meta({
  title: 'Components/Header',
  component: Header,
});

// Default: router à '/'
export const Default = meta.story({
  args: {},
});

// Router initialisé sur '/flights'
export const OnFlightsPage = meta.story({
  args: {},
  loaders: [
    async () => ({
      routerConfig: {
        initialEntries: ['/flights'],
      },
    }),
  ],
});

// Router avec navigation history
export const WithHistory = meta.story({
  args: {},
  loaders: [
    async () => ({
      routerConfig: {
        initialEntries: ['/', '/analytics', '/flights'],
        initialIndex: 2, // Commence à '/flights'
      },
    }),
  ],
});

export default meta;
```

### Routes disponibles dans Storybook

Par défaut, le router est initialisé avec la route `/`. Si votre composant nécessite des routes spécifiques ou des paramètres, vous pouvez personnaliser le router au niveau de la story :

```tsx
export const WithCustomRoute = meta.story({
  parameters: {
    // Configuration personnalisée si nécessaire
  },
  args: {},
});
```

## Mock Service Worker (MSW)

Pour mocker des requêtes API dans vos stories :

```tsx
import { http, HttpResponse } from 'msw';

export const WithMockedData = meta.story({
  parameters: {
    msw: {
      handlers: [
        http.get('/api/data', () => {
          return HttpResponse.json({ data: 'mocked' });
        }),
      ],
    },
  },
});
```

## Accessibilité

Les tests d'accessibilité sont configurés en mode `'todo'` par défaut, ce qui affiche les violations dans l'UI sans faire échouer les tests.

## Commandes

- `npm run storybook` - Démarrer Storybook en mode dev
- `npm run build-storybook` - Build Storybook pour production
