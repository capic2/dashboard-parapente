import { Button } from '@dashboard-parapente/core/Button/Button';
import type { YoutubeVideoAssociation } from '@dashboard-parapente/shared-types';
import {
  Clipboard,
  ExternalLink,
  LoaderCircle,
  Play,
  Trash2,
} from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useToast } from '../../../hooks/useToast';
import { getYoutubeEmbedUrl, getYoutubeVideoId } from '../../../lib/youtube';

interface FlightYoutubeVideosProps {
  urls?: string[];
  associations?: YoutubeVideoAssociation[];
  removingUrl?: string | null;
  onRemove?: (url: string) => void;
}

const EMPTY_URLS: string[] = [];

export function FlightYoutubeVideos({
  urls = EMPTY_URLS,
  associations = [],
  removingUrl = null,
  onRemove,
}: FlightYoutubeVideosProps) {
  const { t } = useTranslation();
  const toast = useToast();
  const [activeVideoIds, setActiveVideoIds] = useState<Set<string>>(
    () => new Set()
  );
  const copyYoutubeLink = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success(t('flights.youtubeLinkCopied'));
    } catch {
      toast.error(t('flights.youtubeLinkCopyError'));
    }
  };
  const videos = urls.flatMap((url) => {
    const embedUrl = getYoutubeEmbedUrl(url);
    const videoId = getYoutubeVideoId(url);
    const title = associations
      .find((association) => association.video_id === videoId)
      ?.title?.trim();
    const isTelemetryVideo =
      /(?:^|[\s:–—-])(?:télémétrie|telemetry)(?:\s+(?:overlay|video))?\s*$/iu.test(
        title ?? ''
      );
    return embedUrl && videoId
      ? [{ embedUrl, videoId, url, title, isTelemetryVideo }]
      : [];
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
        {videos.map(
          ({ embedUrl, videoId, url, title, isTelemetryVideo }, index) => (
            <div
              key={embedUrl}
              className="min-w-0 overflow-hidden rounded-lg bg-gray-900 shadow-sm"
            >
              {activeVideoIds.has(videoId) ? (
                // oxlint-disable-next-line react/iframe-missing-sandbox -- The source is restricted to validated youtube-nocookie.com video IDs; YouTube playback does not work inside the restrictive sandbox.
                <iframe
                  src={embedUrl}
                  title={
                    title ||
                    t('flights.youtubeVideoTitle', { count: index + 1 })
                  }
                  className="aspect-video w-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; xr-spatial-tracking"
                  referrerPolicy="origin"
                  allowFullScreen
                />
              ) : (
                <button
                  type="button"
                  className="group relative flex aspect-video w-full cursor-pointer items-center justify-center overflow-hidden bg-black text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-400"
                  aria-label={t('flights.playYoutubeVideo', {
                    count: index + 1,
                  })}
                  aria-describedby={`youtube-video-title-${videoId}`}
                  onClick={() =>
                    setActiveVideoIds((current) =>
                      new Set(current).add(videoId)
                    )
                  }
                >
                  <img
                    src={`https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`}
                    alt=""
                    className="absolute inset-0 h-full w-full object-cover transition-opacity group-hover:opacity-80"
                    loading="lazy"
                  />
                </button>
              )}
              <div className="space-y-3 bg-gray-900 p-3 sm:p-4">
                <h4
                  id={`youtube-video-title-${videoId}`}
                  className="text-sm font-semibold leading-5 break-words text-white"
                >
                  {title ||
                    t('flights.youtubeVideoTitle', { count: index + 1 })}
                </h4>
                {isTelemetryVideo && (
                  <a
                    href={`https://studio.youtube.com/video/${videoId}/edit`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg bg-sky-600 px-3 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-sky-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900"
                  >
                    <ExternalLink
                      className="h-4 w-4 shrink-0"
                      aria-hidden="true"
                    />
                    <span>{t('flights.openYoutubeStudio')}</span>
                  </a>
                )}
                <div className="flex items-center gap-2">
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-10 min-w-0 flex-1 items-center justify-center gap-2 rounded-lg border border-gray-700 px-3 py-2 text-sm font-medium text-gray-200 transition-colors hover:border-gray-500 hover:bg-gray-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900"
                  >
                    <Play
                      className="h-4 w-4 shrink-0 text-red-400"
                      aria-hidden="true"
                    />
                    <span className="truncate">
                      {t('flights.openOnYoutube')}
                    </span>
                  </a>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="shrink-0 text-gray-300 hover:bg-gray-800 hover:text-white focus-visible:ring-sky-400 focus-visible:ring-offset-gray-900"
                    aria-label={t('flights.copyYoutubeLink')}
                    title={t('flights.copyYoutubeLink')}
                    onPress={() => void copyYoutubeLink(url)}
                  >
                    <Clipboard className="h-4 w-4" aria-hidden="true" />
                  </Button>
                  {onRemove && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="shrink-0 text-gray-400 hover:bg-red-950/40 hover:text-red-300 focus-visible:ring-red-400 focus-visible:ring-offset-gray-900"
                      aria-label={
                        removingUrl === url
                          ? t('flights.youtubeAssociationRemoving')
                          : t('flights.removeYoutubeAssociation')
                      }
                      title={
                        removingUrl === url
                          ? t('flights.youtubeAssociationRemoving')
                          : t('flights.removeYoutubeAssociation')
                      }
                      isDisabled={removingUrl !== null}
                      onPress={() => onRemove(url)}
                    >
                      {removingUrl === url ? (
                        <LoaderCircle
                          className="h-4 w-4 motion-safe:animate-spin"
                          aria-hidden="true"
                        />
                      ) : (
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      )}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )
        )}
      </div>
    </section>
  );
}
