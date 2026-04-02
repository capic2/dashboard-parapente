import { FigureWrapper } from '../../../.storybook/FigureWrapper.tsx';
import preview from '../../../.storybook/preview.tsx';
import {
  Default,
  Loading,
  Error,
  NoFlights,
  ManyFlights,
} from './StatsPanel.stories.tsx';

const meta = preview.meta({
  title: 'Components/StatsPanel/Chromatic',
  parameters: {
    layout: 'padded',
    chromatic: {
      disableSnapshot: false,
    },
  },
  tags: ['!autodocs'],
});

export const StatsPanelChromatic = meta.story({
  render: () => (
    <div className="flex flex-col gap-2">
      <FigureWrapper title={Default.composed.name}>
        <Default.Component />
      </FigureWrapper>
      <FigureWrapper title={Loading.composed.name}>
        <Loading.Component />
      </FigureWrapper>
      <FigureWrapper title={Error.composed.name}>
        <Error.Component />
      </FigureWrapper>
      <FigureWrapper title={NoFlights.composed.name}>
        <NoFlights.Component />
      </FigureWrapper>
      <FigureWrapper title={ManyFlights.composed.name}>
        <ManyFlights.Component />
      </FigureWrapper>
    </div>
  ),
});
