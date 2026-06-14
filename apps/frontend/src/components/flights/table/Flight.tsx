import { useTranslation } from 'react-i18next';
import { Button, Card } from '@dashboard-parapente/design-system';
import { VIDEO_EXPORT_IN_PROGRESS_STATUSES } from '@dashboard-parapente/shared-types';
import {
  Clock3,
  Download,
  FileText,
  MapPin,
  Mountain,
  Ruler,
  Trash2,
  Video,
  Wand2,
} from 'lucide-react';
import { formatMediaProgressLabel } from './mediaProgress';
import type { Flight as FlightRecord, Site } from '../../../types';
import {
  formatAltitudeMeters,
  formatDistanceKm,
  useAppSettingsStore,
} from '../../../stores/appSettingsStore';
import {
  hasFlightGoproOverlay,
  hasFlightVideo,
  isGoproOverlayInProgress,
} from '../../../lib/flightMediaState';
import { formatFlightSiteLabel } from '../siteDisplay';

export interface DownloadingMedia {
  flightId: string;
  type: 'gpx' | 'video' | 'overlay';
}

interface FlightProps {
  flight: FlightRecord;
  sites: Site[];
  isActive: boolean;
  isSelected: boolean;
  selectionMode: boolean;
  downloadingMedia: DownloadingMedia | null;
  onSelectFlight: (flight: FlightRecord) => void;
  onDeleteFlight: (flight: FlightRecord) => void;
  onDownloadGpx: (flight: FlightRecord) => void;
  onDownloadVideo: (flight: FlightRecord) => void;
  onDownloadOverlay: (flight: FlightRecord) => void;
}

function formatFlightDate(date: string, language: string) {
  const [year, month, day] = date.split('-');
  const localDate = new Date(Number(year), Number(month) - 1, Number(day));

  return localDate.toLocaleDateString(language, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function formatDepartureTime(date: string, language: string) {
  return new Date(date).toLocaleTimeString(language, {
    hour: '2-digit',
    minute: '2-digit',
  });
}

// oxlint-disable-next-line max-lines-per-function
export function Flight({
  flight,
  sites,
  isActive,
  isSelected,
  selectionMode,
  downloadingMedia,
  onSelectFlight,
  onDeleteFlight,
  onDownloadGpx,
  onDownloadVideo,
  onDownloadOverlay,
}: FlightProps) {
  const { t, i18n } = useTranslation();
  const units = useAppSettingsStore((state) => state.settings.units);
  const isHighlighted = isActive || isSelected;
  const hasGpx = Boolean(flight.gpx_file_path);
  const hasVideo = hasFlightVideo(flight);
  const hasPersistedGoproOverlay = hasFlightGoproOverlay(flight);
  const isGoproOverlayRunning = isGoproOverlayInProgress(
    flight.gopro_overlay_status
  );
  const isGoproOverlayFailed = flight.gopro_overlay_status === 'failed';
  const canDownloadGoproOverlay =
    hasPersistedGoproOverlay && !isGoproOverlayRunning && !isGoproOverlayFailed;
  const isVideoExportRunning = Boolean(
    flight.video_export_status &&
    VIDEO_EXPORT_IN_PROGRESS_STATUSES.has(flight.video_export_status)
  );
  const isVideoExportFailed = flight.video_export_status === 'failed';
  const videoProcessingLabel = formatMediaProgressLabel(
    t('flights.videoProcessingBadge'),
    flight.video_export_progress
  );
  const goproOverlayProcessingLabel = formatMediaProgressLabel(
    t('flights.goproOverlayProcessingBadge'),
    flight.gopro_overlay_progress
  );
  const selectFlight = () => {
    if (!selectionMode) {
      onSelectFlight(flight);
    }
  };
  const titleColor = isHighlighted
    ? 'text-sky-950 dark:text-white'
    : 'text-gray-900 dark:text-white';
  const metaColor = isHighlighted
    ? 'text-sky-800 dark:text-sky-100'
    : 'text-gray-500 dark:text-gray-400';
  const statsColor = isHighlighted
    ? 'text-sky-900 dark:text-sky-100'
    : 'text-gray-600 dark:text-gray-300';
  const hasMediaStatus =
    hasGpx ||
    hasVideo ||
    isVideoExportRunning ||
    isVideoExportFailed ||
    hasPersistedGoproOverlay ||
    isGoproOverlayRunning ||
    isGoproOverlayFailed;
  const siteLabel = formatFlightSiteLabel({
    siteId: flight.site_id,
    siteName: flight.site_name,
    sites,
  });

  return (
    <Card
      // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role
      role="option"
      aria-selected={isHighlighted}
      tabIndex={0}
      data-testid={`flight-row-${flight.id}`}
      selected={isHighlighted}
      interactive
      padding="sm"
      borderWidth="strong"
      className="group"
      onClick={selectFlight}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          selectFlight();
        }
      }}
    >
      {isHighlighted && (
        <span
          aria-hidden="true"
          className="absolute inset-y-2 left-0 w-1.5 rounded-r-full bg-sky-700 dark:bg-sky-300"
        />
      )}
      {!selectionMode && (
        <Button
          size="icon"
          variant="danger"
          className="absolute top-2 right-2 w-10 h-10 sm:w-7 sm:h-7 flex items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30 text-red-500 dark:text-red-300 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 hover:bg-red-200 dark:hover:bg-red-900/50 hover:text-red-700 dark:hover:text-red-200 transition-all"
          onClick={(event) => {
            event.stopPropagation();
            onDeleteFlight(flight);
          }}
          aria-label={t('flights.deleteAriaLabel', {
            title: flight.title || t('flights.untitledFlight'),
          })}
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" />
        </Button>
      )}
      <div className="flex justify-between items-start mb-2 gap-2 pl-1.5">
        <div className="min-w-0 flex-1">
          <h3 className={`truncate text-sm font-semibold ${titleColor}`}>
            {flight.title || t('flights.untitledFlight')}
          </h3>
          {!selectionMode && hasMediaStatus && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {hasGpx && (
                <button
                  type="button"
                  className="inline-flex cursor-pointer items-center gap-1 rounded-full border border-green-200 bg-green-50 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-green-800 transition-colors hover:bg-green-100 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 dark:border-green-800 dark:bg-green-950/40 dark:text-green-200 dark:hover:bg-green-900/50 dark:focus:ring-offset-gray-800 disabled:cursor-not-allowed disabled:opacity-60"
                  onClick={(event) => {
                    event.stopPropagation();
                    onDownloadGpx(flight);
                  }}
                  disabled={Boolean(downloadingMedia)}
                  aria-label={t('flights.downloadGpx')}
                >
                  <FileText className="h-3 w-3" aria-hidden="true" />
                  {t('flights.gpxBadge')}
                  <Download className="h-3 w-3" aria-hidden="true" />
                </button>
              )}
              {hasVideo && (
                <button
                  type="button"
                  className="inline-flex cursor-pointer items-center gap-1 rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-indigo-800 transition-colors hover:bg-indigo-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 dark:border-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-200 dark:hover:bg-indigo-900/50 dark:focus:ring-offset-gray-800 disabled:cursor-not-allowed disabled:opacity-60"
                  onClick={(event) => {
                    event.stopPropagation();
                    onDownloadVideo(flight);
                  }}
                  disabled={Boolean(downloadingMedia)}
                  aria-label={t('flights.viewer.downloadVideo')}
                >
                  <Video className="h-3 w-3" aria-hidden="true" />
                  {t('flights.videoBadge')}
                  <Download className="h-3 w-3" aria-hidden="true" />
                </button>
              )}
              {isVideoExportRunning && (
                <span className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-blue-800 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-200">
                  {videoProcessingLabel}
                </span>
              )}
              {isVideoExportFailed && (
                <span className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200">
                  {t('flights.videoErrorBadge')}
                </span>
              )}
              {canDownloadGoproOverlay && (
                <button
                  type="button"
                  className="inline-flex cursor-pointer items-center gap-1 rounded-full border border-cyan-200 bg-cyan-50 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-cyan-800 transition-colors hover:bg-cyan-100 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 dark:border-cyan-800 dark:bg-cyan-950/40 dark:text-cyan-200 dark:hover:bg-cyan-900/50 dark:focus:ring-offset-gray-800 disabled:cursor-not-allowed disabled:opacity-60"
                  onClick={(event) => {
                    event.stopPropagation();
                    onDownloadOverlay(flight);
                  }}
                  disabled={Boolean(downloadingMedia)}
                  aria-label={t('flights.goproOverlayDownload')}
                >
                  <Wand2 className="h-3 w-3" aria-hidden="true" />
                  {t('flights.goproOverlayBadge')}
                  <Download className="h-3 w-3" aria-hidden="true" />
                </button>
              )}
              {isGoproOverlayRunning && (
                <span className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-blue-800 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-200">
                  {goproOverlayProcessingLabel}
                </span>
              )}
              {isGoproOverlayFailed && (
                <span className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200">
                  {t('flights.goproOverlayErrorBadge')}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      <div className={`mb-2 pl-1.5 text-xs ${metaColor}`}>
        <span className="font-medium">
          {formatFlightDate(flight.flight_date, i18n.language)}
        </span>
        {flight.departure_time && (
          <span className="ml-2">
            {t('flights.at', {
              time: formatDepartureTime(flight.departure_time, i18n.language),
            })}
          </span>
        )}
      </div>

      <div className={`flex flex-wrap gap-2 pl-1.5 text-xs ${statsColor}`}>
        {flight.duration_minutes && (
          <div className="flex items-center gap-1">
            <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
            <span>
              {Math.floor(flight.duration_minutes / 60)}h
              {flight.duration_minutes % 60}m
            </span>
          </div>
        )}
        {flight.distance_km && (
          <div className="flex items-center gap-1">
            <Ruler className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{formatDistanceKm(flight.distance_km, units.distance)}</span>
          </div>
        )}
        {flight.max_altitude_m && (
          <div className="flex items-center gap-1">
            <Mountain className="h-3.5 w-3.5" aria-hidden="true" />
            <span>
              {formatAltitudeMeters(flight.max_altitude_m, units.altitude)}
            </span>
          </div>
        )}
      </div>
      {siteLabel && (
        <div
          className={`mt-2 flex items-center gap-1 pl-1.5 text-xs ${metaColor}`}
        >
          <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span className="truncate">{siteLabel}</span>
        </div>
      )}
    </Card>
  );
}
