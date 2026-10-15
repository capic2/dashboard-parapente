import preview from '../../../../.storybook/preview';
import { expect, within } from 'storybook/test';
import { VideoExportJobsPanel } from './VideoExportJobsPanel';
import {
  defaultHandlers,
  resetMockVideoJobs,
} from '../../../pages/InfrastructurePage.stories.handlers';

const meta = preview.meta({
  title: 'Components/Infrastructure/Video Export Jobs',
  component: VideoExportJobsPanel,
  parameters: { layout: 'padded' },
  tags: ['autodocs'],

  beforeEach: (context) => {
    context.msw.use(...defaultHandlers);
  },
});

export const Default = meta.story({
  name: 'Operational list',
  args: { limit: null },
  beforeEach: ({ msw }) => {
    msw.use(...defaultHandlers);
    resetMockVideoJobs();
  },
});

Default.test('shows jobs from the mock data', async ({ canvasElement }) => {
  const canvas = within(canvasElement);
  await expect(
    (await canvas.findAllByText('Arguel - soaring du soir')).length
  ).toBeGreaterThan(0);
  await expect(
    (await canvas.findAllByText('Chalais - thermique bleu')).length
  ).toBeGreaterThan(0);
  await expect(
    await canvas.findByRole('button', { name: 'Nettoyer les temporaires' })
  ).toBeVisible();
});
