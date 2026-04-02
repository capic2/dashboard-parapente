import { FigureWrapper } from '../../../.storybook/FigureWrapper.tsx';
import preview from '../../../.storybook/preview.tsx';
import { Closed, Open } from './StravaSyncModal.stories.tsx';

const meta = preview.meta({
  title: 'Components/Forms/StravaSyncModal/Chromatic',
  parameters: {
    layout: 'padded',
    chromatic: {
      disableSnapshot: false,
    },
  },
  tags: ['!autodocs'],
});

export const StravaSyncModalChromatic = meta.story({
  render: () => (
    <div className="flex flex-col gap-2">
      <FigureWrapper title={Closed.composed.name}>
        <Closed.Component />
      </FigureWrapper>
      <FigureWrapper title={Open.composed.name}>
        <Open.Component />
      </FigureWrapper>
    </div>
  ),
});
