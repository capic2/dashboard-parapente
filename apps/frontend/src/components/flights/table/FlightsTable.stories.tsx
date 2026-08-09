import preview from '../../../../.storybook/preview';
import { expect, fn, userEvent, within } from 'storybook/test';
import { useState } from 'react';
import type { RowSelectionState } from '@tanstack/react-table';
import { FlightsTable } from './FlightsTable';
import type { Flight, Site } from '../../../types';
import type { FlightSummary } from '@dashboard-parapente/shared-types';

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
    video_export_job_id: 'job-flight-1',
    video_export_status: 'completed',
    video_file_path: '/exports/flight-1.mp4',
    gopro_overlay_file_path: '/exports/final.mp4',
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
    video_export_status: 'processing',
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
    video_export_status: 'failed',
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

const mockSites: Site[] = [
  {
    id: 'site-1',
    name: 'Puy de Dôme',
    latitude: 45.77,
    longitude: 2.96,
    country: 'FR',
    region: 'Besançon',
    camera_distance: null,
    flight_count: 1,
    is_active: true,
  },
  {
    id: 'site-2',
    name: 'Col de la Forclaz',
    latitude: 45.86,
    longitude: 6.24,
    country: 'FR',
    region: 'Annecy',
    camera_distance: null,
    flight_count: 1,
    is_active: true,
  },
  {
    id: 'site-3',
    name: 'Planfait',
    latitude: 45.84,
    longitude: 6.21,
    country: 'FR',
    region: 'Annecy',
    camera_distance: null,
    flight_count: 1,
    is_active: true,
  },
  {
    id: 'site-4',
    name: 'Sancy',
    latitude: 45.53,
    longitude: 2.81,
    country: 'FR',
    region: 'Besançon',
    camera_distance: null,
    flight_count: 1,
    is_active: true,
  },
];

const summarizeFlight = (flight: Flight): FlightSummary => ({
  id: flight.id,
  site_id: flight.site_id ?? null,
  site_name: flight.site_name ?? null,
  site_region:
    mockSites.find((site) => site.id === flight.site_id)?.region ?? null,
  name: flight.name ?? null,
  title: flight.title ?? null,
  flight_date: flight.flight_date,
  departure_time: flight.departure_time ?? null,
  duration_minutes: flight.duration_minutes ?? null,
  max_altitude_m: flight.max_altitude_m ?? null,
  distance_km: flight.distance_km ?? null,
  elevation_gain_m: flight.elevation_gain_m ?? null,
  has_gpx: Boolean(flight.gpx_file_path),
  has_video: Boolean(flight.video_file_path),
  has_gopro_overlay: Boolean(flight.gopro_overlay_file_path),
  video_export_job_id: flight.video_export_job_id ?? null,
  video_export_status: flight.video_export_status ?? null,
  video_export_progress: flight.video_export_progress ?? null,
  gopro_overlay_job_id: flight.gopro_overlay_job_id ?? null,
  gopro_overlay_status: flight.gopro_overlay_status ?? null,
  gopro_overlay_progress: flight.gopro_overlay_progress ?? null,
});

function FlightsTableWrapper({
  flights,
  selectionMode = false,
  initialSelectedFlightId = null,
}: {
  flights: Flight[];
  selectionMode?: boolean;
  initialSelectedFlightId?: string | null;
}) {
  const [selectedFlightId, setSelectedFlightId] = useState<string | null>(
    initialSelectedFlightId
  );
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

  return (
    <div style={{ maxWidth: '400px' }}>
      <FlightsTable
        flights={flights.map(summarizeFlight)}
        selectedFlightId={selectedFlightId}
        selectionMode={selectionMode}
        onSelectFlight={(flight) => setSelectedFlightId(flight.id)}
        onDeleteFlight={fn()}
        onDownloadGpx={fn()}
        onDownloadVideo={fn()}
        onDownloadOverlay={fn()}
        downloadingMedia={null}
        unavailableMedia={new Set()}
        rowSelection={rowSelection}
        onRowSelectionChange={setRowSelection}
        sorting={[{ id: 'flight_date', desc: true }]}
        onSortingChange={() => undefined}
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

export const SelectionUpdatesActiveStyle = meta.story({
  name: 'Selection updates active style',
  parameters: {
    chromatic: { disableSnapshot: true },
  },
  render: () => <FlightsTableWrapper flights={mockFlights} />,
  async play({ canvasElement }) {
    const canvas = within(canvasElement);
    const flightRow = canvas.getByTestId('flight-row-flight-1');

    await userEvent.click(flightRow);

    await expect(flightRow).toHaveClass('border-sky-700');
  },
});

export const SelectionMode = meta.story({
  name: 'Selection Mode',
  render: () => (
    <FlightsTableWrapper flights={mockFlights} selectionMode={true} />
  ),
});

export const ActiveFlight = meta.story({
  name: 'Active Flight',
  render: () => (
    <FlightsTableWrapper
      flights={mockFlights}
      initialSelectedFlightId="flight-1"
    />
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
