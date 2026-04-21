import preview from '../../../.storybook/preview';
import { expect, fn, userEvent, within } from 'storybook/test';
import AppUpdateBanner from './AppUpdateBanner';

const meta = preview.meta({
  title: 'Components/Common/AppUpdateBanner',
  component: AppUpdateBanner,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
});

export const WithReleaseNotes = meta.story({
  args: {
    title: 'Nouvelle version disponible',
    message: 'Une nouvelle version (2026.04.22.1) est prete.',
    viewWhatsNewLabel: 'Voir les nouveautes',
    refreshLabel: 'Rafraichir',
    releaseNotesUrl: 'https://example.com/releases/2026.04.22.1',
    onRefresh: fn(),
  },
});

WithReleaseNotes.test('shows version details and release notes link', async ({
  canvasElement,
}) => {
  const canvas = within(canvasElement);

  await expect(
    canvas.getByText(/Une nouvelle version \(2026\.04\.22\.1\) est prete\./i)
  ).toBeInTheDocument();
  await expect(
    canvas.getByRole('link', { name: /Voir les nouveautes/i })
  ).toBeInTheDocument();
});

WithReleaseNotes.test('calls refresh callback', async ({ canvasElement, args }) => {
  const canvas = within(canvasElement);

  await userEvent.click(canvas.getByRole('button', { name: /Rafraichir/i }));
  await expect(args.onRefresh).toHaveBeenCalledTimes(1);
});

export const WithoutReleaseNotes = meta.story({
  args: {
    title: 'New version available',
    message: 'A new version (2026.04.22.1) is ready.',
    viewWhatsNewLabel: "See what's new",
    refreshLabel: 'Refresh',
    releaseNotesUrl: null,
    onRefresh: fn(),
  },
});

WithoutReleaseNotes.test('hides release notes link when URL is missing', async ({
  canvasElement,
}) => {
  const canvas = within(canvasElement);

  await expect(canvas.queryByRole('link')).not.toBeInTheDocument();
  await expect(canvas.getByRole('button', { name: /Refresh/i })).toBeInTheDocument();
});
