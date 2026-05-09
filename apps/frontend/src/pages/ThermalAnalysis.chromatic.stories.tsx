import { http, HttpResponse } from 'msw';
import { FigureWrapper } from '../../.storybook/FigureWrapper.tsx';
import preview from '../../.storybook/preview.tsx';
import { Default, Loading, NoData } from './ThermalAnalysis.stories.tsx';

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
  ai_raw_response: null,
  raw_analysis: 'Detailed analysis...',
  skewt_image_path: null,
  raw_sounding_data: null,
  source: 'open-meteo',
  is_from_llm: true,
  has_thermal_data: true,
  flyable_hours_formatted: '5h',
  screenshot_paths: JSON.stringify({
    'meteo-parapente': '/tmp/test-meteo-parapente.png',
    topmeteo: '/tmp/test-topmeteo.png',
  }),
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

const meta = preview.meta({
  title: 'Pages/ThermalAnalysis/Chromatic',
  parameters: {
    layout: 'padded',
    chromatic: {
      disableSnapshot: false,
    },
    msw: {
      handlers: [
        // Default story handlers (consumed first, once: true)
        http.get('/api/spots/:id', () => HttpResponse.json(mockSite), {
          once: true,
        }),
        http.get(
          '/api/emagram/hours',
          () =>
            HttpResponse.json({
              site_id: 'site-mont-poupet-ouest',
              forecast_date: '2026-03-24',
              hours: [
                { hour: 9, score: 45, status: 'completed', id: 'emagram-h9' },
                {
                  hour: 12,
                  score: 72,
                  status: 'completed',
                  id: 'emagram-h12',
                },
                {
                  hour: 15,
                  score: 85,
                  status: 'completed',
                  id: 'emagram-h15',
                },
                {
                  hour: 18,
                  score: 60,
                  status: 'completed',
                  id: 'emagram-h18',
                },
              ],
            }),
          { once: true }
        ),
        http.get(
          '/api/emagram/latest',
          () => HttpResponse.json(mockEmagramLatest),
          { once: true }
        ),
        http.get(
          '/api/emagram/history',
          () => HttpResponse.json(mockEmagramHistory),
          { once: true }
        ),
        screenshotHandler,
        http.post(
          '/api/emagram/analyze',
          () => HttpResponse.json({ success: true, id: 'emagram-new' }),
          { once: true }
        ),

        // NoData story handlers (consumed second, once: true)
        http.get('/api/spots/:id', () => HttpResponse.json(mockSite), {
          once: true,
        }),
        http.get(
          '/api/emagram/hours',
          () =>
            HttpResponse.json({
              site_id: 'site-mont-poupet-ouest',
              forecast_date: '2026-03-24',
              hours: [],
            }),
          { once: true }
        ),
        http.get('/api/emagram/latest', () => HttpResponse.json(null), {
          once: true,
        }),
        http.get('/api/emagram/history', () => HttpResponse.json([]), {
          once: true,
        }),
        http.post(
          '/api/emagram/analyze',
          () => HttpResponse.json({ success: true }),
          { once: true }
        ),
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
  tags: ['!autodocs'],
});

export const ThermalAnalysisChromatic = meta.story({
  render: () => (
    <div className="flex flex-col gap-2">
      <FigureWrapper title={Default.composed.name}>
        <Default.Component />
      </FigureWrapper>
      <FigureWrapper title={NoData.composed.name}>
        <NoData.Component />
      </FigureWrapper>
      <FigureWrapper title={Loading.composed.name}>
        <Loading.Component />
      </FigureWrapper>
    </div>
  ),
});
