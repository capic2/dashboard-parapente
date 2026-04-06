import preview from '../../.storybook/preview';
import CacheViewer from './CacheViewer';
import {
  defaultHandlers,
  resetCacheDb,
  cacheDb,
} from './CacheViewer.stories.handlers';

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

/*
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
  await expect(
    await within(modal).findByText('best_spot:day_0')
  ).toBeInTheDocument();
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
  await waitFor(() => {
    expect(canvas.queryByText('weather:forecast')).toBeNull();
  });
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

Default.test('can refresh manually', async ({ canvas, userEvent }) => {
  // Verify initial state
  await expect(await canvas.findByText('weather:forecast')).toBeInTheDocument();

  // Mutate cacheDb externally (simulate server-side change)
  cacheDb.push({
    key: 'weather:forecast:newkey',
    ttl: 3600,
    size: 1024,
    value: JSON.stringify({
      temperature: 25,
      cached_at: '2026-01-15T12:00:00+00:00',
    }),
  });

  // Click refresh
  await userEvent.click(
    await canvas.findByRole('button', { name: i18n.t('cache.refresh') })
  );

  // Expand weather:forecast to see the new key
  await userEvent.click(await canvas.findByText('weather:forecast'));
  await expect(
    await canvas.findByText('weather:forecast:newkey')
  ).toBeInTheDocument();
});
*/

/*
Default.test('auto-refresh updates data', async ({ canvas, userEvent }) => {
  // Verify initial total keys
  await expect(await canvas.findByText('6')).toBeInTheDocument();

  // Enable auto-refresh
  await userEvent.click(
    await canvas.findByRole('checkbox', { name: i18n.t('cache.autoRefresh') })
  );

  // Mutate cacheDb externally (simulate server-side change)
  cacheDb.push({
    key: 'best_spot:day_3',
    ttl: 1800,
    size: 256,
    value: JSON.stringify({
      site: 'new',
      cached_at: '2026-01-15T12:00:00+00:00',
    }),
  });

  // Wait for auto-refresh to pick up the change (interval is 5s)
  // Total keys should go from 6 to 7
  await waitFor(
    async () => {
      await expect(await canvas.findByText('7')).toBeInTheDocument();
    },
    { timeout: 10000 }
  );
});
*/

export const Empty = meta.story({
  name: 'Empty Cache',
  beforeEach: () => {
    cacheDb.length = 0;
  },
});
