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

const mockWeather = {
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
    {
      hour: 14,
      temperature: 22,
      wind_speed: 15,
      wind_gust: 22,
      wind_direction: 225,
      precipitation: 0,
      cloud_cover: 30,
      para_index: 75,
      verdict: 'bon',
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
  site_id: 'site-arguel',
  site_name: 'Arguel',
  cached_at: '2025-06-15T08:30:00Z',
  score: 82,
  para_index: 78,
  verdict: 'bon',
  wind_speed: 12,
  wind_direction: 'SW',
  orientation: 'SW',
  wind_favorability: 'favorable',
  explanation: 'Vent compatible avec orientation du site',
};

const mockDailySummary = {
  site_id: 'site-arguel',
  site_name: 'Arguel',
  cached_at: '2025-06-15T08:00:00Z',
  days: Array.from({ length: 7 }, (_, i) => ({
    day_index: i,
    date: `2026-03-${24 + i}`,
    para_index: 10 * i,
    verdict: i < 3 ? 'bon' : 'moyen',
    emoji: i < 3 ? '🟢' : '🟡',
    temp_min: 10 + i,
    temp_max: 18 + i,
    wind_avg: 10 + i * 2,
  })),
};

// 1x1 PNG placeholder for emagram screenshot previews
const placeholderPng = (() => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600">
    <rect width="800" height="600" fill="#f3f4f6"/>
    <text x="400" y="280" text-anchor="middle" font-family="sans-serif" font-size="24" fill="#6b7280">Émagramme</text>
    <text x="400" y="320" text-anchor="middle" font-family="sans-serif" font-size="16" fill="#9ca3af">Aperçu non disponible en Storybook</text>
  </svg>`;
  return new TextEncoder().encode(svg);
})();

const defaultHandlers = [
  http.get(
    '/api/emagram/screenshot/:id/:source',
    () =>
      new HttpResponse(placeholderPng, {
        headers: { 'Content-Type': 'image/svg+xml' },
      })
  ),
  http.get('/api/spots', () => HttpResponse.json(mockSites)),
  http.get('/api/spots/best', () => HttpResponse.json(mockBestSpot)),
  http.get('/api/spots/:id', ({ params }) => {
    const site = mockSites.sites.find((s) => s.id === params.id);
    return site
      ? HttpResponse.json(site)
      : new HttpResponse(null, { status: 404 });
  }),
  http.get('/api/weather/:spotId/daily-summary', () =>
    HttpResponse.json(mockDailySummary)
  ),
  http.get('/api/weather/:spotId', () => HttpResponse.json(mockWeather)),
  http.get('/api/flights/stats', () => HttpResponse.json(mockStats)),
  http.get('/api/sites/:siteId/landings', () => HttpResponse.json([])),
  http.get('/api/sites/:siteId/landings/weather', () => HttpResponse.json([])),
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
  'renders dashboard with site selector and weather',
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
