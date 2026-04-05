import preview from '../../.storybook/preview';
import { expect, userEvent, screen } from 'storybook/test';
import { http, HttpResponse } from 'msw';
import CacheViewer from './CacheViewer';
import type { CacheOverview, CacheKeyDetail } from '../hooks/admin/useCache';

const mockOverview: CacheOverview = {
  total_keys: 10,
  memory_usage: '1.2M',
  groups: {
    'weather:forecast': {
      count: 5,
      keys: [
        { key: 'weather:forecast:abc123', ttl: 3200, size: 2048 },
        { key: 'weather:forecast:def456', ttl: 1800, size: 1536 },
        { key: 'weather:forecast:ghi789', ttl: 900, size: 1024 },
        { key: 'weather:forecast:jkl012', ttl: 3500, size: 2560 },
        { key: 'weather:forecast:mno345', ttl: 2400, size: 1792 },
      ],
    },
    best_spot: {
      count: 3,
      keys: [
        { key: 'best_spot:day_0', ttl: 3000, size: 512 },
        { key: 'best_spot:day_1', ttl: 2500, size: 480 },
        { key: 'best_spot:day_2', ttl: 2000, size: 496 },
      ],
    },
    'emagram:sounding': {
      count: 2,
      keys: [
        { key: 'emagram:sounding:07145:12:2026-01-15', ttl: 80000, size: 4096 },
        { key: 'emagram:sounding:07481:00:2026-01-15', ttl: 72000, size: 3584 },
      ],
    },
  },
};

const mockKeyDetail: CacheKeyDetail = {
  key: 'best_spot:day_0',
  ttl: 3000,
  size: 512,
  type: 'json',
  value: {
    site: { id: 'site-arguel', name: 'Arguel', latitude: 47.2, longitude: 6.0 },
    paraIndex: 75,
    score: 75.0,
    verdict: 'BON',
    cached_at: '2026-01-15T10:00:00+00:00',
  },
};

const emptyOverview: CacheOverview = {
  total_keys: 0,
  memory_usage: null,
  groups: {},
};

const defaultHandlers = [
  http.get('*/api/admin/cache', () => HttpResponse.json(mockOverview)),
  http.get('*/api/admin/cache/*', () => HttpResponse.json(mockKeyDetail)),
  http.delete('*/api/admin/cache/*', () =>
    HttpResponse.json({ success: true, keys_deleted: 1 })
  ),
];

const meta = preview.meta({
  title: 'Pages/CacheViewer',
  component: CacheViewer,
  parameters: {
    layout: 'padded',
    msw: { handlers: defaultHandlers },
  },
  tags: ['autodocs'],
});

export const Default = meta.story({
  name: 'Default',
});

Default.test('displays cache groups and key counts', async () => {
  await expect(await screen.findByText('weather:forecast')).toBeInTheDocument();
  await expect(await screen.findByText('best_spot')).toBeInTheDocument();
  await expect(await screen.findByText('emagram:sounding')).toBeInTheDocument();
  await expect(await screen.findByText('10')).toBeInTheDocument();
});

Default.test('can filter keys', async () => {
  const input = await screen.findByPlaceholderText('Filtrer les clés...');
  await userEvent.type(input, 'best_spot');

  await expect(await screen.findByText('best_spot')).toBeInTheDocument();
  // weather:forecast group should be filtered out
  const forecastElements = screen.queryAllByText('weather:forecast');
  await expect(forecastElements).toHaveLength(0);
});

Default.test('can open key detail modal', async () => {
  // Expand best_spot group
  const groupHeader = await screen.findByText('best_spot');
  await userEvent.click(groupHeader);

  // Click view on first key
  const viewButtons = await screen.findAllByText('Voir');
  await userEvent.click(viewButtons[0]);

  // Modal should show key detail
  await expect(await screen.findByText('Détail de la clé')).toBeInTheDocument();
  await expect(await screen.findByText('"Arguel"')).toBeInTheDocument();
});

export const Empty = meta.story({
  name: 'Empty Cache',
  parameters: {
    msw: {
      handlers: [
        http.get('*/api/admin/cache', () => HttpResponse.json(emptyOverview)),
      ],
    },
  },
});

Empty.test('displays empty state message', async () => {
  await expect(
    await screen.findByText('Aucune clé en cache')
  ).toBeInTheDocument();
  await expect(await screen.findByText('0')).toBeInTheDocument();
});
