import { FigureWrapper } from '../../.storybook/FigureWrapper.tsx';
import preview from '../../.storybook/preview.tsx';
import {
  Default,
  EmptyState,
  Loading,
  DeleteSingleFlight,
  ConfirmDeleteFlight,
  DeleteMultipleFlights,
} from './FlightHistory.stories.tsx';

const meta = preview.meta({
  title: 'Pages/FlightHistory/Chromatic',
  parameters: {
    layout: 'padded',
    chromatic: {
      disableSnapshot: false,
    },
  },
  tags: ['!autodocs'],
});

export const FlightHistoryChromatic = meta.story({
  render: () => (
    <div className="flex flex-col gap-2">
      <FigureWrapper title={Default.composed.name}>
        <Default.Component />
      </FigureWrapper>
      <FigureWrapper title={EmptyState.composed.name}>
        <EmptyState.Component />
      </FigureWrapper>
      <FigureWrapper title={Loading.composed.name}>
        <Loading.Component />
      </FigureWrapper>
      <FigureWrapper title={DeleteSingleFlight.composed.name}>
        <DeleteSingleFlight.Component />
      </FigureWrapper>
      <FigureWrapper title={ConfirmDeleteFlight.composed.name}>
        <ConfirmDeleteFlight.Component />
      </FigureWrapper>
      <FigureWrapper title={DeleteMultipleFlights.composed.name}>
        <DeleteMultipleFlights.Component />
      </FigureWrapper>
    </div>
  ),
});
