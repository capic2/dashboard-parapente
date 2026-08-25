import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@dashboard-parapente/design-system';
import type { HighlightVideoJob } from '@dashboard-parapente/shared-types';
import {
  CircleAlert,
  Download,
  FileText,
  FolderDown,
  LoaderCircle,
  Orbit,
  Video,
  Wand2,
} from 'lucide-react';
import type { Flight } from '../../../types';
import { FlightVideoExportControls } from '../video-export/FlightVideoExportControls';
import { FlightMediaThumbnail } from './FlightMediaThumbnail';
import { FlightYoutubeUploadControls } from './FlightYoutubeUploadControls';

interface FlightMediaBadgesProps {
  flightId: string;
  hasGpx: boolean;
  hasVideo: boolean;
  hasPanoVideo: boolean;
  flight: Flight;
  hasPersistedGoproOverlay: boolean;
  hasCompletedGoproOverlayJob: boolean;
  isVideoExportRunning: boolean;
  isVideoExportFailed: boolean;
  isDownloadingAnyMedia: boolean;
  videoProcessingLabel: string;
  onDownloadGpx: () => void;
  onDownloadVideo: () => void;
  onDownloadPersistedGoproOverlay: () => void;
  highlightVideo: HighlightVideoJob | null;
  onDownloadHighlightVideo: () => void;
  children: ReactNode;
}

export function FlightMediaBadges({
  flightId,
  hasGpx,
  hasVideo,
  hasPanoVideo,
  flight,
  hasPersistedGoproOverlay,
  hasCompletedGoproOverlayJob,
  isVideoExportRunning,
  isVideoExportFailed,
  isDownloadingAnyMedia,
  videoProcessingLabel,
  onDownloadGpx,
  onDownloadVideo,
  onDownloadPersistedGoproOverlay,
  highlightVideo,
  onDownloadHighlightVideo,
  children,
}: FlightMediaBadgesProps) {
  const { t } = useTranslation();
  const showPersistedOverlayBadge =
    hasPersistedGoproOverlay && !hasCompletedGoproOverlayJob;
  const videoProgress = Math.max(
    0,
    Math.min(100, Math.round(flight.video_export_progress ?? 0))
  );
  let videoStatusLabel = t('flights.videoNotGenerated');
  if (hasVideo) {
    videoStatusLabel = t('flights.mediaFileAvailable');
  } else if (isVideoExportRunning) {
    videoStatusLabel = videoProcessingLabel;
  } else if (isVideoExportFailed) {
    videoStatusLabel = t('flights.videoErrorBadge');
  }

  const downloadCardClassName =
    'group flex min-h-24 cursor-pointer items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 text-left shadow-sm transition-colors duration-200 hover:border-indigo-300 hover:bg-indigo-50/60 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900/60 dark:hover:border-indigo-700 dark:hover:bg-indigo-950/30 dark:focus:ring-offset-gray-800';

  return (
    <section
      aria-labelledby="flight-media-files-title"
      className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900/40 sm:p-5"
    >
      <div className="mb-4 flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
          <FolderDown className="h-5 w-5" aria-hidden="true" />
        </span>
        <div>
          <h3
            id="flight-media-files-title"
            className="text-base font-semibold text-slate-950 dark:text-white"
          >
            {t('flights.mediaFilesTitle')}
          </h3>
          <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-300">
            {t('flights.mediaFilesDescription')}
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
        {hasGpx && (
          <button
            type="button"
            className={downloadCardClassName}
            onClick={onDownloadGpx}
            disabled={isDownloadingAnyMedia}
            aria-label={t('flights.downloadGpx')}
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
              <FileText className="h-5 w-5" aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold text-slate-950 dark:text-white">
                {t('flights.gpxBadge')}
              </span>
              <span className="block text-xs text-slate-600 dark:text-slate-300">
                {t('flights.mediaFileAvailable')}
              </span>
            </span>
            <Download
              className="h-4 w-4 shrink-0 text-slate-400 transition-colors group-hover:text-indigo-600 dark:group-hover:text-indigo-300"
              aria-hidden="true"
            />
          </button>
        )}
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900/60">
          {hasVideo && (
            <FlightMediaThumbnail
              path={`/flights/${flightId}/video/thumbnail`}
              alt={t('flights.videoThumbnailAlt')}
            />
          )}
          <div className="p-3">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300">
                <Video className="h-5 w-5" aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold text-slate-950 dark:text-white">
                  {t('flights.videoBadge')}
                </span>
                <span className="block text-xs text-slate-600 dark:text-slate-300">
                  {videoStatusLabel}
                </span>
              </span>
              {hasVideo && (
                <button
                  type="button"
                  className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-indigo-50 hover:text-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-60 dark:text-slate-300 dark:hover:bg-indigo-950/50 dark:hover:text-indigo-300"
                  onClick={onDownloadVideo}
                  disabled={isDownloadingAnyMedia}
                  aria-label={t('flights.viewer.downloadVideo')}
                >
                  <Download className="h-4 w-4" aria-hidden="true" />
                </button>
              )}
            </div>
            {isVideoExportRunning && (
              <div className="mt-3" aria-label={videoProcessingLabel}>
                <div className="mb-1 flex items-center justify-between text-xs font-semibold text-blue-800 dark:text-blue-200">
                  <span className="flex items-center gap-1.5">
                    <LoaderCircle
                      className="h-3.5 w-3.5 motion-safe:animate-spin"
                      aria-hidden="true"
                    />
                    {t('flights.mediaExportInProgress')}
                  </span>
                  <span>{videoProgress}%</span>
                </div>
                <progress
                  aria-label={videoProcessingLabel}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={videoProgress}
                  value={videoProgress}
                  max={100}
                  className="h-2 w-full accent-blue-600 dark:accent-blue-400"
                />
              </div>
            )}
            {isVideoExportFailed && (
              <p className="mt-3 flex items-center gap-2 rounded-lg bg-red-50 p-2 text-xs font-semibold text-red-800 dark:bg-red-950/40 dark:text-red-200">
                <CircleAlert className="h-4 w-4" aria-hidden="true" />
                {t('flights.videoErrorBadge')}
              </p>
            )}
            <div className="mt-3">
              {hasGpx ? (
                <FlightVideoExportControls
                  flight={flight}
                  buttonClassName="min-h-10 w-full px-3 py-2 text-sm"
                  compact
                  showModeSelector={false}
                  showCancelAction={false}
                  showLogsPanel={false}
                />
              ) : (
                <Button
                  variant="outline"
                  className="min-h-10 w-full rounded-lg px-3 py-2 text-sm"
                  isDisabled
                  title={t('flights.replayUnavailable')}
                >
                  <Video className="h-4 w-4" aria-hidden="true" />
                  {t('flights.viewer.generateVideoShort')}
                </Button>
              )}
            </div>
          </div>
        </div>
        {hasPanoVideo && (
          <div className="overflow-hidden rounded-xl border border-violet-200 bg-white shadow-sm dark:border-violet-800 dark:bg-slate-900/60">
            <FlightMediaThumbnail
              path={`/flights/${flightId}/pano/thumbnail`}
              alt={t('flights.panoThumbnailAlt')}
            />
            <div className="p-3">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-violet-100 text-violet-700 dark:bg-violet-950/60 dark:text-violet-300">
                  <Orbit className="h-5 w-5" aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold text-slate-950 dark:text-white">
                    {t('flights.panoBadge')}
                  </span>
                  <span className="block text-xs text-slate-600 dark:text-slate-300">
                    {t('flights.mediaFileAvailable')}
                  </span>
                </span>
              </div>
              <div className="mt-3">
                <FlightYoutubeUploadControls
                  flight={flight}
                  source={{ source_type: 'pano' }}
                />
              </div>
            </div>
          </div>
        )}
        {showPersistedOverlayBadge && (
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900/60">
            <FlightMediaThumbnail
              path={`/flights/${flightId}/gopro-overlay/thumbnail`}
              alt={t('flights.goproOverlayThumbnailAlt')}
            />
            <div className="flex items-center gap-3 p-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-cyan-100 text-cyan-700 dark:bg-cyan-950/60 dark:text-cyan-300">
                <Wand2 className="h-5 w-5" aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold text-slate-950 dark:text-white">
                  {t('flights.goproOverlayBadge')}
                </span>
                <span className="block text-xs text-slate-600 dark:text-slate-300">
                  {t('flights.mediaFileAvailable')}
                </span>
              </span>
              <button
                type="button"
                className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-indigo-50 hover:text-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-60 dark:text-slate-300 dark:hover:bg-indigo-950/50 dark:hover:text-indigo-300"
                onClick={onDownloadPersistedGoproOverlay}
                disabled={isDownloadingAnyMedia}
                aria-label={t('flights.goproOverlayDownload')}
              >
                <Download className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </div>
        )}
        {highlightVideo && (
          <div className="overflow-hidden rounded-xl border border-violet-200 bg-white shadow-sm dark:border-violet-800 dark:bg-slate-900/60">
            {highlightVideo.status === 'completed' && (
              <FlightMediaThumbnail
                path={`/flights/${flightId}/highlight-videos/${highlightVideo.job_id}/thumbnail`}
                alt={t('flights.highlightVideoThumbnailAlt')}
              />
            )}
            <div className="p-3">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-violet-100 text-violet-700 dark:bg-violet-950/60 dark:text-violet-300">
                  <Wand2 className="h-5 w-5" aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold text-slate-950 dark:text-white">
                    {t('flights.highlightVideoTitle')}
                  </span>
                  <span className="block text-xs text-slate-600 dark:text-slate-300">
                    {highlightVideo.status === 'completed'
                      ? t('flights.mediaFileAvailable')
                      : (highlightVideo.message ??
                        t(
                          `flights.generationLogs.status.${highlightVideo.status}`
                        ))}
                  </span>
                </span>
              </div>
              {highlightVideo.status === 'running' && (
                <progress
                  className="mt-3 h-2 w-full accent-violet-600"
                  value={highlightVideo.progress}
                  max={100}
                  aria-label={t('flights.generationLogs.progress')}
                />
              )}
              {highlightVideo.status === 'completed' && (
                <div className="mt-3 space-y-2">
                  <Button
                    variant="outline"
                    className="min-h-10 w-full rounded-lg border-violet-300 px-3 py-2 text-sm dark:border-violet-700"
                    onPress={onDownloadHighlightVideo}
                    isDisabled={isDownloadingAnyMedia}
                  >
                    <Download className="h-4 w-4" aria-hidden="true" />
                    {t('flights.highlightVideoDownload')}
                  </Button>
                  <FlightYoutubeUploadControls
                    flight={flight}
                    source={{
                      source_type: 'highlight',
                      highlight_video_job_id: highlightVideo.job_id,
                    }}
                  />
                </div>
              )}
            </div>
          </div>
        )}
        {children}
      </div>
    </section>
  );
}
