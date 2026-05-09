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
  latitude: 46.94,
  longitude: 5.88,
  score: 75,
  summary:
    'Conditions thermiques moderees. Base des cumulus estimee a 1600m. Instabilite presente en basses couches.',
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
  source: 'open-meteo',
  created_at: '2026-03-24T08:00:00',
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

const defaultHandlers = [
  http.get('/api/spots/:id', () => HttpResponse.json(mockSite)),
  http.get('/api/emagram/hours', () => HttpResponse.json(mockEmagramHours)),
  http.get('/api/emagram/latest', () => HttpResponse.json(mockEmagramLatest)),
  http.get('/api/emagram/history', () => HttpResponse.json(mockEmagramHistory)),
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
