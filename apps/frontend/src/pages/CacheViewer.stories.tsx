import preview from '../../.storybook/preview';
import InfrastructurePage from './InfrastructurePage';
import {
  defaultHandlers,
  stravaExpiredHandlers,
  cacheHandlers,
  resetCacheDb,
  cacheDb,
} from './CacheViewer.stories.handlers';

// --- Stories ---

const meta = preview.meta({
  title: 'Pages/Infrastructure',
  component: InfrastructurePage,
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

export const TokenExpired = meta.story({
  name: 'Token Expired',
  beforeEach: resetCacheDb,
  parameters: {
    msw: { handlers: [...stravaExpiredHandlers, ...cacheHandlers] },
  },
});

export const Empty = meta.story({
  name: 'Empty Cache',
  beforeEach: () => {
    cacheDb.length = 0;
  },
});
