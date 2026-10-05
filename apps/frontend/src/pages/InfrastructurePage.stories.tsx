import preview from '../../.storybook/preview';
import { expect, within } from 'storybook/test';
import InfrastructurePage from './InfrastructurePage';
import { validateInfrastructureSearch } from '../routes/infrastructure';
import {
  defaultHandlers,
  intervalsNoActivityTypesHandlers,
  cacheHandlers,
  resetCacheDb,
  cacheDb,
  deploymentDrainHandlers,
  deploymentWaitingHandlers,
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

export const VideoExports = meta.story({
  name: 'Video Exports',
  beforeEach: resetCacheDb,
  parameters: {
    router: {
      initialPath: '/infrastructure/video-exports',
      routes: [
        {
          path: '/infrastructure/$tab',
          element: 'story',
          validateSearch: validateInfrastructureSearch,
        },
      ],
    },
  },
});

export const AwaitingActivityType = meta.story({
  name: 'No Activity Types',
  beforeEach: resetCacheDb,
  parameters: {
    msw: {
      handlers: [
        ...intervalsNoActivityTypesHandlers,
        ...cacheHandlers,
        ...deploymentDrainHandlers,
      ],
    },
  },
});

export const DeploymentWaiting = meta.story({
  name: 'Deployment Waiting',
  beforeEach: resetCacheDb,
  parameters: {
    msw: {
      handlers: deploymentWaitingHandlers,
    },
  },
});

DeploymentWaiting.test(
  'shows the blocked deployment and GitHub run link',
  async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      await canvas.findByRole('status', { name: /Déploiement en attente/iu })
    ).toBeInTheDocument();
    await expect(
      canvas.getByRole('link', { name: /GitHub Actions/iu })
    ).toHaveAttribute('href', expect.stringContaining('/actions/runs/123'));
  }
);

export const Empty = meta.story({
  name: 'Empty Cache',
  beforeEach: () => {
    cacheDb.length = 0;
  },
});
