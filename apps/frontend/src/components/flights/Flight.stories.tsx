import preview from '../../../.storybook/preview';
import { Flight } from './Flight';
import type { Flight as FlightRecord } from '../../types';

const mockFlight: FlightRecord = {
  id: 'flight-1',
  flight_date: '2024-03-15',
  site_name: 'Puy de Dome',
  site_id: 'site-1',
  title: 'Vol thermique Puy de Dome',
  name: 'Vol thermique',
  duration_minutes: 90,
  distance_km: 12.5,
  max_altitude_m: 1465,
  departure_time: '2024-03-15T14:30:00',
  gpx_file_path: '/uploads/flight-1.gpx',
  video_file_path: '/exports/flight-1.mp4',
  gopro_overlay_file_path: '/exports/final.mp4',
  notes: null,
};

const meta = preview.meta({
  title: 'Components/Flights/Flight',
  component: Flight,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
});

export const Default = meta.story({
  name: 'Default',
  render: () => (
    <div className="max-w-sm">
      <Flight
        flight={mockFlight}
        isActive={false}
        isSelected={false}
        selectionMode={false}
        downloadingMedia={null}
        onSelectFlight={() => undefined}
        onDeleteFlight={() => undefined}
        onDownloadGpx={() => undefined}
        onDownloadVideo={() => undefined}
        onDownloadOverlay={() => undefined}
      />
    </div>
  ),
});

export const Active = meta.story({
  name: 'Active',
  render: () => (
    <div className="max-w-sm">
      <Flight
        flight={mockFlight}
        isActive
        isSelected={false}
        selectionMode={false}
        downloadingMedia={null}
        onSelectFlight={() => undefined}
        onDeleteFlight={() => undefined}
        onDownloadGpx={() => undefined}
        onDownloadVideo={() => undefined}
        onDownloadOverlay={() => undefined}
      />
    </div>
  ),
});

export const Processing = meta.story({
  name: 'Processing',
  render: () => (
    <div className="max-w-sm">
      <Flight
        flight={{
          ...mockFlight,
          id: 'flight-processing',
          video_file_path: null,
          video_export_status: 'running',
          video_export_progress: 42,
        }}
        isActive={false}
        isSelected={false}
        selectionMode={false}
        downloadingMedia={null}
        onSelectFlight={() => undefined}
        onDeleteFlight={() => undefined}
        onDownloadGpx={() => undefined}
        onDownloadVideo={() => undefined}
        onDownloadOverlay={() => undefined}
      />
    </div>
  ),
});
