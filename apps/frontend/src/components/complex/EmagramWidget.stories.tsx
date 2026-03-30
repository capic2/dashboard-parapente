import preview from '../../../.storybook/preview';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { expect } from 'storybook/test';
import EmagramWidget from './EmagramWidget';

const meta = preview.meta({
  title: 'Components/Complex/EmagramWidget',
  component: EmagramWidget,
  decorators: [
    (Story) => {
      const queryClient = new QueryClient({
        defaultOptions: {
          queries: { retry: false, gcTime: 0, staleTime: 0 },
        },
      });

      return (
        <QueryClientProvider client={queryClient}>
          <div style={{ maxWidth: '800px', padding: '20px' }}>
            <Story />
          </div>
        </QueryClientProvider>
      );
    },
  ],
  parameters: { layout: 'fullscreen' },
  tags: ['autodocs'],
});



const mockEmagramData = {
  id: 'test-emagram-1',
  analysis_date: '2026-03-24',
  analysis_time: '12:00',
  analysis_datetime: '2026-03-24T12:00:00Z',
  station_code: 'site-arguel',
  station_name: 'Arguel',
  station_latitude: 47.2,
  station_longitude: 6.0,
  distance_km: 0.0,
  data_source: 'test',
  sounding_time: '12Z',
  llm_provider: 'google',
  llm_model: 'gemini-2.5-flash',
  analysis_method: 'llm_vision' as const,
  plafond_thermique_m: 2500,
  force_thermique_ms: 2.5,
  stabilite_atmospherique: 'instable',
  cisaillement_vent: 'faible',
  heure_debut_thermiques: '11:00',
  heure_fin_thermiques: '17:00',
  heures_volables_total: 6,
  risque_orage: 'faible',
  score_volabilite: 75,
  resume_conditions: 'Bonnes conditions thermiques avec base cumulus a 2500m',
  conseils_vol: 'Thermiques exploitables des 11h, plafond a 2500m',
  alertes_securite: JSON.stringify([
    'Attention au vent en altitude au-dessus de 2000m',
  ]),
  is_from_llm: true,
  has_thermal_data: true,
  flyable_hours_formatted: '6h',
  screenshot_paths: JSON.stringify({
    'meteo-parapente': '/tmp/test-mp.png',
    topmeteo: '/tmp/test-tm.png',
  }),
  sources_count: 2,
  sources_agreement: 'high',
  analysis_status: 'completed',
  created_at: '2026-03-24T12:00:00Z',
  updated_at: '2026-03-24T12:00:00Z',
};

// 1x1 blue PNG placeholder for screenshot preview testing
const PLACEHOLDER_PNG = new Uint8Array([
  137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0, 1,
  0, 0, 0, 1, 8, 2, 0, 0, 0, 144, 119, 83, 222, 0, 0, 0, 12, 73, 68, 65, 84,
  8, 215, 99, 104, 104, 248, 15, 0, 1, 1, 0, 5, 24, 217, 38, 57, 0, 0, 0, 0,
  73, 69, 78, 68, 174, 66, 96, 130,
]);

const screenshotHandler = http.get(
  '*/api/emagram/screenshot/:id/:source',
  () =>
    new HttpResponse(PLACEHOLDER_PNG, {
      headers: { 'Content-Type': 'image/png' },
    })
);

const defaultHandlers = [
  http.get('*/api/emagram/latest', () => HttpResponse.json(mockEmagramData)),
  http.post('*/api/emagram/analyze', () => HttpResponse.json(mockEmagramData)),
  screenshotHandler,
];

export const Default = meta.story({
  args: { siteId: 'site-arguel', dayIndex: 0 },
  parameters: { msw: { handlers: defaultHandlers } },
});

Default.test('displays emagram score and metrics', async ({ canvas }) => {
  await canvas.findByText(/75/);
  await expect(canvas.getByText(/Arguel/)).toBeInTheDocument();
});

Default.test('displays screenshot buttons', async ({ canvas }) => {
  const btn = await canvas.findByText(/Meteo Parapente/);
  await expect(btn).toBeInTheDocument();
  await expect(canvas.getByText(/Topmeteo/)).toBeInTheDocument();
});

export const AnalysisInProgress = meta.story({
  args: { siteId: 'site-arguel', dayIndex: 0 },
  parameters: {
    msw: {
      handlers: [
        http.get('*/api/emagram/latest', () => HttpResponse.json(null)),
        http.post('*/api/emagram/analyze', () =>
          HttpResponse.json(mockEmagramData)
        ),
      ],
    },
  },
});

AnalysisInProgress.test('shows analysis in progress', async ({ canvas }) => {
  await canvas.findByText(/Analyse en cours/);
});

export const Error = meta.story({
  args: { siteId: 'site-arguel', dayIndex: 0 },
  parameters: {
    msw: {
      handlers: [
        http.get('*/api/emagram/latest', () => {
          return new HttpResponse(null, { status: 500 });
        }),
        http.post('*/api/emagram/analyze', () =>
          HttpResponse.json(mockEmagramData)
        ),
      ],
    },
  },
});

Error.test('displays error message', async ({ canvas }) => {
  await canvas.findByText(/Erreur/);
});

export const DifferentDay = meta.story({
  args: { siteId: 'site-arguel', dayIndex: 2 },
  parameters: { msw: { handlers: defaultHandlers } },
});

export const NoSite = meta.story({
  args: { siteId: '', dayIndex: 0 },
  parameters: { msw: { handlers: defaultHandlers } },
});

NoSite.test('shows no site message', async ({ canvas }) => {
  await canvas.findByText(/Aucun site/);
});

export const Loading = meta.story({
  args: { siteId: 'site-arguel', dayIndex: 0 },
  parameters: {
    msw: {
      handlers: [
        http.get('*/api/emagram/latest', async () => {
          await new Promise(() => {});
        }),
      ],
    },
  },
});

export const WithScreenshotPreview = meta.story({
  name: 'With Screenshot Preview (hover)',
  args: { siteId: 'site-arguel', dayIndex: 0 },
  parameters: { msw: { handlers: defaultHandlers } },
});

WithScreenshotPreview.test(
  'screenshot buttons have hover preview container',
  async ({ canvas }) => {
    const btn = await canvas.findByText(/Meteo Parapente/);
    const wrapper = btn.closest('.group');
    await expect(wrapper).not.toBeNull();
    const preview = wrapper?.querySelector('[class*="group-hover"]');
    await expect(preview).not.toBeNull();
  }
);
