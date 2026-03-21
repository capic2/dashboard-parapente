# MSW + Storybook + Vitest - Guide d'Utilisation

## 🎯 Objectif

Ce projet utilise MSW (Mock Service Worker) pour:
1. **Dev** : Mocker les API calls en mode développement navigateur
2. **Storybook** : Mocker les API calls dans les stories Storybook
3. **Tests Vitest** : Mocker les API calls dans les tests Storybook via Vitest

## 📦 Configuration Actuelle

### Fichiers clés

- `mocks/handlers.ts` : Handlers MSW globaux (pattern `/api/...`)
- `mocks/storyHandlers.ts` : Helper pour réutiliser les handlers dans les stories
- `.storybook/preview.tsx` : Initialisation MSW via msw-storybook-addon
- `.storybook/vitest.setup.ts` : Setup Vitest (appelle preview.composed.beforeAll)
- `mocks/browser.ts` : Worker MSW pour le navigateur (dev et tests Vitest)
- `mocks/server.ts` : Server MSW pour Node.js (tests unitaires hors browser)

### Pattern d'URL

**IMPORTANT** : Utilisez toujours le pattern relatif simple `/api/...` dans les handlers MSW. Le pattern avec wildcard `*/api/...` cause des erreurs dans `path-to-regexp` utilisé par MSW.

```typescript
// ✅ CORRECT
http.get('/api/weather/:spotId', () => HttpResponse.json(data))

// ❌ INCORRECT (cause des erreurs "Missing parameter name")
http.get('*/api/weather/:spotId', () => HttpResponse.json(data))
http.get('http://localhost:*/api/weather/:spotId', () => HttpResponse.json(data))
```

## 🚀 Utiliser MSW dans les Stories

### Option 1 : Utiliser les handlers globaux (recommandé)

```typescript
import { getDefaultHandlers } from '../../../mocks/storyHandlers';

export const MyStory = {
  args: {
    spotId: '1',
  },
  parameters: {
    msw: {
      handlers: getDefaultHandlers(),
    },
  },
};
```

### Option 2 : Override des handlers spécifiques

```typescript
import { getDefaultHandlers } from '../../../mocks/storyHandlers';
import { http, HttpResponse } from 'msw';

export const CustomStory = {
  args: {
    spotId: '1',
  },
  parameters: {
    msw: {
      handlers: [
        ...getDefaultHandlers(),
        // Override pour tester un cas d'erreur
        http.get('*/api/weather/:spotId', () => {
          return new HttpResponse(null, { status: 500 });
        }),
      ],
    },
  },
};
```

### Option 3 : Handlers personnalisés uniquement

```typescript
import { http, HttpResponse } from 'msw';

const mockData = {
  site_id: '1',
  para_index: 85,
  verdict: 'bon',
  // ...
};

export const MyStory = {
  parameters: {
    msw: {
      handlers: [
        http.get('*/api/weather/:spotId', () => {
          return HttpResponse.json(mockData);
        }),
        http.get('*/api/spots/:id', () => {
          return HttpResponse.json({ id: '1', name: 'Annecy' });
        }),
      ],
    },
  },
};
```

## 🧪 Tester les Stories

### Lancer les tests

```bash
# Tous les tests Storybook
npm run test-storybook

# Tests avec UI
npm run test:ui -- --project=storybook

# Tests avec coverage
npm run coverage -- --project=storybook
```

### Écrire des tests

```typescript
export const MyStory = meta.story({
  args: {
    spotId: '1',
  },
  parameters: {
    msw: {
      handlers: getDefaultHandlers(),
    },
  },
});

// Ajouter un test
MyStory.test('displays data correctly', async ({ canvas }) => {
  // Attendre que les données soient chargées
  await canvas.findByText(/85\/100/);
  
  // Vérifier l'affichage
  await expect(canvas.getByText(/BON/)).toBeInTheDocument();
  await expect(canvas.getByText('22°C')).toBeInTheDocument();
});
```

## 🔧 Dépannage

### Les handlers ne sont pas appelés

**Symptôme** : `[MSW] Warning: intercepted a request without a matching request handler`

**Solutions** :

1. **Vérifier le pattern** : Utilisez `*/api/...` et NON `/api/...`
2. **Vérifier les params** : `*/api/weather/:spotId` match `/api/weather/1` mais PAS `/api/weather/1/summary`
3. **Utiliser getDefaultHandlers()** : Import depuis `mocks/storyHandlers.ts`

```typescript
// ✅ CORRECT
import { getDefaultHandlers } from '../../../mocks/storyHandlers';

export const MyStory = {
  parameters: {
    msw: {
      handlers: getDefaultHandlers(),
    },
  },
};
```

### Les tests timeout

**Symptôme** : `Test timed out in 30000ms`

**Solutions** :

1. Augmenter le timeout dans `vitest.config.ts`
2. Vérifier que les requêtes API sont bien mockées
3. Utiliser `await canvas.findByText()` pour attendre le rendu

### Les handlers globaux ne marchent pas

**Explication** : `msw-storybook-addon` ne charge PAS automatiquement les handlers globaux définis dans `parameters.msw.handlers` au niveau du preview. Les handlers définis au niveau story remplacent complètement les handlers globaux (ils ne fusionnent pas).

**Solution** : Utilisez `getDefaultHandlers()` dans CHAQUE story qui fait des appels API, puis ajoutez vos overrides spécifiques si nécessaire.

## 📚 Ressources

- [MSW Documentation](https://mswjs.io/docs/)
- [msw-storybook-addon](https://storybook.js.org/addons/msw-storybook-addon)
- [Storybook Vitest Plugin](https://storybook.js.org/docs/writing-tests/vitest-plugin)

## ✅ Checklist pour Nouvelle Story avec API

- [ ] Importer `getDefaultHandlers` de `mocks/storyHandlers.ts`
- [ ] Définir `parameters.msw.handlers: getDefaultHandlers()`
- [ ] Tester dans Storybook UI (`npm run storybook`)
- [ ] Tester dans Vitest (`npm run test-storybook`)
- [ ] Ajouter un test avec `.test()` si nécessaire
