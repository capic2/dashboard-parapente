import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { useTranslation } from 'react-i18next';
import { Maximize2, Minimize2, Pause, Play, Plus } from 'lucide-react';
import type { FlightVideoMarker } from '@dashboard-parapente/shared-types';
import type { FlightTelemetryPipLayout } from './flightTelemetryLayout';
import { getYoutubeVideoId } from '../../../lib/youtube';

interface YoutubePlayer {
  destroy: () => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  getPlayerState: () => number;
  mute: () => void;
  pauseVideo: () => void;
  playVideo: () => void;
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
  setOption: (
    module: 'captions',
    option: 'track',
    value: Record<string, never>
  ) => void;
}

interface YoutubeApi {
  Player: new (
    element: HTMLElement,
    options: Record<string, unknown>
  ) => YoutubePlayer;
}

let youtubeApiPromise: Promise<YoutubeApi> | null = null;

function loadYoutubeApi(): Promise<YoutubeApi> {
  const youtubeWindow = window as Window & {
    YT?: YoutubeApi;
    onYouTubeIframeAPIReady?: () => void;
  };
  if (youtubeWindow.YT) return Promise.resolve(youtubeWindow.YT);
  if (youtubeApiPromise) return youtubeApiPromise;

  youtubeApiPromise = new Promise<YoutubeApi>((resolve, reject) => {
    const existingScript = document.querySelector<HTMLScriptElement>(
      'script[src="https://www.youtube.com/iframe_api"]'
    );
    const previousCallback = youtubeWindow.onYouTubeIframeAPIReady;
    youtubeWindow.onYouTubeIframeAPIReady = () => {
      previousCallback?.();
      if (youtubeWindow.YT) resolve(youtubeWindow.YT);
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

export type FlightOverlayLayout =
  | 'camera-main'
  | 'flight-main'
  | 'side-by-side';

export interface FlightOverlayPip extends FlightTelemetryPipLayout {
  videoUrl?: string;
  youtubeUrl?: string;
  label: string;
}

const EMPTY_PIPS: FlightOverlayPip[] = [];
const EMPTY_VIDEO_MARKERS: FlightVideoMarker[] = [];
const CONTROLS_HIDE_DELAY_MS = 2500;

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
  youtubeUrl?: string;
  flightUrl?: string;
  overlayUrl?: string;
  cameraLabel: string;
  flightLabel: string;
  overlayStatus?: 'missing' | 'generating' | 'ready' | 'failed';
  overlayError?: string | null;
  syncOffsetSeconds?: number;
  pipOffsetSeconds?: number;
  getFlightTime?: (cameraTime: number) => number;
  getCameraTime?: (flightTime: number) => number;
  getOverlayTime?: (cameraTime: number) => number;
  onTimeChange?: (time: number) => void;
  seekRequest?: { id: number; time: number } | null;
  overlayContent?: ReactNode;
  pips?: FlightOverlayPip[];
  videoMarkers?: FlightVideoMarker[];
  onAddVideoMarker?: (marker: Omit<FlightVideoMarker, 'id'>) => Promise<void>;
  isSavingVideoMarker?: boolean;
}

function clamp(value: number, maximum: number) {
  return Math.max(
    0,
    Math.min(value, Number.isFinite(maximum) ? maximum : value)
  );
}

function formatVideoMarkerTime(seconds: number): string {
  const roundedSeconds = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(roundedSeconds / 3600);
  const minutes = Math.floor((roundedSeconds % 3600) / 60);
  const remainingSeconds = roundedSeconds % 60;
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`
    : `${minutes}:${String(remainingSeconds).padStart(2, '0')}`;
}

function getVideoMarkerTitle(
  marker: FlightVideoMarker,
  labels: { takeoff: string; landing: string; interest: string }
): string {
  if (marker.title.trim()) return marker.title.trim();
  return labels[marker.kind];
}

export function FlightOverlayPlayer({
  mode,
  cameraUrl,
  youtubeUrl,
  flightUrl,
  overlayUrl,
  cameraLabel,
  flightLabel,
  overlayStatus,
  overlayError,
  syncOffsetSeconds = 0,
  pipOffsetSeconds = syncOffsetSeconds,
  getFlightTime,
  getCameraTime,
  getOverlayTime,
  onTimeChange,
  seekRequest,
  overlayContent,
  pips = EMPTY_PIPS,
  videoMarkers = EMPTY_VIDEO_MARKERS,
  onAddVideoMarker,
  isSavingVideoMarker = false,
}: FlightOverlayPlayerProps) {
  const { t } = useTranslation();
  const cameraRef = useRef<HTMLVideoElement>(null);
  const youtubeRef = useRef<YoutubePlayer | null>(null);
  const youtubeHostRef = useRef<HTMLDivElement>(null);
  const youtubePipPlayersRef = useRef(new Map<string, YoutubePlayer>());
  const youtubePipHostsRef = useRef(new Map<string, HTMLDivElement>());
  const pipVideosRef = useRef(new Map<string, HTMLVideoElement>());
  const pipsRef = useRef(pips);
  const pipOffsetSecondsRef = useRef(pipOffsetSeconds);
  pipsRef.current = pips;
  pipOffsetSecondsRef.current = pipOffsetSeconds;
  const pipSyncTickRef = useRef(0);
  const lastPipSeekTickRef = useRef(new Map<string, number>());
  const lastPipPlayTickRef = useRef(new Map<string, number>());
  const seekRequestRef = useRef(seekRequest);
  const flightRef = useRef<HTMLVideoElement>(null);
  const overlayRef = useRef<HTMLVideoElement>(null);
  const playerRef = useRef<HTMLDivElement>(null);
  const syncMediaRef = useRef<((notify?: boolean) => void) | null>(null);
  // The calibration player keeps its existing camera/flight layout.
  const [layout, setLayout] = useState<FlightOverlayLayout>(
    mode === 'calibration' && !youtubeUrl && flightUrl
      ? 'flight-main'
      : 'camera-main'
  );
  const [cameraCurrentTime, setCameraCurrentTime] = useState(0);
  const [cameraDuration, setCameraDuration] = useState(0);
  const [cameraIsPlaying, setCameraIsPlaying] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const controlsHideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  const cameraCurrentTimeRef = useRef(cameraCurrentTime);
  const cameraIsPlayingRef = useRef(cameraIsPlaying);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [youtubeReady, setYoutubeReady] = useState(false);
  const [youtubeFailed, setYoutubeFailed] = useState(false);
  const [activePipId, setActivePipId] = useState<string | null>(null);
  const [isAddingVideoMarker, setIsAddingVideoMarker] = useState(false);
  const isAddingVideoMarkerRef = useRef(false);
  const [newVideoMarkerKind, setNewVideoMarkerKind] =
    useState<FlightVideoMarker['kind']>('takeoff');
  const [newVideoMarkerTitle, setNewVideoMarkerTitle] = useState('');
  const [newVideoMarkerTime, setNewVideoMarkerTime] = useState<number | null>(
    null
  );
  const [videoMarkerSaveError, setVideoMarkerSaveError] = useState(false);
  const youtubeId = youtubeUrl ? getYoutubeVideoId(youtubeUrl) : null;
  const masterIsYoutube = Boolean(youtubeId) && !youtubeFailed;
  const isInteractive = mode === 'interactive';
  const sortedVideoMarkers = isInteractive
    ? videoMarkers
        .filter((marker) => marker.youtube_video_id === youtubeId)
        .sort((a, b) => a.timestamp_seconds - b.timestamp_seconds)
    : [];
  const activeVideoMarkers = sortedVideoMarkers.filter(
    (marker) =>
      cameraCurrentTime >= marker.timestamp_seconds &&
      cameraCurrentTime - marker.timestamp_seconds < 5
  );
  const videoMarkerLabels = {
    takeoff: t('flights.videoMarkerKindTakeoff'),
    landing: t('flights.videoMarkerKindLanding'),
    interest: t('flights.videoMarkerKindInterest'),
  };

  const openVideoMarkerForm = () => {
    if (!youtubeId || !onAddVideoMarker || !youtubeReady || !masterIsYoutube) {
      return;
    }
    const playerTime = youtubeRef.current?.getCurrentTime();
    const currentTime = playerTime ?? cameraCurrentTimeRef.current;
    setNewVideoMarkerTime(
      Math.min(86400, Math.max(0, Math.floor(currentTime)))
    );
    setNewVideoMarkerKind('takeoff');
    setNewVideoMarkerTitle('');
    setVideoMarkerSaveError(false);
    isAddingVideoMarkerRef.current = true;
    setIsAddingVideoMarker(true);
    setControlsVisible(true);
    clearControlsHideTimeout();
  };

  const saveVideoMarker = async () => {
    if (!youtubeId || !onAddVideoMarker || newVideoMarkerTime === null) return;
    const title = newVideoMarkerTitle.trim();
    if (newVideoMarkerKind === 'interest' && !title) return;
    setVideoMarkerSaveError(false);
    try {
      await onAddVideoMarker({
        youtube_video_id: youtubeId,
        kind: newVideoMarkerKind,
        timestamp_seconds: newVideoMarkerTime,
        title: newVideoMarkerKind === 'interest' ? title : '',
        include_in_youtube_chapters: true,
      });
      isAddingVideoMarkerRef.current = false;
      setIsAddingVideoMarker(false);
      if (cameraIsPlayingRef.current) scheduleControlsHide();
    } catch {
      setVideoMarkerSaveError(true);
    }
  };

  cameraCurrentTimeRef.current = cameraCurrentTime;
  cameraIsPlayingRef.current = cameraIsPlaying;
  isAddingVideoMarkerRef.current = isAddingVideoMarker;
  seekRequestRef.current = seekRequest;

  const clearControlsHideTimeout = useCallback(() => {
    if (controlsHideTimeoutRef.current) {
      clearTimeout(controlsHideTimeoutRef.current);
      controlsHideTimeoutRef.current = null;
    }
  }, []);

  const scheduleControlsHide = useCallback(() => {
    if (isAddingVideoMarkerRef.current) return;
    clearControlsHideTimeout();
    controlsHideTimeoutRef.current = setTimeout(() => {
      setControlsVisible(false);
      controlsHideTimeoutRef.current = null;
    }, CONTROLS_HIDE_DELAY_MS);
  }, [clearControlsHideTimeout]);

  const handlePlayerActivity = useCallback(() => {
    setControlsVisible(true);
    if (cameraIsPlayingRef.current) scheduleControlsHide();
    else clearControlsHideTimeout();
  }, [clearControlsHideTimeout, scheduleControlsHide]);

  const handlePlayerFocus = useCallback(() => {
    setControlsVisible(true);
    if (cameraIsPlayingRef.current) scheduleControlsHide();
    else clearControlsHideTimeout();
  }, [clearControlsHideTimeout, scheduleControlsHide]);

  const handlePlayerBlur = useCallback(() => {
    if (cameraIsPlayingRef.current) scheduleControlsHide();
  }, [scheduleControlsHide]);

  useEffect(() => {
    if (isInteractive && cameraIsPlaying) scheduleControlsHide();
    else clearControlsHideTimeout();

    return clearControlsHideTimeout;
  }, [
    cameraIsPlaying,
    clearControlsHideTimeout,
    isInteractive,
    scheduleControlsHide,
  ]);

  useEffect(() => {
    const handlePointerActivity = (event: PointerEvent) => {
      if (playerRef.current?.contains(event.target as Node)) {
        handlePlayerActivity();
      }
    };
    const handleKeyActivity = (event: KeyboardEvent) => {
      if (playerRef.current?.contains(event.target as Node)) {
        handlePlayerActivity();
      }
    };

    document.addEventListener('pointermove', handlePointerActivity);
    document.addEventListener('pointerdown', handlePointerActivity);
    document.addEventListener('keydown', handleKeyActivity);
    return () => {
      document.removeEventListener('pointermove', handlePointerActivity);
      document.removeEventListener('pointerdown', handlePointerActivity);
      document.removeEventListener('keydown', handleKeyActivity);
    };
  }, [handlePlayerActivity]);

  useEffect(() => {
    if (mode === 'interactive') setActivePipId(null);
    else setLayout(youtubeUrl || !flightUrl ? 'camera-main' : 'flight-main');
  }, [flightUrl, mode, youtubeUrl]);

  useEffect(() => {
    if (!seekRequest) {
      return;
    }
    if (masterIsYoutube) {
      youtubeRef.current?.seekTo(seekRequest.time, true);
    } else if (cameraRef.current) {
      cameraRef.current.currentTime = seekRequest.time;
    }
  }, [masterIsYoutube, seekRequest, youtubeReady]);

  const syncMedia = (notify = true) => {
    const camera = cameraRef.current;
    const currentTime = masterIsYoutube
      ? (youtubeRef.current?.getCurrentTime() ?? 0)
      : (camera?.currentTime ?? 0);
    if (!camera && !masterIsYoutube) return;
    const pipSyncTick = ++pipSyncTickRef.current;
    pips.forEach((pip) => {
      const pipOffset = pip.applyOffset === false ? 0 : pipOffsetSeconds;
      const desiredPipTime = Math.max(0, currentTime - pipOffset);
      const pipYoutube = youtubePipPlayersRef.current.get(pip.id);
      if (pipYoutube) {
        const currentPipTime = pipYoutube.getCurrentTime();
        const pipState = pipYoutube.getPlayerState();
        if (
          pipState !== 3 &&
          Math.abs(desiredPipTime - currentPipTime) > 0.75 &&
          pipSyncTick - (lastPipSeekTickRef.current.get(pip.id) ?? -30) >= 30
        ) {
          pipYoutube.seekTo(desiredPipTime, true);
          lastPipSeekTickRef.current.set(pip.id, pipSyncTick);
        }
        if (
          cameraIsPlaying &&
          [-1, 2, 5].includes(pipState) &&
          pipSyncTick - (lastPipPlayTickRef.current.get(pip.id) ?? -30) >= 30
        ) {
          pipYoutube.playVideo();
          lastPipPlayTickRef.current.set(pip.id, pipSyncTick);
        } else if (!cameraIsPlaying && pipState === 1) {
          pipYoutube.pauseVideo();
        }
      }
      const pipVideo = pipVideosRef.current.get(pip.id);
      const desiredVideoTime = Math.max(
        0,
        pip.source === 'file:vol' && pip.applyOffset !== false
          ? (getFlightTime?.(currentTime) ?? currentTime - pipOffset)
          : currentTime - pipOffset
      );
      if (
        pipVideo &&
        Math.abs(pipVideo.currentTime - desiredVideoTime) > 0.12
      ) {
        pipVideo.currentTime = clamp(desiredVideoTime, pipVideo.duration);
      }
      if (pipVideo && cameraIsPlaying && pipVideo.paused) playMedia(pipVideo);
      else if (pipVideo && !cameraIsPlaying && !pipVideo.paused)
        pipVideo.pause();
    });
    const flight = flightRef.current;
    const flightTime =
      getFlightTime?.(currentTime) ?? currentTime - syncOffsetSeconds;
    if (flight && Math.abs(flight.currentTime - flightTime) > 0.12) {
      flight.currentTime = clamp(flightTime, flight.duration);
    }
    if (
      flight &&
      cameraIsPlaying &&
      flight.paused &&
      (!Number.isFinite(flight.duration) || flightTime < flight.duration)
    ) {
      playMedia(flight);
    }
    const overlay = overlayRef.current;
    const overlayTime = getOverlayTime?.(currentTime) ?? currentTime;
    if (overlay && Math.abs(overlay.currentTime - overlayTime) > 0.08) {
      overlay.currentTime = clamp(overlayTime, overlay.duration);
    }
    if ((!camera || !camera.paused) && overlay?.paused) {
      // The camera is the master clock. Browsers can leave a secondary muted
      // WebM paused when it finishes loading or after a seek, so retry it on
      // the next synchronization tick instead of letting the layer freeze.
      playMedia(overlay);
    }
    if (notify) {
      setCameraCurrentTime(currentTime);
      onTimeChange?.(currentTime);
    }
  };

  syncMediaRef.current = (notify = false) => syncMedia(notify);

  useEffect(() => {
    // Calibration changes the offset without changing the camera clock. Apply
    // the new mapping immediately so the GPX/video image does not stay at the
    // previous position until the next media event.
    syncMediaRef.current?.();
  }, [pipOffsetSeconds, syncOffsetSeconds]);

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
    setControlsVisible(true);
    setCameraIsPlaying(true);
    syncMedia();
    playMedia(flightRef.current);
    pipVideosRef.current.forEach(playMedia);
    playMedia(overlayRef.current);
  };

  useEffect(() => {
    if (!youtubeId || !youtubeHostRef.current) return;
    let cancelled = false;
    const load = async () => {
      const api = await loadYoutubeApi();
      if (cancelled || !youtubeHostRef.current) return;
      setYoutubeFailed(false);
      youtubeRef.current = new api.Player(youtubeHostRef.current, {
        height: '100%',
        width: '100%',
        videoId: youtubeId,
        playerVars: {
          controls: 0,
          // YouTube chooses the best quality available for the viewing
          // conditions; its iframe API no longer supports forcing quality.
          cc_load_policy: 0,
          fs: 0,
          playsinline: 1,
          origin: window.location.origin,
        },
        events: {
          onReady: () => {
            // cc_load_policy follows the viewer's preference. Passing an
            // empty caption track clears that preference for this player.
            youtubeRef.current?.setOption('captions', 'track', {});
            const duration = youtubeRef.current?.getDuration() ?? 0;
            setCameraDuration(duration);
            setYoutubeReady(true);
            if (seekRequestRef.current) {
              youtubeRef.current?.seekTo(seekRequestRef.current.time, true);
            }
            syncMediaRef.current?.(true);
          },
          onApiChange: () => {
            youtubeRef.current?.setOption('captions', 'track', {});
          },
          onStateChange: ({ data }: { data: number }) => {
            const duration = youtubeRef.current?.getDuration() ?? 0;
            if (duration > 0) setCameraDuration(duration);
            const playing = data === 1;
            setCameraIsPlaying(playing);
            if (!playing) setControlsVisible(true);
            if (playing) {
              playMedia(flightRef.current);
              pipVideosRef.current.forEach(playMedia);
              playMedia(overlayRef.current);
              // Apply the GPX/video offset immediately when YouTube becomes
              // the master clock; the animation frame loop then keeps it
              // aligned for the rest of playback.
              syncMediaRef.current?.(true);
            } else {
              youtubePipPlayersRef.current.forEach((player) =>
                player.pauseVideo()
              );
              flightRef.current?.pause();
              pipVideosRef.current.forEach((video) => video.pause());
              overlayRef.current?.pause();
            }
          },
          onError: () => {
            setYoutubeReady(false);
            setYoutubeFailed(true);
          },
        },
      });
    };
    void load().catch(() => setYoutubeReady(false));
    return () => {
      cancelled = true;
      youtubeRef.current?.destroy();
      youtubeRef.current = null;
    };
  }, [youtubeId]);

  const pipYoutubeSignature = pips
    .map(
      (pip) =>
        `${pip.id}:${pip.youtubeUrl ?? ''}:${pip.applyOffset === false ? 0 : 1}`
    )
    .join('|');
  useEffect(() => {
    if (!isInteractive) return;
    if (!pipsRef.current.some((pip) => pip.youtubeUrl)) return;
    const youtubePipPlayers = youtubePipPlayersRef.current;
    const youtubePipHosts = youtubePipHostsRef.current;
    let cancelled = false;
    const load = async () => {
      const api = await loadYoutubeApi();
      if (cancelled) return;
      for (const pip of pipsRef.current) {
        const videoId = pip.youtubeUrl
          ? getYoutubeVideoId(pip.youtubeUrl)
          : null;
        const host = youtubePipHosts.get(pip.id);
        if (!videoId || !host) continue;
        const playerHost = document.createElement('div');
        host.replaceChildren(playerHost);
        const player = new api.Player(playerHost, {
          height: '100%',
          width: '100%',
          videoId,
          playerVars: {
            controls: 0,
            fs: 0,
            playsinline: 1,
            origin: window.location.origin,
          },
          events: {
            onReady: () => {
              player.mute();
              const currentPip = pipsRef.current.find(
                ({ id }) => id === pip.id
              );
              const offset =
                currentPip?.applyOffset === false
                  ? 0
                  : pipOffsetSecondsRef.current;
              player.seekTo(
                Math.max(0, cameraCurrentTimeRef.current - offset),
                true
              );
              if (cameraIsPlayingRef.current) player.playVideo();
            },
          },
        });
        youtubePipPlayers.set(pip.id, player);
      }
    };
    void load().catch(() => undefined);
    return () => {
      cancelled = true;
      youtubePipPlayers.forEach((player, id) => {
        player.destroy();
        youtubePipPlayers.delete(id);
        youtubePipHosts.get(id)?.replaceChildren();
      });
    };
  }, [isInteractive, pipYoutubeSignature, youtubeId]);

  const handlePause = () => {
    setControlsVisible(true);
    setCameraIsPlaying(false);
    youtubePipPlayersRef.current.forEach((player) => player.pauseVideo());
    flightRef.current?.pause();
    pipVideosRef.current.forEach((video) => video.pause());
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

  const handleFlightReady = () => {
    syncMedia();
  };

  const handleTimelineChange = (time: number) => {
    if (!cameraRef.current) return;
    cameraRef.current.currentTime = time;
    setCameraCurrentTime(time);
    syncMedia();
  };

  const handleTogglePlay = () => {
    if (masterIsYoutube) {
      if (!youtubeRef.current || !youtubeReady) return;
      if (youtubeRef.current.getPlayerState() === 1)
        youtubeRef.current.pauseVideo();
      else youtubeRef.current.playVideo();
      return;
    }
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

  const cameraIsMain = !isInteractive && layout === 'camera-main';
  const flightIsMain = !isInteractive && layout === 'flight-main';
  const activePip = pips.find((pip) => pip.id === activePipId);
  const getPipBoundsStyle = (pip: FlightOverlayPip) => ({
    left: `${pip.x * 100}%`,
    top: `${pip.y * 100}%`,
    width: `${pip.width * 100}%`,
    height: `${pip.height * 100}%`,
    display: pip.visible ? undefined : 'none',
  });
  const mainStyle = activePip ? getPipBoundsStyle(activePip) : undefined;
  const fallbackPipStyle = {
    left: `${(GOPRO_TEMPLATE_PIP.left / GOPRO_TEMPLATE_CANVAS.width) * 100}%`,
    bottom: `${(GOPRO_TEMPLATE_PIP.bottom / GOPRO_TEMPLATE_CANVAS.height) * 100}%`,
    width: `${(GOPRO_TEMPLATE_PIP.width / GOPRO_TEMPLATE_CANVAS.width) * 100}%`,
    aspectRatio: `${GOPRO_TEMPLATE_PIP.width} / ${GOPRO_TEMPLATE_PIP.height}`,
  };
  const calibrationPip = pips[0];
  const calibrationPipStyle: CSSProperties = calibrationPip
    ? getPipBoundsStyle(calibrationPip)
    : fallbackPipStyle;
  let masterMediaStyle: CSSProperties | undefined = mainStyle;
  if (!isInteractive) {
    masterMediaStyle = undefined;
    if (!cameraIsMain && layout !== 'side-by-side') {
      masterMediaStyle = calibrationPipStyle;
    }
  }
  let masterMediaClassName = 'aspect-video w-full object-contain';
  if (isInteractive && activePip) {
    if (masterIsYoutube) {
      masterMediaClassName =
        'absolute z-20 overflow-hidden rounded-lg border-2 border-white/80 bg-black shadow-xl';
    } else {
      masterMediaClassName =
        'absolute z-20 overflow-hidden rounded-lg border-2 border-white/80 object-cover shadow-xl';
    }
  } else if (!cameraIsMain && layout !== 'side-by-side' && !isInteractive) {
    masterMediaClassName =
      'absolute z-20 cursor-pointer rounded-lg border-2 border-white/80 object-cover shadow-xl transition-[width] duration-200 hover:border-sky-300';
  }

  return (
    <div
      ref={playerRef}
      className="relative overflow-hidden rounded-xl bg-black shadow-sm [&:fullscreen]:flex [&:fullscreen]:flex-col [&:fullscreen]:overflow-y-auto [&:fullscreen]:rounded-none"
      onFocusCapture={handlePlayerFocus}
      onBlurCapture={handlePlayerBlur}
    >
      <div
        data-testid="flight-overlay-media-stage"
        className={`relative grid min-h-0 bg-black ${isInteractive ? 'aspect-video' : ''} ${layout === 'side-by-side' ? 'grid-cols-1 md:grid-cols-2' : ''}`}
      >
        {masterIsYoutube ? (
          <div
            className={`${masterMediaClassName} ${isInteractive ? 'pointer-events-none' : ''}`}
            style={masterMediaStyle}
            aria-label={cameraLabel}
          >
            <div ref={youtubeHostRef} className="h-full w-full" />
          </div>
        ) : (
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
            className={masterMediaClassName}
            style={masterMediaStyle}
            onClick={() => {
              if (layout === 'flight-main') setLayout('camera-main');
            }}
            aria-label={cameraLabel}
          >
            <track kind="captions" />
          </video>
        )}
        {isInteractive && activePip && (
          <button
            type="button"
            className="absolute z-30 cursor-pointer bg-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sky-400"
            style={getPipBoundsStyle(activePip)}
            aria-label={t('flights.goproOverlayRestoreMainVideo')}
            onClick={() => setActivePipId(null)}
          />
        )}
        {flightIsMain && getCameraTime && (
          <div className="pointer-events-none absolute inset-0">
            <span className="sr-only">
              {getCameraTime(flightRef.current?.currentTime ?? 0)}
            </span>
          </div>
        )}
        {!isInteractive && Boolean(flightUrl) && (
          <video
            ref={flightRef}
            src={flightUrl}
            playsInline
            preload="metadata"
            muted
            onLoadedData={handleFlightReady}
            onCanPlay={handleFlightReady}
            onClick={() => {
              if (layout === 'camera-main') setLayout('flight-main');
            }}
            className={
              flightIsMain || layout === 'side-by-side'
                ? 'aspect-video w-full object-contain'
                : 'absolute z-10 cursor-pointer rounded-lg border-2 border-white/80 object-cover shadow-xl transition-[width] duration-200 hover:border-sky-300'
            }
            style={
              !flightIsMain && layout !== 'side-by-side'
                ? calibrationPipStyle
                : undefined
            }
            aria-label={flightLabel}
          >
            <track kind="captions" />
          </video>
        )}
        {isInteractive &&
          pips.map((pip) => {
            const isActive = pip.id === activePipId;
            const pipStyle = isActive
              ? { inset: 0, width: '100%', height: '100%' }
              : getPipBoundsStyle(pip);
            const youtubePipId = pip.youtubeUrl
              ? getYoutubeVideoId(pip.youtubeUrl)
              : null;
            const sourceAvailable = pip.youtubeUrl
              ? Boolean(youtubePipId)
              : Boolean(pip.videoUrl);
            return (
              <div
                key={pip.id}
                data-testid={`flight-overlay-pip-${pip.id}`}
                className={`absolute ${isActive ? 'z-10' : 'z-20'} overflow-hidden rounded-lg border-2 border-white/80 bg-black shadow-xl`}
                style={pipStyle}
                aria-label={pip.label}
              >
                {pip.youtubeUrl && youtubePipId ? (
                  <div
                    ref={(node) => {
                      if (node) youtubePipHostsRef.current.set(pip.id, node);
                      else youtubePipHostsRef.current.delete(pip.id);
                    }}
                    className="h-full w-full"
                  />
                ) : pip.videoUrl ? (
                  <video
                    ref={(node) => {
                      if (node) pipVideosRef.current.set(pip.id, node);
                      else pipVideosRef.current.delete(pip.id);
                    }}
                    src={pip.videoUrl}
                    playsInline
                    preload="metadata"
                    muted
                    onLoadedMetadata={() => syncMedia()}
                    onTimeUpdate={() => syncMedia()}
                    onSeeked={() => syncMedia()}
                    className="h-full w-full object-cover"
                    aria-label={pip.label}
                  >
                    <track kind="captions" />
                  </video>
                ) : (
                  <output className="flex h-full items-center justify-center p-2 text-center text-xs font-medium text-white">
                    {pip.source?.startsWith('youtube:')
                      ? t('flights.goproOverlayYoutubePipMissing', {
                          role: pip.source?.replace('youtube:', ''),
                        })
                      : t('flights.overlayInteractivePreviewUnavailable')}
                  </output>
                )}
                <button
                  type="button"
                  className="absolute inset-0 cursor-pointer bg-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sky-400"
                  aria-label={pip.label}
                  aria-pressed={isActive}
                  onClick={() => setActivePipId(isActive ? null : pip.id)}
                  disabled={!sourceAvailable}
                />
              </div>
            );
          })}
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
        {overlayContent && (
          <div
            className={`pointer-events-none absolute z-30 ${overlayUrl ? 'left-3 top-3' : 'inset-0'}`}
          >
            {overlayContent}
          </div>
        )}
        {activeVideoMarkers.length > 0 && (
          <output
            className="pointer-events-none absolute left-3 top-3 z-40 flex max-w-[calc(100%-1.5rem)] flex-wrap gap-2"
            aria-live="polite"
            aria-atomic="true"
          >
            {activeVideoMarkers.map((marker) => (
              <span
                key={marker.id}
                className="rounded-lg border border-white/20 bg-slate-950/90 px-3 py-2 text-sm font-semibold text-white shadow-lg backdrop-blur-sm"
              >
                {getVideoMarkerTitle(marker, videoMarkerLabels)}
              </span>
            ))}
          </output>
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
            className={`pointer-events-none absolute inset-x-0 bottom-0 z-40 max-h-full overflow-y-auto bg-gradient-to-t from-slate-950 via-slate-950/95 to-slate-950/0 px-3 pb-3 pt-12 text-white transition-opacity duration-200 sm:px-4 sm:pb-4 ${controlsVisible ? 'pointer-events-auto opacity-100' : 'opacity-0'}`}
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
                  masterIsYoutube
                    ? youtubeRef.current?.seekTo(
                        Number(event.target.value),
                        true
                      )
                    : handleTimelineChange(Number(event.target.value))
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
            {onAddVideoMarker && (
              <div className="mt-2">
                {!isAddingVideoMarker ? (
                  <button
                    type="button"
                    onClick={openVideoMarkerForm}
                    disabled={!youtubeId || !youtubeReady || !masterIsYoutube}
                    className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-white/20 bg-slate-800/90 px-2.5 py-1.5 text-xs font-medium text-white transition-colors hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                    {t('flights.overlayAddVideoMarker')}
                  </button>
                ) : (
                  <div className="flex flex-wrap items-end gap-2 rounded-lg border border-white/15 bg-slate-900/95 p-2.5">
                    <label className="flex min-w-36 flex-col gap-1 text-xs text-slate-300">
                      {t('flights.videoMarkerKindLabel')}
                      <select
                        value={newVideoMarkerKind}
                        onChange={(event) =>
                          setNewVideoMarkerKind(
                            event.target.value as FlightVideoMarker['kind']
                          )
                        }
                        className="h-8 rounded-md border border-white/20 bg-slate-800 px-2 text-sm text-white"
                      >
                        <option value="takeoff">
                          {videoMarkerLabels.takeoff}
                        </option>
                        <option value="landing">
                          {videoMarkerLabels.landing}
                        </option>
                        <option value="interest">
                          {videoMarkerLabels.interest}
                        </option>
                      </select>
                    </label>
                    {newVideoMarkerKind === 'interest' && (
                      <label className="flex min-w-44 flex-1 flex-col gap-1 text-xs text-slate-300">
                        {t('flights.videoMarkerTitleLabel')}
                        <input
                          value={newVideoMarkerTitle}
                          onChange={(event) =>
                            setNewVideoMarkerTitle(event.target.value)
                          }
                          maxLength={100}
                          className="h-8 rounded-md border border-white/20 bg-slate-800 px-2 text-sm text-white placeholder:text-slate-500"
                        />
                      </label>
                    )}
                    <span className="flex h-8 items-center gap-1 text-xs text-slate-300">
                      {t('flights.videoMarkerTimeLabel')}:
                      <time className="font-mono text-sky-200">
                        {newVideoMarkerTime === null
                          ? '—'
                          : formatVideoMarkerTime(newVideoMarkerTime)}
                      </time>
                    </span>
                    <button
                      type="button"
                      onClick={() => void saveVideoMarker()}
                      disabled={
                        isSavingVideoMarker ||
                        (newVideoMarkerKind === 'interest' &&
                          !newVideoMarkerTitle.trim())
                      }
                      className="h-8 cursor-pointer rounded-md bg-sky-600 px-3 text-xs font-semibold text-white hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isSavingVideoMarker
                        ? t('flights.videoMarkerSaving')
                        : t('flights.videoMarkerSave')}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        isAddingVideoMarkerRef.current = false;
                        setIsAddingVideoMarker(false);
                        if (cameraIsPlayingRef.current) scheduleControlsHide();
                      }}
                      disabled={isSavingVideoMarker}
                      className="h-8 cursor-pointer rounded-md border border-white/20 px-3 text-xs text-slate-200 hover:bg-white/10 disabled:opacity-50"
                    >
                      {t('flights.cancel')}
                    </button>
                    {videoMarkerSaveError && (
                      <p role="alert" className="w-full text-xs text-red-300">
                        {t('flights.videoMarkerSaveError')}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
            {sortedVideoMarkers.length > 0 && (
              <ul
                className="mt-2 m-0 flex max-w-full list-none gap-2 overflow-x-auto p-0 pb-1"
                aria-label={t('flights.overlayVideoMarkersLabel')}
              >
                {sortedVideoMarkers.map((marker) => (
                  <li
                    key={marker.id}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-white/15 bg-slate-800/90 px-2.5 py-1 text-xs text-slate-100"
                    title={t('flights.overlayVideoMarkerAt', {
                      title: getVideoMarkerTitle(marker, videoMarkerLabels),
                      time: formatVideoMarkerTime(marker.timestamp_seconds),
                    })}
                  >
                    <time className="font-mono text-sky-200">
                      {formatVideoMarkerTime(marker.timestamp_seconds)}
                    </time>
                    <span>
                      {getVideoMarkerTitle(marker, videoMarkerLabels)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
