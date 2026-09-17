import { Button } from '@dashboard-parapente/design-system';
import { Trash2 } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { getYoutubeEmbedUrl } from '../../../lib/youtube';

interface YoutubeSphericalProperties {
  enableOrientationSensor: boolean;
}

interface YoutubePlayer {
  setSphericalProperties: (properties: YoutubeSphericalProperties) => void;
  destroy: () => void;
}

interface YoutubeApi {
  Player: new (
    iframe: HTMLIFrameElement,
    options: { events: { onReady: (event: { target: YoutubePlayer }) => void } }
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
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (youtubeApiPromise) return youtubeApiPromise;

  youtubeApiPromise = new Promise((resolve) => {
    const previousReady = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previousReady?.();
      if (window.YT) resolve(window.YT);
    };
    const script = document.createElement('script');
    script.src = 'https://www.youtube.com/iframe_api';
    script.async = true;
    document.head.appendChild(script);
  });
  return youtubeApiPromise;
}

function YoutubeIframe({
  embedUrl,
  title,
}: {
  embedUrl: string;
  title: string;
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    let disposed = false;
    let player: YoutubePlayer | undefined;
    void loadYoutubeApi().then((youtube) => {
      if (disposed || !iframeRef.current) return;
      player = new youtube.Player(iframeRef.current, {
        events: {
          onReady: ({ target }) => {
            target.setSphericalProperties({ enableOrientationSensor: false });
          },
        },
      });
    });
    return () => {
      disposed = true;
      player?.destroy();
    };
  }, []);

  return (
    // oxlint-disable-next-line react/iframe-missing-sandbox -- YouTube playback does not work inside a restrictive sandbox.
    <iframe
      ref={iframeRef}
      src={embedUrl}
      title={title}
      className="aspect-video w-full"
      loading="lazy"
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; xr-spatial-tracking"
      referrerPolicy="origin"
      allowFullScreen
    />
  );
}

interface FlightYoutubeVideosProps {
  urls?: string[];
  removingUrl?: string | null;
  onRemove?: (url: string) => void;
}

const EMPTY_URLS: string[] = [];

export function FlightYoutubeVideos({
  urls = EMPTY_URLS,
  removingUrl = null,
  onRemove,
}: FlightYoutubeVideosProps) {
  const { t } = useTranslation();
  const videos = urls.flatMap((url) => {
    const embedUrl = getYoutubeEmbedUrl(url);
    return embedUrl ? [{ embedUrl, url }] : [];
  });

  if (videos.length === 0) return null;

  return (
    <section aria-labelledby="flight-media-youtube-title">
      <h3
        id="flight-media-youtube-title"
        className="mb-1 text-base font-semibold text-gray-900 dark:text-white"
      >
        {t('flights.youtubeVideos')}
      </h3>
      <p className="mb-4 text-sm text-slate-600 dark:text-slate-300">
        {t('flights.mediaPublishedDescription')}
      </p>
      <div className="grid gap-4 2xl:grid-cols-2">
        {videos.map(({ embedUrl, url }, index) => (
          <div
            key={embedUrl}
            className="overflow-hidden rounded-lg bg-black shadow-sm"
          >
            {/* oxlint-disable-next-line react/iframe-missing-sandbox -- YouTube playback does not work inside a restrictive sandbox. */}
            <YoutubeIframe
              embedUrl={embedUrl}
              title={t('flights.youtubeVideoTitle', { count: index + 1 })}
            />
            <div className="flex items-center justify-between gap-2 bg-gray-900 px-3 py-2">
              <a
                href={url}
                target="_blank"
                rel="noreferrer"
                className="min-w-0 flex-1 cursor-pointer truncate py-1 text-sm text-gray-200 underline-offset-2 transition-colors hover:underline focus:outline-none focus:ring-2 focus:ring-indigo-400"
              >
                {t('flights.openOnYoutube')}
              </a>
              {onRemove && (
                <Button
                  variant="ghost"
                  className="min-h-9 shrink-0 rounded-lg px-2 py-1 text-sm text-red-300 hover:text-red-200"
                  aria-label={t('flights.removeYoutubeAssociation')}
                  isDisabled={removingUrl !== null}
                  onPress={() => onRemove(url)}
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                  {removingUrl === url
                    ? t('flights.youtubeAssociationRemoving')
                    : t('flights.removeYoutubeAssociation')}
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
