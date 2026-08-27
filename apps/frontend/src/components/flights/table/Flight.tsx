import { useTranslation } from 'react-i18next';
import { Button, Card } from '@dashboard-parapente/design-system';
import { VIDEO_EXPORT_IN_PROGRESS_STATUSES } from '@dashboard-parapente/shared-types';
import {
  Camera,
  Clock3,
  FileText,
  MapPin,
  Mountain,
  Orbit,
  Play,
  Ruler,
  Trash2,
  Video,
  Wand2,
} from 'lucide-react';
import { formatMediaProgressLabel } from './mediaProgress';
import type { FlightSummary } from '@dashboard-parapente/shared-types';
import {
  formatAltitudeMeters,
  formatDistanceKm,
  useAppSettingsStore,
} from '../../../stores/appSettingsStore';
import { isGoproOverlayInProgress } from '../../../lib/flightMediaState';

interface FlightProps {
  flight: FlightSummary;
  isActive: boolean;
  isSelected: boolean;
  selectionMode: boolean;
  onSelectFlight: (flight: FlightSummary) => void;
  onDeleteFlight: (flight: FlightSummary) => void;
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
  isActive,
  isSelected,
  selectionMode,
  onSelectFlight,
  onDeleteFlight,
}: FlightProps) {
  const { t, i18n } = useTranslation();
  const units = useAppSettingsStore((state) => state.settings.units);
  const isHighlighted = isActive || isSelected;
  const hasGpx = flight.has_gpx;
  const hasVideo = flight.has_video;
  const hasCamera = flight.has_camera;
  const hasYoutubeVideo = flight.has_youtube_video;
  const isYoutubeUploadRunning =
    flight.youtube_upload_status === 'queued' ||
    flight.youtube_upload_status === 'uploading';
  const hasPanoVideo = flight.has_pano_video;
  const hasHighlightVideo = flight.has_highlight_video;
  const hasPersistedGoproOverlay = flight.has_gopro_overlay;
  const isGoproOverlayRunning = isGoproOverlayInProgress(
    flight.gopro_overlay_status
  );
  const isGoproOverlayFailed = flight.gopro_overlay_status === 'failed';
  const hasCompletedGoproOverlay =
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
  const youtubeLabel = formatMediaProgressLabel(
    t('flights.youtubeBadge'),
    isYoutubeUploadRunning ? flight.youtube_upload_progress : null
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
    hasCamera ||
    hasYoutubeVideo ||
    isYoutubeUploadRunning ||
    hasPanoVideo ||
    hasHighlightVideo ||
    isVideoExportRunning ||
    isVideoExportFailed ||
    hasPersistedGoproOverlay ||
    isGoproOverlayRunning ||
    isGoproOverlayFailed;
  let siteLabel = flight.site_name ?? flight.site_id ?? '';
  if (
    flight.site_name &&
    flight.site_region &&
    flight.site_region !== flight.site_name
  ) {
    siteLabel = `${flight.site_region} - ${flight.site_name}`;
  }

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
                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">
                  <FileText className="h-3 w-3" aria-hidden="true" />
                  {t('flights.gpxBadge')}
                </span>
              )}
              {hasVideo && (
                <span className="inline-flex items-center gap-1 rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[11px] font-medium text-indigo-800 dark:border-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-200">
                  <Video className="h-3 w-3" aria-hidden="true" />
                  {t('flights.videoBadge')}
                </span>
              )}
              {hasCamera && (
                <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
                  <Camera className="h-3 w-3" aria-hidden="true" />
                  {t('flights.cameraBadge')}
                </span>
              )}
              {hasCompletedGoproOverlay && (
                <span className="inline-flex items-center gap-1 rounded-full border border-cyan-200 bg-cyan-50 px-2 py-0.5 text-[11px] font-medium text-cyan-800 dark:border-cyan-800 dark:bg-cyan-950/40 dark:text-cyan-200">
                  <Wand2 className="h-3 w-3" aria-hidden="true" />
                  {t('flights.goproOverlayBadge')}
                </span>
              )}
              {(hasYoutubeVideo || isYoutubeUploadRunning) && (
                <span
                  aria-live={isYoutubeUploadRunning ? 'polite' : undefined}
                  className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200"
                >
                  <Play className="h-3 w-3" aria-hidden="true" />
                  {youtubeLabel}
                </span>
              )}
              {hasPanoVideo && (
                <span className="inline-flex items-center gap-1 rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 text-[11px] font-medium text-violet-800 dark:border-violet-800 dark:bg-violet-950/40 dark:text-violet-200">
                  <Orbit className="h-3 w-3" aria-hidden="true" />
                  {t('flights.panoBadge')}
                </span>
              )}
              {hasHighlightVideo && (
                <span className="inline-flex items-center gap-1 rounded-full border border-fuchsia-200 bg-fuchsia-50 px-2 py-0.5 text-[11px] font-medium text-fuchsia-800 dark:border-fuchsia-800 dark:bg-fuchsia-950/40 dark:text-fuchsia-200">
                  <Wand2 className="h-3 w-3" aria-hidden="true" />
                  {t('flights.highlightVideoBadge')}
                </span>
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
