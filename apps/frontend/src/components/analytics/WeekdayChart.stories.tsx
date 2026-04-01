import preview from '../../../.storybook/preview';
import WeekdayChart from './WeekdayChart';

const meta = preview.meta({
  title: 'Components/Stats/WeekdayChart',
  component: WeekdayChart,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
});

const mockFlights = [
  ...Array.from({ length: 5 }, (_, i) => ({
    id: `${i}`,
    flight_date: '2024-01-06',
  })), // Saturday
  ...Array.from({ length: 8 }, (_, i) => ({
    id: `${i + 5}`,
    flight_date: '2024-01-07',
  })), // Sunday
  ...Array.from({ length: 2 }, (_, i) => ({
    id: `${i + 13}`,
    flight_date: '2024-01-08',
  })), // Monday
  ...Array.from({ length: 3 }, (_, i) => ({
    id: `${i + 15}`,
    flight_date: '2024-01-10',
  })), // Wednesday
];

export const Default = meta.story({
  name: 'Default',
  args: {
    flights: mockFlights,
  },
});

export const NoData = meta.story({
  name: 'No Data',
  args: {
    flights: [],
  },
});
