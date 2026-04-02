import { FigureWrapper } from '../../../.storybook/FigureWrapper.tsx';
import preview from '../../../.storybook/preview.tsx';
import {
  ExcellentConditions,
  GoodConditions,
  ModerateConditions,
  PoorConditions,
  NoWindData,
  NoRating,
  NullData,
  NoSite,
  CustomClassName,
  CompactExcellent,
  CompactNoWind,
  CompactNullData,
  Today,
  Tomorrow,
  Day3,
  FavorableWind,
  ModerateWind,
  BadWind,
} from './BestSpotSuggestion.stories.tsx';

const meta = preview.meta({
  title: 'Components/Weather/BestSpotSuggestion/Chromatic',
  parameters: {
    layout: 'padded',
    chromatic: {
      disableSnapshot: false,
    },
  },
  tags: ['!autodocs'],
});

export const BestSpotSuggestionChromatic = meta.story({
  render: () => (
    <div className="flex flex-col gap-2">
      <FigureWrapper title={ExcellentConditions.composed.name}>
        <ExcellentConditions.Component />
      </FigureWrapper>
      <FigureWrapper title={GoodConditions.composed.name}>
        <GoodConditions.Component />
      </FigureWrapper>
      <FigureWrapper title={ModerateConditions.composed.name}>
        <ModerateConditions.Component />
      </FigureWrapper>
      <FigureWrapper title={PoorConditions.composed.name}>
        <PoorConditions.Component />
      </FigureWrapper>
      <FigureWrapper title={NoWindData.composed.name}>
        <NoWindData.Component />
      </FigureWrapper>
      <FigureWrapper title={NoRating.composed.name}>
        <NoRating.Component />
      </FigureWrapper>
      <FigureWrapper title={NullData.composed.name}>
        <NullData.Component />
      </FigureWrapper>
      <FigureWrapper title={NoSite.composed.name}>
        <NoSite.Component />
      </FigureWrapper>
      <FigureWrapper title={CustomClassName.composed.name}>
        <CustomClassName.Component />
      </FigureWrapper>
      <FigureWrapper title={CompactExcellent.composed.name}>
        <CompactExcellent.Component />
      </FigureWrapper>
      <FigureWrapper title={CompactNoWind.composed.name}>
        <CompactNoWind.Component />
      </FigureWrapper>
      <FigureWrapper title={CompactNullData.composed.name}>
        <CompactNullData.Component />
      </FigureWrapper>
      <FigureWrapper title={Today.composed.name}>
        <Today.Component />
      </FigureWrapper>
      <FigureWrapper title={Tomorrow.composed.name}>
        <Tomorrow.Component />
      </FigureWrapper>
      <FigureWrapper title={Day3.composed.name}>
        <Day3.Component />
      </FigureWrapper>
      <FigureWrapper title={FavorableWind.composed.name}>
        <FavorableWind.Component />
      </FigureWrapper>
      <FigureWrapper title={ModerateWind.composed.name}>
        <ModerateWind.Component />
      </FigureWrapper>
      <FigureWrapper title={BadWind.composed.name}>
        <BadWind.Component />
      </FigureWrapper>
    </div>
  ),
});
