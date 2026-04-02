import { FigureWrapper } from '../../../.storybook/FigureWrapper.tsx';
import preview from '../../../.storybook/preview.tsx';
import {
  Perfect,
  Good,
  Acceptable,
  Unfavorable,
  TooStrong,
  TooWeak,
  NoData,
  WithoutLabel,
  SmallSize,
  LargeSize,
  AllStates,
  Compact,
  AllCompactStates,
} from './WindIndicator.stories.tsx';

const meta = preview.meta({
  title: 'Components/WindIndicator/Chromatic',
  parameters: {
    layout: 'padded',
    chromatic: {
      disableSnapshot: false,
    },
  },
  tags: ['!autodocs'],
});

export const WindIndicatorChromatic = meta.story({
  render: () => (
    <div className="flex flex-col gap-2">
      <FigureWrapper title={Perfect.composed.name}>
        <Perfect.Component />
      </FigureWrapper>
      <FigureWrapper title={Good.composed.name}>
        <Good.Component />
      </FigureWrapper>
      <FigureWrapper title={Acceptable.composed.name}>
        <Acceptable.Component />
      </FigureWrapper>
      <FigureWrapper title={Unfavorable.composed.name}>
        <Unfavorable.Component />
      </FigureWrapper>
      <FigureWrapper title={TooStrong.composed.name}>
        <TooStrong.Component />
      </FigureWrapper>
      <FigureWrapper title={TooWeak.composed.name}>
        <TooWeak.Component />
      </FigureWrapper>
      <FigureWrapper title={NoData.composed.name}>
        <NoData.Component />
      </FigureWrapper>
      <FigureWrapper title={WithoutLabel.composed.name}>
        <WithoutLabel.Component />
      </FigureWrapper>
      <FigureWrapper title={SmallSize.composed.name}>
        <SmallSize.Component />
      </FigureWrapper>
      <FigureWrapper title={LargeSize.composed.name}>
        <LargeSize.Component />
      </FigureWrapper>
      <FigureWrapper title={AllStates.composed.name}>
        <AllStates.Component />
      </FigureWrapper>
      <FigureWrapper title={Compact.composed.name}>
        <Compact.Component />
      </FigureWrapper>
      <FigureWrapper title={AllCompactStates.composed.name}>
        <AllCompactStates.Component />
      </FigureWrapper>
    </div>
  ),
});
