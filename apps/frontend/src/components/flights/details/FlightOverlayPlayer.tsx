import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { useTranslation } from 'react-i18next';
import {
  DefaultVideoLayout,
  defaultLayoutIcons,
} from '@vidstack/react/player/layouts/default';
import {
  MediaPlayer,
  MediaProvider,
  type MediaPlayerInstance,
} from '@vidstack/react';
// oxlint-disable-next-line import/no-unassigned-import
import '@vidstack/react/player/styles/default/theme.css';
// oxlint-disable-next-line import/no-unassigned-import
import '@vidstack/react/player/styles/default/layouts/video.css';
import {
  Columns2,
  Maximize,
  Minimize,
  PictureInPicture2,
  Repeat2,
} from 'lucide-react';

export type FlightOverlayLayout =
  | 'camera-main'
  | 'flight-main'
  | 'side-by-side';

interface FlightOverlayPlayerProps {
  cameraUrl: string;
  flightUrl: string;
  cameraLabel: string;
  flightLabel: string;
  overlayUrl?: string;
  syncOffsetSeconds?: number;
  getFlightTime?: (cameraTime: number) => number;
  getOverlayTime?: (cameraTime: number) => number;
  onTimeChange?: (time: number) => void;
  overlayContent?: ReactNode;
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.max(minimum, Math.min(maximum, value));
}

export function FlightOverlayPlayer({
  cameraUrl,
  flightUrl,
  cameraLabel,
  flightLabel,
  overlayUrl,
  syncOffsetSeconds = 0,
  getFlightTime,
  getOverlayTime,
  onTimeChange,
  overlayContent,
}: FlightOverlayPlayerProps) {
  const { t } = useTranslation();
  const playerRef = useRef<MediaPlayerInstance>(null);
  const flightRef = useRef<HTMLVideoElement>(null);
  const overlayRef = useRef<HTMLVideoElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState<FlightOverlayLayout>('camera-main');
  const [flightReady, setFlightReady] = useState(false);
  const [overlayReady, setOverlayReady] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const syncFlight = useCallback(
    (cameraTime: number) => {
      const flight = flightRef.current;
      if (!flight || !flightReady) return;
      const target = clamp(
        getFlightTime?.(cameraTime) ?? cameraTime - syncOffsetSeconds,
        0,
        Number.isFinite(flight.duration) ? flight.duration : cameraTime
      );
      if (Math.abs(flight.currentTime - target) > 0.12) {
        flight.currentTime = target;
      }
    },
    [flightReady, getFlightTime, syncOffsetSeconds]
  );

  const syncOverlay = useCallback(
    (cameraTime: number) => {
      const overlay = overlayRef.current;
      if (!overlay || !overlayReady) return;
      const target = clamp(
        getOverlayTime?.(cameraTime) ?? cameraTime,
        0,
        Number.isFinite(overlay.duration) ? overlay.duration : cameraTime
      );
      if (Math.abs(overlay.currentTime - target) > 0.08) {
        overlay.currentTime = target;
      }
    },
    [getOverlayTime, overlayReady]
  );

  useEffect(() => {
    syncFlight(playerRef.current?.state.currentTime ?? 0);
    syncOverlay(playerRef.current?.state.currentTime ?? 0);
  }, [syncFlight, syncOverlay]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(document.fullscreenElement === frameRef.current);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () =>
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const toggleFullscreen = () => {
    if (document.fullscreenElement === frameRef.current) {
      void document.exitFullscreen();
      return;
    }
    void frameRef.current?.requestFullscreen();
  };

  const handleTimeUpdate = () => {
    const time = playerRef.current?.state.currentTime ?? 0;
    syncFlight(time);
    syncOverlay(time);
    onTimeChange?.(time);
  };

  const handlePlay = () => {
    syncFlight(playerRef.current?.state.currentTime ?? 0);
    void flightRef.current?.play();
    void overlayRef.current?.play();
  };

  const handlePause = () => {
    flightRef.current?.pause();
    overlayRef.current?.pause();
  };

  const handleSeek = () => {
    syncFlight(playerRef.current?.state.currentTime ?? 0);
    syncOverlay(playerRef.current?.state.currentTime ?? 0);
  };

  const cameraIsMain = layout === 'camera-main';
  const flightIsMain = layout === 'flight-main';
  const pipClassName =
    'absolute bottom-3 left-3 z-30 aspect-video w-1/3 cursor-pointer rounded-lg border-2 border-white/80 bg-black shadow-xl transition-[width] duration-200 hover:border-sky-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400';

  const switchTo = (nextLayout: FlightOverlayLayout) => {
    setLayout(nextLayout);
  };

  const handlePipKeyDown = (
    event: KeyboardEvent<HTMLDivElement>,
    nextLayout: FlightOverlayLayout
  ) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      switchTo(nextLayout);
    }
  };

  return (
    <div className="overflow-hidden rounded-xl bg-black shadow-sm">
      <div
        ref={frameRef}
        className={`relative grid min-h-0 bg-black ${
          layout === 'side-by-side' ? 'grid-cols-1 md:grid-cols-2' : ''
        } [&:fullscreen]:h-screen [&:fullscreen]:w-screen [&:fullscreen]:content-center [&:fullscreen]:items-center [&:fullscreen]:p-4`}
      >
        {/* oxlint-disable-next-line jsx-a11y/no-static-element-interactions */}
        <div
          // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role
          role={
            !cameraIsMain && !layout.includes('side') ? 'button' : undefined
          }
          tabIndex={!cameraIsMain && !layout.includes('side') ? 0 : undefined}
          aria-label={
            !cameraIsMain && !layout.includes('side')
              ? t('flights.goproOverlaySwapVideos', { name: cameraLabel })
              : undefined
          }
          className={
            cameraIsMain || layout === 'side-by-side'
              ? 'aspect-video w-full'
              : pipClassName
          }
          onClick={() => {
            if (flightIsMain) switchTo('camera-main');
          }}
          onKeyDown={(event) => {
            if (flightIsMain) handlePipKeyDown(event, 'camera-main');
          }}
        >
          <MediaPlayer
            ref={playerRef}
            src={cameraUrl}
            playsInline
            preload="metadata"
            onTimeUpdate={handleTimeUpdate}
            onPlay={handlePlay}
            onPause={handlePause}
            onSeeked={handleSeek}
            className="h-full w-full [&_[data-media-provider]]:rounded-md"
            aria-label={cameraLabel}
          >
            <MediaProvider />
            <DefaultVideoLayout icons={defaultLayoutIcons} />
          </MediaPlayer>
          {!cameraIsMain && flightIsMain && (
            <span className="pointer-events-none absolute bottom-2 left-2 rounded bg-slate-950/85 px-2 py-1 text-[10px] font-semibold text-white">
              {cameraLabel}
            </span>
          )}
        </div>

        {/* oxlint-disable-next-line jsx-a11y/no-static-element-interactions */}
        <div
          // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role
          role={cameraIsMain ? 'button' : undefined}
          tabIndex={cameraIsMain ? 0 : undefined}
          aria-label={
            cameraIsMain
              ? t('flights.goproOverlaySwapVideos', { name: flightLabel })
              : undefined
          }
          className={
            flightIsMain || layout === 'side-by-side'
              ? 'aspect-video w-full'
              : pipClassName
          }
          onClick={() => {
            if (cameraIsMain) switchTo('flight-main');
          }}
          onKeyDown={(event) => {
            if (cameraIsMain) handlePipKeyDown(event, 'flight-main');
          }}
        >
          <video
            ref={flightRef}
            src={flightUrl}
            playsInline
            preload="metadata"
            muted
            onLoadStart={() => setFlightReady(false)}
            onLoadedMetadata={() => setFlightReady(true)}
            className="h-full w-full rounded-md object-contain"
            aria-label={flightLabel}
          />
          {cameraIsMain && (
            <span className="pointer-events-none absolute bottom-2 left-2 rounded bg-slate-950/85 px-2 py-1 text-[10px] font-semibold text-white">
              {flightLabel}
            </span>
          )}
        </div>

        {layout !== 'side-by-side' && (
          <button
            type="button"
            onClick={() =>
              setLayout((current) =>
                current === 'camera-main' ? 'flight-main' : 'camera-main'
              )
            }
            className="absolute bottom-3 right-3 z-20 flex cursor-pointer items-center gap-1.5 rounded-md bg-slate-950/80 px-2.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
            aria-label={t('flights.goproOverlaySwapVideos', {
              name: cameraIsMain ? flightLabel : cameraLabel,
            })}
          >
            <Repeat2 className="h-3.5 w-3.5" aria-hidden="true" />
            {cameraIsMain ? flightLabel : cameraLabel}
          </button>
        )}
        {overlayContent && (
          <div className="pointer-events-none absolute inset-0 z-30">
            {overlayContent}
          </div>
        )}
        {overlayUrl && (
          <video
            ref={overlayRef}
            src={overlayUrl}
            playsInline
            muted
            preload="metadata"
            onLoadStart={() => setOverlayReady(false)}
            onLoadedMetadata={() => setOverlayReady(true)}
            className="pointer-events-none absolute inset-0 z-10 h-full w-full object-fill"
            aria-hidden="true"
          />
        )}
        <button
          type="button"
          onClick={toggleFullscreen}
          className="absolute right-3 top-3 z-40 flex h-9 w-9 cursor-pointer items-center justify-center rounded-md bg-slate-950/80 text-white transition-colors hover:bg-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
          aria-label={t('flights.viewer.fullscreen')}
          title={t('flights.viewer.fullscreen')}
        >
          {isFullscreen ? (
            <Minimize className="h-4 w-4" aria-hidden="true" />
          ) : (
            <Maximize className="h-4 w-4" aria-hidden="true" />
          )}
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-2 border-t border-gray-800 bg-gray-950 px-3 py-2">
        <span className="mr-auto text-xs font-medium text-gray-300">
          {t('flights.goproOverlayLayoutLabel')}
        </span>
        <button
          type="button"
          onClick={() => setLayout('camera-main')}
          className={`flex cursor-pointer items-center gap-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 ${cameraIsMain ? 'bg-sky-600 text-white' : 'text-gray-300 hover:bg-gray-800'}`}
        >
          <PictureInPicture2 className="h-3.5 w-3.5" aria-hidden="true" />
          {cameraLabel}
        </button>
        <button
          type="button"
          onClick={() => setLayout('flight-main')}
          className={`flex cursor-pointer items-center gap-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 ${flightIsMain ? 'bg-sky-600 text-white' : 'text-gray-300 hover:bg-gray-800'}`}
        >
          <PictureInPicture2 className="h-3.5 w-3.5" aria-hidden="true" />
          {flightLabel}
        </button>
        <button
          type="button"
          onClick={() => setLayout('side-by-side')}
          className={`flex cursor-pointer items-center gap-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 ${layout === 'side-by-side' ? 'bg-sky-600 text-white' : 'text-gray-300 hover:bg-gray-800'}`}
        >
          <Columns2 className="h-3.5 w-3.5" aria-hidden="true" />
          {t('flights.goproOverlaySideBySide')}
        </button>
      </div>
    </div>
  );
}
