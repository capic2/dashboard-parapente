# Named Handlers - Guide d'utilisation

Les handlers MSW sont maintenant disponibles sous forme d'objet nommé pour faciliter les overrides sélectifs.

## Import

```typescript
import { handlers } from '../../../mocks/namedHandlers';
import { http, HttpResponse } from 'msw';
```

## Usage 1 : Utiliser tous les handlers par défaut

```typescript
export const MyStory = meta.story({
  parameters: {
    msw: {
      handlers: handlers, // Objet avec tous les handlers nommés
    },
  },
});
```

## Usage 2 : Override d'un handler spécifique

```typescript
export const CustomWeatherStory = meta.story({
  parameters: {
    msw: {
      handlers: {
        ...handlers,
        // Override uniquement weatherGet
        weatherGet: http.get('/api/weather/:spotId', () => 
          HttpResponse.json({
            para_index: 100,
            verdict: 'excellent',
            // ... custom data
          })
        ),
      },
    },
  },
});
```

## Usage 3 : Override de plusieurs handlers

```typescript
export const ErrorStory = meta.story({
  parameters: {
    msw: {
      handlers: {
        ...handlers,
        weatherGet: http.get('/api/weather/:spotId', () => 
          new HttpResponse(null, { status: 500 })
        ),
        spotsGet: http.get('/api/spots/:spotId', () => 
          new HttpResponse(null, { status: 404 })
        ),
      },
    },
  },
});
```

## Liste des handlers disponibles

### Spots/Sites
- `spotsList` - GET /api/spots
- `spotsBest` - GET /api/spots/best
- `spotsGet` - GET /api/spots/:spotId
- `spotsGeocode` - GET /api/spots/geocode
- `spotsCreate` - POST /api/spots
- `sitesUpdate` - PATCH /api/sites/:siteId
- `sitesDelete` - DELETE /api/sites/:siteId

### Flights
- `flightsList` - GET /api/flights
- `flightsStats` - GET /api/flights/stats
- `flightsRecords` - GET /api/flights/records
- `flightsGetGpxData` - GET /api/flights/:flightId/gpx-data
- `flightsGet` - GET /api/flights/:flightId
- `flightsCreate` - POST /api/flights
- `flightsCreateFromGpx` - POST /api/flights/create-from-gpx
- `flightsUpdate` - PATCH /api/flights/:flightId
- `flightsSyncStrava` - POST /api/flights/sync-strava
- `flightsUploadGpx` - POST /api/flights/:flightId/upload-gpx
- `flightsDelete` - DELETE /api/flights/:flightId

### Weather
- `weatherGet` - GET /api/weather/:spotId
- `weatherToday` - GET /api/weather/:spotId/today
- `weatherSummary` - GET /api/weather/:spotId/summary
- `weatherDailySummary` - GET /api/weather/:spotId/daily-summary

### Weather Sources
- `weatherSourcesList` - GET /api/weather-sources
- `weatherSourcesStats` - GET /api/weather-sources/stats
- `weatherSourcesGet` - GET /api/weather-sources/:sourceName
- `weatherSourcesCreate` - POST /api/weather-sources
- `weatherSourcesUpdate` - PATCH /api/weather-sources/:sourceName
- `weatherSourcesDelete` - DELETE /api/weather-sources/:sourceName
- `weatherSourcesTest` - POST /api/weather-sources/:sourceName/test

### Alerts
- `alertsList` - GET /api/alerts
- `alertsCreate` - POST /api/alerts

## Avantages

✅ **Overrides sélectifs** : Remplacez uniquement les handlers dont vous avez besoin  
✅ **Pas de `...spread` d'array** : Plus simple et plus lisible  
✅ **Autocomplétion TypeScript** : Les noms des handlers sont typés  
✅ **Pas de conflits** : Les handlers sont identifiés par nom, pas par ordre  

## Migration depuis getDefaultHandlers()

**Avant** :
```typescript
import { getDefaultHandlers } from '../../../mocks/storyHandlers';

handlers: [...getDefaultHandlers(), override1, override2]
```

**Après** :
```typescript
import { handlers } from '../../../mocks/namedHandlers';

handlers: { ...handlers, weatherGet: override1, spotsGet: override2 }
```
