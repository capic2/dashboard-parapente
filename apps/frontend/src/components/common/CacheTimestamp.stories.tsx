import preview from '../../../.storybook/preview';
import CacheTimestamp from './CacheTimestamp';

const meta = preview.meta({
  title: 'Components/Common/CacheTimestamp',
  component: CacheTimestamp,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
});

export const NotCachedNull = meta.story({
  name: 'Not Cached (null)',
  args: {
    cachedAt: null,
  },
});

export const NotCachedUndefined = meta.story({
  name: 'Not Cached (undefined)',
  args: {
    cachedAt: undefined,
  },
});

export const ThirtyMinutesAgo = meta.story({
  name: '30 Minutes Ago',
  args: {
    cachedAt: new Date('2026-03-15T11:30:00Z').toISOString(),
  },
});

export const FullDate = meta.story({
  name: 'Full Date',
  args: {
    cachedAt: '2026-03-29T12:00:00.000Z',
  },
});

export const WithCustomClassName = meta.story({
  name: 'With Custom ClassName',
  args: {
    cachedAt: new Date('2026-03-15T11:30:00Z').toISOString(),
    className: 'mt-2',
  },
});
