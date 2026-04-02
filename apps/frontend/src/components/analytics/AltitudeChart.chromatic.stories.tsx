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

export const AltitudeChartChromatic = meta.story({
  render: () => (
    <div className="flex flex-col gap-2">
      <FigureWrapper title={Default.composed.name}>
        <Default.Component />
      </FigureWrapper>
      <FigureWrapper title={NoData.composed.name}>
        <NoData.Component />
      </FigureWrapper>
    </div>
  ),
});
