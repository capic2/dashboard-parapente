import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import WeatherLiveWindPanel, { getSpotairUrl } from './WeatherLiveWindPanel';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const labels: Record<string, string> = {
        'weather.liveWindTitle': 'Vent en direct',
        'weather.liveWindExternalInfo': 'Consulter les balises sur SpotAiR',
        'weather.liveWindOpenSpotair': 'Ouvrir SpotAiR',
      };

      return labels[key] ?? key;
    },
  }),
}));

describe('WeatherLiveWindPanel', () => {
  it('opens SpotAiR on the selected site coordinates', () => {
    render(<WeatherLiveWindPanel latitude={47.238} longitude={6.024} />);

    expect(
      screen.getByRole('link', { name: 'Ouvrir SpotAiR' })
    ).toHaveAttribute(
      'href',
      'https://www.spotair.mobi/?lat=47.238&lng=6.024&zoom=10'
    );
  });

  it('falls back to SpotAiR home without coordinates', () => {
    expect(getSpotairUrl()).toBe('https://www.spotair.mobi/');
  });
});
