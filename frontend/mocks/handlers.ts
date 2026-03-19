import { http, HttpResponse, HttpHandler } from 'msw';
import { sites } from './data/sites';
import { flights } from './data/flights';
import { gpxData } from './data/gpx';
import { weatherData } from './data/weather';
import { flightStats } from './data/stats';
import { weatherSources } from './data/weatherSources';
import { mockBestSpotsByDay } from './data/bestSpot';

// Helper to create handlers that work in both dev and Storybook
const createHandler = (
  method: 'get' | 'post' | 'put' | 'patch' | 'delete',
  path: string,
  handler: Parameters<typeof http.get>[1]
): HttpHandler[] => {
  return [
    http[method](`/api${path}`, handler),
    http[method](`http://localhost:6006/api${path}`, handler),
  ];
};

export const handlers = [
  // ============================================
  // SITES / SPOTS
  // ============================================

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

  // POST /api/spots - Créer un nouveau site
  ...createHandler('post', '/spots', async ({ request }) => {
    const body = (await request.json()) as any;
    return HttpResponse.json({
      id: `site-${Date.now()}`,
      ...body,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  }),

  // PATCH /api/sites/:siteId - Mettre à jour un site
  ...createHandler('patch', '/sites/:siteId', async ({ params, request }) => {
    const body = (await request.json()) as any;
    const site = sites.find((s) => s.id === params.siteId);
    return HttpResponse.json({
      ...site,
      ...body,
      id: params.siteId,
      updated_at: new Date().toISOString(),
    });
  }),

  // DELETE /api/sites/:siteId - Supprimer un site
  ...createHandler('delete', '/sites/:siteId', () => {
    return HttpResponse.json({ success: true });
  }),

  // GET /api/spots/best - Retourne le meilleur spot pour un jour donné
  ...createHandler('get', '/spots/best', ({ request }) => {
    const url = new URL(request.url);
    const dayIndexParam = url.searchParams.get('day_index');
    const dayIndex = dayIndexParam ? parseInt(dayIndexParam) : 0;
    
    // Validation
    if (dayIndex < 0 || dayIndex > 6) {
      return new HttpResponse(
        JSON.stringify({
          detail: [
            {
              loc: ['query', 'day_index'],
              msg: 'ensure this value is greater than or equal to 0 and less than or equal to 6',
              type: 'value_error',
            },
          ],
        }),
        {
          status: 422,
          statusText: 'Validation Error',
        }
      );
    }
    
    // Retourner le meilleur spot pour le jour demandé
    const bestSpot = mockBestSpotsByDay[dayIndex];
    return HttpResponse.json(bestSpot);
  }),

  // ============================================
  // FLIGHTS / VOLS
  // ============================================

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

  // GET /api/flights/records - Retourne les records de vols
  ...createHandler('get', '/flights/records', () => {
    return HttpResponse.json({
      longest_flight: 180,
      highest_altitude: 2450,
      longest_distance: 45.2,
    });
  }),

  // POST /api/flights - Créer un nouveau vol
  ...createHandler('post', '/flights', async ({ request }) => {
    const body = (await request.json()) as any;
    return HttpResponse.json({
      id: `flight-${Date.now()}`,
      ...body,
      created_at: new Date().toISOString(),
    });
  }),

  // PATCH /api/flights/:flightId - Mettre à jour un vol
  ...createHandler('patch', '/flights/:flightId', async ({ params, request }) => {
    const body = (await request.json()) as any;
    return HttpResponse.json({
      id: params.flightId,
      ...body,
      updated_at: new Date().toISOString(),
    });
  }),

  // POST /api/flights/sync-strava - Synchronize Strava flights
  ...createHandler('post', '/flights/sync-strava', async ({ request }) => {
    const body = (await request.json()) as {
      date_from: string;
      date_to: string;
    };

    // Simulate sync delay
    await new Promise((resolve) => setTimeout(resolve, 1500));

    // Mock response: import 2 new flights, skip 3 duplicates, 0 failed
    return HttpResponse.json({
      success: true,
      imported: 2,
      skipped: 3,
      failed: 0,
      flights: [
        {
          id: 'mock-strava-1',
          site_name: 'Arguel',
          title: 'Vol Strava importé 1',
          flight_date: body.date_from,
          strava_id: '99999999',
        },
        {
          id: 'mock-strava-2',
          site_name: 'La Côte',
          title: 'Vol Strava importé 2',
          flight_date: body.date_to,
          strava_id: '88888888',
        },
      ],
    });
  }),

  // POST /api/flights/:flightId/upload-gpx - Upload GPX to existing flight
  ...createHandler(
    'post',
    '/flights/:flightId/upload-gpx',
    async ({ params }) => {
      const { flightId } = params;

      // Find the flight
      const flight = flights.find((f) => f.id === flightId);
      if (!flight) {
        return new HttpResponse(null, {
          status: 404,
          statusText: 'Flight not found',
        });
      }

      // Simulate upload delay
      await new Promise((resolve) => setTimeout(resolve, 800));

      // Mock successful upload
      const mockGpxPath = `db/gpx/manual_${flightId}.gpx`;

      // Update flight in mock data (in-memory only for this session)
      flight.gpx_file_path = mockGpxPath;

      return HttpResponse.json({
        success: true,
        flight_id: flightId,
        gpx_file_path: mockGpxPath,
        message: 'GPX file uploaded successfully',
      });
    }
  ),

  // DELETE /api/flights/:flightId - Delete a flight
  ...createHandler('delete', '/flights/:flightId', async ({ params }) => {
    const { flightId } = params;

    // Find the flight
    const flightIndex = flights.findIndex((f) => f.id === flightId);
    if (flightIndex === -1) {
      return new HttpResponse(null, {
        status: 404,
        statusText: 'Flight not found',
      });
    }

    // Simulate deletion delay
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Remove flight from mock data (in-memory only for this session)
    const deletedFlight = flights.splice(flightIndex, 1)[0];

    return HttpResponse.json({
      success: true,
      message: `Flight '${deletedFlight.title}' deleted successfully`,
    });
  }),

  // ============================================
  // WEATHER / MÉTÉO
  // ============================================

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

  // GET /api/weather/:spotId/summary - Retourne un résumé météo
  ...createHandler('get', '/weather/:spotId/summary', ({ params }) => {
    const weather = weatherData[params.spotId as string];
    if (!weather) {
      return new HttpResponse(null, { status: 404 });
    }
    return HttpResponse.json({
      current: weather.consensus[0],
      today: weather.consensus,
    });
  }),

  // ============================================
  // WEATHER SOURCES
  // ============================================

  // GET /api/weather-sources - Retourne toutes les sources météo
  ...createHandler('get', '/weather-sources', () => {
    return HttpResponse.json(weatherSources);
  }),

  // GET /api/weather-sources/stats - Statistiques des sources météo
  ...createHandler('get', '/weather-sources/stats', () => {
    return HttpResponse.json({
      total_sources: weatherSources.length,
      active_sources: weatherSources.filter((s) => s.is_enabled).length,
      avg_response_time: 145,
    });
  }),

  // GET /api/weather-sources/:sourceName - Retourne une source spécifique
  ...createHandler('get', '/weather-sources/:sourceName', ({ params }) => {
    const source = weatherSources.find(
      (s) => s.source_name === params.sourceName
    );
    if (!source) {
      return new HttpResponse(null, { status: 404 });
    }
    return HttpResponse.json(source);
  }),

  // POST /api/weather-sources - Créer une nouvelle source météo
  ...createHandler('post', '/weather-sources', async ({ request }) => {
    const body = (await request.json()) as any;
    return HttpResponse.json(
      {
        id: `source-${Date.now()}`,
        ...body,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { status: 201 }
    );
  }),

  // PATCH /api/weather-sources/:sourceName - Mettre à jour une source météo
  ...createHandler(
    'patch',
    '/weather-sources/:sourceName',
    async ({ params, request }) => {
      const body = (await request.json()) as any;
      const source = weatherSources.find(
        (s) => s.source_name === params.sourceName
      );
      return HttpResponse.json({
        ...source,
        ...body,
        updated_at: new Date().toISOString(),
      });
    }
  ),

  // DELETE /api/weather-sources/:sourceName - Supprimer une source météo
  ...createHandler('delete', '/weather-sources/:sourceName', () => {
    return HttpResponse.json({ success: true });
  }),

  // POST /api/weather-sources/:sourceName/test - Tester une source météo
  ...createHandler('post', '/weather-sources/:sourceName/test', () => {
    return HttpResponse.json({
      success: true,
      response_time_ms: 145,
      tested_at: new Date().toISOString(),
    });
  }),

  // ============================================
  // ALERTS / ALERTES
  // ============================================

  // GET /api/alerts - Retourne toutes les alertes
  ...createHandler('get', '/alerts', () => {
    return HttpResponse.json({ alerts: [] });
  }),

  // POST /api/alerts - Créer une nouvelle alerte
  ...createHandler('post', '/alerts', async ({ request }) => {
    const body = (await request.json()) as any;
    return HttpResponse.json({
      id: `alert-${Date.now()}`,
      ...body,
      created_at: new Date().toISOString(),
    });
  }),
];
