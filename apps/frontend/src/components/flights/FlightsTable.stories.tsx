import preview from '../../../.storybook/preview';
import { fn } from 'storybook/test';
import { useState } from 'react';
import type { RowSelectionState } from '@tanstack/react-table';
import { FlightsTable } from './FlightsTable';
import type { Flight } from '../../types';

const mockFlights: Flight[] = [
  {
    id: 'flight-1',
    flight_date: '2024-03-15',
    site_name: 'Puy de Dôme',
    site_id: 'site-1',
    title: 'Vol thermique Puy de Dôme',
    name: 'Vol thermique',
    duration_minutes: 90,
    distance_km: 12.5,
    max_altitude_m: 1465,
    elevation_gain_m: 800,
    max_speed_kmh: 42,
    departure_time: '2024-03-15T14:30:00',
    gpx_file_path: '/uploads/flight-1.gpx',
    notes: 'Super conditions thermiques',
  },
  {
    id: 'flight-2',
    flight_date: '2024-03-10',
    site_name: 'Col de la Forclaz',
    site_id: 'site-2',
    title: 'Plouf à la Forclaz',
    name: 'Plouf',
    duration_minutes: 45,
    distance_km: 5.2,
    max_altitude_m: 920,
    elevation_gain_m: 300,
    departure_time: '2024-03-10T11:00:00',
    gpx_file_path: null,
    notes: null,
  },
  {
    id: 'flight-3',
    flight_date: '2024-03-05',
    site_name: 'Planfait',
    site_id: 'site-3',
    title: 'Cross Planfait - Albertville',
    name: 'Cross',
    duration_minutes: 130,
    distance_km: 28.7,
    max_altitude_m: 2100,
    elevation_gain_m: 1500,
    max_speed_kmh: 55,
    departure_time: '2024-03-05T12:15:00',
    gpx_file_path: '/uploads/flight-3.gpx',
    notes: 'Premier cross de la saison',
  },
  {
    id: 'flight-4',
    flight_date: '2024-02-28',
    title: null,
    name: null,
    site_name: null,
    site_id: null,
    duration_minutes: null,
    distance_km: null,
    max_altitude_m: null,
    gpx_file_path: null,
    notes: null,
  },
  {
    id: 'flight-5',
    flight_date: '2024-02-20',
    site_name: 'Sancy',
    site_id: 'site-4',
    title: 'Vol du soir Sancy',
    name: 'Vol du soir',
    duration_minutes: 35,
    distance_km: 3.1,
    max_altitude_m: 850,
    elevation_gain_m: 200,
    departure_time: '2024-02-20T17:00:00',
    gpx_file_path: '/uploads/flight-5.gpx',
    notes: null,
  },
];

function FlightsTableWrapper({
  flights,
  selectionMode = false,
}: {
  flights: Flight[];
  selectionMode?: boolean;
}) {
  const [selectedFlightId, setSelectedFlightId] = useState<string | null>(null);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

  return (
    <div style={{ maxWidth: '400px' }}>
      <FlightsTable
        flights={flights}
        selectedFlightId={selectedFlightId}
        selectionMode={selectionMode}
        onSelectFlight={(flight) => setSelectedFlightId(flight.id)}
        onDeleteFlight={fn()}
        rowSelection={rowSelection}
        onRowSelectionChange={setRowSelection}
      />
    </div>
  );
}

const meta = preview.meta({
  title: 'Components/Flights/FlightsTable',
  component: FlightsTable,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
});

export const Default = meta.story({
  name: 'Default',
  render: () => <FlightsTableWrapper flights={mockFlights} />,
});

export const SelectionMode = meta.story({
  name: 'Selection Mode',
  render: () => (
    <FlightsTableWrapper flights={mockFlights} selectionMode={true} />
  ),
});

export const Empty = meta.story({
  name: 'Empty',
  render: () => <FlightsTableWrapper flights={[]} />,
});

export const SingleFlight = meta.story({
  name: 'Single Flight',
  render: () => <FlightsTableWrapper flights={[mockFlights[0]]} />,
});
