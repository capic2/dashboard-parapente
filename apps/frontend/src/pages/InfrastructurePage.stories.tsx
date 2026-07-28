import preview from '../../.storybook/preview';
import InfrastructurePage from './InfrastructurePage';
import {
  defaultHandlers,
  intervalsNoActivityTypesHandlers,
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
  name: 'No Activity Types',
  beforeEach: resetCacheDb,
  parameters: {
    msw: { handlers: [...intervalsNoActivityTypesHandlers, ...cacheHandlers] },
  },
});

export const Empty = meta.story({
  name: 'Empty Cache',
  beforeEach: () => {
    cacheDb.length = 0;
  },
});
