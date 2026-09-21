import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Gauge, HeartPulse, MapPin, Mountain, TimerReset } from 'lucide-react';
import {
  useGenerateGoproPreview,
  useGenerateGoproMerge,
  useGoproOverlayPreview,
} from '../../../hooks/gopro/useGoproOverlay';
import { getApiUrlWithSearchParams } from '../../../lib/api';
import { parseApiUtcDate } from '../../../lib/date';
import { useAuthStore } from '../../../stores/authStore';
import {
  telemetryAtTimestamp,
  telemetryTimestampAtVideoTime,
} from './goproSyncTelemetry';
import type { GoproOverlayPreview } from '../../../hooks/gopro/useGoproOverlay';

interface GoproOverlaySyncPreviewProps {
  flightId: string;
  offset: string;
  onOffsetChange: (offset: string) => void;
  onOffsetSave: (offset: string) => Promise<void>;
}

type GpxAlignmentTarget = 'start' | 'end';

function formatSeconds(seconds: number) {
  const sign = seconds < 0 ? '-' : '';
  const absolute = Math.abs(seconds);
  const minutes = Math.floor(absolute / 60);
  const remainingSeconds = absolute - minutes * 60;
  return `${sign}${minutes}:${remainingSeconds.toFixed(1).padStart(4, '0')}`;
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

export function manualOffsetForGpxEndAtVideoTime(
  sourceVideoTime: number,
  automaticOffset: number,
  gpxDuration: number
) {
  return sourceVideoTime - gpxDuration - automaticOffset;
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
  onOffsetSave,
}: GoproOverlaySyncPreviewProps) {
  const { t } = useTranslation();
  const token = useAuthStore((state) => state.token);
  const queryClient = useQueryClient();
  const preview = useGoproOverlayPreview(flightId, true);
  const generatePreview = useGenerateGoproPreview(flightId);
  const generateMerge = useGenerateGoproMerge(flightId);
  const automaticallyRequestedTarget = useRef<string | null>(null);
  const [videoTime, setVideoTime] = useState(0);
  const cameraRef = useRef<HTMLVideoElement>(null);
  const [requestedMinutes, setRequestedMinutes] = useState(3);
  const [alignmentTarget, setAlignmentTarget] =
    useState<GpxAlignmentTarget>('start');
  const parsedOffset = Number(offset);
  const manualOffset = Number.isFinite(parsedOffset) ? parsedOffset : 0;
  const [displayOffset, setDisplayOffset] = useState(manualOffset);
  const automaticOffset = preview.data?.alignment.automatic_offset_seconds ?? 0;
  const gpxDuration = preview.data?.gpx.duration_seconds ?? 0;
  const previewSegments = preview.data?.video.preview_segments ?? [];
  const sourceVideoTime = sourceTimeAtPreviewTime(videoTime, previewSegments);
  const previewEndTime = previewSegments.length
    ? Math.max(
        ...previewSegments.map(
          (segment) => segment.preview_start_seconds + segment.duration_seconds
        )
      )
    : 0;
  const endPreviewStartTime =
    previewSegments.length > 1
      ? previewSegments[previewSegments.length - 1].preview_start_seconds
      : Math.max(
          0,
          previewEndTime -
            Math.min(
              preview.data?.video.preview_available_duration_seconds ||
                preview.data?.video.preview_requested_duration_seconds ||
                180,
              previewEndTime
            )
        );

  useEffect(() => {
    setDisplayOffset(manualOffset);
  }, [manualOffset]);

  const telemetry = preview.data
    ? telemetryAtTimestamp(
        preview.data.gpx.coordinates,
        telemetryTimestampAtVideoTime(
          parseApiUtcDate(preview.data.video.start_time).getTime(),
          sourceVideoTime,
          displayOffset
        )
      )
    : null;
  const heartRate = telemetry?.heart_rate ?? null;
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
  const isMergeMissing = preview.data?.gpx?.enrichment_status === 'missing';
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
    const nextOffset = (displayOffset + delta).toFixed(1);
    setDisplayOffset(Number(nextOffset));
    onOffsetChange(nextOffset);
  };

  const seekToPreviewBoundary = (time: number) => {
    if (cameraRef.current) {
      cameraRef.current.currentTime = time;
    }
    setVideoTime(time);
  };

  const selectAlignmentTarget = (target: GpxAlignmentTarget) => {
    setAlignmentTarget(target);
    seekToPreviewBoundary(target === 'start' ? 0 : endPreviewStartTime);
  };

  const alignGpxAtCurrentVideoTime = async () => {
    const nextOffset = (
      alignmentTarget === 'start'
        ? manualOffsetForGpxStartAtVideoTime(sourceVideoTime, automaticOffset)
        : manualOffsetForGpxEndAtVideoTime(
            sourceVideoTime,
            automaticOffset,
            gpxDuration
          )
    ).toFixed(1);
    setDisplayOffset(Number(nextOffset));
    onOffsetChange(nextOffset);
    await onOffsetSave(nextOffset);
  };

  if (preview.isPending || preview.data?.gpx?.enrichment_status === 'pending') {
    return (
      <div className="rounded-xl border border-gray-200 bg-gray-50 p-6 text-center text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300">
        {t('flights.goproOverlayPreviewLoading')}
      </div>
    );
  }

  if (isMergeMissing) {
    return (
      <div className="rounded-xl border border-gray-200 bg-gray-50 p-6 text-center text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300">
        <p className="mb-3">{t('flights.goproOverlayMergeRequired')}</p>
        <button
          type="button"
          className="rounded-md bg-sky-600 px-3 py-2 font-medium text-white transition-colors hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={generateMerge.isPending}
          onClick={() => void generateMerge.mutateAsync()}
        >
          {generateMerge.isPending
            ? t('flights.goproOverlayMergeGenerating')
            : t('flights.goproOverlayMergeGenerate')}
        </button>
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
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(17rem,1fr)]">
      <div>
        <div className="overflow-hidden rounded-xl bg-black shadow-sm">
          <video
            ref={cameraRef}
            src={videoUrl}
            controls
            playsInline
            preload="metadata"
            className="aspect-video w-full"
            aria-label={t('flights.goproOverlayCameraPreview')}
            onTimeUpdate={(event) =>
              setVideoTime(event.currentTarget.currentTime)
            }
            onSeeked={(event) => setVideoTime(event.currentTarget.currentTime)}
            onLoadedMetadata={(event) => {
              event.currentTarget.currentTime = Math.min(
                videoTime,
                event.currentTarget.duration || videoTime
              );
            }}
          >
            <track kind="captions" />
          </video>
          <div className="flex items-center justify-between px-3 py-2 font-mono text-xs text-gray-200">
            <span>{t('flights.goproOverlayVideoTime')}</span>
            <span>{formatSeconds(sourceVideoTime)}</span>
          </div>
          {previewSegments.length > 1 && (
            <div className="grid grid-cols-2 border-t border-gray-800 text-center text-xs font-medium text-gray-400">
              <button
                type="button"
                onClick={() => seekToPreviewBoundary(0)}
                aria-pressed={videoTime <= 0.05}
                className={`cursor-pointer px-3 py-2 transition-colors hover:bg-gray-900 hover:text-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sky-500 ${videoTime <= 0.05 ? 'bg-sky-950 text-sky-200' : ''}`}
              >
                {t('flights.goproPreviewStart')}
              </button>
              <button
                type="button"
                onClick={() => seekToPreviewBoundary(endPreviewStartTime)}
                aria-pressed={
                  endPreviewStartTime > 0 &&
                  videoTime >= endPreviewStartTime - 0.05
                }
                disabled={previewEndTime <= 0}
                className={`cursor-pointer border-l border-gray-800 px-3 py-2 transition-colors hover:bg-gray-900 hover:text-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sky-500 disabled:cursor-not-allowed disabled:opacity-50 ${endPreviewStartTime > 0 && videoTime >= endPreviewStartTime - 0.05 ? 'bg-sky-950 text-sky-200' : ''}`}
              >
                {t('flights.goproPreviewEnd')}
              </button>
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
      </div>

      <div className="space-y-3 text-gray-900 dark:text-gray-100">
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-900">
            <Mountain
              className="mb-2 h-4 w-4 text-sky-600"
              aria-hidden="true"
            />
            <div className="text-xs text-gray-500 dark:text-gray-400">
              {t('flights.altitude')}
            </div>
            <div className="font-mono text-lg font-semibold">
              {telemetry
                ? `${Math.round(telemetry.elevation)} m`
                : t('flights.goproOverlayTelemetryUnavailable')}
            </div>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-900">
            <Gauge className="mb-2 h-4 w-4 text-rose-600" aria-hidden="true" />
            <div className="text-xs text-gray-500 dark:text-gray-400">
              {t('flights.speed')}
            </div>
            <div className="font-mono text-lg font-semibold">
              {telemetry
                ? `${telemetry.speedKmh.toFixed(1)} km/h`
                : t('flights.goproOverlayTelemetryUnavailable')}
            </div>
          </div>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-900">
          <HeartPulse
            className="mb-2 h-4 w-4 text-emerald-600"
            aria-hidden="true"
          />
          <div className="text-xs text-gray-500 dark:text-gray-400">
            {t('flights.goproOverlayHeartRate')}
          </div>
          <div className="font-mono text-lg font-semibold">
            {heartRate === null
              ? t('flights.goproOverlayHeartRateUnavailable')
              : `${heartRate} bpm`}
          </div>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-900">
          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
            <MapPin className="h-4 w-4" aria-hidden="true" />
            {t('flights.goproOverlayGpxPosition')}
          </div>
          <div className="mt-1 font-mono text-sm">
            {telemetry
              ? `${telemetry.lat.toFixed(5)}, ${telemetry.lon.toFixed(5)}`
              : t('flights.goproOverlayTelemetryUnavailable')}
          </div>
        </div>
        <div className="rounded-lg border border-sky-200 bg-sky-50 p-3 dark:border-sky-900 dark:bg-sky-950/30">
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="flex items-center gap-2 font-medium">
              <TimerReset className="h-4 w-4" aria-hidden="true" />
              {t('flights.goproOverlayEffectiveOffset')}
            </span>
            <span className="font-mono font-semibold">
              {(automaticOffset + displayOffset).toFixed(1)} s
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
        <fieldset className="space-y-2">
          <legend className="text-xs font-medium text-gray-500 dark:text-gray-400">
            {t('flights.goproOverlayAlignmentTargetLabel')}
          </legend>
          <div className="grid grid-cols-2 overflow-hidden rounded-lg border border-gray-300 dark:border-gray-600">
            {(['start', 'end'] as const).map((target) => (
              <button
                key={target}
                type="button"
                onClick={() => selectAlignmentTarget(target)}
                disabled={target === 'end' && previewEndTime <= 0}
                aria-pressed={alignmentTarget === target}
                className={`min-h-10 cursor-pointer px-2 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sky-500 disabled:cursor-not-allowed disabled:opacity-50 ${target === 'end' ? 'border-l border-gray-300 dark:border-gray-600' : ''} ${alignmentTarget === target ? 'bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-100' : 'bg-white text-gray-700 hover:bg-gray-100 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800'}`}
              >
                {t(
                  target === 'start'
                    ? 'flights.goproOverlayAlignmentTargetStart'
                    : 'flights.goproOverlayAlignmentTargetEnd'
                )}
              </button>
            ))}
          </div>
        </fieldset>
        <button
          type="button"
          onClick={() => void alignGpxAtCurrentVideoTime()}
          className="min-h-10 w-full cursor-pointer rounded-lg border border-sky-300 bg-sky-50 px-3 py-2 text-sm font-medium text-sky-800 transition-colors hover:bg-sky-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 dark:border-sky-800 dark:bg-sky-950/30 dark:text-sky-200 dark:hover:bg-sky-950/50"
        >
          {t(
            alignmentTarget === 'start'
              ? 'flights.goproOverlayAlignGpxStart'
              : 'flights.goproOverlayAlignGpxEnd'
          )}
        </button>
      </div>
    </div>
  );
}
