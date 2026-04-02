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
  raw_analysis: 'Detailed analysis...',
  source: 'open-meteo',
  created_at: '2026-03-24T08:00:00',
};

const mockEmagramHistory = [
  { ...mockEmagramLatest, id: 'e-1', analysis_date: '2026-03-24', score: 75 },
  { ...mockEmagramLatest, id: 'e-2', analysis_date: '2026-03-23', score: 82 },
  { ...mockEmagramLatest, id: 'e-3', analysis_date: '2026-03-22', score: 45 },
];

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
          '/api/emagram/latest',
          () => HttpResponse.json(mockEmagramLatest),
          { once: true }
        ),
        http.get(
          '/api/emagram/history',
          () => HttpResponse.json(mockEmagramHistory),
          { once: true }
        ),
        http.post(
          '/api/emagram/analyze',
          () => HttpResponse.json({ success: true, id: 'emagram-new' }),
          { once: true }
        ),

        // NoData story handlers (consumed second, once: true)
        http.get('/api/spots/:id', () => HttpResponse.json(mockSite), {
          once: true,
        }),
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
