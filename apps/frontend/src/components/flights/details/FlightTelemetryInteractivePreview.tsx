import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CircleAlert, Wand2 } from 'lucide-react';
import { useGoproOverlayPreview } from '../../../hooks/gopro/useGoproOverlay';
import { useFlightTelemetry } from '../../../hooks/flights/useFlightTelemetry';
import { getApiUrlWithSearchParams } from '../../../lib/api';
import { useAuthStore } from '../../../stores/authStore';
import { FlightOverlayPlayer } from './FlightOverlayPlayer';
import { FlightTelemetryOverlay } from './FlightTelemetryOverlay';
import { sourceTimeAtPreviewTime } from './GoproOverlaySyncPreview';

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
  const isLoading = telemetry.isPending || overlayPreview.isPending;
  const isReady =
    telemetry.isSuccess &&
    overlayPreview.isSuccess &&
    Boolean(telemetry.data?.points.length);
  const isEnrichmentPending = telemetry.data?.enrichment_status === 'pending';
  const showUnavailable = !isLoading && !isReady;
  let previewStatusMessage: string;
  if (isLoading || isEnrichmentPending) {
    previewStatusMessage = t('flights.overlayInteractivePreviewLoading');
  } else if (isReady) {
    previewStatusMessage = t('flights.overlayInteractivePreviewReady');
  } else {
    previewStatusMessage = t('flights.overlayInteractivePreviewUnavailable');
  }
  // Keep the interactive preview on the same timeline as calibration:
  // telemetry timestamp = GPX start + video time - total alignment offset.
  // Using the video start plus only the manual offset is not equivalent when
  // the API returns the source GPX while OSV enrichment is still pending.
  const overlayOffsetSeconds =
    overlayPreview.data?.alignment.effective_offset_seconds ?? 0;
  const timelineStartTimestamp = telemetry.data?.start_time
    ? Date.parse(telemetry.data.start_time)
    : undefined;
  const previewSegments = overlayPreview.data?.video.preview_segments ?? [];

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
              {previewStatusMessage}
            </span>
          </span>
        </span>
      </div>
      <div className="border-t border-slate-200 p-4 dark:border-slate-700 sm:p-5">
        {isLoading && (
          <output
            className="block rounded-lg bg-slate-100 p-3 text-sm text-slate-700 dark:bg-slate-900 dark:text-slate-200"
            aria-live="polite"
          >
            {t('flights.overlayInteractivePreviewLoading')}
          </output>
        )}
        {!isLoading && isReady && (
          <FlightOverlayPlayer
            mode="interactive"
            cameraUrl={getApiUrlWithSearchParams(
              `flights/${flightId}/gopro-camera/preview`,
              {
                access_token: token,
                target_end_seconds: String(
                  overlayPreview.data?.video.preview_target_end_seconds ?? ''
                ),
                version: `${overlayPreview.data?.video.preview_target_end_seconds}-${overlayPreview.data?.video.preview_available_duration_seconds}`,
              }
            )}
            flightUrl={getApiUrlWithSearchParams(`flights/${flightId}/video`, {
              access_token: token,
            })}
            cameraLabel={t('flights.goproOverlayCameraPreview')}
            flightLabel={t('flights.goproOverlayFlightVideo')}
            onTimeChange={(previewTime) =>
              setCameraTime(
                sourceTimeAtPreviewTime(previewTime, previewSegments)
              )
            }
            overlayContent={
              <FlightTelemetryOverlay
                data={telemetry.data}
                videoTimeSeconds={cameraTime}
                offsetSeconds={overlayOffsetSeconds}
                timelineStartTimestamp={timelineStartTimestamp}
              />
            }
          />
        )}
        {showUnavailable && (
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
