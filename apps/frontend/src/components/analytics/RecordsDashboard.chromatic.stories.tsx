import { FigureWrapper } from '../../../.storybook/FigureWrapper.tsx';
import preview from '../../../.storybook/preview.tsx';
import {
  AllRecords,
  NoRecords,
  PartialRecords,
} from './RecordsDashboard.stories.tsx';

const meta = preview.meta({
  title: 'Components/Stats/RecordsDashboard/Chromatic',
  parameters: {
    layout: 'padded',
    chromatic: {
      disableSnapshot: false,
    },
  },
  tags: ['!autodocs'],
});

export const FilterBarChromatic = meta.story({
  render: () => (
    <div className="flex flex-col gap-2">
      <FigureWrapper title={AllRecords.composed.name}>
        <AllRecords.Component />
      </FigureWrapper>
      <FigureWrapper title={NoRecords.composed.name}>
        <NoRecords.Component />
      </FigureWrapper>
      <FigureWrapper title={PartialRecords.composed.name}>
        <PartialRecords.Component />
      </FigureWrapper>
    </div>
  ),
});
