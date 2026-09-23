import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { CircleAlert, Wand2 } from 'lucide-react';
import type { Flight } from '../../../types';
import type { FlightOverlayLayer } from '../../../hooks/gopro/useGoproOverlay';
import { useGoproOverlayPreview } from '../../../hooks/gopro/useGoproOverlay';
import { getApiUrlWithSearchParams } from '../../../lib/api';
import { getYoutubeVideoId } from '../../../lib/youtube';
import { useAuthStore } from '../../../stores/authStore';
import { FlightYoutubeOverlayPlayer } from './FlightYoutubeOverlayPlayer';
import { FlightYoutubeUploadControls } from './FlightYoutubeUploadControls';

// This is the final dynamic overlay player. Calibration and GPX alignment
// belong to GoproOverlaySyncPreview and must not be changed here by mistake.
interface FlightOverlayInteractivePreviewProps {
  flightId: string;
  flight: Flight;
  hasCameraVideo: boolean;
  overlayLayer?: FlightOverlayLayer;
  youtubeUrl?: string;
}

export function FlightOverlayInteractivePreview({
  flightId,
  flight,
  hasCameraVideo,
  overlayLayer,
  youtubeUrl,
}: FlightOverlayInteractivePreviewProps) {
  const { t } = useTranslation();
  const token = useAuthStore((state) => state.token);
  const overlayPreview = useGoproOverlayPreview(flightId, true);
  const isReady =
    overlayLayer?.status === 'completed' && Boolean(overlayLayer.job);
  const overlayJob = isReady ? overlayLayer.job : null;
  const overlayOffsetSeconds =
    overlayPreview.data?.alignment.effective_offset_seconds ?? 0;
  const overlayUrl = overlayJob
    ? getApiUrlWithSearchParams(
        `gopro-overlays/jobs/${overlayJob.job_id}/download`,
        {
          access_token: token,
          browser_preview: 'true',
          version: overlayJob.updated_at,
        }
      )
    : undefined;
  let playerContent: ReactNode;
  if (overlayUrl && youtubeUrl && getYoutubeVideoId(youtubeUrl)) {
    playerContent = (
      <FlightYoutubeOverlayPlayer
        youtubeUrl={youtubeUrl}
        flightUrl={getApiUrlWithSearchParams(`flights/${flightId}/video`, {
          access_token: token,
        })}
        youtubeLabel={t('flights.goproOverlayYoutubePreview')}
        flightLabel={t('flights.goproOverlayFlightVideo')}
        overlayUrl={overlayUrl}
        getOverlayTime={(youtubeTime) => youtubeTime - overlayOffsetSeconds}
      />
    );
  } else if (youtubeUrl) {
    playerContent = (
      <div className="flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
        <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <span>{t('flights.overlayInteractivePreviewUnavailable')}</span>
      </div>
    );
  } else if (hasCameraVideo) {
    playerContent = (
      <div className="space-y-3 rounded-lg bg-sky-50 p-4 text-sm text-sky-950 dark:bg-sky-950/30 dark:text-sky-100">
        <p>{t('flights.youtubeOverlayUploadCameraPrompt')}</p>
        <FlightYoutubeUploadControls
          flight={flight}
          source={{ source_type: 'camera' }}
        />
      </div>
    );
  } else {
    playerContent = (
      <div className="flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
        <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <span>{t('flights.youtubeOverlayCameraRequired')}</span>
      </div>
    );
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-gray-800">
      <div className="flex items-start gap-3 p-4 sm:p-5">
        <span className="flex min-w-0 items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300">
            <Wand2 className="h-5 w-5" aria-hidden="true" />
          </span>
          <span>
            <span className="block font-semibold text-slate-950 dark:text-white">
              {t('flights.overlayInteractivePreview')}
            </span>
            <span className="block text-sm text-slate-600 dark:text-slate-300">
              {isReady
                ? t('flights.overlayInteractivePreviewReady')
                : t('flights.overlayInteractivePreviewUnavailable')}
            </span>
          </span>
        </span>
      </div>
      <div className="border-t border-slate-200 p-4 dark:border-slate-700 sm:p-5">
        {playerContent}
      </div>
    </section>
  );
}
