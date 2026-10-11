import preview from '../../../../.storybook/preview';
import { expect, userEvent, within } from 'storybook/test';
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

Default.test('opens logs in a modal', async ({ canvasElement }) => {
  const canvas = within(canvasElement);
  const actionsButton = (
    await canvas.findAllByRole('button', {
      name: 'Actions',
    })
  )[0];
  if (!actionsButton) throw new Error('Job actions button not found');
  await userEvent.click(actionsButton);
  await userEvent.click(
    await within(document.body).findByRole('menuitem', {
      name: /logs|show|afficher/iu,
    })
  );
  await expect(
    within(document.body).getAllByText(/Capture completed/u).length
  ).toBeGreaterThanOrEqual(1);
});
