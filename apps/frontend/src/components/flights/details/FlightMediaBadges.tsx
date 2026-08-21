import { useTranslation } from 'react-i18next';
import {
  CircleAlert,
  Download,
  FileText,
  FolderDown,
  LoaderCircle,
  Video,
  Wand2,
} from 'lucide-react';
import { FlightMediaThumbnail } from './FlightMediaThumbnail';

interface FlightMediaBadgesProps {
  flightId: string;
  hasGpx: boolean;
  hasVideo: boolean;
  hasPersistedGoproOverlay: boolean;
  isVideoExportRunning: boolean;
  isVideoExportFailed: boolean;
  isGoproOverlayRunning: boolean;
  isGoproOverlayFailed: boolean;
  isDownloadingAnyMedia: boolean;
  videoProcessingLabel: string;
  goproOverlayProcessingLabel: string;
  onDownloadGpx: () => void;
  onDownloadVideo: () => void;
  onDownloadPersistedGoproOverlay: () => void;
}

export function FlightMediaBadges({
  flightId,
  hasGpx,
  hasVideo,
  hasPersistedGoproOverlay,
  isVideoExportRunning,
  isVideoExportFailed,
  isGoproOverlayRunning,
  isGoproOverlayFailed,
  isDownloadingAnyMedia,
  videoProcessingLabel,
  goproOverlayProcessingLabel,
  onDownloadGpx,
  onDownloadVideo,
  onDownloadPersistedGoproOverlay,
}: FlightMediaBadgesProps) {
  const { t } = useTranslation();
  const showPersistedOverlayBadge =
    hasPersistedGoproOverlay && !isGoproOverlayRunning && !isGoproOverlayFailed;

  const hasMediaOrStatus =
    hasGpx ||
    hasVideo ||
    isVideoExportRunning ||
    isVideoExportFailed ||
    showPersistedOverlayBadge ||
    isGoproOverlayRunning ||
    isGoproOverlayFailed;

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

      {!hasMediaOrStatus && (
        <p className="rounded-xl border border-dashed border-slate-300 px-4 py-6 text-center text-sm text-slate-600 dark:border-slate-700 dark:text-slate-300">
          {t('flights.mediaFilesEmpty')}
        </p>
      )}

      {hasMediaOrStatus && (
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
          {hasVideo && (
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900/60">
              <FlightMediaThumbnail
                path={`/flights/${flightId}/video/thumbnail`}
                alt={t('flights.videoThumbnailAlt')}
              />
              <div className="flex items-center gap-3 p-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300">
                  <Video className="h-5 w-5" aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold text-slate-950 dark:text-white">
                    {t('flights.videoBadge')}
                  </span>
                  <span className="block text-xs text-slate-600 dark:text-slate-300">
                    {t('flights.mediaFileAvailable')}
                  </span>
                </span>
                <button
                  type="button"
                  className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-indigo-50 hover:text-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-60 dark:text-slate-300 dark:hover:bg-indigo-950/50 dark:hover:text-indigo-300"
                  onClick={onDownloadVideo}
                  disabled={isDownloadingAnyMedia}
                  aria-label={t('flights.viewer.downloadVideo')}
                >
                  <Download className="h-4 w-4" aria-hidden="true" />
                </button>
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
          {isVideoExportRunning && (
            <div className="flex min-h-24 items-center gap-3 rounded-xl border border-blue-200 bg-blue-50 p-3 text-blue-900 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-100">
              <LoaderCircle
                className="h-5 w-5 shrink-0 motion-safe:animate-spin"
                aria-hidden="true"
              />
              <span className="text-sm font-semibold">
                {videoProcessingLabel}
              </span>
            </div>
          )}
          {isGoproOverlayRunning && (
            <div className="flex min-h-24 items-center gap-3 rounded-xl border border-blue-200 bg-blue-50 p-3 text-blue-900 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-100">
              <LoaderCircle
                className="h-5 w-5 shrink-0 motion-safe:animate-spin"
                aria-hidden="true"
              />
              <span className="text-sm font-semibold">
                {goproOverlayProcessingLabel}
              </span>
            </div>
          )}
          {isVideoExportFailed && (
            <div className="flex min-h-24 items-center gap-3 rounded-xl border border-red-200 bg-red-50 p-3 text-red-900 dark:border-red-800 dark:bg-red-950/40 dark:text-red-100">
              <CircleAlert className="h-5 w-5 shrink-0" aria-hidden="true" />
              <span className="text-sm font-semibold">
                {t('flights.videoErrorBadge')}
              </span>
            </div>
          )}
          {isGoproOverlayFailed && (
            <div className="flex min-h-24 items-center gap-3 rounded-xl border border-red-200 bg-red-50 p-3 text-red-900 dark:border-red-800 dark:bg-red-950/40 dark:text-red-100">
              <CircleAlert className="h-5 w-5 shrink-0" aria-hidden="true" />
              <span className="text-sm font-semibold">
                {t('flights.goproOverlayErrorBadge')}
              </span>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
