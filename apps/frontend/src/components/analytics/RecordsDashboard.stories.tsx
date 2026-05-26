import preview from '../../../.storybook/preview';
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
    site_id: 'site-annecy',
    departure_time: '2024-08-15T10:15:00',
    partial: false,
  },
  highest_altitude: {
    value: 2850,
    flight_id: '2',
    flight_name: 'Vol thermique',
    flight_date: '2024-07-22',
    site_name: 'Chamonix',
    site_id: 'site-chamonix',
    departure_time: '2024-07-22T11:30:00',
    partial: false,
  },
  longest_distance: {
    value: 45.3,
    flight_id: '3',
    flight_name: 'Cross country',
    flight_date: '2024-06-10',
    site_name: 'Mont Poupet',
    site_id: 'site-poupet',
    departure_time: '2024-06-10T12:05:00',
    partial: false,
  },
  max_speed: {
    value: 62.4,
    flight_id: '4',
    flight_name: 'Speedflying',
    flight_date: '2024-09-01',
    site_name: 'Talloires',
    site_id: 'site-talloires',
    departure_time: '2024-09-01T16:20:00',
    partial: false,
  },
  takeoff_elevation_gain: {
    value: 1420,
    flight_id: '2',
    flight_name: 'Vol thermique',
    flight_date: '2024-07-22',
    site_name: 'Chamonix',
    site_id: 'site-chamonix',
    departure_time: '2024-07-22T11:30:00',
    partial: false,
  },
  earliest_takeoff: {
    value: 8 * 60 + 25,
    flight_id: '5',
    flight_name: 'Matinale au Semnoz',
    flight_date: '2024-08-02',
    site_name: 'Semnoz',
    site_id: 'site-semnoz',
    departure_time: '2024-08-02T08:25:00',
    partial: false,
  },
  latest_takeoff: {
    value: 19 * 60 + 10,
    flight_id: '6',
    flight_name: 'Restitution du soir',
    flight_date: '2024-08-20',
    site_name: 'Annecy',
    site_id: 'site-annecy',
    departure_time: '2024-08-20T19:10:00',
    partial: false,
  },
  most_used_takeoff: {
    value: 12,
    site_id: 'site-annecy',
    site_name: 'Annecy',
    partial: false,
  },
  most_active_month: {
    value: 9,
    month: '2024-08',
    partial: false,
  },
};

const mockPartialRecords = {
  longest_duration: {
    value: 90,
    flight_id: '5',
    flight_name: 'Vol local',
    flight_date: '2024-08-15',
    site_name: 'Annecy',
    site_id: 'site-annecy',
    departure_time: '2024-08-15T14:00:00',
    partial: true,
  },
  highest_altitude: {
    value: 1500,
    flight_id: '6',
    flight_name: 'Vol thermal',
    flight_date: '2024-07-22',
    site_name: null,
    site_id: null,
    departure_time: null,
    partial: true,
  },
  longest_distance: null,
  max_speed: null,
  takeoff_elevation_gain: null,
  earliest_takeoff: null,
  latest_takeoff: null,
  most_used_takeoff: {
    value: 4,
    site_id: 'site-annecy',
    site_name: 'Annecy',
    partial: true,
  },
  most_active_month: {
    value: 3,
    month: '2024-07',
    partial: false,
  },
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
      takeoff_elevation_gain: null,
      earliest_takeoff: null,
      latest_takeoff: null,
      most_used_takeoff: null,
      most_active_month: null,
    },
  },
});
