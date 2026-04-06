import { fn } from 'storybook/test';
import preview from '../../../.storybook/preview';
import DaySelector from './DaySelector';

const meta = preview.meta({
  title: 'Components/Dashboard/DaySelector',
  component: DaySelector,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Lightweight day selector with 7 day buttons for the dashboard. Shows "Today", "Tomorrow", then weekday abbreviations.',
      },
    },
  },
  tags: ['autodocs'],
});

export const Default = meta.story({
  name: 'Default (Today)',
  args: {
    selectedDayIndex: 0,
    onSelectDay: fn(),
  },
});

export const MiddleDay = meta.story({
  name: 'Middle Day Selected',
  args: {
    selectedDayIndex: 3,
    onSelectDay: fn(),
  },
});

export const LastDay = meta.story({
  name: 'Last Day Selected',
  args: {
    selectedDayIndex: 6,
    onSelectDay: fn(),
  },
});
