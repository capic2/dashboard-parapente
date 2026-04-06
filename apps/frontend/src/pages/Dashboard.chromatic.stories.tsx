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
            site_id: 'site-arguel',
            site_name: 'Arguel',
            score: 82,
            para_index: 78,
            verdict: 'bon',
            wind_speed: 12,
            wind_direction: 'SW',
            orientation: 'SW',
            wind_favorability: 'favorable',
          })
        ),
        http.get('/api/spots/:id', ({ params }) => {
          const site = mockSites.sites.find((s) => s.id === params.id);
          return site
            ? HttpResponse.json(site)
            : new HttpResponse(null, { status: 404 });
        }),
        http.get('/api/weather/:spotId/daily-summary', () =>
          HttpResponse.json({
            days: Array.from({ length: 7 }, (_, i) => ({
              day_index: i,
              date: `2026-03-${24 + i}`,
              para_index: 10 * i,
              verdict: i < 3 ? 'bon' : 'moyen',
              emoji: i < 3 ? '🟢' : '🟡',
              temp_min: 10 + i,
              temp_max: 18 + i,
              wind_avg: 10 + i * 2,
            })),
          })
        ),
        http.get('/api/weather/:spotId', () =>
          HttpResponse.json({
            site_id: 'site-arguel',
            site_name: 'Arguel',
            day_index: 0,
            days: 1,
            para_index: 78,
            verdict: 'bon',
            consensus: [],
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
