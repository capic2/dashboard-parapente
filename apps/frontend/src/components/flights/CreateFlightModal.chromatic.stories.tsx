import { FigureWrapper } from '../../../.storybook/FigureWrapper.tsx';
import preview from '../../../.storybook/preview.tsx';
import { FlightModal } from './CreateFlightModal.stories.tsx';

const meta = preview.meta({
  title: 'Components/Forms/CreateFlightModal/Chromatic',
  parameters: {
    layout: 'padded',
    chromatic: {
      disableSnapshot: false,
    },
  },
  tags: ['!autodocs'],
});

export const CreateFlightModalChromatic = meta.story({
  render: () => (
    <div className="flex flex-col gap-2">
      <FigureWrapper title={FlightModal.composed.name}>
        <FlightModal.Component />
      </FigureWrapper>
    </div>
  ),
});
