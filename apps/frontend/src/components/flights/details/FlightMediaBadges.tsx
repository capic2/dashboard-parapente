import { useTranslation } from 'react-i18next';
import { Download, FileText, Video, Wand2 } from 'lucide-react';

interface FlightMediaBadgesProps {
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

  if (
    !hasGpx &&
    !hasVideo &&
    !isVideoExportRunning &&
    !isVideoExportFailed &&
    !showPersistedOverlayBadge &&
    !isGoproOverlayRunning &&
    !isGoproOverlayFailed
  ) {
    return null;
  }

  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {hasGpx && (
        <button
          type="button"
          className="inline-flex cursor-pointer items-center gap-1 rounded-full border border-green-200 bg-green-50 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-green-800 transition-colors hover:bg-green-100 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 dark:border-green-800 dark:bg-green-950/40 dark:text-green-200 dark:hover:bg-green-900/50 dark:focus:ring-offset-gray-800"
          onClick={onDownloadGpx}
          disabled={isDownloadingAnyMedia}
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
          className="inline-flex cursor-pointer items-center gap-1 rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-indigo-800 transition-colors hover:bg-indigo-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 dark:border-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-200 dark:hover:bg-indigo-900/50 dark:focus:ring-offset-gray-800"
          onClick={onDownloadVideo}
          disabled={isDownloadingAnyMedia}
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
      {showPersistedOverlayBadge && (
        <button
          type="button"
          className="inline-flex cursor-pointer items-center gap-1 rounded-full border border-cyan-200 bg-cyan-50 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-cyan-800 transition-colors hover:bg-cyan-100 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 dark:border-cyan-800 dark:bg-cyan-950/40 dark:text-cyan-200 dark:hover:bg-cyan-900/50 dark:focus:ring-offset-gray-800"
          onClick={onDownloadPersistedGoproOverlay}
          disabled={isDownloadingAnyMedia}
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
  );
}
