import { FigureWrapper } from '../../../.storybook/FigureWrapper.tsx';
import preview from '../../../.storybook/preview.tsx';
import {
  Default,
  WithoutGpx,
  MinimalFlight,
} from './FlightDetails.stories.tsx';

const meta = preview.meta({
  title: 'Components/Flights/FlightDetails/Chromatic',
  parameters: {
    layout: 'padded',
    chromatic: {
      disableSnapshot: false,
    },
  },
  tags: ['!autodocs'],
});

export const FlightDetailsChromatic = meta.story({
  render: () => (
    <div className="flex flex-col gap-2">
      <FigureWrapper title={Default.composed.name}>
        <Default.Component />
      </FigureWrapper>
      <FigureWrapper title={WithoutGpx.composed.name}>
        <WithoutGpx.Component />
      </FigureWrapper>
      <FigureWrapper title={MinimalFlight.composed.name}>
        <MinimalFlight.Component />
      </FigureWrapper>
    </div>
  ),
});
