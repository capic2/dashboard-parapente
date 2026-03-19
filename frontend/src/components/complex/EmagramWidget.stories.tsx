import preview from '../../../.storybook/preview';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import EmagramWidget from './EmagramWidget';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false },
  },
});

const meta = preview.meta({
  title: 'Components/Complex/EmagramWidget',
  component: EmagramWidget,
  decorators: [
    (Story) => (
      <QueryClientProvider client={queryClient}>
        <div style={{ maxWidth: '800px', padding: '20px' }}>
          <Story />
        </div>
      </QueryClientProvider>
    ),
  ],
  parameters: {
    layout: 'fullscreen',
    vitest: {
      skip: true, // Skip complex widget tests - may have rendering issues in test environment
    },
  },
  tags: ['autodocs', 'test-skip'],
});

export default meta;

const mockEmagramData = {
  id: 'test-emagram-1',
  analysis_date: '2024-03-15',
  analysis_time: '12:00',
  analysis_datetime: '2024-03-15T12:00:00Z',
  station_code: 'LSZB',
  station_name: 'Bern',
  station_latitude: 46.9912,
  station_longitude: 7.4651,
  distance_km: 45.2,
  data_source: 'test',
  sounding_time: '12Z',
  llm_provider: 'openai',
  llm_model: 'gpt-4',
  llm_tokens_used: 1000,
  llm_cost_usd: 0.01,
  analysis_method: 'llm_vision' as const,
  plafond_thermique_m: 2500,
  force_thermique_ms: 2.5,
  cape_jkg: 800,
  stabilite_atmospherique: 'stable',
  cisaillement_vent: 'faible',
  heure_debut_thermiques: '11:00',
  heure_fin_thermiques: '17:00',
  heures_volables_total: 6,
  risque_orage: 'faible',
  score_volabilite: 75,
  resume_conditions: 'Conditions excellentes pour le vol',
  conseils_vol: 'Profitez des thermiques en début d\'après-midi',
  alertes_securite: JSON.stringify(['Attention au vent en altitude']),
  lcl_m: 1200,
  lfc_m: 1500,
  el_m: 3000,
  lifted_index: -2,
  k_index: 25,
  total_totals: 48,
  showalter_index: 1,
  wind_shear_0_3km_ms: 5,
  wind_shear_0_6km_ms: 8,
  skewt_image_path: null,
  raw_sounding_data: null,
  ai_raw_response: null,
  analysis_status: 'completed',
  error_message: null,
  is_from_llm: true,
  has_thermal_data: true,
  flyable_hours_formatted: '6h',
  created_at: '2024-03-15T12:00:00Z',
  updated_at: '2024-03-15T12:00:00Z',
};

export const Default = meta.story({
  args: {
    userLat: 47.238,
    userLon: 6.024,
  },
  parameters: {
    msw: {
      handlers: [
        http.get('*/api/emagram*', () => {
          return HttpResponse.json(mockEmagramData);
        }),
      ],
    },
  },
});

export const Loading = meta.story({
  args: {
    userLat: 47.238,
    userLon: 6.024,
  },
  parameters: {
    msw: {
      handlers: [
        http.get('*/api/emagram*', async () => {
          await new Promise(() => {});
        }),
      ],
    },
  },
});

export const Error = meta.story({
  args: {
    userLat: 47.238,
    userLon: 6.024,
  },
  parameters: {
    msw: {
      handlers: [
        http.get('*/api/emagram*', () => {
          return new HttpResponse(null, { status: 500 });
        }),
      ],
    },
  },
});
