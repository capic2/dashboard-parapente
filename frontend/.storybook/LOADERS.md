# Utilisation des Loaders pour Tanstack Router

## Pourquoi utiliser des loaders ?

Les **loaders** Storybook permettent de charger des données de manière asynchrone **avant** le rendu de la story. Dans notre configuration, nous utilisons les loaders pour :

### ✅ Avantages

1. **Isolation complète** : Chaque story obtient sa propre instance de router
2. **Pas de state partagé** : Évite les problèmes de pollution entre stories
3. **Configuration flexible** : Personnalisez le router par story (route initiale, historique, etc.)
4. **Performance** : Le router est créé une fois par story, pas à chaque re-render
5. **Testabilité** : Facile de tester différents états de navigation

## Architecture

### Flux de données

```
Story Loader
    ↓
  loaded.routerConfig
    ↓
  Decorator
    ↓
  createRouter(routerConfig)
    ↓
  RouterProvider
    ↓
  Story Component
```

### Code du loader global

```tsx
// .storybook/preview.tsx
const routerLoader = async () => {
  return {
    routerConfig: {
      initialEntries: ['/'],
    },
  };
};

export default definePreview({
  loaders: [mswLoader, routerLoader],
  decorators: [
    (Story, { loaded: { routerConfig } }) => {
      const router = createRouter({
        routeTree: createRootRoute({
          component: () => <Story />,
        }),
        history: createMemoryHistory({
          initialEntries: routerConfig?.initialEntries || ['/'],
        }),
      });

      return (
        <QueryClientProvider client={queryClient}>
          <RouterProvider router={router} />
        </QueryClientProvider>
      );
    },
  ],
});
```

## Exemples d'utilisation

### 1. Story basique (route par défaut)

```tsx
export const Default = meta.story({
  args: {},
});
// Router initialisé à '/'
```

### 2. Story avec route personnalisée

```tsx
export const OnSettingsPage = meta.story({
  args: {},
  loaders: [
    async () => ({
      routerConfig: {
        initialEntries: ['/settings'],
      },
    }),
  ],
});
// Router initialisé à '/settings'
```

### 3. Story avec historique de navigation

```tsx
export const AfterNavigation = meta.story({
  args: {},
  loaders: [
    async () => ({
      routerConfig: {
        // Simule une navigation : Home -> Flights -> Settings
        initialEntries: ['/', '/flights', '/settings'],
        initialIndex: 2, // Position actuelle: /settings
      },
    }),
  ],
});
// Router à '/settings' avec historique complet
```

### 4. Story avec paramètres de route

```tsx
export const WithRouteParams = meta.story({
  args: {},
  loaders: [
    async () => ({
      routerConfig: {
        initialEntries: ['/flights/abc123'],
      },
    }),
  ],
});
// Router à '/flights/:id' avec id='abc123'
```

### 5. Combiner avec MSW pour des scénarios complets

```tsx
export const FlightDetailLoaded = meta.story({
  args: {},
  loaders: [
    async () => ({
      routerConfig: {
        initialEntries: ['/flights/flight-001'],
      },
    }),
  ],
  parameters: {
    msw: {
      handlers: [
        http.get('/api/flights/flight-001', () => {
          return HttpResponse.json({
            id: 'flight-001',
            title: 'Vol du Mont Blanc',
            duration_minutes: 120,
          });
        }),
      ],
    },
  },
});
// Router + API mockée = scénario complet testé
```

## Cas d'usage avancés

### Tester les redirections

```tsx
export const RedirectToLogin = meta.story({
  loaders: [
    async () => ({
      routerConfig: {
        initialEntries: ['/protected-page'],
        // Votre logique de routing devrait rediriger vers /login
      },
    }),
  ],
});
```

### Tester les liens actifs

```tsx
export const ActiveLink = meta.story({
  loaders: [
    async () => ({
      routerConfig: {
        initialEntries: ['/analytics'],
      },
    }),
  ],
});
// Le lien "Analyses" sera actif dans le Header
```

## Bonnes pratiques

1. ✅ **Utilisez des loaders** pour configurer le router plutôt que des parameters
2. ✅ **Documentez** les routes utilisées dans vos stories (commentaires JSDoc)
3. ✅ **Testez différents états** de navigation (début, milieu, fin du parcours)
4. ✅ **Combinez** avec MSW pour des scénarios réalistes
5. ❌ **N'essayez pas** de modifier le router après son initialisation
6. ❌ **Ne partagez pas** d'instances de router entre stories

## Débogage

Pour inspecter la configuration du router :

```tsx
export const Debug = meta.story({
  loaders: [
    async () => {
      const config = { initialEntries: ['/flights'] };
      console.log('Router config:', config);
      return { routerConfig: config };
    },
  ],
  play: async ({ canvasElement }) => {
    // Utilisez la play function pour des tests interactifs
    console.log('Router mounted');
  },
});
```

## Ressources

- [Storybook Loaders Documentation](https://storybook.js.org/docs/writing-stories/loaders)
- [Tanstack Router Memory History](https://tanstack.com/router/latest/docs/framework/react/guide/history-types#memory-history)
- [MSW Storybook Addon](https://storybook.js.org/addons/msw-storybook-addon)
