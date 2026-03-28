import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import preview from '../../.storybook/preview';
import ThermalAnalysis from './ThermalAnalysis';

const meta = preview.meta({
  title: 'Pages/ThermalAnalysis',
  component: ThermalAnalysis,
  decorators: [
    (Story) => {
      const queryClient = new QueryClient({
        defaultOptions: {
          queries: { retry: false, gcTime: 0, staleTime: 0 },
        },
      });
      return (
        <QueryClientProvider client={queryClient}>
          <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
            <Story />
          </div>
        </QueryClientProvider>
      );
    },
  ],
  parameters: { layout: 'fullscreen' },
  tags: ['autodocs'],
});

export default meta;

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

const defaultHandlers = [
  http.get('*/api/spots/:id', () => HttpResponse.json(mockSite)),
  http.get('*/api/emagram/latest', () => HttpResponse.json(mockEmagramLatest)),
  http.get('*/api/emagram/history', () =>
    HttpResponse.json(mockEmagramHistory)
  ),
  http.post('*/api/emagram/analyze', () =>
    HttpResponse.json({ success: true, id: 'emagram-new' })
  ),
];

export const Default = meta.story({
  parameters: { msw: { handlers: defaultHandlers } },
});

Default.test('renders thermal analysis page', async ({ canvas }) => {
  await canvas.findByText(/Analyse Thermique|Emagramme|Thermal/i);
});

export const NoData = meta.story({
  parameters: {
    msw: {
      handlers: [
        http.get('*/api/spots/:id', () => HttpResponse.json(mockSite)),
        http.get('*/api/emagram/latest', () => HttpResponse.json(null)),
        http.get('*/api/emagram/history', () => HttpResponse.json([])),
        http.post('*/api/emagram/trigger', () =>
          HttpResponse.json({ success: true })
        ),
      ],
    },
  },
});

export const Loading = meta.story({
  parameters: {
    msw: {
      handlers: [
        http.get('*/api/spots/:id', () => HttpResponse.json(mockSite)),
        http.get('*/api/emagram/latest', async () => {
          await new Promise(() => {});
        }),
        http.get('*/api/emagram/history', async () => {
          await new Promise(() => {});
        }),
      ],
    },
  },
});
