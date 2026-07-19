import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import HourlyForecast from './HourlyForecast';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, string>) => {
      const labels: Record<string, string> = {
        'weather.paraIndex': 'Para-Index',
        'weather.hourly.paraIndexAt': `Para-Index ${options?.hour}`,
        'weather.hourly.verdictAt': `Verdict ${options?.hour}`,
        'weather.hourly.temperatureAt': `Température ${options?.hour}`,
        'weather.metricsUsed': 'Metriques utilisees',
        'weather.verdictLabel': 'Verdict',
        'weather.criteriaEvaluated': 'Criteres evalues',
        'weather.refreshData': 'Recharger les données météo',
        'weather.refreshingData': 'Rechargement...',
        'weather.hourly.reasons.thunderstorms': 'Orages',
        'weather.hourly.reasons.thunderstormRisk': "Risque d'orage",
        'weather.staleSourceDataWithDate': `données non actualisées, limite API atteinte, affichées depuis le ${options?.date}`,
      };
      if (labels[key]) return labels[key];
      return key;
    },
    i18n: {
      language: 'fr',
    },
  }),
}));

vi.mock('react-aria-components', async () => {
  const React = await import('react');

  const TooltipTrigger = ({
    children,
  }: {
    children: React.ReactNode;
    delay?: number;
    closeDelay?: number;
  }) => {
    const [open, setOpen] = React.useState(false);
    const childArray = React.Children.toArray(children);

    return (
      <div
        onMouseOver={() => setOpen(true)}
        onMouseOut={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
      >
        {childArray[0]}
        {open ? childArray[1] : null}
      </div>
    );
  };

  const Tooltip = ({
    children,
    className,
  }: {
    children: React.ReactNode;
    className?: string;
    offset?: number;
  }) => (
    <div role="tooltip" className={className}>
      {children}
    </div>
  );

  const Button = ({
    children,
    onPress,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement> & {
    onPress?: () => void;
  }) => (
    <button type="button" onClick={onPress} {...props}>
      {children}
    </button>
  );

  return { Button, TooltipTrigger, Tooltip };
});

vi.mock('../../hooks/weather/useWeather', () => ({
  useWeather: vi.fn(),
}));

vi.mock('../../hooks/settings/useAppSettings', () => ({
  useAppSettings: vi.fn(),
}));

import { useWeather } from '../../hooks/weather/useWeather';
import { useAppSettings } from '../../hooks/settings/useAppSettings';

const mockedUseWeather = vi.mocked(useWeather);
const mockedUseAppSettings = vi.mocked(useAppSettings);

describe('HourlyForecast tooltip behavior', () => {
  beforeEach(() => {
    mockedUseAppSettings.mockReturnValue({ data: undefined } as never);

    mockedUseWeather.mockReturnValue({
      data: {
        cached_at: '2026-04-25T10:00:00Z',
        hourly_forecast: [
          {
            hour: '10:00',
            time: '10:00',
            temp: 22,
            temperature: 22,
            wind: 10,
            wind_speed: 10,
            wind_gust: 15,
            direction: 'NW',
            wind_direction: 'NW',
            wind_direction_deg: 315,
            conditions: 'clear',
            precipitation: 0,
            cloud_cover: 10,
            cape: 800,
            thermal_strength: 'fort',
            para_index: 85,
            verdict: 'bon',
            sources: {
              'open-meteo': {
                temperature: 22.2,
                wind_speed: 10.1,
                wind_gust: 14.8,
                wind_direction: 315,
                precipitation: 0,
                cloud_cover: 10,
              },
            },
            source_freshness: {
              'open-meteo': {
                is_stale: true,
                stale_reason: 'rate_limited',
                cached_at: '2026-04-25T10:00:00Z',
              },
            },
          },
        ],
      },
      isLoading: false,
      error: null,
    } as never);
  });

  it('shows para-index tooltip content on hover', () => {
    render(<HourlyForecast spotId="site-1" dayIndex={0} />);

    fireEvent.mouseOver(
      screen.getByRole('button', { name: 'Para-Index 10:00' })
    );

    expect(screen.getByText('Para-Index - 10:00')).toBeTruthy();
    expect(screen.getByText(/Metriques utilisees/iu)).toBeTruthy();
  });

  it('shows stale source timestamp in source tooltips', () => {
    render(<HourlyForecast spotId="site-1" dayIndex={0} />);

    const staleTimestamp = new Intl.DateTimeFormat('fr', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date('2026-04-25T10:00:00Z'));

    fireEvent.mouseOver(
      screen.getByRole('button', { name: 'Température 10:00' })
    );

    expect(
      screen.getAllByText((_, element) =>
        Boolean(
          element?.textContent?.includes('données non actualisées') &&
          element.textContent.includes(staleTimestamp)
        )
      ).length
    ).toBeGreaterThan(0);
  });

  it('shows verdict tooltip content on hover', () => {
    render(<HourlyForecast spotId="site-1" dayIndex={0} />);

    fireEvent.mouseOver(screen.getByRole('button', { name: 'Verdict 10:00' }));

    expect(screen.getByText('✓ Verdict - 10:00')).toBeTruthy();
    expect(screen.getByText(/Criteres evalues/iu)).toBeTruthy();
  });

  it('shows wind direction on mobile hourly cards', () => {
    render(<HourlyForecast spotId="site-1" dayIndex={0} />);

    expect(screen.getByText('NW (315°)')).toBeTruthy();
  });

  it('shows force refresh action only when allowed', () => {
    const onForceRefresh = vi.fn();
    const { rerender } = render(
      <HourlyForecast
        spotId="site-1"
        dayIndex={0}
        onForceRefresh={onForceRefresh}
      />
    );

    expect(screen.queryByText('Recharger les données météo')).toBeNull();

    rerender(
      <HourlyForecast
        spotId="site-1"
        dayIndex={0}
        canForceRefresh
        onForceRefresh={onForceRefresh}
      />
    );

    fireEvent.click(screen.getByText('Recharger les données météo'));

    expect(onForceRefresh).toHaveBeenCalledOnce();
  });

  it('shows thunderstorms as the hourly flyability reason', () => {
    mockedUseWeather.mockReturnValue({
      data: {
        cached_at: '2026-04-25T10:00:00Z',
        hourly_forecast: [
          {
            hour: '10:00',
            time: '10:00',
            temp: 22,
            temperature: 22,
            wind: 10,
            wind_speed: 10,
            wind_gust: 15,
            direction: 'NW',
            wind_direction: 'NW',
            wind_direction_deg: 315,
            conditions: 'clear',
            precipitation: 0,
            cloud_cover: 10,
            cape: 2600,
            lifted_index: -5,
            thermal_strength: 'fort',
            para_index: 25,
            verdict: 'mauvais',
            sources: {},
          },
          {
            hour: '11:00',
            time: '11:00',
            temp: 23,
            temperature: 23,
            wind: 10,
            wind_speed: 10,
            wind_gust: 15,
            direction: 'NW',
            wind_direction: 'NW',
            wind_direction_deg: 315,
            conditions: 'clear',
            precipitation: 0,
            cloud_cover: 10,
            cape: 1600,
            lifted_index: -2,
            thermal_strength: 'fort',
            para_index: 55,
            verdict: 'moyen',
            sources: {},
          },
        ],
      },
      isLoading: false,
      error: null,
    } as never);

    render(<HourlyForecast spotId="site-1" dayIndex={0} />);

    const tenRow = screen
      .getAllByText('10:00')
      .map((element) => element.closest('tr'))
      .find((row) => row != null);
    const elevenRow = screen
      .getAllByText('11:00')
      .map((element) => element.closest('tr'))
      .find((row) => row != null);

    expect(tenRow).not.toBeNull();
    expect(elevenRow).not.toBeNull();
    expect(
      within(tenRow as HTMLElement).getByText('MAUVAIS — Orages')
    ).toBeTruthy();
    expect(
      within(elevenRow as HTMLElement).getByText("MOYEN — Risque d'orage")
    ).toBeTruthy();
  });
});
