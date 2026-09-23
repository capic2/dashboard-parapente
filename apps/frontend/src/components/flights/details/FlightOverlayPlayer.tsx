import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Columns2,
  Maximize2,
  Minimize2,
  Pause,
  PictureInPicture2,
  Play,
  Repeat2,
} from 'lucide-react';
import type { FlightTelemetryPipLayout } from './flightTelemetryLayout';

export type FlightOverlayLayout =
  | 'camera-main'
  | 'flight-main'
  | 'side-by-side';

// The GoPro layout is authored on a 3840x2160 canvas. Keep the interactive
// PiP in that same coordinate system instead of tying it to arbitrary Tailwind
// fractions of the responsive player container.
const GOPRO_TEMPLATE_CANVAS = { width: 3840, height: 2160 };
const GOPRO_TEMPLATE_PIP = {
  left: 20,
  bottom: 20,
  width: 720,
  height: 720,
};

interface FlightOverlayPlayerProps {
  mode: 'calibration' | 'interactive';
  cameraUrl: string;
  flightUrl?: string;
  overlayUrl?: string;
  cameraLabel: string;
  flightLabel: string;
  overlayStatus?: 'missing' | 'generating' | 'ready' | 'failed';
  overlayError?: string | null;
  syncOffsetSeconds?: number;
  getFlightTime?: (cameraTime: number) => number;
  getCameraTime?: (flightTime: number) => number;
  getOverlayTime?: (cameraTime: number) => number;
  onTimeChange?: (time: number) => void;
  seekRequest?: { id: number; time: number } | null;
  overlayContent?: ReactNode;
  pipLayout?: FlightTelemetryPipLayout;
}

function clamp(value: number, maximum: number) {
  return Math.max(
    0,
    Math.min(value, Number.isFinite(maximum) ? maximum : value)
  );
}

export function FlightOverlayPlayer({
  mode,
  cameraUrl,
  flightUrl,
  overlayUrl,
  cameraLabel,
  flightLabel,
  overlayStatus,
  overlayError,
  syncOffsetSeconds = 0,
  getFlightTime,
  getCameraTime,
  getOverlayTime,
  onTimeChange,
  seekRequest,
  overlayContent,
  pipLayout,
}: FlightOverlayPlayerProps) {
  const { t } = useTranslation();
  const cameraRef = useRef<HTMLVideoElement>(null);
  const flightRef = useRef<HTMLVideoElement>(null);
  const overlayRef = useRef<HTMLVideoElement>(null);
  const playerRef = useRef<HTMLDivElement>(null);
  const syncMediaRef = useRef<((notify?: boolean) => void) | null>(null);
  const [layout, setLayout] = useState<FlightOverlayLayout>('camera-main');
  const [cameraCurrentTime, setCameraCurrentTime] = useState(0);
  const [cameraDuration, setCameraDuration] = useState(0);
  const [cameraIsPlaying, setCameraIsPlaying] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    if (!seekRequest || !cameraRef.current) {
      return;
    }
    cameraRef.current.currentTime = seekRequest.time;
  }, [seekRequest]);

  const syncMedia = (notify = true) => {
    const camera = cameraRef.current;
    if (!camera) return;
    const currentTime = camera.currentTime;
    const flight = flightRef.current;
    const flightTime =
      getFlightTime?.(currentTime) ?? currentTime - syncOffsetSeconds;
    if (flight && Math.abs(flight.currentTime - flightTime) > 0.12) {
      flight.currentTime = clamp(flightTime, flight.duration);
    }
    const overlay = overlayRef.current;
    const overlayTime = getOverlayTime?.(currentTime) ?? currentTime;
    if (overlay && Math.abs(overlay.currentTime - overlayTime) > 0.08) {
      overlay.currentTime = clamp(overlayTime, overlay.duration);
    }
    if (!camera.paused && overlay?.paused) {
      // The camera is the master clock. Browsers can leave a secondary muted
      // WebM paused when it finishes loading or after a seek, so retry it on
      // the next synchronization tick instead of letting the layer freeze.
      playMedia(overlay);
    }
    if (notify) {
      onTimeChange?.(currentTime);
    }
  };

  syncMediaRef.current = (notify = false) => syncMedia(notify);

  useEffect(() => {
    // Calibration changes the offset without changing the camera clock. Apply
    // the new mapping immediately so the GPX/video image does not stay at the
    // previous position until the next media event.
    syncMediaRef.current?.();
  }, [syncOffsetSeconds]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(document.fullscreenElement === playerRef.current);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () =>
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  useEffect(() => {
    if (!cameraIsPlaying) return;

    let animationFrame = 0;
    const synchronizePlayback = () => {
      syncMediaRef.current?.(true);
      animationFrame = requestAnimationFrame(synchronizePlayback);
    };

    animationFrame = requestAnimationFrame(synchronizePlayback);
    return () => cancelAnimationFrame(animationFrame);
  }, [cameraIsPlaying]);

  const playMedia = (video: HTMLVideoElement | null) => {
    if (video) {
      // The overlay is muted, but browsers can still reject a secondary
      // play() call. The animation-frame synchronizer keeps it aligned then.
      void video.play().catch(() => undefined);
    }
  };

  const handlePlay = () => {
    setCameraIsPlaying(true);
    syncMedia();
    playMedia(flightRef.current);
    playMedia(overlayRef.current);
  };

  const handlePause = () => {
    setCameraIsPlaying(false);
    flightRef.current?.pause();
    overlayRef.current?.pause();
  };

  const handleOverlayReady = () => {
    syncMedia();
    // The browser preview may finish converting after the camera started.
    // Retry playback at that point so the transparent layer cannot remain
    // silently paused after its source becomes playable.
    if (cameraRef.current && !cameraRef.current.paused) {
      playMedia(overlayRef.current);
    }
  };

  const handleTimelineChange = (time: number) => {
    if (!cameraRef.current) return;
    cameraRef.current.currentTime = time;
    setCameraCurrentTime(time);
    syncMedia();
  };

  const handleTogglePlay = () => {
    if (!cameraRef.current) return;
    if (cameraRef.current.paused) {
      void cameraRef.current.play();
    } else {
      cameraRef.current.pause();
    }
  };

  const handleToggleFullscreen = () => {
    if (!playerRef.current) return;
    if (document.fullscreenElement === playerRef.current) {
      void document.exitFullscreen().catch(() => undefined);
    } else {
      void playerRef.current.requestFullscreen().catch(() => undefined);
    }
  };

  const cameraIsMain = layout === 'camera-main';
  const flightIsMain = layout === 'flight-main';
  const isInteractive = mode === 'interactive';
  const hasFlightVideo = Boolean(flightUrl);
  const pipStyle = pipLayout
    ? {
        left: `${pipLayout.x * 100}%`,
        top: `${pipLayout.y * 100}%`,
        width: `${pipLayout.width * 100}%`,
        height: `${pipLayout.height * 100}%`,
        display: pipLayout.visible ? undefined : 'none',
      }
    : {
        left: `${(GOPRO_TEMPLATE_PIP.left / GOPRO_TEMPLATE_CANVAS.width) * 100}%`,
        bottom: `${(GOPRO_TEMPLATE_PIP.bottom / GOPRO_TEMPLATE_CANVAS.height) * 100}%`,
        width: `${(GOPRO_TEMPLATE_PIP.width / GOPRO_TEMPLATE_CANVAS.width) * 100}%`,
        aspectRatio: `${GOPRO_TEMPLATE_PIP.width} / ${GOPRO_TEMPLATE_PIP.height}`,
      };

  return (
    <div
      ref={playerRef}
      className="group relative overflow-hidden rounded-xl bg-black shadow-sm [&:fullscreen]:flex [&:fullscreen]:flex-col [&:fullscreen]:overflow-y-auto [&:fullscreen]:rounded-none"
    >
      <div
        data-testid="flight-overlay-media-stage"
        className={`relative grid min-h-0 bg-black ${layout === 'side-by-side' ? 'grid-cols-1 md:grid-cols-2' : ''}`}
      >
        <video
          ref={cameraRef}
          src={cameraUrl}
          controls={!isInteractive}
          playsInline
          preload="metadata"
          onPlay={handlePlay}
          onPause={handlePause}
          onLoadedMetadata={() => {
            setCameraDuration(cameraRef.current?.duration ?? 0);
            syncMedia();
          }}
          onTimeUpdate={() => {
            syncMedia();
            setCameraCurrentTime(cameraRef.current?.currentTime ?? 0);
          }}
          onSeeked={() => syncMedia()}
          className={
            cameraIsMain || layout === 'side-by-side'
              ? 'aspect-video w-full object-contain'
              : 'absolute z-20 cursor-pointer rounded-lg border-2 border-white/80 object-cover shadow-xl transition-[width] duration-200 hover:border-sky-300'
          }
          style={
            !cameraIsMain && layout !== 'side-by-side' ? pipStyle : undefined
          }
          onClick={() => {
            if (layout === 'flight-main') setLayout('camera-main');
          }}
          aria-label={cameraLabel}
        >
          <track kind="captions" />
        </video>
        {flightIsMain && getCameraTime && (
          <div className="pointer-events-none absolute inset-0">
            <span className="sr-only">
              {getCameraTime(flightRef.current?.currentTime ?? 0)}
            </span>
          </div>
        )}
        {isInteractive && hasFlightVideo && (
          <video
            ref={flightRef}
            src={flightUrl}
            playsInline
            preload="metadata"
            muted
            onClick={() => {
              if (layout === 'camera-main') setLayout('flight-main');
            }}
            className={
              flightIsMain || layout === 'side-by-side'
                ? 'aspect-video w-full object-contain'
                : 'absolute z-10 cursor-pointer rounded-lg border-2 border-white/80 object-cover shadow-xl transition-[width] duration-200 hover:border-sky-300'
            }
            style={
              !flightIsMain && layout !== 'side-by-side' ? pipStyle : undefined
            }
            aria-label={flightLabel}
          >
            <track kind="captions" />
          </video>
        )}
        {overlayUrl && (
          <video
            ref={overlayRef}
            src={overlayUrl}
            playsInline
            disablePictureInPicture
            disableRemotePlayback
            preload="auto"
            onLoadedMetadata={handleOverlayReady}
            onLoadedData={handleOverlayReady}
            onCanPlay={handleOverlayReady}
            muted
            className="pointer-events-none absolute inset-0 z-[15] h-full w-full object-contain"
            aria-label={t('flights.overlayLayerReady')}
          >
            <track kind="captions" />
          </video>
        )}
        {isInteractive && hasFlightVideo && layout !== 'side-by-side' && (
          <button
            type="button"
            onClick={() =>
              setLayout((current) =>
                current === 'camera-main' ? 'flight-main' : 'camera-main'
              )
            }
            className="absolute right-3 top-3 z-30 flex cursor-pointer items-center gap-1.5 rounded-md bg-slate-950/80 px-2.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
            aria-label={t('flights.goproOverlaySwapVideos', {
              name: cameraIsMain ? flightLabel : cameraLabel,
            })}
          >
            <Repeat2 className="h-3.5 w-3.5" aria-hidden="true" />
            {cameraIsMain ? flightLabel : cameraLabel}
          </button>
        )}
        {overlayContent && (
          <div
            className={`pointer-events-none absolute z-30 ${overlayUrl ? 'left-3 top-3' : 'inset-0'}`}
          >
            {overlayContent}
          </div>
        )}
        {overlayStatus === 'generating' && (
          <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center bg-slate-950/45">
            <span className="rounded-lg bg-slate-950/90 px-4 py-3 text-sm font-semibold text-white">
              {t('flights.goproOverlayGeneratingInteractive')}
            </span>
          </div>
        )}
        {overlayStatus === 'failed' && (
          <div className="pointer-events-none absolute inset-x-4 bottom-4 z-30 rounded-lg bg-red-950/90 px-4 py-3 text-sm text-red-100">
            <p className="font-semibold">
              {t('flights.goproOverlayInteractiveUnavailable')}
            </p>
            {overlayError && <p className="mt-1 text-xs">{overlayError}</p>}
          </div>
        )}
        {isInteractive && (
          <div
            data-testid="flight-overlay-controls"
            className="pointer-events-none absolute inset-x-0 bottom-0 z-40 bg-gradient-to-t from-slate-950 via-slate-950/95 to-slate-950/0 px-3 pb-3 pt-12 text-white opacity-0 transition-opacity duration-200 group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100 [@media(hover:none)]:pointer-events-auto [@media(hover:none)]:opacity-100 sm:px-4 sm:pb-4"
          >
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <button
                type="button"
                onClick={handleTogglePlay}
                className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-md text-gray-100 transition-colors hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
                aria-label={
                  cameraIsPlaying
                    ? t('flights.goproOverlayPause')
                    : t('flights.goproOverlayPlay')
                }
              >
                {cameraIsPlaying ? (
                  <Pause className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <Play className="h-4 w-4" aria-hidden="true" />
                )}
              </button>
              <input
                type="range"
                min={0}
                max={cameraDuration || 0}
                step={0.01}
                value={Math.min(cameraCurrentTime, cameraDuration || 0)}
                onChange={(event) =>
                  handleTimelineChange(Number(event.target.value))
                }
                disabled={!cameraDuration}
                className="min-w-[8rem] flex-1 cursor-pointer accent-sky-500 disabled:cursor-not-allowed disabled:opacity-50"
                aria-label={t('flights.goproOverlayTimeline')}
              />
              <span className="shrink-0 font-mono text-xs text-gray-200">
                {Math.floor(cameraCurrentTime / 60)}:
                {Math.floor(cameraCurrentTime % 60)
                  .toString()
                  .padStart(2, '0')}{' '}
                / {Math.floor(cameraDuration / 60)}:
                {Math.floor(cameraDuration % 60)
                  .toString()
                  .padStart(2, '0')}
              </span>
              <button
                type="button"
                onClick={handleToggleFullscreen}
                className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-md text-gray-100 transition-colors hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
                aria-label={
                  isFullscreen
                    ? t('flights.goproOverlayExitFullscreen')
                    : t('flights.goproOverlayFullscreen')
                }
              >
                {isFullscreen ? (
                  <Minimize2 className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <Maximize2 className="h-4 w-4" aria-hidden="true" />
                )}
              </button>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-1.5 border-t border-white/15 pt-2">
              <span className="mr-auto text-xs font-medium text-gray-200">
                {t('flights.goproOverlayLayoutLabel')}
              </span>
              <button
                type="button"
                onClick={() => setLayout('camera-main')}
                aria-pressed={cameraIsMain}
                className="flex cursor-pointer items-center gap-1 rounded-md px-2 py-1.5 text-xs font-medium text-gray-200 transition-colors hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 aria-pressed:bg-sky-600 aria-pressed:text-white"
              >
                <PictureInPicture2 className="h-3.5 w-3.5" aria-hidden="true" />
                {cameraLabel}
              </button>
              {hasFlightVideo && (
                <>
                  <button
                    type="button"
                    onClick={() => setLayout('flight-main')}
                    aria-pressed={flightIsMain}
                    className="flex cursor-pointer items-center gap-1 rounded-md px-2 py-1.5 text-xs font-medium text-gray-200 transition-colors hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 aria-pressed:bg-sky-600 aria-pressed:text-white"
                  >
                    <PictureInPicture2
                      className="h-3.5 w-3.5"
                      aria-hidden="true"
                    />
                    {flightLabel}
                  </button>
                  <button
                    type="button"
                    onClick={() => setLayout('side-by-side')}
                    aria-pressed={layout === 'side-by-side'}
                    className="flex cursor-pointer items-center gap-1 rounded-md px-2 py-1.5 text-xs font-medium text-gray-200 transition-colors hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 aria-pressed:bg-sky-600 aria-pressed:text-white"
                  >
                    <Columns2 className="h-3.5 w-3.5" aria-hidden="true" />
                    {t('flights.goproOverlaySideBySide')}
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
