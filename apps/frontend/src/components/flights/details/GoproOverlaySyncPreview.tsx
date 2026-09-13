import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  Activity,
  Gauge,
  HeartPulse,
  Mountain,
  TimerReset,
} from 'lucide-react';
import {
  useGenerateGoproPreview,
  useGoproOverlayPreview,
} from '../../../hooks/gopro/useGoproOverlay';
import { getApiUrlWithSearchParams } from '../../../lib/api';
import { parseApiUtcDate } from '../../../lib/date';
import { useAuthStore } from '../../../stores/authStore';
import { telemetryAtTimestamp } from './goproSyncTelemetry';
import type { GoproOverlayPreview } from '../../../hooks/gopro/useGoproOverlay';
import { FlightOverlayPlayer } from './FlightOverlayPlayer';

interface GoproOverlaySyncPreviewProps {
  flightId: string;
  offset: string;
  onOffsetChange: (offset: string) => void;
}

function formatSeconds(seconds: number) {
  const sign = seconds < 0 ? '-' : '';
  const absolute = Math.abs(seconds);
  const minutes = Math.floor(absolute / 60);
  const remainingSeconds = absolute - minutes * 60;
  return `${sign}${minutes}:${remainingSeconds.toFixed(1).padStart(4, '0')}`;
}

function flightTotals(coordinates: GoproOverlayPreview['gpx']['coordinates']) {
  let gain = 0;
  let loss = 0;
  let distance = 0;
  for (let index = 1; index < coordinates.length; index += 1) {
    const previous = coordinates[index - 1];
    const current = coordinates[index];
    const elevationDelta = current.elevation - previous.elevation;
    if (elevationDelta > 0) gain += elevationDelta;
    else loss -= elevationDelta;
    const latitude = ((previous.lat + current.lat) / 2) * (Math.PI / 180);
    const latitudeDelta = (current.lat - previous.lat) * (Math.PI / 180);
    const longitudeDelta = (current.lon - previous.lon) * (Math.PI / 180);
    const a =
      Math.sin(latitudeDelta / 2) ** 2 +
      Math.cos(latitude) ** 2 * Math.sin(longitudeDelta / 2) ** 2;
    distance += 2 * 6_371_000 * Math.asin(Math.sqrt(a));
  }
  return {
    gain,
    loss,
    distance: distance / 1000,
    startAltitude: coordinates[0]?.elevation ?? 0,
    minAltitude: Math.min(...coordinates.map((point) => point.elevation)),
    maxAltitude: Math.max(...coordinates.map((point) => point.elevation)),
  };
}

function varioAtTimestamp(
  coordinates: GoproOverlayPreview['gpx']['coordinates'],
  timestamp: number
) {
  if (coordinates.length < 2) return 0;
  let index = 1;
  while (
    index < coordinates.length &&
    coordinates[index].timestamp < timestamp
  ) {
    index += 1;
  }
  const previous = coordinates[index - 1];
  const next = coordinates[Math.min(index, coordinates.length - 1)];
  const duration = (next.timestamp - previous.timestamp) / 1000;
  return duration > 0 ? (next.elevation - previous.elevation) / duration : 0;
}

function formatOverlayDate(timestamp: number) {
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(new Date(timestamp));
}

function InteractiveGoproOverlay({
  telemetry,
  coordinates,
}: {
  telemetry: ReturnType<typeof telemetryAtTimestamp>;
  coordinates: GoproOverlayPreview['gpx']['coordinates'];
}) {
  const totals = flightTotals(coordinates);
  const vario = telemetry
    ? varioAtTimestamp(coordinates, telemetry.timestamp)
    : 0;
  const heartRates = coordinates.flatMap((point) =>
    point.heart_rate === undefined ? [] : [point.heart_rate]
  );
  const value = (current: number | null | undefined, suffix = '') =>
    current === null || current === undefined
      ? '--'
      : `${Math.round(current)}${suffix}`;

  return (
    <div className="pointer-events-none absolute inset-0 z-10 overflow-hidden font-mono text-[clamp(7px,1.25vw,16px)] font-semibold text-white [text-shadow:0_1px_3px_rgba(0,0,0,0.95)]">
      <span className="absolute left-[0.52%] top-[0.93%] whitespace-nowrap text-[clamp(8px,1.4vw,18px)]">
        {telemetry
          ? formatOverlayDate(telemetry.timestamp)
          : '--/--/---- --:--:--'}
      </span>

      <div className="absolute right-[1%] top-[0.93%] w-[15%] text-right">
        <div className="flex items-center justify-end gap-1 text-[clamp(8px,1vw,14px)]">
          <HeartPulse className="h-[1.8em] w-[1.8em]" aria-hidden="true" />
          {telemetry?.heart_rate ? `${telemetry.heart_rate} bpm` : '-- bpm'}
        </div>
        <div className="mt-1 text-[clamp(12px,2.2vw,28px)]">
          {telemetry?.heart_rate ?? '--'}
        </div>
        <div className="mt-1 flex justify-end gap-3 text-[0.8em]">
          <span>
            min {value(heartRates.length ? Math.min(...heartRates) : null)}
          </span>
          <span>
            max {value(heartRates.length ? Math.max(...heartRates) : null)}
          </span>
        </div>
      </div>

      <div className="absolute right-[1%] top-[10.2%] w-[15%] text-right">
        <div className="flex items-center justify-end gap-1 text-[clamp(8px,1vw,14px)]">
          <Mountain className="h-[1.8em] w-[1.8em]" aria-hidden="true" /> m
        </div>
        <div className="mt-1 text-[clamp(12px,2.2vw,28px)]">
          {value(telemetry?.elevation)}
        </div>
        <div className="mt-1 flex justify-end gap-3 text-[0.8em]">
          <span>min {Math.round(totals.minAltitude)}</span>
          <span>max {Math.round(totals.maxAltitude)}</span>
        </div>
      </div>

      <div className="absolute right-[1%] top-[19.4%] w-[15%] text-right">
        <div className="flex items-center justify-end gap-1">
          ↗ D+ {Math.round(totals.gain)} m
        </div>
        <div>↘ D- {Math.round(totals.loss)} m</div>
      </div>

      <div className="absolute right-[1%] top-[28.7%] w-[15%] text-right">
        <div className="flex items-center justify-end gap-1">
          <Activity className="h-[1.8em] w-[1.8em]" aria-hidden="true" />
          {vario.toFixed(2)} m/s
        </div>
      </div>

      <div className="absolute bottom-[1%] left-[12.5%] text-left">
        <div>Déco (m)</div>
        <div className="text-[clamp(12px,2.2vw,28px)]">
          {Math.round(totals.startAltitude)}
        </div>
        <div className="mt-1">Attero (m)</div>
        <div className="text-[clamp(12px,2.2vw,28px)]">
          {Math.round(totals.minAltitude)}
        </div>
        <div className="mt-1">Distance {totals.distance.toFixed(1)} km</div>
      </div>

      <div className="absolute bottom-[1%] right-[1%] flex flex-col items-center text-center">
        <Gauge
          className="h-[clamp(24px,6vw,76px)] w-[clamp(24px,6vw,76px)]"
          aria-hidden="true"
        />
        <span className="-mt-2 text-[clamp(14px,2.8vw,36px)]">
          {telemetry ? Math.round(telemetry.speedKmh) : '--'}
        </span>
        <span>km/h</span>
      </div>
    </div>
  );
}

export function sourceTimeAtPreviewTime(
  previewTime: number,
  segments: GoproOverlayPreview['video']['preview_segments']
) {
  const segment = segments[previewSegmentIndex(previewTime, segments)];
  if (!segment) return previewTime;
  const elapsed = Math.min(
    Math.max(0, previewTime - segment.preview_start_seconds),
    segment.duration_seconds
  );
  return segment.source_start_seconds + elapsed;
}

export function manualOffsetForGpxStartAtVideoTime(
  sourceVideoTime: number,
  automaticOffset: number
) {
  return sourceVideoTime - automaticOffset;
}

function previewSegmentIndex(
  previewTime: number,
  segments: GoproOverlayPreview['video']['preview_segments']
) {
  let activeIndex = 0;
  for (let index = 1; index < segments.length; index += 1) {
    if (previewTime < segments[index].preview_start_seconds) break;
    activeIndex = index;
  }
  return activeIndex;
}

export function GoproOverlaySyncPreview({
  flightId,
  offset,
  onOffsetChange,
}: GoproOverlaySyncPreviewProps) {
  const { t } = useTranslation();
  const token = useAuthStore((state) => state.token);
  const queryClient = useQueryClient();
  const preview = useGoproOverlayPreview(flightId, true);
  const generatePreview = useGenerateGoproPreview(flightId);
  const automaticallyRequestedTarget = useRef<string | null>(null);
  const [videoTime, setVideoTime] = useState(0);
  const [requestedMinutes, setRequestedMinutes] = useState(3);
  const parsedOffset = Number(offset);
  const manualOffset = Number.isFinite(parsedOffset) ? parsedOffset : 0;
  const automaticOffset = preview.data?.alignment.automatic_offset_seconds ?? 0;
  const previewSegments = preview.data?.video.preview_segments ?? [];
  const sourceVideoTime = sourceTimeAtPreviewTime(videoTime, previewSegments);
  const activeSegmentIndex = previewSegmentIndex(videoTime, previewSegments);
  const gpxStart = preview.data
    ? parseApiUtcDate(preview.data.gpx.start_time).getTime()
    : 0;
  const telemetry = preview.data
    ? telemetryAtTimestamp(
        preview.data.gpx.coordinates,
        gpxStart + (sourceVideoTime - automaticOffset - manualOffset) * 1000
      )
    : null;
  const videoUrl = getApiUrlWithSearchParams(
    `flights/${flightId}/gopro-camera/preview`,
    {
      access_token: token,
      target_end_seconds: String(
        preview.data?.video.preview_target_end_seconds ?? ''
      ),
      version: `${preview.data?.video.preview_target_end_seconds}-${preview.data?.video.preview_available_duration_seconds}`,
    }
  );
  const flightVideoUrl = getApiUrlWithSearchParams(
    `flights/${flightId}/video`,
    {
      access_token: token,
    }
  );

  const availableMinutes = Math.max(
    0,
    Math.ceil(
      (preview.data?.video.preview_available_duration_seconds ?? 0) / 60
    )
  );
  const maxMinutes = Math.max(
    3,
    Math.floor((preview.data?.video.preview_max_duration_seconds ?? 900) / 60)
  );
  const isGenerating = preview.data?.video.preview_status === 'generating';
  const requestedDurationCoversSource =
    requestedMinutes * 120 >=
    (preview.data?.video.preview_target_end_seconds ?? Infinity);

  useEffect(() => {
    setRequestedMinutes((current) => Math.max(current, availableMinutes, 3));
  }, [availableMinutes]);

  useEffect(() => {
    const targetEndSeconds = preview.data?.video.preview_target_end_seconds;
    const requestKey = `${flightId}:${targetEndSeconds}`;
    if (
      preview.data?.video.preview_status !== 'missing' ||
      targetEndSeconds === undefined ||
      automaticallyRequestedTarget.current === requestKey
    ) {
      return;
    }
    automaticallyRequestedTarget.current = requestKey;
    generatePreview.mutate(
      { durationSeconds: 180, targetEndSeconds },
      {
        onSuccess: () =>
          void queryClient.invalidateQueries({
            queryKey: ['flights', flightId, 'gopro-overlay-preview'],
          }),
      }
    );
  }, [flightId, generatePreview, preview.data?.video, queryClient]);

  const handleGeneratePreview = async () => {
    try {
      await generatePreview.mutateAsync({
        durationSeconds: requestedMinutes * 60,
        targetEndSeconds: preview.data?.video.preview_target_end_seconds ?? 0,
      });
      await queryClient.invalidateQueries({
        queryKey: ['flights', flightId, 'gopro-overlay-preview'],
      });
    } catch {
      // The existing preview remains usable; the inline fallback explains the failure.
    }
  };

  const adjustOffset = (delta: number) => {
    onOffsetChange((manualOffset + delta).toFixed(1));
  };

  const alignGpxStartAtCurrentVideoTime = () => {
    onOffsetChange(
      manualOffsetForGpxStartAtVideoTime(
        sourceVideoTime,
        automaticOffset
      ).toFixed(1)
    );
  };

  if (preview.isPending) {
    return (
      <div className="rounded-xl border border-gray-200 bg-gray-50 p-6 text-center text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300">
        {t('flights.goproOverlayPreviewLoading')}
      </div>
    );
  }

  if (preview.isError) {
    return (
      <div
        role="alert"
        className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200"
      >
        {t('flights.goproOverlayPreviewError')}
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      <div className="overflow-hidden rounded-xl bg-black shadow-sm">
        <FlightOverlayPlayer
          cameraUrl={videoUrl}
          flightUrl={flightVideoUrl}
          cameraLabel={t('flights.goproOverlayCameraPreview')}
          flightLabel={t('flights.goproOverlayFlightVideo')}
          syncOffsetSeconds={automaticOffset + manualOffset}
          getFlightTime={(previewTime) =>
            sourceTimeAtPreviewTime(previewTime, previewSegments) -
            automaticOffset -
            manualOffset
          }
          onTimeChange={setVideoTime}
          overlayContent={
            <InteractiveGoproOverlay
              telemetry={telemetry}
              coordinates={preview.data?.gpx.coordinates ?? []}
            />
          }
        />
        <div className="flex items-center justify-between px-3 py-2 font-mono text-xs text-gray-200">
          <span>{t('flights.goproOverlayVideoTime')}</span>
          <span>{formatSeconds(sourceVideoTime)}</span>
        </div>
        {previewSegments.length > 1 && (
          <div className="grid grid-cols-2 border-t border-gray-800 text-center text-xs font-medium text-gray-400">
            <span
              className={`px-3 py-2 ${activeSegmentIndex === 0 ? 'bg-sky-950 text-sky-200' : ''}`}
            >
              {t('flights.goproPreviewStart')}
            </span>
            <span
              className={`border-l border-gray-800 px-3 py-2 ${activeSegmentIndex === 1 ? 'bg-sky-950 text-sky-200' : ''}`}
            >
              {t('flights.goproPreviewEnd')}
            </span>
          </div>
        )}
        <div className="space-y-2 border-t border-gray-800 px-3 py-3 text-gray-100">
          <div className="flex items-center justify-between gap-3 text-xs">
            <label htmlFor="gopro-preview-duration">
              {t('flights.goproPreviewDuration')}
            </label>
            <span className="font-mono">
              {t('flights.goproPreviewMinutes', { count: requestedMinutes })}
            </span>
          </div>
          <input
            id="gopro-preview-duration"
            className="w-full accent-sky-500"
            type="range"
            min={3}
            max={maxMinutes}
            step={1}
            value={Math.min(requestedMinutes, maxMinutes)}
            onChange={(event) =>
              setRequestedMinutes(Number(event.target.value))
            }
          />
          <div className="flex items-center justify-between gap-3 text-xs text-gray-300">
            <span>
              {t('flights.goproPreviewAvailable', {
                count: availableMinutes,
              })}
            </span>
            <button
              type="button"
              className="cursor-pointer rounded-md bg-sky-600 px-3 py-2 font-medium text-white transition-colors hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={
                isGenerating ||
                generatePreview.isPending ||
                requestedMinutes <= availableMinutes ||
                (requestedDurationCoversSource &&
                  preview.data?.video.preview_status === 'ready')
              }
              onClick={() => void handleGeneratePreview()}
            >
              {isGenerating || generatePreview.isPending
                ? t('flights.goproPreviewGenerating')
                : t('flights.goproPreviewGenerate', {
                    count: requestedMinutes,
                  })}
            </button>
          </div>
          {isGenerating && (
            <p className="text-xs text-amber-200">
              {t('flights.goproPreviewGeneratingNotice')}
            </p>
          )}
          {(preview.data?.video.preview_status === 'failed' ||
            generatePreview.isError) && (
            <p role="alert" className="text-xs text-amber-300">
              {t('flights.goproPreviewFallback')}
            </p>
          )}
        </div>
      </div>

      <div className="space-y-3 text-gray-900 dark:text-gray-100">
        <div className="rounded-lg border border-sky-200 bg-sky-50 p-3 dark:border-sky-900 dark:bg-sky-950/30">
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="flex items-center gap-2 font-medium">
              <TimerReset className="h-4 w-4" aria-hidden="true" />
              {t('flights.goproOverlayEffectiveOffset')}
            </span>
            <span className="font-mono font-semibold">
              {(automaticOffset + manualOffset).toFixed(1)} s
            </span>
          </div>
          <div className="mt-1 text-xs text-gray-600 dark:text-gray-300">
            {t('flights.goproOverlayAutomaticOffset', {
              offset: automaticOffset.toFixed(1),
            })}
          </div>
        </div>
        <div className="grid grid-cols-4 gap-2">
          {[-1, -0.1, 0.1, 1].map((delta) => (
            <button
              key={delta}
              type="button"
              onClick={() => adjustOffset(delta)}
              className="min-h-10 cursor-pointer rounded-lg border border-gray-300 bg-white px-2 font-mono text-sm font-medium transition-colors hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 dark:border-gray-600 dark:bg-gray-900 dark:hover:bg-gray-800"
              aria-label={t('flights.goproOverlayAdjustOffset', {
                offset: delta,
              })}
            >
              {delta > 0 ? '+' : ''}
              {delta} s
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={alignGpxStartAtCurrentVideoTime}
          className="min-h-10 w-full cursor-pointer rounded-lg border border-sky-300 bg-sky-50 px-3 py-2 text-sm font-medium text-sky-800 transition-colors hover:bg-sky-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 dark:border-sky-800 dark:bg-sky-950/30 dark:text-sky-200 dark:hover:bg-sky-950/50"
        >
          {t('flights.goproOverlayAlignGpxStart')}
        </button>
      </div>
    </div>
  );
}
