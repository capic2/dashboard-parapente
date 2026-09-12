import { useCallback, useEffect, useRef, useState } from 'react';
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
import { Columns2, PictureInPicture2, Repeat2 } from 'lucide-react';

export type FlightOverlayLayout =
  | 'camera-main'
  | 'flight-main'
  | 'side-by-side';

interface FlightOverlayPlayerProps {
  cameraUrl: string;
  flightUrl: string;
  cameraLabel: string;
  flightLabel: string;
  syncOffsetSeconds?: number;
  getFlightTime?: (cameraTime: number) => number;
  onTimeChange?: (time: number) => void;
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.max(minimum, Math.min(maximum, value));
}

export function FlightOverlayPlayer({
  cameraUrl,
  flightUrl,
  cameraLabel,
  flightLabel,
  syncOffsetSeconds = 0,
  getFlightTime,
  onTimeChange,
}: FlightOverlayPlayerProps) {
  const { t } = useTranslation();
  const playerRef = useRef<MediaPlayerInstance>(null);
  const flightRef = useRef<HTMLVideoElement>(null);
  const [layout, setLayout] = useState<FlightOverlayLayout>('camera-main');
  const [flightReady, setFlightReady] = useState(false);

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

  useEffect(() => {
    syncFlight(playerRef.current?.state.currentTime ?? 0);
  }, [syncFlight]);

  const handleTimeUpdate = () => {
    const time = playerRef.current?.state.currentTime ?? 0;
    syncFlight(time);
    onTimeChange?.(time);
  };

  const handlePlay = () => {
    syncFlight(playerRef.current?.state.currentTime ?? 0);
    void flightRef.current?.play();
  };

  const handlePause = () => {
    flightRef.current?.pause();
  };

  const handleSeek = () => {
    syncFlight(playerRef.current?.state.currentTime ?? 0);
  };

  const cameraIsMain = layout === 'camera-main';
  const flightIsMain = layout === 'flight-main';

  return (
    <div className="overflow-hidden rounded-xl bg-black shadow-sm">
      <div
        className={`relative grid min-h-0 bg-black ${
          layout === 'side-by-side' ? 'grid-cols-1 md:grid-cols-2' : ''
        }`}
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
          className={
            cameraIsMain || layout === 'side-by-side'
              ? 'aspect-video w-full'
              : 'pointer-events-none absolute inset-0 z-20 h-full w-full [&_[data-media-provider]]:opacity-0'
          }
          aria-label={cameraLabel}
        >
          <MediaProvider />
          <DefaultVideoLayout icons={defaultLayoutIcons} />
        </MediaPlayer>

        <video
          ref={flightRef}
          src={flightUrl}
          playsInline
          preload="metadata"
          muted
          onLoadStart={() => setFlightReady(false)}
          onLoadedMetadata={() => setFlightReady(true)}
          className={
            flightIsMain || layout === 'side-by-side'
              ? 'aspect-video w-full object-contain'
              : 'absolute bottom-3 right-3 z-10 aspect-video w-1/3 cursor-pointer rounded-lg border-2 border-white/80 object-cover shadow-xl transition-[width] duration-200 hover:border-sky-300'
          }
          onClick={() => {
            if (layout === 'camera-main') setLayout('flight-main');
          }}
          aria-label={flightLabel}
        />

        {layout !== 'side-by-side' && (
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
