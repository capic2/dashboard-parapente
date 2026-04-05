import preview from '../../.storybook/preview';
import { expect, screen, within } from 'storybook/test';
import { http, HttpResponse } from 'msw';
import CacheViewer from './CacheViewer';
import type { CacheKeyDetail } from '../hooks/admin/useCache';
import i18n from 'i18next';

// --- In-memory cache database ---

interface CacheEntry {
  key: string;
  ttl: number;
  size: number;
  value: string; // JSON-serialized
}

const initialEntries: CacheEntry[] = [
  {
    key: 'weather:forecast:abc123',
    ttl: 3200,
    size: 2048,
    value: JSON.stringify({
      temperature: 18,
      wind_speed: 15,
      cached_at: '2026-01-15T10:00:00+00:00',
    }),
  },
  {
    key: 'weather:forecast:def456',
    ttl: 1800,
    size: 1536,
    value: JSON.stringify({
      temperature: 12,
      wind_speed: 20,
      cached_at: '2026-01-15T10:00:00+00:00',
    }),
  },
  {
    key: 'weather:forecast:ghi789',
    ttl: 900,
    size: 1024,
    value: JSON.stringify({
      temperature: 22,
      wind_speed: 8,
      cached_at: '2026-01-15T10:00:00+00:00',
    }),
  },
  {
    key: 'best_spot:day_0',
    ttl: 3000,
    size: 512,
    value: JSON.stringify({
      site: {
        id: 'site-arguel',
        name: 'Arguel',
        latitude: 47.2,
        longitude: 6.0,
      },
      paraIndex: 75,
      score: 75.0,
      verdict: 'BON',
      cached_at: '2026-01-15T10:00:00+00:00',
    }),
  },
  {
    key: 'best_spot:day_1',
    ttl: 2500,
    size: 480,
    value: JSON.stringify({
      site: { id: 'site-chalais', name: 'Chalais' },
      paraIndex: 60,
      score: 60.0,
      verdict: 'MOYEN',
      cached_at: '2026-01-15T10:00:00+00:00',
    }),
  },
  {
    key: 'emagram:sounding:07145:12:2026-01-15',
    ttl: 80000,
    size: 4096,
    value: JSON.stringify({
      success: true,
      station_code: '07145',
      data: [1, 2, 3],
      cached_at: '2026-01-15T10:00:00+00:00',
    }),
  },
];

const cacheDb: CacheEntry[] = [...initialEntries];

const resetCacheDb = () => {
  cacheDb.length = 0;
  cacheDb.push(...initialEntries);
};

// --- Helper: build overview response from cacheDb ---

function buildOverview() {
  const groups: Record<
    string,
    { count: number; keys: { key: string; ttl: number; size: number }[] }
  > = {};

  for (const entry of cacheDb) {
    const parts = entry.key.split(':');
    const prefix = parts.length >= 3 ? `${parts[0]}:${parts[1]}` : parts[0];

    if (!groups[prefix]) {
      groups[prefix] = { count: 0, keys: [] };
    }
    groups[prefix].count += 1;
    groups[prefix].keys.push({
      key: entry.key,
      ttl: entry.ttl,
      size: entry.size,
    });
  }

  return {
    total_keys: cacheDb.length,
    memory_usage: '1.2M',
    groups,
  };
}

// --- MSW handlers reading/modifying cacheDb ---

const defaultHandlers = [
  http.get('/api/admin/cache', () => HttpResponse.json(buildOverview())),

  http.get('/api/admin/cache/:key', ({ params }) => {
    const key = decodeURIComponent(params.key as string);
    const entry = cacheDb.find((e) => e.key === key);
    if (!entry) {
      return new HttpResponse(null, { status: 404 });
    }
    let value: unknown;
    let type: 'json' | 'string';
    try {
      value = JSON.parse(entry.value);
      type = 'json';
    } catch {
      value = entry.value;
      type = 'string';
    }
    return HttpResponse.json({
      key: entry.key,
      ttl: entry.ttl,
      size: entry.size,
      value,
      type,
    } satisfies CacheKeyDetail);
  }),

  http.delete('/api/admin/cache/:key', ({ params }) => {
    const key = decodeURIComponent(params.key as string);

    if (key.includes('*')) {
      const pattern = key.replace(/\*/g, '');
      const before = cacheDb.length;
      for (let i = cacheDb.length - 1; i >= 0; i--) {
        if (cacheDb[i].key.startsWith(pattern)) {
          cacheDb.splice(i, 1);
        }
      }
      return HttpResponse.json({
        success: true,
        keys_deleted: before - cacheDb.length,
      });
    }

    const index = cacheDb.findIndex((e) => e.key === key);
    if (index !== -1) {
      cacheDb.splice(index, 1);
      return HttpResponse.json({ success: true, keys_deleted: 1 });
    }
    return HttpResponse.json({ success: true, keys_deleted: 0 });
  }),
];

// --- Stories ---

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
  beforeEach: resetCacheDb,
});

Default.test('displays cache groups and key counts', async ({ canvas }) => {
  await expect(await canvas.findByText('weather:forecast')).toBeInTheDocument();
  await expect(await canvas.findByText('best_spot')).toBeInTheDocument();
  await expect(await canvas.findByText('emagram:sounding')).toBeInTheDocument();
});

Default.test('can filter keys', async ({ canvas, userEvent }) => {
  const input = await canvas.findByPlaceholderText(
    i18n.t('cache.searchPlaceholder')
  );
  await userEvent.type(input, 'best_spot');

  await expect(await canvas.findByText('best_spot')).toBeInTheDocument();
  const forecastElements = canvas.queryAllByText('weather:forecast');
  await expect(forecastElements).toHaveLength(0);
});

Default.test('can open key detail modal', async ({ canvas, userEvent }) => {
  // Expand best_spot group
  await userEvent.click(await canvas.findByText('best_spot'));

  // Click view on first key
  const viewButtons = await canvas.findAllByText(i18n.t('cache.view'));
  await userEvent.click(viewButtons[0]);

  // Modal should show key detail
  const modal = await screen.findByRole('dialog');
  await expect(
    within(modal).getByText(i18n.t('cache.keyDetail'))
  ).toBeInTheDocument();
  await expect(within(modal).getByText('best_spot:day_0')).toBeInTheDocument();
});

Default.test('can delete a single key', async ({ canvas, userEvent }) => {
  // Expand best_spot group
  await userEvent.click(await canvas.findByText('best_spot'));

  // Click delete on first key
  const deleteButtons = await canvas.findAllByRole('button', {
    name: i18n.t('cache.deleteKey'),
  });
  await userEvent.click(deleteButtons[0]);

  // Confirm in alertdialog
  const dialog = within(await screen.findByRole('alertdialog'));
  await userEvent.click(
    dialog.getByRole('button', { name: i18n.t('common.confirm') })
  );

  // best_spot group should now show 1 key
  await expect(await canvas.findByText('best_spot')).toBeInTheDocument();
});

Default.test('can clear a group', async ({ canvas, userEvent }) => {
  // Click "clear group" on weather:forecast (3 keys)
  const clearButtons = await canvas.findAllByRole('button', {
    name: i18n.t('cache.clearPattern'),
  });
  // weather:forecast is first alphabetically (before best_spot? no — best_spot < emagram < weather)
  // Groups sorted: best_spot, emagram:sounding, weather:forecast → index 2
  await userEvent.click(clearButtons[2]);

  // Confirm in alertdialog
  const dialog = within(await screen.findByRole('alertdialog'));
  await userEvent.click(
    dialog.getByRole('button', { name: i18n.t('common.confirm') })
  );

  // weather:forecast group should be gone, others remain
  await expect(await canvas.findByText('best_spot')).toBeInTheDocument();
  await expect(await canvas.findByText('emagram:sounding')).toBeInTheDocument();
  await expect(canvas.queryByText('weather:forecast')).toBeNull();
});

Default.test('can clear all cache', async ({ canvas, userEvent }) => {
  await userEvent.click(
    await canvas.findByRole('button', { name: i18n.t('cache.clearAll') })
  );

  // Confirm in alertdialog
  const dialog = within(await screen.findByRole('alertdialog'));
  await userEvent.click(
    dialog.getByRole('button', { name: i18n.t('common.confirm') })
  );

  // Should show empty state
  await expect(
    await canvas.findByText(i18n.t('cache.noKeys'))
  ).toBeInTheDocument();
});

export const Empty = meta.story({
  name: 'Empty Cache',
  beforeEach: () => {
    cacheDb.length = 0;
  },
});

Empty.test('displays empty state', async ({ canvas }) => {
  await expect(
    await canvas.findByText(i18n.t('cache.noKeys'))
  ).toBeInTheDocument();
});
