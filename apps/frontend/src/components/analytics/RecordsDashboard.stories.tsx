import preview from '../../../.storybook/preview';
import { expect, waitFor } from 'storybook/test';
import RecordsDashboard from './RecordsDashboard';

const meta = preview.meta({
  title: 'Components/Stats/RecordsDashboard',
  component: RecordsDashboard,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
});

// Mock records data
const mockRecords = {
  longest_duration: {
    value: 125,
    flight_id: '1',
    flight_name: 'Vol XC Annecy',
    flight_date: '2024-08-15',
    site_name: 'Annecy',
  },
  highest_altitude: {
    value: 2850,
    flight_id: '2',
    flight_name: 'Vol thermique',
    flight_date: '2024-07-22',
    site_name: 'Chamonix',
  },
  longest_distance: {
    value: 45.3,
    flight_id: '3',
    flight_name: 'Cross country',
    flight_date: '2024-06-10',
    site_name: 'Mont Poupet',
  },
  max_speed: {
    value: 62.4,
    flight_id: '4',
    flight_name: 'Speedflying',
    flight_date: '2024-09-01',
    site_name: 'Talloires',
  },
};

const mockPartialRecords = {
  longest_duration: {
    value: 90,
    flight_id: '5',
    flight_name: 'Vol local',
    flight_date: '2024-08-15',
    site_name: 'Annecy',
  },
  highest_altitude: {
    value: 1500,
    flight_id: '6',
    flight_name: 'Vol thermal',
    flight_date: '2024-07-22',
    site_name: null,
  },
  longest_distance: null,
  max_speed: null,
};

// Default story - all records
export const AllRecords = meta.story({
  name: 'All Records',
  args: {
    records: mockRecords,
  },
});

// Partial records
export const PartialRecords = meta.story({
  name: 'Partial Records',
  args: {
    records: mockPartialRecords,
  },
});

// No records
export const NoRecords = meta.story({
  name: 'No Records',
  args: {
    records: {
      longest_duration: null,
      highest_altitude: null,
      longest_distance: null,
      max_speed: null,
    },
  },
});

// Interaction Tests

export const DisplaysAllRecordCards = meta.story({
  name: 'Displays All Record Cards',
  args: {
    records: mockRecords,
  },
});

DisplaysAllRecordCards.test('displays all record cards', async ({ canvas }) => {
  await waitFor(() => {
    expect(canvas.getByText('🏆 Records Personnels')).toBeInTheDocument();
  });

  await expect(canvas.getByText('Vol le plus long')).toBeInTheDocument();
  await expect(canvas.getByText('Plus haute altitude')).toBeInTheDocument();
  await expect(canvas.getByText('Plus longue distance')).toBeInTheDocument();
  await expect(canvas.getByText('Vitesse maximale')).toBeInTheDocument();
});
