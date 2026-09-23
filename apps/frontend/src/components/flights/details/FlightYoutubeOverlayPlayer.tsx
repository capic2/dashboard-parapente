import { useCallback, useEffect, useRef, useState } from 'react';
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
import type { FlightOverlayLayout } from './FlightOverlayPlayer';
import { getYoutubeVideoId } from '../../../lib/youtube';

interface YoutubePlayer {
  destroy: () => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  getPlayerState: () => number;
  pauseVideo: () => void;
  playVideo: () => void;
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
}

interface YoutubeApi {
  Player: new (
    element: HTMLElement,
    options: {
      height: string;
      width: string;
      videoId: string;
      playerVars: Record<string, number | string>;
      events: {
        onError: () => void;
        onReady: () => void;
        onStateChange: (event: { data: number }) => void;
      };
    }
  ) => YoutubePlayer;
}

declare global {
  interface Window {
    YT?: YoutubeApi;
    onYouTubeIframeAPIReady?: () => void;
  }
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

interface FlightYoutubeOverlayPlayerProps {
  youtubeUrl: string;
  flightUrl: string;
  overlayUrl?: string;
  youtubeLabel: string;
  flightLabel: string;
  onTimeChange?: (time: number) => void;
  getOverlayTime?: (youtubeTime: number) => number;
}

const YOUTUBE_PLAYING = 1;
const YOUTUBE_ENDED = 0;

export function FlightYoutubeOverlayPlayer({
  youtubeUrl,
  flightUrl,
  overlayUrl,
  youtubeLabel,
  flightLabel,
  onTimeChange,
  getOverlayTime,
}: FlightYoutubeOverlayPlayerProps) {
  const { t } = useTranslation();
  const youtubeContainerRef = useRef<HTMLDivElement>(null);
  const youtubePlayerRef = useRef<YoutubePlayer | null>(null);
  const flightRef = useRef<HTMLVideoElement>(null);
  const overlayRef = useRef<HTMLVideoElement>(null);
  const playerRef = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState<FlightOverlayLayout>('camera-main');
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const getOverlayTimeRef = useRef(getOverlayTime);
  const onTimeChangeRef = useRef(onTimeChange);
  getOverlayTimeRef.current = getOverlayTime;
  onTimeChangeRef.current = onTimeChange;

  const videoId = getYoutubeVideoId(youtubeUrl);
  const cameraIsMain = layout === 'camera-main';
  const flightIsMain = layout === 'flight-main';

  const syncMedia = useCallback((notify = true) => {
    const player = youtubePlayerRef.current;
    if (!player) return;
    const youtubeTime = player.getCurrentTime();
    const flight = flightRef.current;
    if (flight && Math.abs(flight.currentTime - youtubeTime) > 0.12) {
      flight.currentTime = Math.max(
        0,
        Math.min(youtubeTime, flight.duration || youtubeTime)
      );
    }
    const overlay = overlayRef.current;
    const overlayTime = getOverlayTimeRef.current?.(youtubeTime) ?? youtubeTime;
    if (overlay && Math.abs(overlay.currentTime - overlayTime) > 0.08) {
      overlay.currentTime = Math.max(
        0,
        Math.min(overlayTime, overlay.duration || overlayTime)
      );
    }
    if (notify) {
      setCurrentTime(youtubeTime);
      onTimeChangeRef.current?.(youtubeTime);
    }
  }, []);

  const playSecondaryMedia = useCallback(() => {
    void flightRef.current?.play().catch(() => undefined);
    void overlayRef.current?.play().catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!videoId || !youtubeContainerRef.current) return;
    let cancelled = false;

    void loadYoutubeApi()
      .then((api) => {
        if (cancelled || !youtubeContainerRef.current) return;
        youtubePlayerRef.current = new api.Player(youtubeContainerRef.current, {
          height: '100%',
          width: '100%',
          videoId,
          playerVars: {
            // Playback is controlled by this player, so hide YouTube's native
            // controls and prevent its captions button from being exposed.
            controls: 0,
            cc_load_policy: 0,
            enablejsapi: 1,
            // Native YouTube fullscreen only expands the iframe and drops the
            // synchronized flight and overlay layers. Use the parent player
            // fullscreen control below so all layers stay together.
            fs: 0,
            origin: window.location.origin,
            playsinline: 1,
          },
          events: {
            onReady: () => {
              const player = youtubePlayerRef.current;
              if (!player) return;
              setDuration(player.getDuration());
              setIsReady(true);
              syncMedia();
            },
            onError: () => setHasError(true),
            onStateChange: ({ data }) => {
              const playing = data === YOUTUBE_PLAYING;
              setIsPlaying(playing);
              if (playing) playSecondaryMedia();
              else if (data === YOUTUBE_ENDED) {
                flightRef.current?.pause();
                overlayRef.current?.pause();
              } else {
                flightRef.current?.pause();
                overlayRef.current?.pause();
              }
            },
          },
        });
      })
      .catch(() => setHasError(true));

    return () => {
      cancelled = true;
      youtubePlayerRef.current?.destroy();
      youtubePlayerRef.current = null;
    };
  }, [playSecondaryMedia, syncMedia, videoId]);

  useEffect(() => {
    if (!isPlaying) return;
    let animationFrame = 0;
    const tick = () => {
      syncMedia();
      animationFrame = requestAnimationFrame(tick);
    };
    animationFrame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animationFrame);
  }, [isPlaying, syncMedia]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(document.fullscreenElement === playerRef.current);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () =>
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const togglePlay = () => {
    const player = youtubePlayerRef.current;
    if (!player || !isReady) return;
    if (player.getPlayerState() === YOUTUBE_PLAYING) player.pauseVideo();
    else player.playVideo();
  };

  const seek = (time: number) => {
    youtubePlayerRef.current?.seekTo(time, true);
    syncMedia();
  };

  const toggleFullscreen = () => {
    if (!playerRef.current) return;
    if (document.fullscreenElement === playerRef.current) {
      void document.exitFullscreen().catch(() => undefined);
    } else {
      void playerRef.current.requestFullscreen().catch(() => undefined);
    }
  };

  if (!videoId || hasError) {
    return (
      <div className="rounded-lg bg-amber-50 p-4 text-sm text-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
        {t('flights.youtubeOverlayUnavailable')}
      </div>
    );
  }

  return (
    <div
      ref={playerRef}
      className="overflow-hidden rounded-xl bg-black shadow-sm [&:fullscreen]:flex [&:fullscreen]:flex-col [&:fullscreen]:overflow-y-auto [&:fullscreen]:rounded-none"
    >
      <div
        className={`relative grid min-h-0 bg-black ${layout === 'side-by-side' ? 'grid-cols-1 md:grid-cols-2' : ''}`}
      >
        <div
          ref={youtubeContainerRef}
          className={`${cameraIsMain || layout === 'side-by-side' ? 'aspect-video w-full' : 'absolute bottom-[0.93%] left-[0.52%] z-20 aspect-square w-[11.46%] cursor-pointer rounded-lg border-2 border-white/80 object-cover shadow-xl transition-[width] duration-200 hover:border-sky-300'}`}
          aria-label={youtubeLabel}
          role="application"
        />
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
              : 'absolute bottom-[0.93%] left-[0.52%] z-10 aspect-square w-[11.46%] cursor-pointer rounded-lg border-2 border-white/80 object-cover shadow-xl transition-[width] duration-200 hover:border-sky-300'
          }
          aria-label={flightLabel}
        >
          <track kind="captions" />
        </video>
        {overlayUrl && (
          <video
            ref={overlayRef}
            src={overlayUrl}
            playsInline
            muted
            preload="auto"
            className="pointer-events-none absolute inset-0 z-[15] h-full w-full object-contain"
            aria-label={t('flights.overlayLayerReady')}
          >
            <track kind="captions" />
          </video>
        )}
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
              name: cameraIsMain ? flightLabel : youtubeLabel,
            })}
          >
            <Repeat2 className="h-3.5 w-3.5" aria-hidden="true" />
            {cameraIsMain ? flightLabel : youtubeLabel}
          </button>
        )}
      </div>
      <div className="flex items-center gap-3 border-t border-gray-800 bg-gray-950 px-3 py-2">
        <button
          type="button"
          onClick={togglePlay}
          disabled={!isReady}
          className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-md text-gray-200 hover:bg-gray-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 disabled:cursor-not-allowed disabled:opacity-50"
          aria-label={
            isPlaying
              ? t('flights.goproOverlayPause')
              : t('flights.goproOverlayPlay')
          }
        >
          {isPlaying ? (
            <Pause className="h-4 w-4" aria-hidden="true" />
          ) : (
            <Play className="h-4 w-4" aria-hidden="true" />
          )}
        </button>
        <input
          type="range"
          min={0}
          max={duration}
          step={0.01}
          value={Math.min(currentTime, duration)}
          onChange={(event) => seek(Number(event.target.value))}
          disabled={!isReady || !duration}
          className="min-w-0 flex-1 cursor-pointer accent-sky-500 disabled:cursor-not-allowed disabled:opacity-50"
          aria-label={t('flights.goproOverlayTimeline')}
        />
        <span className="shrink-0 font-mono text-xs text-gray-300">
          {Math.floor(currentTime / 60)}:
          {Math.floor(currentTime % 60)
            .toString()
            .padStart(2, '0')}{' '}
          / {Math.floor(duration / 60)}:
          {Math.floor(duration % 60)
            .toString()
            .padStart(2, '0')}
        </span>
        <button
          type="button"
          onClick={toggleFullscreen}
          className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-md text-gray-200 hover:bg-gray-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
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
          {youtubeLabel}
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
    </div>
  );
}
