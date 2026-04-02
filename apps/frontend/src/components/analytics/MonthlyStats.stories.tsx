import preview from '../../../.storybook/preview';
import MonthlyStats from './MonthlyStats';

const meta = preview.meta({
  title: 'Components/Stats/MonthlyStats',
  component: MonthlyStats,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
});

export const defaultFlights = [
  ...Array.from({ length: 8 }, (_, i) => ({
    id: `${i}`,
    flight_date: `2024-03-${String(i + 1).padStart(2, '0')}`,
    duration_minutes: 90,
  })),
  ...Array.from({ length: 12 }, (_, i) => ({
    id: `${i + 8}`,
    flight_date: `2024-02-${String(i + 1).padStart(2, '0')}`,
    duration_minutes: 120,
  })),
  ...Array.from({ length: 5 }, (_, i) => ({
    id: `${i + 20}`,
    flight_date: `2024-01-${String(i + 1).padStart(2, '0')}`,
    duration_minutes: 60,
  })),
];

export const noDataFlights: typeof defaultFlights = [];

export const Default = meta.story({
  name: 'Default',
  args: {
    flights: defaultFlights,
  },
});

export const NoData = meta.story({
  name: 'No Data',
  args: {
    flights: noDataFlights,
  },
});
