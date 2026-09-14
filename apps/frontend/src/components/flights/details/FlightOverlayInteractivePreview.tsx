import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, CircleAlert, Wand2 } from 'lucide-react';
import { useFlightOverlayLayer } from '../../../hooks/gopro/useGoproOverlay';
import { getApiUrlWithSearchParams } from '../../../lib/api';
import { useAuthStore } from '../../../stores/authStore';
import { FlightOverlayPlayer } from './FlightOverlayPlayer';

interface FlightOverlayInteractivePreviewProps {
  flightId: string;
}

export function FlightOverlayInteractivePreview({
  flightId,
}: FlightOverlayInteractivePreviewProps) {
  const { t } = useTranslation();
  const token = useAuthStore((state) => state.token);
  const layer = useFlightOverlayLayer(flightId);
  const [isExpanded, setIsExpanded] = useState(false);
  const isReady = layer.data?.status === 'completed' && Boolean(layer.data.job);
  const overlayJob = isReady ? layer.data?.job : null;
  const overlayUrl = overlayJob
    ? getApiUrlWithSearchParams(
        `gopro-overlays/jobs/${overlayJob.job_id}/download`,
        { access_token: token, version: overlayJob.updated_at }
      )
    : undefined;

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-gray-800">
      <button
        type="button"
        className="flex w-full cursor-pointer items-center justify-between gap-3 p-4 text-left transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-inset dark:hover:bg-slate-700/50 sm:p-5"
        aria-expanded={isExpanded}
        aria-controls="flight-overlay-interactive-preview-panel"
        onClick={() => setIsExpanded((expanded) => !expanded)}
      >
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
        <ChevronDown
          aria-hidden="true"
          className={`size-5 shrink-0 text-slate-500 transition-transform duration-200 dark:text-slate-400 ${isExpanded ? 'rotate-180' : ''}`}
        />
      </button>
      {isExpanded && (
        <div
          id="flight-overlay-interactive-preview-panel"
          className="border-t border-slate-200 p-4 dark:border-slate-700 sm:p-5"
        >
          {overlayUrl ? (
            <FlightOverlayPlayer
              cameraUrl={getApiUrlWithSearchParams(
                `flights/${flightId}/gopro-camera/preview`,
                { access_token: token }
              )}
              flightUrl={getApiUrlWithSearchParams(
                `flights/${flightId}/video`,
                {
                  access_token: token,
                }
              )}
              overlayUrl={overlayUrl}
              cameraLabel={t('flights.goproOverlayCameraPreview')}
              flightLabel={t('flights.goproOverlayFlightVideo')}
            />
          ) : (
            <div className="flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
              <CircleAlert
                className="mt-0.5 h-4 w-4 shrink-0"
                aria-hidden="true"
              />
              <span>{t('flights.overlayInteractivePreviewUnavailable')}</span>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
