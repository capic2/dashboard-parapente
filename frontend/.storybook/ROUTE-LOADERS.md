# Route Loaders et Storybook

## Philosophie

Storybook est conçu pour tester des **composants isolés**, pas des routes complètes. Par conséquent :

- ❌ **Route loaders ne s'exécutent PAS** dans Storybook
- ✅ **Les données sont mockées** via MSW ou args
- ✅ **Les composants Router fonctionnent** (`<Link>`, `useNavigate()`, etc.)

## Pourquoi cette approche ?

### Isolation des composants

```tsx
// ❌ Dans l'app (route avec loader)
// src/routes/flights.tsx
export const Route = createFileRoute('/flights')({
  component: FlightHistory,
  loader: async () => {
    const flights = await fetchFlights(); // Appel API réel
    return { flights };
  },
});

// ✅ Dans Storybook (composant isolé + MSW)
// src/pages/FlightHistory.stories.tsx
export const WithFlights = meta.story({
  parameters: {
    msw: {
      handlers: [
        http.get('/api/flights', () => {
          return HttpResponse.json({ flights: mockFlights });
        }),
      ],
    },
  },
});
```

### Avantages

1. **Contrôle total** sur les données de test
2. **Pas de dépendances** au backend
3. **Tests rapides** (pas de vraies requêtes)
4. **Scénarios multiples** facilement testables (loading, erreur, vide, etc.)

## Exemples pratiques

### Exemple 1 : Page avec route loader

Imaginons cette route :

```tsx
// src/routes/flights/$flightId.tsx
export const Route = createFileRoute('/flights/$flightId')({
  component: FlightDetail,
  loader: async ({ params }) => {
    const flight = await fetchFlight(params.flightId);
    return { flight };
  },
});
```

Dans Storybook, mockez les données :

```tsx
// src/pages/FlightDetail.stories.tsx
import preview from '../../.storybook/preview';
import FlightDetail from './FlightDetail';
import { http, HttpResponse } from 'msw';

const meta = preview.meta({
  title: 'Pages/FlightDetail',
  component: FlightDetail,
});

export const Loaded = meta.story({
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
            distance_km: 25,
          });
        }),
      ],
    },
  },
});

export const Loading = meta.story({
  parameters: {
    msw: {
      handlers: [
        http.get('/api/flights/*', async () => {
          await delay('infinite'); // Requête infinie
        }),
      ],
    },
  },
});

export const Error = meta.story({
  parameters: {
    msw: {
      handlers: [
        http.get('/api/flights/*', () => {
          return HttpResponse.json(
            { error: 'Vol introuvable' },
            { status: 404 }
          );
        }),
      ],
    },
  },
});
```

### Exemple 2 : Composant utilisant useLoaderData

Si votre composant utilise `useLoaderData()` de Tanstack Router :

```tsx
// ❌ Problème : ne fonctionne pas dans Storybook
function FlightDetail() {
  const { flight } = Route.useLoaderData();
  return <div>{flight.title}</div>;
}

// ✅ Solution : Accepter les données via props aussi
function FlightDetail({ flight: flightProp }: { flight?: Flight }) {
  // Essayer d'abord useLoaderData, sinon utiliser les props
  let flight: Flight | undefined;

  try {
    const loaderData = Route.useLoaderData();
    flight = loaderData.flight;
  } catch {
    // Dans Storybook, useLoaderData échoue, utiliser les props
    flight = flightProp;
  }

  if (!flight) return <div>Loading...</div>;

  return <div>{flight.title}</div>;
}

// Story avec props
export const WithProps = meta.story({
  args: {
    flight: {
      id: 'flight-001',
      title: 'Vol du Mont Blanc',
      duration_minutes: 120,
    },
  },
});
```

### Exemple 3 : Composant avec useQuery (recommandé)

**Meilleure pratique** : Utiliser React Query directement dans les composants, pas les route loaders pour les données.

```tsx
// ✅ Recommandé : Utiliser useQuery dans le composant
function FlightDetail({ flightId }: { flightId: string }) {
  const {
    data: flight,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['flight', flightId],
    queryFn: () => fetchFlight(flightId),
  });

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error</div>;
  if (!flight) return null;

  return <div>{flight.title}</div>;
}

// Story avec MSW - fonctionne parfaitement
export const Default = meta.story({
  args: {
    flightId: 'flight-001',
  },
  parameters: {
    msw: {
      handlers: [
        http.get('/api/flights/flight-001', () => {
          return HttpResponse.json({
            id: 'flight-001',
            title: 'Vol du Mont Blanc',
          });
        }),
      ],
    },
  },
});
```

## Pattern recommandé

### Architecture

```
Route (src/routes/)
  ↓
  loader: minimal (juste auth, permissions)
  ↓
Component/Page (src/pages/)
  ↓
  useQuery: fetching des données
  ↓
  Rendu
```

### Pourquoi ?

1. **Composants testables** : Faciles à tester dans Storybook
2. **React Query features** : Cache, refetch, optimistic updates
3. **Code réutilisable** : Composants utilisables hors contexte de route
4. **Meilleure DX** : Pas besoin de mock complexe dans Storybook

## Migration depuis route loaders

Si vous avez déjà des route loaders :

### Avant

```tsx
// src/routes/flights.tsx
export const Route = createFileRoute('/flights')({
  component: FlightHistory,
  loader: async () => {
    const flights = await fetchFlights();
    return { flights };
  },
});

// src/pages/FlightHistory.tsx
function FlightHistory() {
  const { flights } = Route.useLoaderData();
  return <div>{flights.map(...)}</div>;
}
```

### Après

```tsx
// src/routes/flights.tsx
export const Route = createFileRoute('/flights')({
  component: FlightHistory,
  // Pas de loader pour les données (juste auth si besoin)
});

// src/pages/FlightHistory.tsx
function FlightHistory() {
  const { data: flights } = useFlights(); // Hook custom avec useQuery
  return <div>{flights?.map(...)}</div>;
}

// src/pages/FlightHistory.stories.tsx
export const Default = meta.story({
  parameters: {
    msw: {
      handlers: [
        http.get('/api/flights', () => {
          return HttpResponse.json({ flights: mockFlights });
        }),
      ],
    },
  },
});
```

## Quand utiliser les route loaders ?

Utilisez les route loaders **uniquement** pour :

- ✅ **Authentication checks** (redirection si non connecté)
- ✅ **Authorization checks** (permissions)
- ✅ **Route-level prefetching** (performance optimization)
- ❌ **PAS pour fetching principal des données** (utilisez React Query à la place)

## Résumé

| Aspect                  | Route Loaders     | React Query dans composant |
| ----------------------- | ----------------- | -------------------------- |
| Testable dans Storybook | ❌ Non            | ✅ Oui (avec MSW)          |
| Cache automatique       | ⚠️ Limité         | ✅ Complet                 |
| Refetch facile          | ❌ Difficile      | ✅ Facile                  |
| Composant réutilisable  | ❌ Couplé à route | ✅ Indépendant             |
| Optimistic updates      | ❌ Non            | ✅ Oui                     |

**Recommandation** : Privilégiez React Query dans les composants pour un code plus testable et maintenable.
