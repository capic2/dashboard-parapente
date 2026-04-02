import { FigureWrapper } from '../../../.storybook/FigureWrapper.tsx';
import preview from '../../../.storybook/preview.tsx';
import {
  MultipleOrientationsWithWeather,
  TwoOrientations,
  NoWeatherData,
  NoRating,
  CustomBaseName,
  NoSelection,
  SingleSite,
  NoElevation,
  DropdownOpen,
} from './MultiOrientationSelector.stories.tsx';

const meta = preview.meta({
  title: 'Components/Forms/MultiOrientationSelector/Chromatic',
  parameters: {
    layout: 'padded',
    chromatic: {
      disableSnapshot: false,
    },
  },
  tags: ['!autodocs'],
});

export const MultiOrientationSelectorChromatic = meta.story({
  render: () => (
    <div className="flex flex-col gap-2">
      <FigureWrapper title={MultipleOrientationsWithWeather.composed.name}>
        <MultipleOrientationsWithWeather.Component />
      </FigureWrapper>
      <FigureWrapper title={TwoOrientations.composed.name}>
        <TwoOrientations.Component />
      </FigureWrapper>
      <FigureWrapper title={NoWeatherData.composed.name}>
        <NoWeatherData.Component />
      </FigureWrapper>
      <FigureWrapper title={NoRating.composed.name}>
        <NoRating.Component />
      </FigureWrapper>
      <FigureWrapper title={CustomBaseName.composed.name}>
        <CustomBaseName.Component />
      </FigureWrapper>
      <FigureWrapper title={NoSelection.composed.name}>
        <NoSelection.Component />
      </FigureWrapper>
      <FigureWrapper title={SingleSite.composed.name}>
        <SingleSite.Component />
      </FigureWrapper>
      <FigureWrapper title={NoElevation.composed.name}>
        <NoElevation.Component />
      </FigureWrapper>
      <FigureWrapper title={DropdownOpen.composed.name}>
        <DropdownOpen.Component />
      </FigureWrapper>
    </div>
  ),
});
