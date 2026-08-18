import { useTranslation } from 'react-i18next';
import { getYoutubeEmbedUrl } from '../../../lib/youtube';

interface FlightYoutubeVideosProps {
  urls?: string[];
}

const EMPTY_URLS: string[] = [];

export function FlightYoutubeVideos({
  urls = EMPTY_URLS,
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
            {/* oxlint-disable-next-line react/iframe-missing-sandbox -- The source is restricted to validated youtube-nocookie.com video IDs; YouTube playback does not work inside the restrictive sandbox. */}
            <iframe
              src={embedUrl}
              title={t('flights.youtubeVideoTitle', { count: index + 1 })}
              className="aspect-video w-full"
              loading="lazy"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              referrerPolicy="strict-origin-when-cross-origin"
              allowFullScreen
            />
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className="block cursor-pointer truncate bg-gray-900 px-3 py-3 text-sm text-gray-200 underline-offset-2 transition-colors hover:bg-gray-800 hover:underline focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-400"
            >
              {t('flights.openOnYoutube')}
            </a>
          </div>
        ))}
      </div>
    </section>
  );
}
