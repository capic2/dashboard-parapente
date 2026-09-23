import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { CircleAlert, Edit3, Wand2 } from 'lucide-react';
import { useGoproOverlayPreview } from '../../../hooks/gopro/useGoproOverlay';
import { useFlightTelemetry } from '../../../hooks/flights/useFlightTelemetry';
import { useTelemetryLayout } from '../../../hooks/flights/useTelemetryLayout';
import { getApiUrlWithSearchParams } from '../../../lib/api';
import { parseApiUtcDate } from '../../../lib/date';
import { useAuthStore } from '../../../stores/authStore';
import { FlightOverlayPlayer } from './FlightOverlayPlayer';
import { FlightTelemetryOverlay } from './FlightTelemetryOverlay';
import type { FlightTelemetryPipLayout } from './flightTelemetryLayout';
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
  const layout = useTelemetryLayout(flightId);
  const [cameraTime, setCameraTime] = useState(0);
  const isEnrichmentPending =
    telemetry.data?.enrichment_status === 'pending' ||
    overlayPreview.data?.gpx?.enrichment_status === 'pending';
  const isLoading =
    telemetry.isPending ||
    overlayPreview.isPending ||
    layout.isPending ||
    isEnrichmentPending;
  const isReady =
    telemetry.isSuccess &&
    layout.isSuccess &&
    overlayPreview.isSuccess &&
    !isEnrichmentPending &&
    Boolean(telemetry.data?.points.length);
  const showUnavailable = !isLoading && !isEnrichmentPending && !isReady;
  let previewStatusMessage: string;
  if (isLoading || isEnrichmentPending) {
    previewStatusMessage = t('flights.overlayInteractivePreviewLoading');
  } else if (isReady) {
    previewStatusMessage = t('flights.overlayInteractivePreviewReady');
  } else {
    previewStatusMessage = t('flights.overlayInteractivePreviewUnavailable');
  }
  const overlayOffsetSeconds =
    overlayPreview.data?.alignment.manual_offset_seconds ?? 0;
  const timelineStartTimestamp = overlayPreview.data?.video.start_time
    ? parseApiUtcDate(overlayPreview.data.video.start_time).getTime()
    : undefined;
  const mergedGpxStartTimestamp = telemetry.data?.start_time
    ? parseApiUtcDate(telemetry.data.start_time).getTime()
    : undefined;
  const mergedGpxStartOffsetSeconds =
    mergedGpxStartTimestamp !== undefined &&
    timelineStartTimestamp !== undefined
      ? (mergedGpxStartTimestamp - timelineStartTimestamp) / 1000
      : 0;
  const previewSegments = overlayPreview.data?.video.preview_segments ?? [];

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-gray-800">
      <div className="flex items-start gap-3 p-4 sm:p-5">
        <span className="flex min-w-0 items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300">
            <Wand2 className="h-5 w-5" aria-hidden="true" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-semibold text-slate-950 dark:text-white">
              {t('flights.overlayInteractivePreview')}
            </span>
            <span className="block text-sm text-slate-600 dark:text-slate-300">
              {previewStatusMessage}
            </span>
          </span>
          <Link
            to="/flights/$flightId/telemetry-layout"
            params={{ flightId }}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-violet-200 bg-white px-3 py-2 text-xs font-semibold text-violet-700 transition-colors hover:bg-violet-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 dark:border-violet-800 dark:bg-gray-900 dark:text-violet-300 dark:hover:bg-violet-950/40"
          >
            <Edit3 className="h-3.5 w-3.5" aria-hidden="true" />
            {t('telemetryLayout.configure')}
          </Link>
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
            pipLayout={layout.data?.layout.find(
              (item): item is FlightTelemetryPipLayout => item.type === 'pip'
            )}
            onTimeChange={(previewTime) =>
              setCameraTime(
                sourceTimeAtPreviewTime(previewTime, previewSegments)
              )
            }
            overlayContent={
              <FlightTelemetryOverlay
                data={telemetry.data}
                videoTimeSeconds={cameraTime - mergedGpxStartOffsetSeconds}
                offsetSeconds={overlayOffsetSeconds}
                timelineStartTimestamp={
                  mergedGpxStartTimestamp ?? timelineStartTimestamp
                }
                layout={layout.data?.layout}
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
