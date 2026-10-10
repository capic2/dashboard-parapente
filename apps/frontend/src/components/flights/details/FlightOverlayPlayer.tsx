import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { Maximize2, Minimize2, Pause, Play } from 'lucide-react';
import type { FlightVideoMarker } from '@dashboard-parapente/shared-types';
import type {
  FlightTelemetryPipLayout,
  TelemetryPipVideoRole,
} from './flightTelemetryLayout';
import { getYoutubeVideoId } from '../../../lib/youtube';

interface YoutubePlayer {
  destroy: () => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  getPlayerState: () => number;
  cueVideoById: (videoId: string, startSeconds?: number) => void;
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

interface NativeFullscreenBridge {
  enter: () => void;
  exit: () => void;
  supportsOrientationReady?: () => boolean;
}

interface FullscreenPlaybackSnapshot {
  currentTime: number;
  wasPlaying: boolean;
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

function pipSyncOffsetSeconds(
  pip: FlightOverlayPip,
  mainVideoRole: TelemetryPipVideoRole,
  offsetSeconds: number
): number {
  if (pip.applyOffset === false) return 0;
  const pipVideoRole = pip.source?.split(':')[1] as
    | TelemetryPipVideoRole
    | undefined;
  if (!pipVideoRole || pipVideoRole === mainVideoRole) return 0;
  if (pipVideoRole === 'vol') return offsetSeconds;
  if (mainVideoRole === 'vol') return -offsetSeconds;
  return 0;
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
  mainVideoRole?: TelemetryPipVideoRole;
  getFlightTime?: (cameraTime: number) => number;
  getCameraTime?: (flightTime: number) => number;
  getOverlayTime?: (cameraTime: number) => number;
  onTimeChange?: (time: number) => void;
  seekRequest?: { id: number; time: number } | null;
  overlayContent?: ReactNode;
  pips?: FlightOverlayPip[];
  videoMarkers?: FlightVideoMarker[];
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
  mainVideoRole = 'face',
  getFlightTime,
  getCameraTime,
  getOverlayTime,
  onTimeChange,
  seekRequest,
  overlayContent,
  pips = EMPTY_PIPS,
  videoMarkers = EMPTY_VIDEO_MARKERS,
}: FlightOverlayPlayerProps) {
  const { t } = useTranslation();
  const isInteractive = mode === 'interactive';
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
  const playerMountRef = useRef<HTMLDivElement>(null);
  const nativeFullscreenActiveRef = useRef(false);
  const fullscreenPlaybackSnapshotRef =
    useRef<FullscreenPlaybackSnapshot | null>(null);
  const fullscreenSeekTargetRef = useRef<number | null>(null);
  const syncMediaRef = useRef<
    | ((
        notify?: boolean,
        forcePipSync?: boolean,
        allowFullscreenSnapshotRewind?: boolean
      ) => void)
    | null
  >(null);
  const fullscreenRestoreFrameRef = useRef<number | null>(null);
  // The calibration player keeps its existing camera/flight layout.
  const [layout, setLayout] = useState<FlightOverlayLayout>(
    mode === 'calibration' && !youtubeUrl && flightUrl
      ? 'flight-main'
      : 'camera-main'
  );
  const [cameraCurrentTime, setCameraCurrentTime] = useState(0);
  const [cameraDuration, setCameraDuration] = useState(0);
  const [cameraIsPlaying, setCameraIsPlaying] = useState(false);
  const [hasStartedMainPlayback, setHasStartedMainPlayback] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const controlsHideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  const cameraCurrentTimeRef = useRef(cameraCurrentTime);
  const cameraIsPlayingRef = useRef(cameraIsPlaying);
  const playbackRequestedRef = useRef(false);
  const youtubeCuedTimeRef = useRef<number | null>(null);
  const onTimeChangeRef = useRef(onTimeChange);
  onTimeChangeRef.current = onTimeChange;
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fullscreenPortalHost] = useState<HTMLDivElement | null>(() =>
    isInteractive && typeof document !== 'undefined'
      ? document.createElement('div')
      : null
  );
  const [youtubeReady, setYoutubeReady] = useState(false);
  const [youtubeFailed, setYoutubeFailed] = useState(false);
  const [activePipId, setActivePipId] = useState<string | null>(null);
  const youtubeId = youtubeUrl ? getYoutubeVideoId(youtubeUrl) : null;
  const masterIsYoutube = Boolean(youtubeId) && !youtubeFailed;
  const canSeekVideoMarkers = Boolean(
    youtubeId && youtubeReady && masterIsYoutube
  );

  const captureFullscreenPlayback = useCallback(
    (preserveExisting = false) => {
      if (!isInteractive) return;
      if (preserveExisting && fullscreenPlaybackSnapshotRef.current) return;

      const player = youtubeRef.current;
      const video = cameraRef.current;
      let wasPlaying =
        cameraIsPlayingRef.current || playbackRequestedRef.current;
      let currentTime = cameraCurrentTimeRef.current;

      try {
        if (masterIsYoutube && player) {
          wasPlaying ||= player.getPlayerState() === 1;
          currentTime = youtubeCuedTimeRef.current ?? player.getCurrentTime();
        } else if (video) {
          wasPlaying ||= !video.paused;
          currentTime = video.currentTime;
        }
      } catch {
        // Keep the latest time and playback state recorded by media events.
      }

      if (!Number.isFinite(currentTime)) return;

      fullscreenPlaybackSnapshotRef.current = {
        currentTime,
        wasPlaying,
      };
    },
    [isInteractive, masterIsYoutube]
  );

  const restoreFullscreenPlayback = useCallback(() => {
    const snapshot = fullscreenPlaybackSnapshotRef.current;
    if (!snapshot) return;

    try {
      if (masterIsYoutube) {
        const player = youtubeRef.current;
        if (!player) return;

        const playerIsPlaying = player.getPlayerState() === 1;
        const playerTime = player.getCurrentTime();
        if (Math.abs(playerTime - snapshot.currentTime) > 0.25) {
          youtubeCuedTimeRef.current = snapshot.currentTime;
          player.seekTo(snapshot.currentTime, true);
        }
        playbackRequestedRef.current = snapshot.wasPlaying;
        if (snapshot.wasPlaying && !playerIsPlaying) {
          player.playVideo();
        } else if (!snapshot.wasPlaying && playerIsPlaying) {
          player.pauseVideo();
        }
      } else {
        const video = cameraRef.current;
        if (!video) return;

        if (Math.abs(video.currentTime - snapshot.currentTime) > 0.25) {
          video.currentTime = snapshot.currentTime;
        }
        playbackRequestedRef.current = snapshot.wasPlaying;
        if (snapshot.wasPlaying && video.paused) {
          void video.play().catch(() => undefined);
        } else if (!snapshot.wasPlaying && !video.paused) {
          video.pause();
        }
      }
      cameraCurrentTimeRef.current = snapshot.currentTime;
      cameraIsPlayingRef.current = snapshot.wasPlaying;
      setCameraCurrentTime(snapshot.currentTime);
      setCameraIsPlaying(snapshot.wasPlaying);
      fullscreenPlaybackSnapshotRef.current = null;
      syncMediaRef.current?.(true, true, true);
    } catch {
      // A reloaded YouTube iframe will retry restoration from its onReady event.
    }
  }, [masterIsYoutube]);

  useLayoutEffect(() => {
    if (!isInteractive || !fullscreenPortalHost) return;
    const mount = playerMountRef.current;
    if (!mount) return;

    mount.appendChild(fullscreenPortalHost);
    return () => fullscreenPortalHost.remove();
  }, [fullscreenPortalHost, isInteractive]);

  useLayoutEffect(() => {
    if (!fullscreenPortalHost) return;
    if (!isFullscreen && !fullscreenPlaybackSnapshotRef.current) return;
    if (isInteractive && isFullscreen) captureFullscreenPlayback(true);
    if (fullscreenRestoreFrameRef.current !== null) {
      window.cancelAnimationFrame(fullscreenRestoreFrameRef.current);
    }
    fullscreenRestoreFrameRef.current = window.requestAnimationFrame(() => {
      fullscreenRestoreFrameRef.current = null;
      if (!isFullscreen) restoreFullscreenPlayback();
      syncMediaRef.current?.(true, true);
    });
    return () => {
      if (fullscreenRestoreFrameRef.current !== null) {
        window.cancelAnimationFrame(fullscreenRestoreFrameRef.current);
        fullscreenRestoreFrameRef.current = null;
      }
    };
  }, [
    captureFullscreenPlayback,
    fullscreenPortalHost,
    isFullscreen,
    isInteractive,
    restoreFullscreenPlayback,
  ]);
  const hasPlaybackIntent = useCallback(
    () => !isInteractive || playbackRequestedRef.current,
    [isInteractive]
  );
  const cueYoutubeAt = useCallback((videoId: string, time: number) => {
    youtubeCuedTimeRef.current = time;
    const player = youtubeRef.current;
    const playerState = player?.getPlayerState();
    if (
      player &&
      (playerState === -1 ||
        (playerState !== undefined &&
          !playbackRequestedRef.current &&
          [0, 5].includes(playerState)))
    ) {
      player.cueVideoById(videoId, time);
    } else {
      player?.seekTo(time, true);
    }
    cameraCurrentTimeRef.current = time;
    syncMediaRef.current?.(true, true, true);
    if (!syncMediaRef.current) {
      setCameraCurrentTime(time);
      onTimeChangeRef.current?.(time);
    }
  }, []);
  const sortedVideoMarkers = isInteractive
    ? [...videoMarkers].sort(
        (a, b) => a.timestamp_seconds - b.timestamp_seconds
      )
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

  cameraCurrentTimeRef.current = cameraCurrentTime;
  cameraIsPlayingRef.current = cameraIsPlaying;
  seekRequestRef.current = seekRequest;

  const clearControlsHideTimeout = useCallback(() => {
    if (controlsHideTimeoutRef.current) {
      clearTimeout(controlsHideTimeoutRef.current);
      controlsHideTimeoutRef.current = null;
    }
  }, []);

  const scheduleControlsHide = useCallback(() => {
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
      if (!youtubeReady) return;
      if (isInteractive && youtubeId && !playbackRequestedRef.current) {
        cueYoutubeAt(youtubeId, seekRequest.time);
      } else {
        youtubeRef.current?.seekTo(seekRequest.time, true);
      }
    } else if (cameraRef.current) {
      cameraRef.current.currentTime = seekRequest.time;
    }
  }, [
    cueYoutubeAt,
    isInteractive,
    masterIsYoutube,
    seekRequest,
    youtubeId,
    youtubeReady,
  ]);

  const syncMedia = (
    notify = true,
    forcePipSync = false,
    allowFullscreenSnapshotRewind = false
  ) => {
    const camera = cameraRef.current;
    let currentTime = masterIsYoutube
      ? (youtubeCuedTimeRef.current ??
        youtubeRef.current?.getCurrentTime() ??
        0)
      : (camera?.currentTime ?? 0);
    if (!camera && !masterIsYoutube) return;
    const fullscreenSeekTarget = fullscreenSeekTargetRef.current;
    if (isInteractive && isFullscreen && fullscreenSeekTarget !== null) {
      if (Math.abs(currentTime - fullscreenSeekTarget) <= 1) {
        fullscreenSeekTargetRef.current = null;
      } else {
        // YouTube may report its old playback position for a short time after
        // seekTo(). Keep the requested position authoritative until the seek
        // completes so the fullscreen recovery snapshot cannot undo it.
        currentTime = fullscreenSeekTarget;
      }
    } else {
      fullscreenSeekTargetRef.current = null;
    }
    const fullscreenSnapshot =
      isInteractive && isFullscreen
        ? fullscreenPlaybackSnapshotRef.current
        : null;
    if (
      fullscreenSnapshot &&
      !allowFullscreenSnapshotRewind &&
      currentTime < fullscreenSnapshot.currentTime - 1
    ) {
      currentTime = fullscreenSnapshot.currentTime;
      if (masterIsYoutube) {
        youtubeCuedTimeRef.current = currentTime;
        youtubeRef.current?.seekTo(currentTime, true);
      } else if (camera) {
        camera.currentTime = currentTime;
      }
    }
    const pipSyncTick = ++pipSyncTickRef.current;
    const mainIsPlaying = cameraIsPlayingRef.current;
    pips.forEach((pip) => {
      let pipOffset = pipOffsetSeconds;
      if (isInteractive) {
        pipOffset = pipSyncOffsetSeconds(pip, mainVideoRole, pipOffsetSeconds);
      } else if (pip.applyOffset === false) {
        pipOffset = 0;
      }
      const desiredPipTime = Math.max(0, currentTime - pipOffset);
      const pipYoutube = youtubePipPlayersRef.current.get(pip.id);
      if (pipYoutube) {
        const currentPipTime = pipYoutube.getCurrentTime();
        const pipState = pipYoutube.getPlayerState();
        if (
          pipState !== 3 &&
          Math.abs(desiredPipTime - currentPipTime) > 0.75 &&
          (forcePipSync ||
            pipSyncTick - (lastPipSeekTickRef.current.get(pip.id) ?? -30) >= 30)
        ) {
          const pipVideoId = pip.youtubeUrl
            ? getYoutubeVideoId(pip.youtubeUrl)
            : null;
          const pipPlaybackRequested = hasPlaybackIntent() && mainIsPlaying;
          if (
            !pipPlaybackRequested &&
            [-1, 0, 5].includes(pipState) &&
            pipVideoId
          ) {
            pipYoutube.cueVideoById(pipVideoId, desiredPipTime);
          } else {
            pipYoutube.seekTo(desiredPipTime, true);
          }
          lastPipSeekTickRef.current.set(pip.id, pipSyncTick);
        }
        if (
          hasPlaybackIntent() &&
          mainIsPlaying &&
          [-1, 2, 5].includes(pipState) &&
          pipSyncTick - (lastPipPlayTickRef.current.get(pip.id) ?? -30) >= 30
        ) {
          pipYoutube.playVideo();
          lastPipPlayTickRef.current.set(pip.id, pipSyncTick);
        } else if (!mainIsPlaying && pipState === 1) {
          pipYoutube.pauseVideo();
        }
      }
      const pipVideo = pipVideosRef.current.get(pip.id);
      const desiredVideoTime = Math.max(
        0,
        pip.source === 'file:vol' &&
          pip.applyOffset !== false &&
          (!isInteractive || mainVideoRole !== 'vol')
          ? (getFlightTime?.(currentTime) ?? currentTime - pipOffset)
          : currentTime - pipOffset
      );
      if (
        pipVideo &&
        Math.abs(pipVideo.currentTime - desiredVideoTime) > 0.12
      ) {
        pipVideo.currentTime = clamp(desiredVideoTime, pipVideo.duration);
      }
      if (pipVideo && hasPlaybackIntent() && mainIsPlaying && pipVideo.paused) {
        playMedia(pipVideo);
      } else if (pipVideo && !mainIsPlaying && !pipVideo.paused)
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
      mainIsPlaying &&
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
    if (hasPlaybackIntent() && mainIsPlaying && overlay?.paused) {
      // The camera is the master clock. Browsers can leave a secondary muted
      // WebM paused when it finishes loading or after a seek, so retry it on
      // the next synchronization tick instead of letting the layer freeze.
      playMedia(overlay);
    }
    if (notify) {
      setCameraCurrentTime(currentTime);
      onTimeChange?.(currentTime);
    }
    if (isInteractive && isFullscreen) {
      fullscreenPlaybackSnapshotRef.current = {
        currentTime,
        wasPlaying: mainIsPlaying || playbackRequestedRef.current,
      };
    }
  };

  syncMediaRef.current = (
    notify = false,
    forcePipSync = false,
    allowFullscreenSnapshotRewind = false
  ) => syncMedia(notify, forcePipSync, allowFullscreenSnapshotRewind);

  useEffect(() => {
    // Calibration changes the offset without changing the camera clock. Apply
    // the new mapping immediately so the GPX/video image does not stay at the
    // previous position until the next media event.
    syncMediaRef.current?.();
  }, [pipOffsetSeconds, syncOffsetSeconds]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      const entering = document.fullscreenElement === playerRef.current;
      if (entering) {
        captureFullscreenPlayback(true);
      }
      setIsFullscreen(entering);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () =>
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, [captureFullscreenPlayback]);

  useEffect(() => {
    const handleNativeFullscreenBack = () => {
      nativeFullscreenActiveRef.current = false;
      const nativeFullscreen = (
        window as Window & { NativeFullscreen?: NativeFullscreenBridge }
      ).NativeFullscreen;
      if (nativeFullscreen?.supportsOrientationReady?.() !== true) {
        setIsFullscreen(false);
      }
      nativeFullscreen?.exit();
    };

    const handleNativeFullscreenOrientationChange = (event: Event) => {
      const landscape = (event as CustomEvent<{ landscape: boolean }>).detail
        ?.landscape;
      if (typeof landscape !== 'boolean') return;
      if (landscape) {
        captureFullscreenPlayback(true);
      }
      nativeFullscreenActiveRef.current = landscape;
      setIsFullscreen(landscape);
    };

    window.addEventListener('nativefullscreenback', handleNativeFullscreenBack);
    window.addEventListener(
      'nativefullscreenorientationchange',
      handleNativeFullscreenOrientationChange
    );
    return () => {
      window.removeEventListener(
        'nativefullscreenback',
        handleNativeFullscreenBack
      );
      window.removeEventListener(
        'nativefullscreenorientationchange',
        handleNativeFullscreenOrientationChange
      );
    };
  }, [captureFullscreenPlayback]);

  useEffect(
    () => () => {
      if (nativeFullscreenActiveRef.current) {
        (
          window as Window & { NativeFullscreen?: NativeFullscreenBridge }
        ).NativeFullscreen?.exit();
      }
    },
    []
  );

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
    if (video?.paused) {
      // The overlay is muted, but browsers can still reject a secondary
      // play() call. The animation-frame synchronizer keeps it aligned then.
      void video.play().catch(() => undefined);
    }
  };

  const playPips = () => {
    youtubePipPlayersRef.current.forEach((player) => player.playVideo());
    pipVideosRef.current.forEach(playMedia);
  };

  const handlePlay = () => {
    setControlsVisible(true);
    setHasStartedMainPlayback(true);
    cameraIsPlayingRef.current = true;
    setCameraIsPlaying(true);
    syncMedia();
    playPips();
    playMedia(flightRef.current);
    playMedia(overlayRef.current);
  };

  useEffect(() => {
    if (!youtubeId || !youtubeHostRef.current) return;
    youtubeCuedTimeRef.current = null;
    setYoutubeReady(false);
    setHasStartedMainPlayback(false);
    let cancelled = false;
    let player: YoutubePlayer | null = null;
    const load = async () => {
      const api = await loadYoutubeApi();
      if (cancelled || !youtubeHostRef.current) return;
      setYoutubeFailed(false);
      player = new api.Player(youtubeHostRef.current, {
        height: '100%',
        width: '100%',
        videoId: youtubeId,
        playerVars: {
          ...(isInteractive ? { autoplay: 0 } : {}),
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
            if (cancelled || !player) return;
            // cc_load_policy follows the viewer's preference. Passing an
            // empty caption track clears that preference for this player.
            player.setOption('captions', 'track', {});
            const duration = player.getDuration();
            setCameraDuration(duration);
            setYoutubeReady(true);
            restoreFullscreenPlayback();
            const pendingSeek = seekRequestRef.current;
            if (pendingSeek) {
              if (isInteractive && youtubeId && !playbackRequestedRef.current) {
                cueYoutubeAt(youtubeId, pendingSeek.time);
              } else {
                player.seekTo(pendingSeek.time, true);
              }
            }
            syncMediaRef.current?.(true);
          },
          onApiChange: () => {
            if (cancelled) return;
            player?.setOption('captions', 'track', {});
          },
          onStateChange: ({ data }: { data: number }) => {
            if (cancelled || !player) return;
            const duration = player.getDuration();
            if (duration > 0) setCameraDuration(duration);
            if (data === 0 && isInteractive) {
              playbackRequestedRef.current = false;
            }
            const playing = data === 1;
            if (playing) youtubeCuedTimeRef.current = null;
            if (playing && isInteractive && !playbackRequestedRef.current) {
              player.pauseVideo();
              cameraIsPlayingRef.current = false;
              setCameraIsPlaying(false);
              return;
            }
            if (playing) setHasStartedMainPlayback(true);
            cameraIsPlayingRef.current = playing;
            setCameraIsPlaying(playing);
            if (!playing) setControlsVisible(true);
            if (playing) {
              if (hasPlaybackIntent()) {
                syncMediaRef.current?.(true);
                if (isInteractive) playPips();
                playMedia(flightRef.current);
                pipVideosRef.current.forEach(playMedia);
                playMedia(overlayRef.current);
              } else {
                syncMediaRef.current?.(true);
              }
            } else {
              cameraIsPlayingRef.current = false;
              youtubePipPlayersRef.current.forEach((player) =>
                player.pauseVideo()
              );
              flightRef.current?.pause();
              pipVideosRef.current.forEach((video) => video.pause());
              overlayRef.current?.pause();
              syncMediaRef.current?.(true);
            }
          },
          onError: () => {
            if (cancelled) return;
            playbackRequestedRef.current = false;
            youtubePipPlayersRef.current.forEach((player) =>
              player.pauseVideo()
            );
            pipVideosRef.current.forEach((video) => video.pause());
            setYoutubeReady(false);
            setYoutubeFailed(true);
          },
        },
      });
      youtubeRef.current = player;
    };
    void load().catch(() => {
      if (!cancelled) setYoutubeReady(false);
    });
    return () => {
      cancelled = true;
      player?.destroy();
      if (youtubeRef.current === player) youtubeRef.current = null;
    };
  }, [
    cueYoutubeAt,
    hasPlaybackIntent,
    isInteractive,
    restoreFullscreenPlayback,
    youtubeId,
  ]);

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
    let pipSyncFrame: number | null = null;
    const load = async () => {
      const api = await loadYoutubeApi();
      if (cancelled) return;
      pipsRef.current.forEach((pip) => {
        const videoId = pip.youtubeUrl
          ? getYoutubeVideoId(pip.youtubeUrl)
          : null;
        const host = youtubePipHosts.get(pip.id);
        if (!videoId || !host) return;
        const playerHost = document.createElement('div');
        host.replaceChildren(playerHost);
        const player = new api.Player(playerHost, {
          height: '100%',
          width: '100%',
          videoId,
          playerVars: {
            autoplay: 0,
            controls: 0,
            fs: 0,
            playsinline: 1,
            origin: window.location.origin,
          },
          events: {
            onReady: () => {
              if (cancelled) return;
              player.mute();
              const currentPip = pipsRef.current.find(
                ({ id }) => id === pip.id
              );
              let offset = 0;
              if (currentPip && isInteractive) {
                offset = pipSyncOffsetSeconds(
                  currentPip,
                  mainVideoRole,
                  pipOffsetSecondsRef.current
                );
              } else if (currentPip?.applyOffset !== false) {
                offset = pipOffsetSecondsRef.current;
              }
              player.cueVideoById(
                videoId,
                Math.max(0, cameraCurrentTimeRef.current - offset)
              );
              if (
                playbackRequestedRef.current &&
                (!isInteractive || cameraIsPlayingRef.current)
              ) {
                player.playVideo();
              }
            },
            onStateChange: () => {
              if (cancelled || pipSyncFrame !== null) return;
              pipSyncFrame = window.requestAnimationFrame(() => {
                pipSyncFrame = null;
                if (!cancelled) syncMediaRef.current?.(true, true);
              });
            },
          },
        });
        youtubePipPlayers.set(pip.id, player);
      });
    };
    void load().catch(() => undefined);
    return () => {
      cancelled = true;
      if (pipSyncFrame !== null) {
        window.cancelAnimationFrame(pipSyncFrame);
        pipSyncFrame = null;
      }
      youtubePipPlayers.forEach((player, id) => {
        player.destroy();
        youtubePipPlayers.delete(id);
        youtubePipHosts.get(id)?.replaceChildren();
      });
    };
  }, [isInteractive, mainVideoRole, pipYoutubeSignature, youtubeId]);

  const handlePause = () => {
    setControlsVisible(true);
    playbackRequestedRef.current = false;
    cameraIsPlayingRef.current = false;
    setCameraIsPlaying(false);
    youtubePipPlayersRef.current.forEach((player) => player.pauseVideo());
    flightRef.current?.pause();
    pipVideosRef.current.forEach((video) => video.pause());
    overlayRef.current?.pause();
    syncMedia();
  };

  const handleOverlayReady = () => {
    syncMedia();
    // The browser preview may finish converting after the camera started.
    // Retry playback at that point so the transparent layer cannot remain
    // silently paused after its source becomes playable.
    if (hasPlaybackIntent() && cameraRef.current && !cameraRef.current.paused) {
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
    syncMedia(true, true, true);
  };

  const handleTogglePlay = () => {
    if (masterIsYoutube) {
      if (!youtubeRef.current || !youtubeReady) return;
      if (youtubeRef.current.getPlayerState() === 1) {
        playbackRequestedRef.current = false;
        youtubeRef.current.pauseVideo();
      } else {
        playbackRequestedRef.current = true;
        setHasStartedMainPlayback(true);
        syncMediaRef.current?.();
        youtubeRef.current.playVideo();
      }
      return;
    }
    if (!cameraRef.current) return;
    if (cameraRef.current.paused) {
      playbackRequestedRef.current = true;
      syncMediaRef.current?.();
      void cameraRef.current.play();
    } else {
      playbackRequestedRef.current = false;
      cameraRef.current.pause();
    }
  };

  const handleToggleFullscreen = () => {
    if (!playerRef.current) return;
    const nativeFullscreen = (
      window as Window & { NativeFullscreen?: NativeFullscreenBridge }
    ).NativeFullscreen;

    if (isInteractive && nativeFullscreen) {
      const entering = !nativeFullscreenActiveRef.current;
      const waitsForOrientation =
        nativeFullscreen.supportsOrientationReady?.() === true;
      if (entering) {
        captureFullscreenPlayback(true);
      }
      nativeFullscreenActiveRef.current = entering;
      if (!waitsForOrientation) {
        setIsFullscreen(entering);
      }
      if (entering) nativeFullscreen.enter();
      else nativeFullscreen.exit();
      return;
    }

    if (isInteractive) {
      const entering = !isFullscreen;
      if (entering) {
        captureFullscreenPlayback();
      }
      setIsFullscreen(entering);
      if (document.fullscreenElement === playerRef.current) {
        if (!entering) void document.exitFullscreen().catch(() => undefined);
      } else if (entering) {
        void playerRef.current.requestFullscreen().catch(() => undefined);
      }
      return;
    }

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

  const playerElement = (
    <div
      ref={playerRef}
      className={`bg-black shadow-sm [&:fullscreen]:flex [&:fullscreen]:flex-col [&:fullscreen]:overflow-y-auto [&:fullscreen]:rounded-none ${
        isInteractive && isFullscreen
          ? 'fixed inset-0 z-[9999] flex h-[100dvh] w-screen max-w-none flex-col overflow-hidden rounded-none'
          : 'relative overflow-hidden rounded-xl'
      }`}
      onFocusCapture={handlePlayerFocus}
      onBlurCapture={handlePlayerBlur}
    >
      <div
        data-testid="flight-overlay-media-stage"
        className={`relative grid min-h-0 bg-black ${isInteractive && !isFullscreen ? 'aspect-video' : ''} ${isInteractive && isFullscreen ? 'flex-1' : ''} ${layout === 'side-by-side' ? 'grid-cols-1 md:grid-cols-2' : ''}`}
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
              if (isInteractive) handleTogglePlay();
              else if (layout === 'flight-main') setLayout('camera-main');
            }}
            aria-label={cameraLabel}
          >
            <track kind="captions" />
          </video>
        )}
        {isInteractive && masterIsYoutube && !activePip && (
          <button
            type="button"
            className="absolute inset-0 z-10 flex cursor-pointer items-center justify-center bg-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sky-400"
            aria-label={
              cameraIsPlaying
                ? t('flights.goproOverlayPause')
                : t('flights.goproOverlayPlay')
            }
            onClick={handleTogglePlay}
          >
            {!hasStartedMainPlayback && youtubeId && (
              <>
                <img
                  src={`https://i.ytimg.com/vi/${youtubeId}/mqdefault.jpg`}
                  alt=""
                  className="pointer-events-none absolute inset-0 h-full w-full object-cover"
                />
                <span className="pointer-events-none relative flex h-16 w-16 items-center justify-center rounded-full bg-sky-600 text-white shadow-lg">
                  <Play
                    className="ml-1 h-7 w-7 fill-current"
                    aria-hidden="true"
                  />
                </span>
              </>
            )}
          </button>
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
                  <>
                    <div
                      ref={(node) => {
                        if (node) youtubePipHostsRef.current.set(pip.id, node);
                        else youtubePipHostsRef.current.delete(pip.id);
                      }}
                      className="h-full w-full"
                    />
                    {!hasStartedMainPlayback && (
                      <img
                        src={`https://i.ytimg.com/vi/${youtubePipId}/mqdefault.jpg`}
                        alt=""
                        className="pointer-events-none absolute inset-0 h-full w-full object-cover"
                      />
                    )}
                  </>
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
          <div
            className="absolute left-3 top-3 z-40 flex max-w-[calc(100%-1.5rem)] flex-wrap gap-2"
            aria-live="polite"
          >
            {activeVideoMarkers.map((marker) => (
              <button
                key={marker.id}
                type="button"
                className="cursor-pointer rounded-lg border border-white/20 bg-slate-950/90 px-3 py-2 text-sm font-semibold text-white shadow-lg transition-colors hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={!canSeekVideoMarkers}
                aria-label={t('flights.overlayVideoMarkerAt', {
                  title: getVideoMarkerTitle(marker, videoMarkerLabels),
                  time: formatVideoMarkerTime(marker.timestamp_seconds),
                })}
                onClick={() => {
                  if (youtubeId)
                    cueYoutubeAt(youtubeId, marker.timestamp_seconds);
                }}
              >
                {getVideoMarkerTitle(marker, videoMarkerLabels)}
              </button>
            ))}
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
            className={`absolute inset-x-0 bottom-0 z-40 max-h-full overflow-y-auto bg-gradient-to-t from-slate-950 via-slate-950/95 to-slate-950/0 px-3 pb-3 pt-12 text-white transition-opacity duration-200 sm:px-4 sm:pb-4 ${controlsVisible ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'}`}
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
                onChange={(event) => {
                  const time = Number(event.target.value);
                  if (isFullscreen) {
                    fullscreenSeekTargetRef.current = time;
                    fullscreenPlaybackSnapshotRef.current = {
                      currentTime: time,
                      wasPlaying:
                        cameraIsPlayingRef.current ||
                        playbackRequestedRef.current,
                    };
                  }
                  if (masterIsYoutube) {
                    if (
                      isInteractive &&
                      youtubeId &&
                      !playbackRequestedRef.current
                    ) {
                      cueYoutubeAt(youtubeId, time);
                    } else {
                      youtubeRef.current?.seekTo(time, true);
                    }
                  } else {
                    handleTimelineChange(time);
                  }
                }}
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
            {sortedVideoMarkers.length > 0 && (
              <ul
                className="mt-2 m-0 flex max-w-full list-none gap-2 overflow-x-auto p-0 pb-1"
                aria-label={t('flights.overlayVideoMarkersLabel')}
              >
                {sortedVideoMarkers.map((marker) => (
                  <li key={marker.id} className="shrink-0">
                    <button
                      type="button"
                      className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-white/15 bg-slate-800/90 px-2.5 py-1 text-xs text-slate-100 transition-colors hover:bg-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 disabled:cursor-not-allowed disabled:opacity-60"
                      disabled={!canSeekVideoMarkers}
                      aria-label={t('flights.overlayVideoMarkerAt', {
                        title: getVideoMarkerTitle(marker, videoMarkerLabels),
                        time: formatVideoMarkerTime(marker.timestamp_seconds),
                      })}
                      onClick={() => {
                        if (youtubeId)
                          cueYoutubeAt(youtubeId, marker.timestamp_seconds);
                      }}
                    >
                      <time className="font-mono text-sky-200">
                        {formatVideoMarkerTime(marker.timestamp_seconds)}
                      </time>
                      <span>
                        {getVideoMarkerTitle(marker, videoMarkerLabels)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );

  if (!isInteractive) return playerElement;

  return (
    <div ref={playerMountRef} className="min-w-0 w-full">
      {fullscreenPortalHost &&
        createPortal(playerElement, fullscreenPortalHost)}
    </div>
  );
}
