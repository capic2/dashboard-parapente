import preview from '../../.storybook/preview';
import InfrastructurePage from './InfrastructurePage';
import {
  defaultHandlers,
  intervalsAwaitingTypeHandlers,
  cacheHandlers,
  resetCacheDb,
  cacheDb,
} from './InfrastructurePage.stories.handlers';

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

export const AwaitingActivityType = meta.story({
  name: 'Awaiting Activity Type',
  beforeEach: resetCacheDb,
  parameters: {
    msw: { handlers: [...intervalsAwaitingTypeHandlers, ...cacheHandlers] },
  },
});

export const Empty = meta.story({
  name: 'Empty Cache',
  beforeEach: () => {
    cacheDb.length = 0;
  },
});
