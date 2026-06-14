import preview from '../../../../.storybook/preview';
import { Flight } from './Flight';
import type { Flight as FlightRecord, Site } from '../../../types';
import { fn } from 'storybook/test';

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

const mockSites: Site[] = [
  {
    id: 'site-1',
    name: 'Puy de Dome',
    latitude: 45.77,
    longitude: 2.96,
    country: 'FR',
    region: 'Besançon',
    camera_distance: null,
    flight_count: 1,
    is_active: true,
  },
];

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
        sites={mockSites}
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
        sites={mockSites}
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

export const NoFile = meta.story({
  name: 'No File',
  render: () => (
    <div className="max-w-sm">
      <Flight
        flight={{
          ...mockFlight,
          gpx_file_path: null,
          video_file_path: null,
          gopro_overlay_file_path: null,
        }}
        sites={mockSites}
        isActive={false}
        isSelected={false}
        selectionMode={false}
        downloadingMedia={null}
        onSelectFlight={fn()}
        onDeleteFlight={fn()}
        onDownloadGpx={fn()}
        onDownloadOverlay={fn()}
        onDownloadVideo={fn()}
      />
    </div>
  ),
});

export const WithGpx = meta.story({
  name: 'With Gpx',
  render: () => (
    <div className="max-w-sm">
      <Flight
        flight={{
          ...mockFlight,
          video_file_path: null,
          gopro_overlay_file_path: null,
        }}
        sites={mockSites}
        isActive={false}
        isSelected={false}
        selectionMode={false}
        downloadingMedia={null}
        onSelectFlight={fn()}
        onDeleteFlight={fn()}
        onDownloadGpx={fn()}
        onDownloadOverlay={fn()}
        onDownloadVideo={fn()}
      />
    </div>
  ),
});

export const WithGpxVideo = meta.story({
  name: 'With Gpx And Video',
  render: () => (
    <div className="max-w-sm">
      <Flight
        flight={{ ...mockFlight, gopro_overlay_file_path: null }}
        sites={mockSites}
        isActive={false}
        isSelected={false}
        selectionMode={false}
        downloadingMedia={null}
        onSelectFlight={fn()}
        onDeleteFlight={fn()}
        onDownloadGpx={fn()}
        onDownloadOverlay={fn()}
        onDownloadVideo={fn()}
      />
    </div>
  ),
});

export const WithOverlay = meta.story({
  name: 'With Gpx, Video and Overlay',
  render: () => (
    <div className="max-w-sm">
      <Flight
        flight={mockFlight}
        sites={mockSites}
        isActive={false}
        isSelected={false}
        selectionMode={false}
        downloadingMedia={null}
        onSelectFlight={fn()}
        onDeleteFlight={fn()}
        onDownloadGpx={fn()}
        onDownloadOverlay={fn()}
        onDownloadVideo={fn()}
      />
    </div>
  ),
});

export const VideoProcessing = meta.story({
  name: 'Video Processing',
  render: () => (
    <div className="max-w-sm">
      <Flight
        flight={{
          ...mockFlight,
          id: 'flight-processing',
          video_file_path: null,
          video_export_status: 'running',
          video_export_progress: 42,
          gopro_overlay_file_path: null,
        }}
        sites={mockSites}
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

export const OverlayProcessing = meta.story({
  name: 'Overlay Processing',
  render: () => (
    <div className="max-w-sm">
      <Flight
        flight={{
          ...mockFlight,
          id: 'flight-processing',
          gopro_overlay_status: 'running',
          gopro_overlay_progress: 42,
        }}
        sites={mockSites}
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

export const VideoError = meta.story({
  name: 'Video Error',
  render: () => (
    <div className="max-w-sm">
      <Flight
        flight={{
          ...mockFlight,
          id: 'flight-processing',
          video_file_path: null,
          video_export_status: 'failed',
          video_export_progress: 42,
          gopro_overlay_file_path: null,
        }}
        sites={mockSites}
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

export const OverlayError = meta.story({
  name: 'Overlay Error',
  render: () => (
    <div className="max-w-sm">
      <Flight
        flight={{
          ...mockFlight,
          id: 'flight-processing',
          gopro_overlay_status: 'failed',
          gopro_overlay_progress: 42,
          gopro_overlay_file_path: null,
        }}
        sites={mockSites}
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
