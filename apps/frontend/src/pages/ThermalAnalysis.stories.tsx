import { http, HttpResponse } from 'msw';
import preview from '../../.storybook/preview';
import ThermalAnalysis from './ThermalAnalysis';

const meta = preview.meta({
  title: 'Pages/ThermalAnalysis',
  component: ThermalAnalysis,
  parameters: { layout: 'fullscreen' },
  tags: ['autodocs'],
});

const mockSite = {
  id: 'site-mont-poupet-ouest',
  code: 'MPO',
  name: 'Mont Poupet Ouest',
  latitude: 46.94,
  longitude: 5.88,
  elevation_m: 850,
  country: 'FR',
  orientation: 'W',
  usage_type: 'takeoff',
  flight_count: 8,
  is_active: true,
};

const mockEmagramLatest = {
  id: 'emagram-001',
  analysis_date: '2026-03-24',
  analysis_time: '12:00',
  analysis_datetime: '2026-03-24T12:00:00Z',
  station_code: 'MPO',
  station_name: 'Mont Poupet Ouest',
  station_latitude: 46.94,
  station_longitude: 5.88,
  distance_km: 0,
  data_source: 'multi-source',
  sounding_time: '12Z',
  llm_provider: 'gemini',
  llm_model: 'gemini-pro-vision',
  llm_tokens_used: 1200,
  llm_cost_usd: 0.01,
  analysis_method: 'llm_vision',
  latitude: 46.94,
  longitude: 5.88,
  score_volabilite: 75,
  plafond_thermique_m: 1600,
  force_thermique_ms: 2.4,
  cape_jkg: 320,
  stabilite_atmospherique: 'instable',
  cisaillement_vent: 'modéré',
  heure_debut_thermiques: '12:00',
  heure_fin_thermiques: '17:00',
  heures_volables_total: 5,
  risque_orage: 'faible',
  score: 75,
  summary:
    'Conditions thermiques moderees. Base des cumulus estimee a 1600m. Instabilite presente en basses couches.',
  resume_conditions:
    'Conditions thermiques moderees. Base des cumulus estimee a 1600m. Instabilite presente en basses couches.',
  conseils_vol:
    'Creneau exploitable en milieu de journee, avec surveillance du vent en altitude.',
  alerts: JSON.stringify([
    {
      type: 'thermal',
      level: 'info',
      message: 'Thermiques moderes attendus a partir de 12h',
    },
    {
      type: 'wind',
      level: 'warning',
      message: 'Renforcement du vent en altitude > 2000m',
    },
  ]),
  alertes_securite: JSON.stringify([
    'Thermiques moderes attendus a partir de 12h',
    'Renforcement du vent en altitude > 2000m',
  ]),
  ai_raw_response: JSON.stringify({
    explication_analyse: {
      resume:
        'Le score est moyen-bon : les thermiques existent, mais la couche exploitable reste modérée.',
      indices: [
        'La courbe température/point de rosée suggère une instabilité en basses couches -> déclenchement possible.',
        'La base estimée vers 1600 m limite les marges au-dessus du relief.',
      ],
      par_source: {
        'meteo-parapente': [
          "Courbe observee: température et point de rosée proches en basses couches | Comment la reconnaitre: les deux courbes se rapprochent sous 1700 m | Interpretation: humidité suffisante pour matérialiser la convection | Consequence parapente: déclenchement possible mais plafond modéré.",
        ],
        meteociel: [
          "Courbe observee: vent qui forcit au-dessus de 2000 m | Comment la reconnaitre: barbules plus longues sur la colonne de vent | Interpretation: cisaillement et dérive en altitude | Consequence parapente: rester prudent en transition et près du relief.",
        ],
      },
    },
  }),
  screenshot_paths: JSON.stringify({
    'meteo-parapente': '/tmp/test-mp.png',
    meteociel: '/tmp/test-mc.png',
  }),
  raw_analysis: 'Detailed analysis...',
  skewt_image_path: null,
  raw_sounding_data: null,
  source: 'open-meteo',
  is_from_llm: true,
  has_thermal_data: true,
  flyable_hours_formatted: '5h',
  sources_count: 2,
  sources_agreement: 'high',
  sources_errors: null,
  analysis_status: 'completed',
  error_message: null,
  created_at: '2026-03-24T08:00:00',
  updated_at: '2026-03-24T08:00:00',
};

const mockEmagramHistory = [
  { ...mockEmagramLatest, id: 'e-1', analysis_date: '2026-03-24', score: 75 },
  { ...mockEmagramLatest, id: 'e-2', analysis_date: '2026-03-23', score: 82 },
  { ...mockEmagramLatest, id: 'e-3', analysis_date: '2026-03-22', score: 45 },
];

const mockEmagramHours = {
  site_id: 'site-mont-poupet-ouest',
  forecast_date: '2026-03-24',
  hours: [
    { hour: 9, score: 45, status: 'completed', id: 'emagram-h9' },
    { hour: 12, score: 72, status: 'completed', id: 'emagram-h12' },
    { hour: 15, score: 85, status: 'completed', id: 'emagram-h15' },
    { hour: 18, score: 60, status: 'completed', id: 'emagram-h18' },
  ],
};

const PLACEHOLDER_PNG = new Uint8Array([
  137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0, 1,
  0, 0, 0, 1, 8, 2, 0, 0, 0, 144, 119, 83, 222, 0, 0, 0, 12, 73, 68,
  65, 84, 8, 215, 99, 104, 104, 248, 15, 0, 1, 1, 0, 5, 24, 217, 38, 57,
  0, 0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130,
]);

const screenshotHandler = http.get(
  '*/api/emagram/screenshot/:id/:source',
  () =>
    new HttpResponse(PLACEHOLDER_PNG, {
      headers: { 'Content-Type': 'image/png' },
    })
);

const defaultHandlers = [
  http.get('/api/spots/:id', () => HttpResponse.json(mockSite)),
  http.get('/api/emagram/hours', () => HttpResponse.json(mockEmagramHours)),
  http.get('/api/emagram/latest', () => HttpResponse.json(mockEmagramLatest)),
  http.get('/api/emagram/history', () => HttpResponse.json(mockEmagramHistory)),
  screenshotHandler,
  http.post('/api/emagram/analyze', () =>
    HttpResponse.json({ success: true, id: 'emagram-new' })
  ),
];

export const Default = meta.story({
  name: 'Default',
  parameters: { msw: { handlers: defaultHandlers } },
});

export const NoData = meta.story({
  name: 'No Data',
  parameters: {
    msw: {
      handlers: [
        http.get('/api/spots/:id', () => HttpResponse.json(mockSite)),
        http.get('/api/emagram/hours', () =>
          HttpResponse.json({
            site_id: mockEmagramHours.site_id,
            forecast_date: mockEmagramHours.forecast_date,
            hours: [],
          })
        ),
        http.get('/api/emagram/latest', () => HttpResponse.json(null)),
        http.get('/api/emagram/history', () => HttpResponse.json([])),
        http.post('/api/emagram/trigger', () =>
          HttpResponse.json({ success: true })
        ),
      ],
    },
  },
});

export const Loading = meta.story({
  name: 'Loading',
  parameters: {
    msw: {
      handlers: [
        http.get('/api/spots/:id', () => HttpResponse.json(mockSite)),
        http.get('/api/emagram/hours', async () => {
          await new Promise(() => {});
        }),
        http.get('/api/emagram/latest', async () => {
          await new Promise(() => {});
        }),
        http.get('/api/emagram/history', async () => {
          await new Promise(() => {});
        }),
      ],
    },
  },
});
