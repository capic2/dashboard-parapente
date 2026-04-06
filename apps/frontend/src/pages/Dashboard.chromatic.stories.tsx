import { FigureWrapper } from '../../.storybook/FigureWrapper.tsx';
import preview from '../../.storybook/preview.tsx';
import { http, HttpResponse } from 'msw';
import { Default, Loading, Error } from './Dashboard.stories.tsx';

const mockSites = {
  sites: [
    {
      id: 'site-arguel',
      code: 'ARG',
      name: 'Arguel',
      latitude: 47.2,
      longitude: 6.0,
      elevation_m: 427,
      region: 'Doubs',
      country: 'FR',
      orientation: 'SW',
      usage_type: 'takeoff',
      flight_count: 12,
      is_active: true,
    },
    {
      id: 'site-chalais',
      code: 'CHA',
      name: 'Chalais',
      latitude: 47.18,
      longitude: 6.22,
      elevation_m: 920,
      region: 'Doubs',
      country: 'FR',
      orientation: 'W',
      usage_type: 'both',
      flight_count: 5,
      is_active: true,
    },
  ],
};

const meta = preview.meta({
  title: 'Pages/Dashboard/Chromatic',
  parameters: {
    layout: 'padded',
    chromatic: {
      disableSnapshot: false,
    },
    msw: {
      handlers: [
        http.get('/api/spots', () => HttpResponse.json(mockSites)),
        http.get('/api/spots/best', () =>
          HttpResponse.json({
            site: {
              id: 'site-arguel',
              name: 'Arguel',
              rating: 4,
              orientation: 'SW',
            },
            paraIndex: 78,
            windDirection: 'SW',
            windSpeed: 12,
            windFavorability: 'good',
            score: 82,
            verdict: 'BON',
            reason: 'Bonnes conditions',
            flyableSlot: '10h-17h',
            thermalCeiling: 1850,
            cached_at: '2025-06-15T08:30:00Z',
          })
        ),
        http.get('/api/spots/:id', ({ params }) => {
          const site = mockSites.sites.find((s) => s.id === params.id);
          return site
            ? HttpResponse.json(site)
            : new HttpResponse(null, { status: 404 });
        }),
        http.get('/api/weather/:spotId', () =>
          HttpResponse.json({
            site_id: 'site-arguel',
            site_name: 'Arguel',
            day_index: 0,
            days: 1,
            para_index: 78,
            verdict: 'bon',
            emoji: '🟢',
            explanation: 'Conditions favorables',
            consensus: [
              {
                hour: 10,
                temperature: 18,
                wind_speed: 12,
                wind_gust: 18,
                wind_direction: 225,
                precipitation: 0,
                cloud_cover: 20,
                para_index: 78,
                verdict: 'bon',
              },
            ],
          })
        ),
        http.get('/api/flights/stats', () =>
          HttpResponse.json({
            total_flights: 42,
            total_hours: 68.5,
            total_duration_minutes: 4110,
            total_distance_km: 312.4,
            avg_duration_minutes: 97,
            favorite_spot: 'Arguel',
          })
        ),
        http.get('/api/sites/:siteId/landings', () => HttpResponse.json([])),
        http.get('/api/sites/:siteId/landings/weather', () =>
          HttpResponse.json([])
        ),
        http.get('/api/emagram/hours', () =>
          HttpResponse.json({
            site_id: '',
            forecast_date: '2026-03-24',
            hours: [],
          })
        ),
        http.get('/api/emagram/latest', () => HttpResponse.json(null)),
        http.get('/api/emagram/history', () => HttpResponse.json([])),
      ],
    },
  },
  tags: ['!autodocs'],
});

export const DashboardChromatic = meta.story({
  render: () => (
    <div className="flex flex-col gap-2">
      <FigureWrapper title={Default.composed.name}>
        <Default.Component />
      </FigureWrapper>
      <FigureWrapper title={Loading.composed.name}>
        <Loading.Component />
      </FigureWrapper>
      <FigureWrapper title={Error.composed.name}>
        <Error.Component />
      </FigureWrapper>
    </div>
  ),
});
