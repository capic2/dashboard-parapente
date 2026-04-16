import { FigureWrapper } from '../../../.storybook/FigureWrapper.tsx';
import preview from '../../../.storybook/preview.tsx';
import { Default, MinimalFlightForm } from './FlightEditForm.stories.tsx';

const meta = preview.meta({
  title: 'Components/Flights/FlightEditForm/Chromatic',
  parameters: {
    layout: 'padded',
    chromatic: {
      disableSnapshot: false,
    },
  },
  tags: ['!autodocs'],
});

export const FlightEditFormChromatic = meta.story({
  render: () => (
    <div className="flex flex-col gap-2">
      <FigureWrapper title={Default.composed.name}>
        <Default.Component />
      </FigureWrapper>
      <FigureWrapper title={MinimalFlightForm.composed.name}>
        <MinimalFlightForm.Component />
      </FigureWrapper>
    </div>
  ),
});
