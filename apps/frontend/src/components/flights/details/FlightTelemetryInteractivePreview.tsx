import { useMemo, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { CircleAlert, Edit3, Wand2 } from 'lucide-react';
import { useGoproOverlayPreview } from '../../../hooks/gopro/useGoproOverlay';
import {
  interpolateTelemetryAtVideoTime,
  useFlightTelemetry,
} from '../../../hooks/flights/useFlightTelemetry';
import { useTelemetryLayout } from '../../../hooks/flights/useTelemetryLayout';
import { getApiUrlWithSearchParams } from '../../../lib/api';
import { parseApiUtcDate } from '../../../lib/date';
import { useAuthStore } from '../../../stores/authStore';
import { FlightOverlayPlayer } from './FlightOverlayPlayer';
import { FlightTelemetryOverlay } from './FlightTelemetryOverlay';
import {
  ensureInteractiveDynamicTelemetryWidgets,
  type FlightTelemetryPipLayout,
} from './flightTelemetryLayout';
import { sourceTimeAtPreviewTime } from './GoproOverlaySyncPreview';

interface FlightTelemetryInteractivePreviewProps {
  flightId: string;
  hasFlightVideo?: boolean;
  manualOffsetSeconds?: number;
}

export function FlightTelemetryInteractivePreview({
  flightId,
  hasFlightVideo = true,
  manualOffsetSeconds,
}: FlightTelemetryInteractivePreviewProps) {
  const { t } = useTranslation();
  const token = useAuthStore((state) => state.token);
  const overlayPreview = useGoproOverlayPreview(flightId, true);
  const telemetry = useFlightTelemetry(flightId, true);
  const layout = useTelemetryLayout(flightId);
  const interactiveLayout = useMemo(
    () =>
      layout.data?.layout
        ? ensureInteractiveDynamicTelemetryWidgets(layout.data.layout)
        : undefined,
    [layout.data?.layout]
  );
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
    manualOffsetSeconds ??
    overlayPreview.data?.alignment.manual_offset_seconds ??
    0;
  const automaticOffsetSeconds =
    overlayPreview.data?.alignment.automatic_offset_seconds ?? 0;
  // PROTECTED CALIBRATION SYNC CONTRACT — use the same GPX origin and
  // combined offset as GoproOverlaySyncPreview. Changes require explicit
  // user authorization in the current task.
  const calibrationOffsetSeconds =
    automaticOffsetSeconds + overlayOffsetSeconds;
  const telemetryStartTimestamp =
    overlayPreview.data?.gpx?.coordinates[0]?.timestamp ??
    (overlayPreview.data?.gpx?.start_time
      ? parseApiUtcDate(overlayPreview.data.gpx.start_time).getTime()
      : telemetry.data?.points[0]?.timestamp);
  const previewSegments = overlayPreview.data?.video.preview_segments ?? [];
  const currentTelemetryPoint = interpolateTelemetryAtVideoTime(
    telemetry.data,
    cameraTime,
    calibrationOffsetSeconds,
    telemetryStartTimestamp
  );
  const currentHeartRate = currentTelemetryPoint?.heart_rate;

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
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start">
            <div className="min-w-0 flex-1">
              <FlightOverlayPlayer
                mode="interactive"
                cameraUrl={getApiUrlWithSearchParams(
                  `flights/${flightId}/gopro-camera/preview`,
                  {
                    access_token: token,
                    target_end_seconds: String(
                      overlayPreview.data?.video.preview_target_end_seconds ??
                        ''
                    ),
                    version: `${overlayPreview.data?.video.preview_target_end_seconds}-${overlayPreview.data?.video.preview_available_duration_seconds}`,
                  }
                )}
                flightUrl={
                  hasFlightVideo
                    ? getApiUrlWithSearchParams(`flights/${flightId}/video`, {
                        access_token: token,
                      })
                    : undefined
                }
                cameraLabel={t('flights.goproOverlayCameraPreview')}
                flightLabel={t('flights.goproOverlayFlightVideo')}
                pipLayout={interactiveLayout?.find(
                  (item): item is FlightTelemetryPipLayout =>
                    item.type === 'pip'
                )}
                onTimeChange={(previewTime) =>
                  setCameraTime(
                    sourceTimeAtPreviewTime(previewTime, previewSegments)
                  )
                }
                overlayContent={
                  <FlightTelemetryOverlay
                    data={telemetry.data}
                    videoTimeSeconds={cameraTime}
                    offsetSeconds={calibrationOffsetSeconds}
                    timelineStartTimestamp={telemetryStartTimestamp}
                    layout={interactiveLayout}
                  />
                }
              />
            </div>
            <aside
              data-testid="telemetry-debug-bpm"
              className="shrink-0 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-100 lg:w-44"
            >
              <div className="text-xs font-semibold uppercase tracking-wide">
                Debug télémétrie
              </div>
              <div className="mt-2 text-xs">BPM courant</div>
              <div className="font-mono text-xl font-bold">
                {currentHeartRate == null ? '—' : `${currentHeartRate} bpm`}
              </div>
              <div className="mt-2 text-xs opacity-75">
                t vidéo: {cameraTime.toFixed(1)} s
              </div>
            </aside>
          </div>
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
