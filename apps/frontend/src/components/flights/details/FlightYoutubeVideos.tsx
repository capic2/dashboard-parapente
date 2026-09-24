import { Button } from '@dashboard-parapente/design-system';
import { Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getYoutubeEmbedUrl } from '../../../lib/youtube';
import { useStartYoutubeOverlayExport } from '../../../hooks/flights/useYoutubeUpload';

interface FlightYoutubeVideosProps {
  flightId: string;
  urls?: string[];
  removingUrl?: string | null;
  onRemove?: (url: string) => void;
}

const EMPTY_URLS: string[] = [];

export function FlightYoutubeVideos({
  flightId,
  urls = EMPTY_URLS,
  removingUrl = null,
  onRemove,
}: FlightYoutubeVideosProps) {
  const { t } = useTranslation();
  const startExport = useStartYoutubeOverlayExport(flightId);
  const [exportUrl, setExportUrl] = useState<string | null>(null);
  const [rightsConfirmed, setRightsConfirmed] = useState(false);
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
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; xr-spatial-tracking"
              referrerPolicy="origin"
              allowFullScreen
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
              <Button
                variant="ghost"
                className="min-h-9 shrink-0 rounded-lg px-2 py-1 text-sm text-cyan-300 hover:text-cyan-200"
                onPress={() => {
                  setExportUrl(url);
                  setRightsConfirmed(false);
                }}
              >
                {t('flights.youtubeOverlayExport')}
              </Button>
            </div>
          </div>
        ))}
      </div>
      {exportUrl && (
        <div className="mt-4 rounded-xl border border-cyan-200 bg-cyan-50 p-4 dark:border-cyan-800 dark:bg-cyan-950/30">
          <h4 className="font-semibold text-slate-900 dark:text-white">
            {t('flights.youtubeOverlayExportTitle')}
          </h4>
          <p className="mt-1 text-sm text-slate-700 dark:text-slate-200">
            {t('flights.youtubeOverlayExportDescription')}
          </p>
          <label className="mt-3 flex items-start gap-2 text-sm text-slate-800 dark:text-slate-100">
            <input
              type="checkbox"
              checked={rightsConfirmed}
              onChange={(event) => setRightsConfirmed(event.target.checked)}
            />
            {t('flights.youtubeOverlayExportRights')}
          </label>
          <div className="mt-3 flex gap-2">
            <Button variant="secondary" onPress={() => setExportUrl(null)}>
              {t('common.cancel')}
            </Button>
            <Button
              isDisabled={!rightsConfirmed || startExport.isPending}
              onPress={async () => {
                if (!exportUrl || !rightsConfirmed) return;
                await startExport.mutateAsync({
                  youtube_url: exportUrl,
                  rights_confirmed: true,
                });
                setExportUrl(null);
              }}
            >
              {startExport.isPending
                ? t('common.loading')
                : t('flights.youtubeOverlayExportStart')}
            </Button>
          </div>
          {startExport.isError && (
            <p
              className="mt-2 text-sm text-red-700 dark:text-red-300"
              role="alert"
            >
              {t('flights.youtubeOverlayExportError')}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
