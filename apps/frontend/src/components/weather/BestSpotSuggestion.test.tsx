import { render, screen } from '@testing-library/react';
import type { ComponentType } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { BestSpotSuggestion } from './BestSpotSuggestion';
import type { BestSpotResult } from '@dashboard-parapente/shared-types';

vi.mock('react-i18next', () => ({
  withTranslation: () => (Component: ComponentType) => Component,
  useTranslation: () => ({
    t: (key: string, options?: Record<string, string>) => {
      const labels: Record<string, string> = {
        'common.today': 'Aujourd’hui',
        'weather.bestSpotFor': `Meilleur spot pour ${options?.date}`,
        'weather.bestSpot.reasonCodes.windDecollageCul':
          'vent de cul au décollage',
        'weather.byHour': 'H -> fin de journée',
        'weather.calculating': 'Calcul en cours...',
        'weather.flyableSlot': 'Créneau',
        'weather.paraIndex': 'Conditions de vol',
        'weather.score': 'Score',
        'weather.thermalCeiling': 'Plafond',
        'weather.viewForecast': 'Voir les prévisions',
        'weather.windOrientation': 'Vent / Orientation',
        'weather.favorabilityPoor': 'Défavorable',
      };
      return labels[key] ?? key;
    },
    i18n: {
      language: 'fr',
    },
  }),
}));

const bestSpotWithTechnicalReason: BestSpotResult = {
  site: {
    id: 'site-arguel',
    code: 'arguel',
    name: 'Arguel',
    orientation: 'W',
  },
  paraIndex: 35,
  score: 35,
  windDirection: 'E',
  windSpeed: 12,
  windFavorability: 'bad',
  reason:
    'Les conditions restent limites. Le moment le moins défavorable est autour de 7h-7h, principalement à cause de wind_decollage_cul.',
  flyableSlot: '7h',
  thermalCeiling: null,
  verdict: 'LIMITE',
};

describe('BestSpotSuggestion', () => {
  it('localizes technical reason codes returned by the API', () => {
    render(
      <BestSpotSuggestion
        bestSpot={bestSpotWithTechnicalReason}
        onSelectSite={vi.fn()}
      />
    );

    expect(screen.queryByText(/wind_decollage_cul/u)).not.toBeInTheDocument();
    expect(screen.getByText(/vent de cul au décollage/u)).toBeInTheDocument();
  });
});
