import { FigureWrapper } from '../../../.storybook/FigureWrapper.tsx';
import preview from '../../../.storybook/preview.tsx';
import {
  MixedConditions,
  AllGoodConditions,
  AllBadConditions,
  SecondDaySelected,
  NoSelection,
  WithCallback,
  Loading,
  Error,
  EmptyDays,
  NoDaysField,
} from './Forecast7Day.stories.tsx';

const meta = preview.meta({
  title: 'Components/Weather/Forecast7Day/Chromatic',
  parameters: {
    layout: 'padded',
    chromatic: {
      disableSnapshot: false,
    },
  },
  tags: ['!autodocs'],
});

export const Forecast7DayChromatic = meta.story({
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
      <FigureWrapper title={SecondDaySelected.composed.name}>
        <SecondDaySelected.Component />
      </FigureWrapper>
      <FigureWrapper title={NoSelection.composed.name}>
        <NoSelection.Component />
      </FigureWrapper>
      <FigureWrapper title={WithCallback.composed.name}>
        <WithCallback.Component />
      </FigureWrapper>
      <FigureWrapper title={Loading.composed.name}>
        <Loading.Component />
      </FigureWrapper>
      <FigureWrapper title={Error.composed.name}>
        <Error.Component />
      </FigureWrapper>
      <FigureWrapper title={EmptyDays.composed.name}>
        <EmptyDays.Component />
      </FigureWrapper>
      <FigureWrapper title={NoDaysField.composed.name}>
        <NoDaysField.Component />
      </FigureWrapper>
    </div>
  ),
});
