import { FigureWrapper } from '../../../.storybook/FigureWrapper.tsx';
import preview from '../../../.storybook/preview.tsx';
import {
  Default,
  TakeoffOnly,
  LandingOnly,
  NoFlights,
  NoDescription,
  NoCode,
  LongDescription,
  MultipleOrientations,
  GridView,
} from './SiteCard.stories.tsx';

const meta = preview.meta({
  title: 'Components/SiteCard/Chromatic',
  parameters: {
    layout: 'padded',
    chromatic: {
      disableSnapshot: false,
    },
  },
  tags: ['!autodocs'],
});

export const SiteCardChromatic = meta.story({
  render: () => (
    <div className="flex flex-col gap-2">
      <FigureWrapper title={Default.composed.name}>
        <Default.Component />
      </FigureWrapper>
      <FigureWrapper title={TakeoffOnly.composed.name}>
        <TakeoffOnly.Component />
      </FigureWrapper>
      <FigureWrapper title={LandingOnly.composed.name}>
        <LandingOnly.Component />
      </FigureWrapper>
      <FigureWrapper title={NoFlights.composed.name}>
        <NoFlights.Component />
      </FigureWrapper>
      <FigureWrapper title={NoDescription.composed.name}>
        <NoDescription.Component />
      </FigureWrapper>
      <FigureWrapper title={NoCode.composed.name}>
        <NoCode.Component />
      </FigureWrapper>
      <FigureWrapper title={LongDescription.composed.name}>
        <LongDescription.Component />
      </FigureWrapper>
      <FigureWrapper title={MultipleOrientations.composed.name}>
        <MultipleOrientations.Component />
      </FigureWrapper>
      <FigureWrapper title={GridView.composed.name}>
        <GridView.Component />
      </FigureWrapper>
    </div>
  ),
});
