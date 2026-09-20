import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CircleAlert, Wand2 } from 'lucide-react';
import { useGoproOverlayPreview } from '../../../hooks/gopro/useGoproOverlay';
import { useFlightTelemetry } from '../../../hooks/flights/useFlightTelemetry';
import { getApiUrlWithSearchParams } from '../../../lib/api';
import { useAuthStore } from '../../../stores/authStore';
import { FlightOverlayPlayer } from './FlightOverlayPlayer';
import { FlightTelemetryOverlay } from './FlightTelemetryOverlay';

interface FlightTelemetryInteractivePreviewProps {
  flightId: string;
}

export function FlightTelemetryInteractivePreview({
  flightId,
}: FlightTelemetryInteractivePreviewProps) {
  const { t } = useTranslation();
  const token = useAuthStore((state) => state.token);
  const overlayPreview = useGoproOverlayPreview(flightId, true);
  const telemetry = useFlightTelemetry(flightId, true);
  const [cameraTime, setCameraTime] = useState(0);
  const isReady = telemetry.isSuccess && overlayPreview.isSuccess;
  const overlayOffsetSeconds =
    overlayPreview.data?.alignment.effective_offset_seconds ?? 0;

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
        {isReady ? (
          <FlightOverlayPlayer
            mode="interactive"
            cameraUrl={getApiUrlWithSearchParams(
              `flights/${flightId}/gopro-camera/preview`,
              { access_token: token }
            )}
            flightUrl={getApiUrlWithSearchParams(`flights/${flightId}/video`, {
              access_token: token,
            })}
            cameraLabel={t('flights.goproOverlayCameraPreview')}
            flightLabel={t('flights.goproOverlayFlightVideo')}
            onTimeChange={setCameraTime}
            overlayContent={
              <FlightTelemetryOverlay
                data={telemetry.data}
                videoTimeSeconds={cameraTime}
                offsetSeconds={overlayOffsetSeconds}
              />
            }
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
    </section>
  );
}
