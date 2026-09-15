import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Columns2,
  Pause,
  PictureInPicture2,
  Play,
  Repeat2,
} from 'lucide-react';

export type FlightOverlayLayout =
  | 'camera-main'
  | 'flight-main'
  | 'side-by-side';

interface FlightOverlayPlayerProps {
  mode: 'calibration' | 'interactive';
  cameraUrl: string;
  flightUrl: string;
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
}: FlightOverlayPlayerProps) {
  const { t } = useTranslation();
  const cameraRef = useRef<HTMLVideoElement>(null);
  const flightRef = useRef<HTMLVideoElement>(null);
  const overlayRef = useRef<HTMLVideoElement>(null);
  const [layout, setLayout] = useState<FlightOverlayLayout>('camera-main');
  const [cameraCurrentTime, setCameraCurrentTime] = useState(0);
  const [cameraDuration, setCameraDuration] = useState(0);
  const [cameraIsPlaying, setCameraIsPlaying] = useState(false);

  useEffect(() => {
    if (!seekRequest || !cameraRef.current) {
      return;
    }
    cameraRef.current.currentTime = seekRequest.time;
  }, [seekRequest]);

  const syncMedia = () => {
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
    onTimeChange?.(currentTime);
  };

  const handlePlay = () => {
    setCameraIsPlaying(true);
    syncMedia();
    void flightRef.current?.play();
    void overlayRef.current?.play();
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
      void overlayRef.current?.play();
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

  const cameraIsMain = layout === 'camera-main';
  const flightIsMain = layout === 'flight-main';
  const isInteractive = mode === 'interactive';

  return (
    <div className="overflow-hidden rounded-xl bg-black shadow-sm">
      <div
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
          }}
          onTimeUpdate={() => {
            syncMedia();
            setCameraCurrentTime(cameraRef.current?.currentTime ?? 0);
          }}
          onSeeked={syncMedia}
          className={
            cameraIsMain || layout === 'side-by-side'
              ? 'aspect-video w-full object-contain'
              : 'absolute bottom-3 right-3 z-20 aspect-video w-1/3 cursor-pointer rounded-lg border-2 border-white/80 object-cover shadow-xl transition-[width] duration-200 hover:border-sky-300'
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
        {isInteractive && (
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
                : 'absolute bottom-3 right-3 z-10 aspect-video w-1/3 cursor-pointer rounded-lg border-2 border-white/80 object-cover shadow-xl transition-[width] duration-200 hover:border-sky-300'
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
            preload="auto"
            onLoadedMetadata={handleOverlayReady}
            onCanPlay={handleOverlayReady}
            muted
            className="pointer-events-none absolute inset-0 z-[15] h-full w-full object-contain"
            aria-label={t('flights.overlayLayerReady')}
          >
            <track kind="captions" />
          </video>
        )}
        {isInteractive && layout !== 'side-by-side' && (
          <button
            type="button"
            onClick={() =>
              setLayout((current) =>
                current === 'camera-main' ? 'flight-main' : 'camera-main'
              )
            }
            className="absolute bottom-3 left-3 z-20 flex cursor-pointer items-center gap-1.5 rounded-md bg-slate-950/80 px-2.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
            aria-label={t('flights.goproOverlaySwapVideos', {
              name: cameraIsMain ? flightLabel : cameraLabel,
            })}
          >
            <Repeat2 className="h-3.5 w-3.5" aria-hidden="true" />
            {cameraIsMain ? flightLabel : cameraLabel}
          </button>
        )}
        {overlayContent && (
          <div className="pointer-events-none absolute left-3 top-3 z-30">
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
      </div>
      {isInteractive && (
        <div className="flex items-center gap-3 border-t border-gray-800 bg-gray-950 px-3 py-2">
          <button
            type="button"
            onClick={handleTogglePlay}
            className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-md text-gray-200 hover:bg-gray-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
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
            className="min-w-0 flex-1 cursor-pointer accent-sky-500 disabled:cursor-not-allowed disabled:opacity-50"
            aria-label={t('flights.goproOverlayTimeline')}
          />
          <span className="shrink-0 font-mono text-xs text-gray-300">
            {Math.floor(cameraCurrentTime / 60)}:
            {Math.floor(cameraCurrentTime % 60)
              .toString()
              .padStart(2, '0')}{' '}
            / {Math.floor(cameraDuration / 60)}:
            {Math.floor(cameraDuration % 60)
              .toString()
              .padStart(2, '0')}
          </span>
        </div>
      )}
      {isInteractive && (
        <div className="flex flex-wrap items-center gap-2 border-t border-gray-800 bg-gray-950 px-3 py-2">
          <span className="mr-auto text-xs font-medium text-gray-300">
            {t('flights.goproOverlayLayoutLabel')}
          </span>
          <button
            type="button"
            onClick={() => setLayout('camera-main')}
            className="flex cursor-pointer items-center gap-1 rounded-md px-2 py-1.5 text-xs font-medium text-gray-300 hover:bg-gray-800"
          >
            <PictureInPicture2 className="h-3.5 w-3.5" aria-hidden="true" />
            {cameraLabel}
          </button>
          <button
            type="button"
            onClick={() => setLayout('flight-main')}
            className="flex cursor-pointer items-center gap-1 rounded-md px-2 py-1.5 text-xs font-medium text-gray-300 hover:bg-gray-800"
          >
            <PictureInPicture2 className="h-3.5 w-3.5" aria-hidden="true" />
            {flightLabel}
          </button>
          <button
            type="button"
            onClick={() => setLayout('side-by-side')}
            className="flex cursor-pointer items-center gap-1 rounded-md px-2 py-1.5 text-xs font-medium text-gray-300 hover:bg-gray-800"
          >
            <Columns2 className="h-3.5 w-3.5" aria-hidden="true" />
            {t('flights.goproOverlaySideBySide')}
          </button>
        </div>
      )}
    </div>
  );
}
