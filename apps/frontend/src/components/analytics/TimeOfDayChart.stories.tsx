import preview from '../../../.storybook/preview';
import TimeOfDayChart from './TimeOfDayChart';

const meta = preview.meta({
  title: 'Components/Stats/TimeOfDayChart',
  component: TimeOfDayChart,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
});

const mockFlights = [
  ...Array.from({ length: 3 }, (_, i) => ({
    id: `${i}`,
    flight_date: '2024-03-15',
    departure_time: '2024-03-15T09:30:00',
  })),
  ...Array.from({ length: 5 }, (_, i) => ({
    id: `${i + 3}`,
    flight_date: '2024-03-15',
    departure_time: '2024-03-15T11:45:00',
  })),
  ...Array.from({ length: 8 }, (_, i) => ({
    id: `${i + 8}`,
    flight_date: '2024-03-15',
    departure_time: '2024-03-15T14:15:00',
  })),
  ...Array.from({ length: 4 }, (_, i) => ({
    id: `${i + 16}`,
    flight_date: '2024-03-15',
    departure_time: '2024-03-15T16:30:00',
  })),
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
