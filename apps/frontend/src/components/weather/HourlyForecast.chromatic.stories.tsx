import { FigureWrapper } from '../../../.storybook/FigureWrapper.tsx';
import preview from '../../../.storybook/preview.tsx';
import {
  GoodConditions,
  MixedConditions,
  EmptyForecast,
  Loading,
  Error,
  NoHourlyData,
  DayTwo,
} from './HourlyForecast.stories.tsx';

const meta = preview.meta({
  title: 'Components/Weather/HourlyForecast/Chromatic',
  parameters: {
    layout: 'padded',
    chromatic: {
      disableSnapshot: false,
    },
  },
  tags: ['!autodocs'],
});

export const HourlyForecastChromatic = meta.story({
  render: () => (
    <div className="flex flex-col gap-2">
      <FigureWrapper title={GoodConditions.composed.name}>
        <GoodConditions.Component />
      </FigureWrapper>
      <FigureWrapper title={MixedConditions.composed.name}>
        <MixedConditions.Component />
      </FigureWrapper>
      <FigureWrapper title={EmptyForecast.composed.name}>
        <EmptyForecast.Component />
      </FigureWrapper>
      <FigureWrapper title={Loading.composed.name}>
        <Loading.Component />
      </FigureWrapper>
      <FigureWrapper title={Error.composed.name}>
        <Error.Component />
      </FigureWrapper>
      <FigureWrapper title={NoHourlyData.composed.name}>
        <NoHourlyData.Component />
      </FigureWrapper>
      <FigureWrapper title={DayTwo.composed.name}>
        <DayTwo.Component />
      </FigureWrapper>
    </div>
  ),
});
