import { FigureWrapper } from '../../../.storybook/FigureWrapper.tsx';
import preview from '../../../.storybook/preview.tsx';
import { Default, NoData } from './AltitudeChart.stories.tsx';

const meta = preview.meta({
  title: 'Components/Stats/AltitudeChart/Chromatic',
  parameters: {
    layout: 'padded',
    chromatic: {
      disableSnapshot: false,
    },
  },
  tags: ['!autodocs'],
});

const stories = [{ story: Default }, { story: NoData }];

export const AltitudeChartChromatic = meta.story({
  render: () => (
    <div className="flex flex-col gap-2">
      {stories.map(({ story }) => (
        <FigureWrapper key={story.composed.name} title={story.composed.name}>
          <story.Component />
        </FigureWrapper>
      ))}
    </div>
  ),
});
