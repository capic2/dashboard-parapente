import preview from '../../../.storybook/preview';
import ProgressChart from './ProgressChart';

const meta = preview.meta({
  title: 'Components/Stats/ProgressChart',
  component: ProgressChart,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
});

const mockFlights = Array.from({ length: 30 }, (_, i) => ({
  id: `flight-${i}`,
  flight_date: new Date(2024, 0, i + 1).toISOString().split('T')[0],
  duration_minutes: 60 + Math.floor(Math.random() * 120),
  distance_km: 10 + Math.floor(Math.random() * 30),
}));

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
