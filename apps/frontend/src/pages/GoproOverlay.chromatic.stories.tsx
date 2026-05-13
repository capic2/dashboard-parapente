import { FigureWrapper } from '../../.storybook/FigureWrapper.tsx';
import preview from '../../.storybook/preview.tsx';
import { goproOverlayHandlers } from './GoproOverlay.handlers';
import { Default, MissingLayoutFiles } from './GoproOverlay.stories.tsx';

const meta = preview.meta({
  title: 'Pages/GoproOverlay/Chromatic',
  parameters: {
    layout: 'padded',
    chromatic: {
      disableSnapshot: false,
    },
    msw: { handlers: goproOverlayHandlers },
  },
  tags: ['!autodocs'],
});

export const GoproOverlayChromatic = meta.story({
  render: () => (
    <div className="flex flex-col gap-2">
      <FigureWrapper title={Default.composed.name}>
        <Default.Component />
      </FigureWrapper>
      <FigureWrapper title={MissingLayoutFiles.composed.name}>
        <MissingLayoutFiles.Component />
      </FigureWrapper>
    </div>
  ),
});
