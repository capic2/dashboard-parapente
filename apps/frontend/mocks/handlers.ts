import { http, HttpResponse, HttpHandler } from 'msw';
import { sites } from './data/sites';
import { flights } from './data/flights';
import { gpxData } from './data/gpx';
import { weatherData } from './data/weather';
import { flightStats } from './data/stats';
import { weatherSources } from './data/weatherSources';
import { getBestSpotForDay } from './data/bestSpot';

// Helper to create handlers that work in both dev, Storybook, and Vitest
// Use wildcard pattern */api/... to match any origin
const createHandler = (
  method: 'get' | 'post' | 'put' | 'patch' | 'delete',
  path: string,
  handler: Parameters<typeof http.get>[1]
): HttpHandler[] => {
  return [
    // Wildcard pattern - works in all environments (dev, Storybook, Vitest)
    http[method](`*/api${path}`, handler),
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

  // GET /api/spots/best - Retourne le meilleur spot pour un jour spécifique
  // IMPORTANT: Must be BEFORE /spots/:spotId to avoid matching "best" as a spotId
  ...createHandler('get', '/spots/best', ({ request }) => {
    const url = new URL(request.url);
    const dayIndexParam = url.searchParams.get('day_index');
    const dayIndex = dayIndexParam ? parseInt(dayIndexParam, 10) : 0;

    // Get best spot data for the requested day
    const bestSpot = getBestSpotForDay(dayIndex);

    return HttpResponse.json(bestSpot);
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

  // GET /api/spots/geocode - Recherche géocodage
  ...createHandler('get', '/spots/geocode', ({ request }) => {
    const url = new URL(request.url);
    const query = url.searchParams.get('query') || '';

    // Mock geocoding results
    return HttpResponse.json({
      results: [
        {
          name: query,
          latitude: 47.2382 + Math.random() * 0.1,
          longitude: 6.0245 + Math.random() * 0.1,
          country: url.searchParams.get('country') || 'FR',
        },
      ],
    });
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

  // GET /api/flights/stats - Retourne les statistiques des vols
  // IMPORTANT: Must be BEFORE /flights/:flightId to avoid matching "stats" as a flightId
  ...createHandler('get', '/flights/stats', () => {
    return HttpResponse.json(flightStats);
  }),

  // GET /api/flights/records - Retourne les records de vols
  // IMPORTANT: Must be BEFORE /flights/:flightId to avoid matching "records" as a flightId
  ...createHandler('get', '/flights/records', () => {
    return HttpResponse.json({
      longest_duration: {
        value: 180,
        flight_id: 'flight1',
        flight_name: 'Vol record - Durée',
        flight_date: '2024-06-15',
        site_name: 'Annecy',
      },
      highest_altitude: {
        value: 2450,
        flight_id: 'flight2',
        flight_name: 'Vol record - Altitude',
        flight_date: '2024-07-20',
        site_name: 'Chamonix',
      },
      longest_distance: {
        value: 45.2,
        flight_id: 'flight3',
        flight_name: 'Vol record - Distance',
        flight_date: '2024-08-10',
        site_name: 'Annecy',
      },
      max_speed: {
        value: 65.5,
        flight_id: 'flight4',
        flight_name: 'Vol record - Vitesse',
        flight_date: '2024-09-05',
        site_name: 'Grenoble',
      },
    });
  }),

  // GET /api/flights/:flight_id/gpx-data - Retourne les données GPX d'un vol
  // IMPORTANT: Must be BEFORE /flights/:flightId to match the more specific path first
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

  // POST /api/flights - Créer un nouveau vol
  ...createHandler('post', '/flights', async ({ request }) => {
    const body = (await request.json()) as any;
    return HttpResponse.json({
      id: `flight-${Date.now()}`,
      ...body,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      duration: 45,
      distance: 12.5,
      max_altitude: 1850,
      site_id: body.site_id || '1',
      site_name: 'Annecy',
    });
  }),

  // POST /api/flights/create-from-gpx - Créer un vol depuis un fichier GPX
  ...createHandler('post', '/flights/create-from-gpx', async ({ request }) => {
    // Check if GPX is valid (mock validation)
    const formData = await request.formData();
    const gpxFile = formData.get('gpx_file');

    if (!gpxFile || (gpxFile as File).size < 100) {
      return HttpResponse.json(
        { error: 'Le fichier GPX ne contient pas de données de vol valides' },
        { status: 400 }
      );
    }

    return HttpResponse.json({
      id: `flight-${Date.now()}`,
      date: new Date().toISOString().split('T')[0],
      duration: 45,
      distance: 12.5,
      max_altitude: 1850,
      site_id: '1',
      site_name: 'Annecy',
      gpx_file: (gpxFile as File).name,
    });
  }),

  // PATCH /api/flights/:flightId - Mettre à jour un vol
  ...createHandler(
    'patch',
    '/flights/:flightId',
    async ({ params, request }) => {
      const body = (await request.json()) as any;
      return HttpResponse.json({
        id: params.flightId,
        ...body,
        updated_at: new Date().toISOString(),
      });
    }
  ),

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

  // GET /api/weather/:spotId/daily-summary - Retourne le résumé météo sur plusieurs jours
  ...createHandler(
    'get',
    '/weather/:spotId/daily-summary',
    ({ params, request }) => {
      const { spotId } = params;
      const url = new URL(request.url);
      const daysParam = url.searchParams.get('days');
      const days = daysParam ? parseInt(daysParam, 10) : 7;

      const site = sites.find((s) => s.id === spotId);
      if (!site) {
        return new HttpResponse(null, {
          status: 404,
          statusText: 'Spot not found',
        });
      }

      // Generate daily summary for the requested number of days
      const dailySummary = {
        site_id: spotId,
        site_name: site.name,
        cached_at: '2025-06-15T08:00:00Z',
        days: Array.from({ length: days }, (_, index) => {
          const date = new Date();
          date.setDate(date.getDate() + index);

          // Vary conditions across days for realistic mock data
          const baseParaIndex = 70 + (index % 3) * 10;
          const variance = Math.floor(Math.random() * 10);
          const paraIndex = Math.min(100, baseParaIndex + variance);

          return {
            day_index: index,
            date: date.toISOString().split('T')[0],
            para_index: paraIndex,
            verdict:
              paraIndex >= 75 ? 'BON' : paraIndex >= 60 ? 'MOYEN' : 'MAUVAIS',
            emoji: paraIndex >= 75 ? '✅' : paraIndex >= 60 ? '⚠️' : '❌',
            temp_min: 10 + index,
            temp_max: 18 + index,
            wind_avg: 8 + index * 2,
          };
        }),
      };

      return HttpResponse.json(dailySummary);
    }
  ),

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
  // LANDING ASSOCIATIONS
  // ============================================

  // GET /api/sites/:siteId/landings - Retourne les associations d'atterrissage
  // IMPORTANT: Must be BEFORE /sites/:siteId to match the more specific path first
  ...createHandler('get', '/sites/:siteId/landings/weather', ({ params, request }) => {
    const { siteId } = params;
    const url = new URL(request.url);
    const dayIndex = parseInt(url.searchParams.get('day_index') || '0', 10);

    // Find landing sites associated with this takeoff site
    const landingSite = sites.find((s) => s.id !== siteId);

    if (!landingSite) {
      return HttpResponse.json([]);
    }

    return HttpResponse.json([
      {
        landing_site_id: landingSite.id,
        landing_site_name: landingSite.name,
        distance_km: 2.5,
        is_primary: true,
        weather: {
          consensus: weatherData[landingSite.id]?.consensus || [],
          para_index: 75,
          verdict: 'BON',
          emoji: '✅',
          sunrise: '06:30',
          sunset: '20:45',
          day_index: dayIndex,
        },
      },
    ]);
  }),

  // GET /api/sites/:siteId/landings - Retourne les associations d'atterrissage
  ...createHandler('get', '/sites/:siteId/landings', ({ params }) => {
    const { siteId } = params;

    // Find a different site to use as landing
    const landingSite = sites.find((s) => s.id !== siteId);

    if (!landingSite) {
      return HttpResponse.json([]);
    }

    return HttpResponse.json([
      {
        id: 'assoc-1',
        takeoff_site_id: siteId,
        landing_site_id: landingSite.id,
        is_primary: true,
        distance_km: 2.5,
        notes: 'Atterrissage principal',
        landing_site: landingSite,
        created_at: '2025-01-15T10:00:00Z',
      },
    ]);
  }),

  // POST /api/sites/:siteId/landings - Créer une association d'atterrissage
  ...createHandler('post', '/sites/:siteId/landings', async ({ params, request }) => {
    const body = (await request.json()) as any;
    const landingSite = sites.find((s) => s.id === body.landing_site_id);

    return HttpResponse.json({
      id: `assoc-${Date.now()}`,
      takeoff_site_id: params.siteId,
      landing_site_id: body.landing_site_id,
      is_primary: body.is_primary ?? false,
      distance_km: null,
      notes: body.notes ?? null,
      landing_site: landingSite || null,
      created_at: new Date().toISOString(),
    });
  }),

  // PATCH /api/sites/:siteId/landings/:assocId - Mettre à jour une association
  ...createHandler('patch', '/sites/:siteId/landings/:assocId', async ({ params, request }) => {
    const body = (await request.json()) as any;

    return HttpResponse.json({
      id: params.assocId,
      takeoff_site_id: params.siteId,
      landing_site_id: 'landing-1',
      is_primary: body.is_primary ?? false,
      distance_km: 2.5,
      notes: body.notes ?? null,
      created_at: '2025-01-15T10:00:00Z',
    });
  }),

  // DELETE /api/sites/:siteId/landings/:assocId - Supprimer une association
  ...createHandler('delete', '/sites/:siteId/landings/:assocId', () => {
    return HttpResponse.json({ success: true });
  }),

  // ============================================
  // ADMIN CACHE
  // ============================================

  // GET /api/admin/cache - Retourne l'aperçu du cache Redis
  ...createHandler('get', '/admin/cache', () => {
    return HttpResponse.json({
      total_keys: 12,
      memory_usage: '2.4 MB',
      groups: {
        weather: {
          count: 5,
          keys: [
            { key: 'weather:site-1:day-0', ttl: 3600, size: 1024 },
            { key: 'weather:site-1:day-1', ttl: 3200, size: 980 },
            { key: 'weather:site-2:day-0', ttl: 3500, size: 1100 },
            { key: 'weather:site-2:day-1', ttl: 3100, size: 950 },
            { key: 'weather:site-3:day-0', ttl: 2800, size: 1050 },
          ],
        },
        summary: {
          count: 4,
          keys: [
            { key: 'summary:site-1', ttl: 7200, size: 512 },
            { key: 'summary:site-2', ttl: 7000, size: 480 },
            { key: 'summary:site-3', ttl: 6800, size: 520 },
            { key: 'summary:site-4', ttl: 6500, size: 490 },
          ],
        },
        'best-spot': {
          count: 3,
          keys: [
            { key: 'best-spot:day-0', ttl: 1800, size: 256 },
            { key: 'best-spot:day-1', ttl: 1600, size: 260 },
            { key: 'best-spot:day-2', ttl: 1400, size: 248 },
          ],
        },
      },
      truncated: false,
    });
  }),

  // GET /api/admin/cache/:key - Retourne le détail d'une clé de cache
  http.get(/\/api\/admin\/cache\/(.+)/, ({ request }) => {
    const url = new URL(request.url);
    const key = decodeURIComponent(
      url.pathname.replace(/.*\/api\/admin\/cache\//, '')
    );

    return HttpResponse.json({
      key,
      ttl: 3600,
      size: 1024,
      value: { site_id: 'site-1', data: 'mock cached value' },
      type: 'json' as const,
    });
  }),

  // DELETE /api/admin/cache/:key - Supprimer une clé ou un pattern de cache
  http.delete(/\/api\/admin\/cache\/(.+)/, () => {
    return HttpResponse.json({
      success: true,
      keys_deleted: 1,
    });
  }),

  // ============================================
  // EMAGRAM ANALYSIS
  // ============================================

  // GET /api/emagram/latest - Dernière analyse émagramme
  ...createHandler('get', '/emagram/latest', ({ request }) => {
    const url = new URL(request.url);
    const hour = url.searchParams.get('hour');

    return HttpResponse.json({
      id: 'emagram-001',
      analysis_date: '2025-06-15',
      analysis_time: '12:00',
      analysis_datetime: '2025-06-15T12:00:00Z',
      station_code: 'LFQN',
      station_name: 'Besançon',
      station_latitude: 47.25,
      station_longitude: 6.08,
      distance_km: 15.3,
      data_source: 'meteofrance',
      sounding_time: '12Z',
      llm_provider: 'anthropic',
      llm_model: 'claude-sonnet-4-20250514',
      llm_tokens_used: 1200,
      llm_cost_usd: 0.004,
      analysis_method: 'llm_vision',
      plafond_thermique_m: 2200,
      force_thermique_ms: 2.5,
      cape_jkg: 450,
      stabilite_atmospherique: 'Instable conditionnel',
      cisaillement_vent: 'Faible',
      heure_debut_thermiques: '11:00',
      heure_fin_thermiques: '17:00',
      heures_volables_total: 6,
      risque_orage: 'Faible',
      score_volabilite: 75,
      resume_conditions: 'Bonnes conditions thermiques prévues avec plafond à 2200m.',
      conseils_vol: 'Décollage recommandé entre 11h et 14h.',
      alertes_securite: '[]',
      lcl_m: 800,
      lfc_m: 1200,
      el_m: 8000,
      lifted_index: -2.5,
      k_index: 28,
      total_totals: 48,
      showalter_index: -1.5,
      wind_shear_0_3km_ms: 3.2,
      wind_shear_0_6km_ms: 5.8,
      skewt_image_path: null,
      raw_sounding_data: null,
      ai_raw_response: null,
      analysis_status: 'completed',
      error_message: null,
      is_from_llm: true,
      has_thermal_data: true,
      flyable_hours_formatted: '11:00 - 17:00',
      forecast_date: '2025-06-15',
      forecast_hour: hour ? parseInt(hour, 10) : null,
      external_source_urls: null,
      screenshot_paths: null,
      sources_count: null,
      sources_agreement: null,
      sources_errors: null,
      created_at: '2025-06-15T08:00:00Z',
      updated_at: '2025-06-15T12:00:00Z',
    });
  }),

  // GET /api/emagram/hours - Heures disponibles pour l'émagramme
  ...createHandler('get', '/emagram/hours', ({ request }) => {
    const url = new URL(request.url);
    const siteId = url.searchParams.get('site_id') || 'site-1';

    return HttpResponse.json({
      site_id: siteId,
      forecast_date: '2025-06-15',
      hours: [
        { hour: 9, score: 40, status: 'completed', id: 'emagram-h09' },
        { hour: 10, score: 55, status: 'completed', id: 'emagram-h10' },
        { hour: 11, score: 65, status: 'completed', id: 'emagram-h11' },
        { hour: 12, score: 75, status: 'completed', id: 'emagram-h12' },
        { hour: 13, score: 80, status: 'completed', id: 'emagram-h13' },
        { hour: 14, score: 72, status: 'completed', id: 'emagram-h14' },
        { hour: 15, score: 60, status: 'completed', id: 'emagram-h15' },
        { hour: 16, score: 45, status: 'completed', id: 'emagram-h16' },
        { hour: 17, score: 30, status: 'completed', id: 'emagram-h17' },
      ],
    });
  }),

  // GET /api/emagram/history - Historique des analyses
  ...createHandler('get', '/emagram/history', () => {
    return HttpResponse.json([
      {
        id: 'emagram-001',
        analysis_date: '2025-06-15',
        analysis_time: '12:00',
        station_code: 'LFQN',
        station_name: 'Besançon',
        distance_km: 15.3,
        score_volabilite: 75,
        plafond_thermique_m: 2200,
        force_thermique_ms: 2.5,
        heures_volables_total: 6,
        analysis_method: 'llm_vision',
        analysis_status: 'completed',
        created_at: '2025-06-15T08:00:00Z',
      },
      {
        id: 'emagram-002',
        analysis_date: '2025-06-14',
        analysis_time: '12:00',
        station_code: 'LFQN',
        station_name: 'Besançon',
        distance_km: 15.3,
        score_volabilite: 60,
        plafond_thermique_m: 1800,
        force_thermique_ms: 1.8,
        heures_volables_total: 4,
        analysis_method: 'llm_vision',
        analysis_status: 'completed',
        created_at: '2025-06-14T08:00:00Z',
      },
    ]);
  }),

  // POST /api/emagram/analyze - Déclencher une analyse
  ...createHandler('post', '/emagram/analyze', async ({ request }) => {
    const body = (await request.json()) as any;

    return HttpResponse.json({
      id: `emagram-${Date.now()}`,
      analysis_date: '2025-06-15',
      analysis_time: '12:00',
      analysis_datetime: '2025-06-15T12:00:00Z',
      station_code: 'LFQN',
      station_name: 'Besançon',
      station_latitude: 47.25,
      station_longitude: 6.08,
      distance_km: 15.3,
      data_source: 'meteofrance',
      sounding_time: '12Z',
      llm_provider: 'anthropic',
      llm_model: 'claude-sonnet-4-20250514',
      llm_tokens_used: 1200,
      llm_cost_usd: 0.004,
      analysis_method: 'llm_vision',
      plafond_thermique_m: 2200,
      force_thermique_ms: 2.5,
      cape_jkg: 450,
      stabilite_atmospherique: 'Instable conditionnel',
      cisaillement_vent: 'Faible',
      heure_debut_thermiques: '11:00',
      heure_fin_thermiques: '17:00',
      heures_volables_total: 6,
      risque_orage: 'Faible',
      score_volabilite: 75,
      resume_conditions: 'Bonnes conditions thermiques prévues.',
      conseils_vol: 'Décollage recommandé entre 11h et 14h.',
      alertes_securite: '[]',
      lcl_m: 800,
      lfc_m: 1200,
      el_m: 8000,
      lifted_index: -2.5,
      k_index: 28,
      total_totals: 48,
      showalter_index: -1.5,
      wind_shear_0_3km_ms: 3.2,
      wind_shear_0_6km_ms: 5.8,
      skewt_image_path: null,
      raw_sounding_data: null,
      ai_raw_response: null,
      analysis_status: 'completed',
      error_message: null,
      is_from_llm: true,
      has_thermal_data: true,
      flyable_hours_formatted: '11:00 - 17:00',
      forecast_date: body.day_index ? '2025-06-15' : '2025-06-15',
      forecast_hour: body.hour ?? null,
      external_source_urls: null,
      screenshot_paths: null,
      sources_count: null,
      sources_agreement: null,
      sources_errors: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
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

  // ============================================
  // EMAGRAM / SOUNDING ANALYSIS
  // ============================================

  // GET /api/emagram/hours - Available hourly emagram analyses for slider
  ...createHandler('get', '/emagram/hours', ({ request }) => {
    const url = new URL(request.url);
    const siteId = url.searchParams.get('site_id') || 'unknown';
    const dayIndex = parseInt(url.searchParams.get('day_index') || '0', 10);

    const baseDate = new Date('2026-04-06');
    baseDate.setDate(baseDate.getDate() + dayIndex);

    return HttpResponse.json({
      site_id: siteId,
      forecast_date: baseDate.toISOString().split('T')[0],
      hours: [
        { hour: 9, score: 45, status: 'completed', id: 'emagram-h9' },
        { hour: 12, score: 72, status: 'completed', id: 'emagram-h12' },
        { hour: 15, score: 85, status: 'completed', id: 'emagram-h15' },
        { hour: 18, score: 60, status: 'completed', id: 'emagram-h18' },
      ],
    });
  }),

  // GET /api/emagram/latest - Latest emagram analysis for a site
  ...createHandler('get', '/emagram/latest', ({ request }) => {
    const url = new URL(request.url);
    const siteId = url.searchParams.get('site_id') || 'unknown';
    const hour = url.searchParams.get('hour');

    return HttpResponse.json({
      id: 'emagram-latest-1',
      analysis_date: '2026-04-06',
      analysis_time: '12:00',
      analysis_datetime: '2026-04-06T12:00:00Z',
      station_code: siteId,
      station_name: 'Station Mock',
      station_latitude: 47.24,
      station_longitude: 6.02,
      distance_km: 15.3,
      data_source: 'open_meteo',
      sounding_time: '12Z',
      llm_provider: 'gemini',
      llm_model: 'gemini-2.0-flash',
      llm_tokens_used: 1200,
      llm_cost_usd: 0.002,
      analysis_method: 'llm_vision',
      plafond_thermique_m: 2200,
      force_thermique_ms: 2.5,
      cape_jkg: 450,
      stabilite_atmospherique: 'Instable modéré',
      cisaillement_vent: 'Faible',
      heure_debut_thermiques: '11:00',
      heure_fin_thermiques: '17:00',
      heures_volables_total: 6,
      risque_orage: 'Faible',
      score_volabilite: hour ? 72 : 85,
      resume_conditions:
        'Bonnes conditions thermiques prévues. Plafond à 2200m, thermiques modérés à forts.',
      conseils_vol:
        'Décoller entre 11h et 14h pour profiter des meilleures conditions. Plafond exploitable jusqu\'à 2200m.',
      alertes_securite: '["Brise de vallée modérée après 15h"]',
      lcl_m: 1200,
      lfc_m: 1500,
      el_m: 5000,
      lifted_index: -2.5,
      k_index: 28,
      total_totals: 48,
      showalter_index: -1.2,
      wind_shear_0_3km_ms: 3.5,
      wind_shear_0_6km_ms: 6.2,
      skewt_image_path: null,
      raw_sounding_data: null,
      ai_raw_response: null,
      analysis_status: 'completed',
      error_message: null,
      is_from_llm: true,
      has_thermal_data: true,
      flyable_hours_formatted: '11:00 - 17:00',
      forecast_date: '2026-04-06',
      forecast_hour: hour ? parseInt(hour, 10) : null,
      external_source_urls: null,
      screenshot_paths: null,
      sources_count: 1,
      sources_agreement: null,
      sources_errors: null,
      created_at: '2026-04-06T08:00:00Z',
      updated_at: '2026-04-06T08:00:00Z',
    });
  }),

  // GET /api/emagram/history - Historical emagram analyses
  ...createHandler('get', '/emagram/history', () => {
    return HttpResponse.json([
      {
        id: 'emagram-hist-1',
        analysis_date: '2026-04-05',
        analysis_time: '12:00',
        station_code: 'LSMP',
        station_name: 'Payerne',
        distance_km: 45.2,
        score_volabilite: 78,
        plafond_thermique_m: 2100,
        force_thermique_ms: 2.3,
        heures_volables_total: 5,
        analysis_method: 'llm_vision',
        analysis_status: 'completed',
        created_at: '2026-04-05T08:00:00Z',
      },
      {
        id: 'emagram-hist-2',
        analysis_date: '2026-04-04',
        analysis_time: '12:00',
        station_code: 'LSMP',
        station_name: 'Payerne',
        distance_km: 45.2,
        score_volabilite: 55,
        plafond_thermique_m: 1600,
        force_thermique_ms: 1.5,
        heures_volables_total: 3,
        analysis_method: 'llm_vision',
        analysis_status: 'completed',
        created_at: '2026-04-04T08:00:00Z',
      },
    ]);
  }),

  // POST /api/emagram/analyze - Trigger manual emagram analysis
  ...createHandler('post', '/emagram/analyze', async ({ request }) => {
    const body = (await request.json()) as any;

    return HttpResponse.json({
      id: `emagram-${Date.now()}`,
      analysis_date: '2026-04-06',
      analysis_time: '12:00',
      analysis_datetime: '2026-04-06T12:00:00Z',
      station_code: body.site_id || 'LSMP',
      station_name: 'Station Mock',
      station_latitude: 47.24,
      station_longitude: 6.02,
      distance_km: 15.3,
      data_source: 'open_meteo',
      sounding_time: '12Z',
      llm_provider: 'gemini',
      llm_model: 'gemini-2.0-flash',
      llm_tokens_used: 1500,
      llm_cost_usd: 0.003,
      analysis_method: 'llm_vision',
      plafond_thermique_m: 2200,
      force_thermique_ms: 2.5,
      cape_jkg: 450,
      stabilite_atmospherique: 'Instable modéré',
      cisaillement_vent: 'Faible',
      heure_debut_thermiques: '11:00',
      heure_fin_thermiques: '17:00',
      heures_volables_total: 6,
      risque_orage: 'Faible',
      score_volabilite: 82,
      resume_conditions:
        'Bonnes conditions thermiques. Plafond à 2200m.',
      conseils_vol:
        'Décoller entre 11h et 14h.',
      alertes_securite: '[]',
      lcl_m: 1200,
      lfc_m: 1500,
      el_m: 5000,
      lifted_index: -2.5,
      k_index: 28,
      total_totals: 48,
      showalter_index: -1.2,
      wind_shear_0_3km_ms: 3.5,
      wind_shear_0_6km_ms: 6.2,
      skewt_image_path: null,
      raw_sounding_data: null,
      ai_raw_response: null,
      analysis_status: 'completed',
      error_message: null,
      is_from_llm: true,
      has_thermal_data: true,
      flyable_hours_formatted: '11:00 - 17:00',
      forecast_date: '2026-04-06',
      forecast_hour: body.hour ?? null,
      external_source_urls: null,
      screenshot_paths: null,
      sources_count: 1,
      sources_agreement: null,
      sources_errors: null,
      created_at: '2026-04-06T12:00:00Z',
      updated_at: '2026-04-06T12:00:00Z',
    });
  }),

  // ============================================
  // APP SETTINGS
  // ============================================

  // GET /api/settings
  ...createHandler('get', '/settings', () => {
    return HttpResponse.json({
      cache_ttl_default: '3600',
      cache_ttl_summary: '3600',
      scheduler_interval_minutes: '30',
      redis_connect_timeout: '5',
      redis_socket_timeout: '5',
    });
  }),

  // PUT /api/settings
  ...createHandler('put', '/settings', async ({ request }) => {
    const body = (await request.json()) as Record<string, string>;
    return HttpResponse.json({
      success: true,
      updated: body,
    });
  }),
];
