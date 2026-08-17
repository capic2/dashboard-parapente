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
    <section className="mt-4 border-t border-gray-200 pt-4 dark:border-gray-700">
      <h3 className="mb-3 text-sm font-semibold text-gray-900 dark:text-white">
        {t('flights.youtubeVideos')}
      </h3>
      <div className="grid gap-4 xl:grid-cols-2">
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
              className="block truncate bg-gray-900 px-3 py-2 text-xs text-gray-200 underline-offset-2 hover:underline"
            >
              {t('flights.openOnYoutube')}
            </a>
          </div>
        ))}
      </div>
    </section>
  );
}
