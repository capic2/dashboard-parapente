import { http, HttpResponse, HttpHandler } from 'msw';
import { sites, flights, gpxData, weatherData, flightStats } from './data';

// Helper to create handlers that work in both dev and Storybook
const createHandler = (
  method: 'get' | 'post' | 'put' | 'delete',
  path: string,
  handler: Parameters<typeof http.get>[1]
): HttpHandler[] => {
  return [
    http[method](`/api${path}`, handler),
    http[method](`http://localhost:6006/api${path}`, handler),
  ];
};

export const handlers = [
  // GET /api/spots - Retourne tous les sites
  ...createHandler('get', '/spots', () => {
    return HttpResponse.json({
      sites: sites,
    });
  }),

  // GET /api/spots/:spot_id - Retourne un site spécifique
  ...createHandler('get', '/spots/:spotId', ({ params }) => {
    const { spotId } = params;
    const site = sites.find((s) => s.id === spotId);

    if (!site) {
      return new HttpResponse(null, {
        status: 404,
        statusText: 'Spot not found',
      });
    }

    return HttpResponse.json(site);
  }),

  // GET /api/flights - Retourne les vols récents
  ...createHandler('get', '/flights', ({ request }) => {
    const url = new URL(request.url);
    const limitParam = url.searchParams.get('limit');
    const limit = limitParam ? parseInt(limitParam) : 10;

    const limitedFlights = flights.slice(0, limit);

    return HttpResponse.json({
      flights: limitedFlights,
    });
  }),

  // GET /api/flights/:flight_id - Retourne un vol spécifique
  ...createHandler('get', '/flights/:flightId', ({ params }) => {
    const { flightId } = params;
    const flight = flights.find((f) => f.id === flightId);

    if (!flight) {
      return new HttpResponse(null, {
        status: 404,
        statusText: 'Flight not found',
      });
    }

    return HttpResponse.json(flight);
  }),

  // GET /api/flights/:flight_id/gpx-data - Retourne les données GPX d'un vol
  ...createHandler('get', '/flights/:flightId/gpx-data', ({ params }) => {
    const { flightId } = params;
    const flight = flights.find((f) => f.id === flightId);

    if (!flight) {
      return new HttpResponse(null, {
        status: 404,
        statusText: 'Flight not found',
      });
    }

    const rawData = gpxData[flightId as string];

    if (!rawData) {
      return new HttpResponse(null, {
        status: 404,
        statusText: 'GPX data not found',
      });
    }

    // Transform data to match GPXData interface
    const data = {
      coordinates: rawData.coordinates.map((coord: any) => ({
        lat: coord.lat,
        lon: coord.lon,
        elevation: coord.elevation,
        timestamp: new Date(coord.time).getTime(),
      })),
      max_altitude_m: rawData.stats.max_altitude_m,
      min_altitude_m: rawData.stats.min_altitude_m,
      elevation_gain_m: rawData.stats.elevation_gain_m,
      elevation_loss_m: rawData.stats.elevation_loss_m || 0,
      total_distance_km: rawData.stats.distance_km,
      flight_duration_seconds: rawData.stats.duration_seconds,
    };

    // Wrap in data property to match API response structure
    return HttpResponse.json({ data });
  }),

  // GET /api/flights/stats - Retourne les statistiques des vols
  ...createHandler('get', '/flights/stats', () => {
    return HttpResponse.json(flightStats);
  }),

  // GET /api/weather/:spot_id - Retourne la météo pour un site
  ...createHandler('get', '/weather/:spotId', ({ params, request }) => {
    const { spotId } = params;
    const url = new URL(request.url);
    const dayIndex = url.searchParams.get('day_index') || '0';

    const weather = weatherData[spotId as string];

    if (!weather) {
      const site = sites.find((s) => s.id === spotId);
      if (!site) {
        return new HttpResponse(null, {
          status: 404,
          statusText: 'Spot not found',
        });
      }

      // Retourne une erreur météo si le site existe mais pas de données météo
      return HttpResponse.json({
        site_id: spotId,
        site_name: site.name,
        error: 'Failed to fetch weather data',
        day_index: parseInt(dayIndex),
      });
    }

    return HttpResponse.json({
      ...weather,
      day_index: parseInt(dayIndex),
    });
  }),

  // GET /api/weather/:spot_id/today - Retourne la météo d'aujourd'hui
  ...createHandler('get', '/weather/:spotId/today', ({ params }) => {
    const { spotId } = params;
    const weather = weatherData[spotId as string];

    if (!weather) {
      const site = sites.find((s) => s.id === spotId);
      if (!site) {
        return new HttpResponse(null, {
          status: 404,
          statusText: 'Spot not found',
        });
      }

      return HttpResponse.json({
        site_id: spotId,
        site_name: site.name,
        error: 'Failed to fetch weather data',
        day_index: 0,
      });
    }

    return HttpResponse.json({
      ...weather,
      day_index: 0,
    });
  }),
];
