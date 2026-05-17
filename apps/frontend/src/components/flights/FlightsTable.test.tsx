import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import type { RowSelectionState } from '@tanstack/react-table';
import type * as ReactI18next from 'react-i18next';
import { expect, test, vi } from 'vitest';
import type { Flight } from '../../types';
import { FlightsTable } from './FlightsTable';

vi.mock('react-i18next', async (importOriginal) => {
  const actual = await importOriginal<typeof ReactI18next>();

  return {
    ...actual,
    useTranslation: () => ({
      t: (key: string) => key,
      i18n: { language: 'fr' },
    }),
  };
});

const flights: Flight[] = [
  {
    id: 'flight-1',
    flight_date: '2024-03-15',
    site_name: 'Puy de Dôme',
    site_id: 'site-1',
    title: 'Vol thermique',
    name: 'Thermique',
    duration_minutes: 90,
    distance_km: 12.5,
    max_altitude_m: 1465,
    departure_time: '2024-03-15T14:30:00',
    gpx_file_path: '/uploads/flight-1.gpx',
    video_export_job_id: 'job-flight-1',
    video_export_status: 'completed',
    video_file_path: '/exports/flight-1.mp4',
    notes: null,
  },
  {
    id: 'flight-2',
    flight_date: '2024-03-10',
    site_name: 'Col de la Forclaz',
    site_id: 'site-2',
    title: 'Autre vol',
    name: 'Autre',
    duration_minutes: 45,
    distance_km: 5.2,
    max_altitude_m: 920,
    departure_time: '2024-03-10T11:00:00',
    gpx_file_path: null,
    notes: null,
  },
];

function FlightsTableHarness({
  onDownloadGpx = () => undefined,
  onDownloadVideo = () => undefined,
}: {
  onDownloadGpx?: (flight: Flight) => void;
  onDownloadVideo?: (flight: Flight) => void;
}) {
  const [selectedFlightId, setSelectedFlightId] = useState<string | null>(null);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

  return (
    <FlightsTable
      flights={flights}
      selectedFlightId={selectedFlightId}
      selectionMode={false}
      onSelectFlight={(flight) => setSelectedFlightId(flight.id)}
      onDeleteFlight={() => undefined}
      onDownloadGpx={onDownloadGpx}
      onDownloadVideo={onDownloadVideo}
      downloadingMedia={null}
      rowSelection={rowSelection}
      onRowSelectionChange={setRowSelection}
    />
  );
}

test('applies the active style when a flight is selected', () => {
  render(<FlightsTableHarness />);

  const flightRow = screen.getByTestId('flight-row-flight-1');

  fireEvent.click(flightRow);

  expect(flightRow).toHaveClass('border-sky-700');
  expect(flightRow).toHaveAttribute('aria-selected', 'true');
});

test('downloads media from badges without selecting the flight', () => {
  const onDownloadGpx = vi.fn();
  render(<FlightsTableHarness onDownloadGpx={onDownloadGpx} />);

  const flightRow = screen.getByTestId('flight-row-flight-1');

  fireEvent.click(screen.getByRole('button', { name: 'flights.downloadGpx' }));

  expect(onDownloadGpx).toHaveBeenCalledWith(flights[0]);
  expect(flightRow).not.toHaveClass('border-sky-700');
  expect(flightRow).toHaveAttribute('aria-selected', 'false');
});
