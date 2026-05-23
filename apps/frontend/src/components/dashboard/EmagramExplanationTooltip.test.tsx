import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { EmagramExplanationTooltip } from './EmagramExplanationTooltip';
import type { EmagramAnalysis } from '../../types/emagram';

const emagram: EmagramAnalysis = {
  id: 'emagram-test',
  analysis_date: '2026-03-24',
  analysis_time: '12:00',
  analysis_datetime: '2026-03-24T12:00:00Z',
  station_code: 'site-arguel',
  station_name: 'Arguel',
  station_latitude: 47.2,
  station_longitude: 6.0,
  distance_km: 0,
  data_source: 'test',
  sounding_time: '12Z',
  llm_provider: 'google',
  llm_model: 'gemini-2.5-flash',
  llm_tokens_used: null,
  llm_cost_usd: null,
  analysis_method: 'llm_vision',
  plafond_thermique_m: 2500,
  force_thermique_ms: 2.5,
  cape_jkg: null,
  stabilite_atmospherique: 'instable',
  cisaillement_vent: 'faible',
  heure_debut_thermiques: '11:00',
  heure_fin_thermiques: '17:00',
  heures_volables_total: 6,
  risque_orage: 'faible',
  score_volabilite: 75,
  resume_conditions: 'Bonnes conditions thermiques.',
  conseils_vol: 'Thermiques exploitables dès 11h.',
  alertes_securite: null,
  lcl_m: null,
  lfc_m: null,
  el_m: null,
  lifted_index: null,
  k_index: null,
  total_totals: null,
  showalter_index: null,
  wind_shear_0_3km_ms: null,
  wind_shear_0_6km_ms: null,
  skewt_image_path: null,
  raw_sounding_data: null,
  ai_raw_response: JSON.stringify({
    explication_analyse: {
      resume: 'Le score est bon grâce aux thermiques établis.',
      indices: ['Plafond correct au-dessus du relief.'],
      par_source: {
        'meteo-parapente': ['Courbe de température bien décroissante.'],
      },
    },
  }),
  analysis_status: 'completed',
  error_message: null,
  is_from_llm: true,
  has_thermal_data: true,
  flyable_hours_formatted: '6h',
  screenshot_paths: JSON.stringify({
    'meteo-parapente': '/tmp/test-mp.png',
  }),
  sources_count: 1,
  sources_agreement: 'high',
  created_at: '2026-03-24T12:00:00Z',
  updated_at: '2026-03-24T12:00:00Z',
};

describe('EmagramExplanationTooltip', () => {
  it('opens explanation content on click', async () => {
    render(<EmagramExplanationTooltip emagram={emagram} compact />);

    fireEvent.click(screen.getByLabelText("Comment l'IA a analysé ?"));

    await expect(
      screen.findByText('Lecture par émagramme')
    ).resolves.toBeInTheDocument();
    expect(
      screen.getByText('Le score est bon grâce aux thermiques établis.')
    ).toBeInTheDocument();
  });
});
