import { FigureWrapper } from '../../../.storybook/FigureWrapper.tsx';
import preview from '../../../.storybook/preview.tsx';
import { Default, MiddleDay, LastDay } from './DaySelector.stories.tsx';

const meta = preview.meta({
  title: 'Components/Dashboard/DaySelector/Chromatic',
  parameters: {
    layout: 'padded',
    chromatic: {
      disableSnapshot: false,
    },
  },
  tags: ['!autodocs'],
});

export const DaySelectorChromatic = meta.story({
  render: () => (
    <div className="flex flex-col gap-2">
      <FigureWrapper title={Default.composed.name}>
        <Default.Component />
      </FigureWrapper>
      <FigureWrapper title={MiddleDay.composed.name}>
        <MiddleDay.Component />
      </FigureWrapper>
      <FigureWrapper title={LastDay.composed.name}>
        <LastDay.Component />
      </FigureWrapper>
    </div>
  ),
});
