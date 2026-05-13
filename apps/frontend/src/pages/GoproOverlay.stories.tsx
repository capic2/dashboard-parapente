import preview from '../../.storybook/preview';
import GoproOverlayPage from './GoproOverlay';
import {
  goproOverlayHandlers,
  missingGoproOverlayLayoutsHandlers,
} from './GoproOverlay.handlers';

const meta = preview.meta({
  title: 'Pages/GoproOverlay',
  component: GoproOverlayPage,
  parameters: {
    layout: 'fullscreen',
    msw: { handlers: goproOverlayHandlers },
  },
  tags: ['autodocs'],
});

export const Default = meta.story({
  name: 'Default',
});

export const MissingLayoutFiles = meta.story({
  name: 'Missing layout files',
  parameters: {
    msw: {
      handlers: missingGoproOverlayLayoutsHandlers,
    },
  },
});
