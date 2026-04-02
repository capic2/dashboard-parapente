import { FigureWrapper } from '../../../.storybook/FigureWrapper.tsx';
import preview from '../../../.storybook/preview.tsx';
import {
  MixedConditions,
  AllGoodConditions,
  AllBadConditions,
  WithWeatherError,
  SingleLanding,
  NoAssociations,
  Loading,
} from './WeatherMultiLanding.stories.tsx';

const meta = preview.meta({
  title: 'Components/Weather/WeatherMultiLanding/Chromatic',
  parameters: {
    layout: 'padded',
    chromatic: {
      disableSnapshot: false,
    },
  },
  tags: ['!autodocs'],
});

export const WeatherMultiLandingChromatic = meta.story({
  render: () => (
    <div className="flex flex-col gap-2">
      <FigureWrapper title={MixedConditions.composed.name}>
        <MixedConditions.Component />
      </FigureWrapper>
      <FigureWrapper title={AllGoodConditions.composed.name}>
        <AllGoodConditions.Component />
      </FigureWrapper>
      <FigureWrapper title={AllBadConditions.composed.name}>
        <AllBadConditions.Component />
      </FigureWrapper>
      <FigureWrapper title={WithWeatherError.composed.name}>
        <WithWeatherError.Component />
      </FigureWrapper>
      <FigureWrapper title={SingleLanding.composed.name}>
        <SingleLanding.Component />
      </FigureWrapper>
      <FigureWrapper title={NoAssociations.composed.name}>
        <NoAssociations.Component />
      </FigureWrapper>
      <FigureWrapper title={Loading.composed.name}>
        <Loading.Component />
      </FigureWrapper>
    </div>
  ),
});
