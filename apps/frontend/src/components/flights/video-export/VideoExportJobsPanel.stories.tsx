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
  parameters: {
    layout: 'padded',
    msw: { handlers: defaultHandlers },
  },
  tags: ['autodocs'],
});

export const Default = meta.story({
  name: 'Operational list',
  args: { limit: null },
  beforeEach: resetMockVideoJobs,
});

Default.test('opens logs in a modal', async ({ canvasElement }) => {
  const canvas = within(canvasElement);
  await expect(
    canvas.getByRole('button', { name: 'Logs' })
  ).toBeInTheDocument();
  await canvas.getByRole('button', { name: 'Logs' }).click();
  await expect(
    within(document.body).getByText('Opening viewer')
  ).toBeInTheDocument();
});
