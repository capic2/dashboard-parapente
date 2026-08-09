import preview from '../../../../.storybook/preview';
import { Flight } from './Flight';
import type { FlightSummary } from '@dashboard-parapente/shared-types';
import { fn } from 'storybook/test';

const mockFlight: FlightSummary = {
  id: 'flight-1',
  flight_date: '2024-03-15',
  site_name: 'Puy de Dome',
  site_id: 'site-1',
  site_region: 'Besançon',
  title: 'Vol thermique Puy de Dome',
  name: 'Vol thermique',
  duration_minutes: 90,
  distance_km: 12.5,
  max_altitude_m: 1465,
  departure_time: '2024-03-15T14:30:00',
  elevation_gain_m: 800,
  has_gpx: true,
  has_video: true,
  has_gopro_overlay: true,
  video_export_job_id: null,
  video_export_status: null,
  video_export_progress: null,
  gopro_overlay_job_id: null,
  gopro_overlay_status: null,
  gopro_overlay_progress: null,
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

export const NoFile = meta.story({
  name: 'No File',
  render: () => (
    <div className="max-w-sm">
      <Flight
        flight={{
          ...mockFlight,
          has_gpx: false,
          has_video: false,
          has_gopro_overlay: false,
        }}
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
          has_video: false,
          has_gopro_overlay: false,
        }}
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
        flight={{ ...mockFlight, has_gopro_overlay: false }}
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
          has_video: false,
          video_export_status: 'running',
          video_export_progress: 42,
          has_gopro_overlay: false,
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
          has_video: false,
          video_export_status: 'failed',
          video_export_progress: 42,
          has_gopro_overlay: false,
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
          has_gopro_overlay: false,
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
