import { useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Columns2, PictureInPicture2, Repeat2 } from 'lucide-react';

export type FlightOverlayLayout =
  | 'camera-main'
  | 'flight-main'
  | 'side-by-side';

interface FlightOverlayPlayerProps {
  cameraUrl: string;
  flightUrl: string;
  overlayUrl?: string;
  cameraLabel: string;
  flightLabel: string;
  overlayContent?: ReactNode;
}

function clamp(value: number, maximum: number) {
  return Math.max(
    0,
    Math.min(value, Number.isFinite(maximum) ? maximum : value)
  );
}

export function FlightOverlayPlayer({
  cameraUrl,
  flightUrl,
  overlayUrl,
  cameraLabel,
  flightLabel,
  overlayContent,
}: FlightOverlayPlayerProps) {
  const { t } = useTranslation();
  const cameraRef = useRef<HTMLVideoElement>(null);
  const flightRef = useRef<HTMLVideoElement>(null);
  const overlayRef = useRef<HTMLVideoElement>(null);
  const [layout, setLayout] = useState<FlightOverlayLayout>('camera-main');

  const syncMedia = () => {
    const camera = cameraRef.current;
    if (!camera) return;
    const currentTime = camera.currentTime;
    const flight = flightRef.current;
    if (flight && Math.abs(flight.currentTime - currentTime) > 0.12) {
      flight.currentTime = clamp(currentTime, flight.duration);
    }
    const overlay = overlayRef.current;
    if (overlay && Math.abs(overlay.currentTime - currentTime) > 0.08) {
      overlay.currentTime = clamp(currentTime, overlay.duration);
    }
  };

  const handlePlay = () => {
    syncMedia();
    void flightRef.current?.play();
    void overlayRef.current?.play();
  };

  const handlePause = () => {
    flightRef.current?.pause();
    overlayRef.current?.pause();
  };

  const cameraIsMain = layout === 'camera-main';
  const flightIsMain = layout === 'flight-main';

  return (
    <div className="overflow-hidden rounded-xl bg-black shadow-sm">
      <div
        className={`relative grid min-h-0 bg-black ${layout === 'side-by-side' ? 'grid-cols-1 md:grid-cols-2' : ''}`}
      >
        <video
          ref={cameraRef}
          src={cameraUrl}
          controls
          playsInline
          preload="metadata"
          onPlay={handlePlay}
          onPause={handlePause}
          onTimeUpdate={syncMedia}
          onSeeked={syncMedia}
          className={
            cameraIsMain || layout === 'side-by-side'
              ? 'aspect-video w-full object-contain'
              : 'pointer-events-none absolute inset-0 z-20 h-full w-full opacity-0'
          }
          aria-label={cameraLabel}
        >
          <track kind="captions" />
        </video>
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
        {overlayUrl && (
          <video
            ref={overlayRef}
            src={overlayUrl}
            playsInline
            preload="metadata"
            muted
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
    </div>
  );
}
