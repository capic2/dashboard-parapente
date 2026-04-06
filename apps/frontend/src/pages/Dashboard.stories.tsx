import { http, HttpResponse } from 'msw';
import preview from '../../.storybook/preview';
import { expect } from 'storybook/test';
import Dashboard from './Dashboard';

const meta = preview.meta({
  title: 'Pages/Dashboard',
  component: Dashboard,
  parameters: { layout: 'fullscreen' },
  tags: ['autodocs'],
});

const mockSites = {
  sites: [
    {
      id: 'site-arguel',
      code: 'ARG',
      name: 'Arguel',
      latitude: 47.2,
      longitude: 6.0,
      elevation_m: 427,
      region: 'Doubs',
      country: 'FR',
      orientation: 'SW',
      usage_type: 'takeoff',
      flight_count: 12,
      is_active: true,
    },
    {
      id: 'site-chalais',
      code: 'CHA',
      name: 'Chalais',
      latitude: 47.18,
      longitude: 6.22,
      elevation_m: 920,
      region: 'Doubs',
      country: 'FR',
      orientation: 'W',
      usage_type: 'both',
      flight_count: 5,
      is_active: true,
    },
  ],
};

const mockWeatherArguel = {
  site_id: 'site-arguel',
  site_name: 'Arguel',
  cached_at: '2025-06-15T08:30:00Z',
  day_index: 0,
  days: 1,
  para_index: 78,
  verdict: 'bon',
  emoji: '🟢',
  explanation: 'Conditions favorables',
  consensus: [
    {
      hour: 10,
      temperature: 18,
      wind_speed: 12,
      wind_gust: 18,
      wind_direction: 225,
      precipitation: 0,
      cloud_cover: 20,
      para_index: 78,
      verdict: 'bon',
    },
  ],
};

const mockWeatherChalais = {
  site_id: 'site-chalais',
  site_name: 'Chalais',
  cached_at: '2025-06-15T08:30:00Z',
  day_index: 0,
  days: 1,
  para_index: 55,
  verdict: 'moyen',
  emoji: '🟡',
  explanation: 'Conditions moyennes',
  consensus: [
    {
      hour: 10,
      temperature: 16,
      wind_speed: 20,
      wind_gust: 28,
      wind_direction: 270,
      precipitation: 0,
      cloud_cover: 45,
      para_index: 55,
      verdict: 'moyen',
    },
  ],
};

const mockStats = {
  total_flights: 42,
  total_hours: 68.5,
  total_duration_minutes: 4110,
  total_distance_km: 312.4,
  total_elevation_gain_m: 28500,
  avg_duration_minutes: 97,
  avg_distance_km: 7.4,
  max_altitude_m: 2150,
  favorite_spot: 'Arguel',
  favorite_site: null,
  last_flight_date: '2026-03-15',
};

const mockBestSpot = {
  site: {
    id: 'site-arguel',
    name: 'Arguel',
    rating: 4,
    orientation: 'SW',
  },
  paraIndex: 78,
  windDirection: 'SW',
  windSpeed: 12,
  windFavorability: 'good',
  score: 82,
  verdict: 'BON',
  reason:
    'Bonnes conditions (Para-Index 78), 22°C, ciel dégagé, vent favorable SW 12km/h',
  flyableSlot: '10h-17h',
  thermalCeiling: 1850,
  cached_at: '2025-06-15T08:30:00Z',
};

const defaultHandlers = [
  http.get('/api/spots', () => HttpResponse.json(mockSites)),
  http.get('/api/spots/best', () => HttpResponse.json(mockBestSpot)),
  http.get('/api/spots/:id', ({ params }) => {
    const site = mockSites.sites.find((s) => s.id === params.id);
    return site
      ? HttpResponse.json(site)
      : new HttpResponse(null, { status: 404 });
  }),
  http.get('/api/weather/site-arguel', () =>
    HttpResponse.json(mockWeatherArguel)
  ),
  http.get('/api/weather/site-chalais', () =>
    HttpResponse.json(mockWeatherChalais)
  ),
  http.get('/api/flights/stats', () => HttpResponse.json(mockStats)),
  http.get('/api/sites/:siteId/landings', () => HttpResponse.json([])),
  http.get('/api/sites/:siteId/landings/weather', () => HttpResponse.json([])),
  http.get('/api/emagram/hours', () =>
    HttpResponse.json({
      site_id: '07280',
      forecast_date: '2026-03-24',
      hours: [
        { hour: 9, score: 45, status: 'completed', id: 'emagram-h9' },
        { hour: 12, score: 72, status: 'completed', id: 'emagram-h12' },
        { hour: 15, score: 85, status: 'completed', id: 'emagram-h15' },
        { hour: 18, score: 60, status: 'completed', id: 'emagram-h18' },
      ],
    })
  ),
  http.get('/api/emagram/latest', () =>
    HttpResponse.json({
      id: 'emagram-001',
      analysis_date: '2026-03-24',
      analysis_time: '12:00',
      analysis_datetime: '2026-03-24T12:00:00Z',
      station_code: '07280',
      station_name: 'Dijon-Longvic',
      station_latitude: 47.27,
      station_longitude: 5.09,
      distance_km: 72,
      data_source: 'open-meteo',
      sounding_time: '12Z',
      llm_provider: 'gemini',
      llm_model: 'gemini-2.0-flash',
      llm_tokens_used: 1200,
      llm_cost_usd: 0.002,
      analysis_method: 'llm_vision',
      plafond_thermique_m: 1850,
      force_thermique_ms: 2.3,
      cape_jkg: 320,
      stabilite_atmospherique: 'instable',
      cisaillement_vent: 'faible',
      heure_debut_thermiques: '11:30',
      heure_fin_thermiques: '17:00',
      heures_volables_total: 5.5,
      risque_orage: 'faible',
      score_volabilite: 76,
      resume_conditions:
        "Bonne journée thermique avec un plafond exploitable à 1850m. Les thermiques démarrent vers 11h30 avec une force correcte de 2.3 m/s. Vent de sud-ouest modéré, compatible avec l'orientation du site.",
      conseils_vol:
        'Privilégier le créneau 12h-15h pour les meilleures ascendances. Rester vigilant en fin de journée avec le renforcement du vent en altitude.',
      alertes_securite:
        '["Cisaillement possible au-dessus de 1500m","Brises de vallée renforcées après 15h"]',
      lcl_m: 1200,
      lfc_m: 1400,
      el_m: 4500,
      lifted_index: -2.1,
      k_index: 28,
      total_totals: 48,
      showalter_index: 1.2,
      wind_shear_0_3km_ms: 4.5,
      wind_shear_0_6km_ms: 8.2,
      skewt_image_path: null,
      raw_sounding_data: null,
      ai_raw_response: null,
      analysis_status: 'completed',
      error_message: null,
      is_from_llm: true,
      has_thermal_data: true,
      flyable_hours_formatted: '11h30 – 17h00',
      external_source_urls:
        '{"meteo-parapente":"https://meteo-parapente.com/emagram/07280","open-meteo":"https://open-meteo.com/sounding/07280"}',
      screenshot_paths:
        '{"meteo-parapente":"/screenshots/emagram-001-meteo-parapente.png","open-meteo":"/screenshots/emagram-001-open-meteo.png"}',
      sources_count: 2,
      sources_agreement: 'high',
      created_at: '2026-03-24T12:05:00Z',
      updated_at: '2026-03-24T12:05:00Z',
    })
  ),
  http.get('/api/emagram/history', () => HttpResponse.json([])),
];

export const Default = meta.story({
  name: 'Default',
  parameters: { msw: { handlers: defaultHandlers } },
});

Default.test(
  'renders dashboard with best spot and all sites conditions',
  async ({ canvas }) => {
    await canvas.findByText('Arguel');
    await expect(canvas.getByText('Chalais')).toBeInTheDocument();
  }
);

export const Loading = meta.story({
  name: 'Loading',
  parameters: {
    msw: {
      handlers: [
        http.get('/api/spots', async () => {
          await new Promise(() => {});
        }),
        ...defaultHandlers.slice(1),
      ],
    },
  },
});

export const Error = meta.story({
  name: 'Error',
  parameters: {
    msw: {
      handlers: [
        http.get('/api/spots', () => new HttpResponse(null, { status: 500 })),
        ...defaultHandlers.slice(1),
      ],
    },
  },
});
