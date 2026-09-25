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
import { useFlightTelemetry } from '../../../hooks/flights/useFlightTelemetry';
import type { GeoPoint } from '../../../types/flight';
import {
  telemetryAtTimestamp,
  telemetryTimestampAtVideoTime,
} from './goproSyncTelemetry';
import type { GoproOverlayPreview } from '../../../hooks/gopro/useGoproOverlay';
import { getYoutubeVideoId } from '../../../lib/youtube';

interface YoutubePlayer {
  destroy: () => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
}
interface YoutubeApi {
  Player: new (
    element: HTMLElement,
    options: Record<string, unknown>
  ) => YoutubePlayer;
}
let youtubeApiPromise: Promise<YoutubeApi> | null = null;
function loadYoutubeApi(): Promise<YoutubeApi> {
  if (window.YT) return Promise.resolve(window.YT);
  if (youtubeApiPromise) return youtubeApiPromise;
  youtubeApiPromise = new Promise<YoutubeApi>((resolve, reject) => {
    const existingScript = document.querySelector<HTMLScriptElement>(
      'script[src="https://www.youtube.com/iframe_api"]'
    );
    const previousCallback = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previousCallback?.();
      if (window.YT) resolve(window.YT);
      else reject(new Error('YouTube API did not initialize'));
    };
    if (!existingScript) {
      const script = document.createElement('script');
      script.src = 'https://www.youtube.com/iframe_api';
      script.async = true;
      script.onerror = () => reject(new Error('YouTube API failed to load'));
      document.head.appendChild(script);
    }
  });
  return youtubeApiPromise;
}
declare global {
  interface Window {
    YT?: YoutubeApi;
    onYouTubeIframeAPIReady?: () => void;
  }
}

interface GoproOverlaySyncPreviewProps {
  flightId: string;
  offset: string;
  onOffsetChange: (offset: string) => void;
  onOffsetSave: (offset: string) => Promise<void>;
  youtubeUrls?: string[];
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

export function calibrationTelemetryTimestampAtVideoTime(
  gpxStartTimestamp: number,
  sourceVideoTime: number,
  automaticOffset: number,
  manualOffset: number
) {
  // PROTECTED CALIBRATION SYNC CONTRACT — see the root AGENTS.md. Changes
  // require explicit user authorization in the current task.
  return telemetryTimestampAtVideoTime(
    gpxStartTimestamp,
    sourceVideoTime,
    automaticOffset + manualOffset
  );
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
  youtubeUrls = [],
}: GoproOverlaySyncPreviewProps) {
  const { t } = useTranslation();
  const token = useAuthStore((state) => state.token);
  const queryClient = useQueryClient();
  const youtubeId = youtubeUrls.map(getYoutubeVideoId).find(Boolean) ?? null;
  const isYoutubeCalibration = Boolean(youtubeId);
  // Keep the preview query enabled for YouTube calibration: when the durable
  // enriched GPX is missing, the backend uses this request to start its
  // generation and then polls until it is ready.
  const preview = useGoproOverlayPreview(flightId, true);
  const flightTelemetry = useFlightTelemetry(flightId, isYoutubeCalibration);
  const generatePreview = useGenerateGoproPreview(flightId);
  const generateMerge = useGenerateGoproMerge(flightId);
  const automaticallyRequestedTarget = useRef<string | null>(null);
  const [videoTime, setVideoTime] = useState(0);
  const cameraRef = useRef<HTMLVideoElement>(null);
  const [youtubeHostElement, setYoutubeHostElement] =
    useState<HTMLDivElement | null>(null);
  const youtubeRef = useRef<YoutubePlayer | null>(null);
  const [youtubeReady, setYoutubeReady] = useState(false);
  const [youtubeFailed, setYoutubeFailed] = useState(false);
  const [youtubeDuration, setYoutubeDuration] = useState(0);
  const [requestedMinutes, setRequestedMinutes] = useState(3);
  const [alignmentTarget, setAlignmentTarget] =
    useState<GpxAlignmentTarget>('start');
  const parsedOffset = Number(offset);
  const manualOffset = Number.isFinite(parsedOffset) ? parsedOffset : 0;
  const [displayOffset, setDisplayOffset] = useState(manualOffset);
  const automaticOffset = isYoutubeCalibration
    ? 0
    : (preview.data?.alignment.automatic_offset_seconds ?? 0);
  const gpxDuration = isYoutubeCalibration
    ? (flightTelemetry.data?.duration_seconds ?? 0)
    : (preview.data?.gpx.duration_seconds ?? 0);
  const previewSegments = isYoutubeCalibration
    ? youtubeDuration > 0
      ? [
          {
            preview_start_seconds: 0,
            source_start_seconds: 0,
            duration_seconds: youtubeDuration,
          },
        ]
      : []
    : (preview.data?.video.preview_segments ?? []);
  const sourceVideoTime = youtubeId
    ? videoTime
    : sourceTimeAtPreviewTime(videoTime, previewSegments);
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

  const gpxCoordinates: GeoPoint[] = isYoutubeCalibration
    ? (flightTelemetry.data?.points ?? []).map(
        ({ speed_kmh, heart_rate, ...point }): GeoPoint => {
          const normalizedPoint: GeoPoint = {
            lat: point.lat,
            lon: point.lon,
            elevation: point.elevation,
            timestamp: point.timestamp,
            segment: point.segment,
          };
          if (speed_kmh != null) normalizedPoint.speed_kmh = speed_kmh;
          if (heart_rate != null) normalizedPoint.heart_rate = heart_rate;
          return normalizedPoint;
        }
      )
    : (preview.data?.gpx.coordinates ?? []);
  const gpxStartTimestamp = isYoutubeCalibration
    ? (gpxCoordinates[0]?.timestamp ??
      (flightTelemetry.data?.start_time
        ? parseApiUtcDate(flightTelemetry.data.start_time).getTime()
        : 0))
    : preview.data
      ? (preview.data.gpx.coordinates[0]?.timestamp ??
        parseApiUtcDate(preview.data.gpx.start_time).getTime())
      : 0;
  const telemetry = gpxCoordinates.length
    ? telemetryAtTimestamp(
        gpxCoordinates,
        calibrationTelemetryTimestampAtVideoTime(
          gpxStartTimestamp,
          sourceVideoTime,
          automaticOffset,
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
  const isEnrichmentFailed =
    flightTelemetry.data?.enrichment_status === 'failed' ||
    preview.data?.gpx?.enrichment_status === 'failed';
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
    if (youtubeId && !youtubeFailed) {
      youtubeRef.current?.seekTo(time, true);
    } else if (cameraRef.current) {
      cameraRef.current.currentTime = time;
    }
    setVideoTime(time);
  };

  useEffect(() => {
    if (!youtubeId || youtubeFailed || !youtubeHostElement) return;
    let cancelled = false;
    void loadYoutubeApi()
      .then((api) => {
        if (cancelled || !youtubeHostElement) return;
        const host = document.createElement('div');
        youtubeHostElement.replaceChildren(host);
        youtubeRef.current = new api.Player(host, {
          height: '100%',
          width: '100%',
          videoId: youtubeId,
          playerVars: {
            controls: 1,
            playsinline: 1,
            origin: window.location.origin,
          },
          events: {
            onReady: () => {
              setYoutubeReady(true);
              setYoutubeDuration(youtubeRef.current?.getDuration() ?? 0);
            },
            onError: () => {
              setYoutubeReady(false);
              setYoutubeFailed(true);
            },
          },
        });
      })
      .catch(() => {
        setYoutubeReady(false);
        setYoutubeFailed(true);
      });
    return () => {
      cancelled = true;
      youtubeRef.current?.destroy();
      youtubeRef.current = null;
      setYoutubeReady(false);
    };
  }, [
    preview.data?.video.preview_status,
    youtubeFailed,
    youtubeHostElement,
    youtubeId,
  ]);

  useEffect(() => {
    if (!youtubeId || !youtubeReady) return;
    let frame = 0;
    const update = () => {
      setVideoTime(youtubeRef.current?.getCurrentTime() ?? 0);
      frame = requestAnimationFrame(update);
    };
    frame = requestAnimationFrame(update);
    return () => cancelAnimationFrame(frame);
  }, [youtubeId, youtubeReady]);

  const selectAlignmentTarget = (target: GpxAlignmentTarget) => {
    setAlignmentTarget(target);
    seekToPreviewBoundary(
      target === 'start'
        ? 0
        : youtubeId && youtubeDuration > 0
          ? youtubeDuration
          : endPreviewStartTime
    );
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

  const isYoutubeTelemetryPending =
    isYoutubeCalibration &&
    (flightTelemetry.isPending ||
      (flightTelemetry.data?.has_osv === true &&
        (flightTelemetry.data.enrichment_status === 'missing' ||
          flightTelemetry.data.enrichment_status === 'pending')));
  if (isEnrichmentFailed) {
    return (
      <div
        role="alert"
        className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200"
      >
        <p className="mb-3">{t('flights.goproOverlayEnrichmentFailed')}</p>
        <button
          type="button"
          className="rounded-md bg-sky-600 px-3 py-2 font-medium text-white transition-colors hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={generateMerge.isPending}
          onClick={() => void generateMerge.mutateAsync()}
        >
          {generateMerge.isPending
            ? t('flights.goproOverlayMergeGenerating')
            : t('flights.goproOverlayEnrichmentRetry')}
        </button>
        {generateMerge.isError && (
          <p className="mt-3">{t('flights.goproOverlayPreviewError')}</p>
        )}
      </div>
    );
  }
  if (
    isYoutubeTelemetryPending ||
    (!isYoutubeCalibration &&
      (preview.isPending || preview.data?.gpx?.enrichment_status === 'pending'))
  ) {
    return (
      <div className="rounded-xl border border-gray-200 bg-gray-50 p-6 text-center text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300">
        {t('flights.goproOverlayEnrichmentPending')}
      </div>
    );
  }

  if (!isYoutubeCalibration && isMergeMissing) {
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

  if (isYoutubeCalibration ? flightTelemetry.isError : preview.isError) {
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
          {youtubeId && !youtubeFailed ? (
            <div
              className="aspect-video w-full"
              aria-label={t('flights.goproOverlayCameraPreview')}
            >
              <div ref={setYoutubeHostElement} className="h-full w-full" />
            </div>
          ) : (
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
              onSeeked={(event) =>
                setVideoTime(event.currentTarget.currentTime)
              }
              onLoadedMetadata={(event) => {
                event.currentTarget.currentTime = Math.min(
                  videoTime,
                  event.currentTarget.duration || videoTime
                );
              }}
            >
              <track kind="captions" />
            </video>
          )}
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
          {!isYoutubeCalibration && (
            <div className="space-y-2 border-t border-gray-800 px-3 py-3 text-gray-100">
              <div className="flex items-center justify-between gap-3 text-xs">
                <label htmlFor="gopro-preview-duration">
                  {t('flights.goproPreviewDuration')}
                </label>
                <span className="font-mono">
                  {t('flights.goproPreviewMinutes', {
                    count: requestedMinutes,
                  })}
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
          )}
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
