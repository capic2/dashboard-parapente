import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Lightbox } from '@dashboard-parapente/design-system';
import { ImageOff, LoaderCircle, Maximize2 } from 'lucide-react';
import { api } from '../../../lib/api';

interface FlightMediaThumbnailProps {
  path: string;
  alt: string;
}

function ThumbnailUnavailable() {
  const { t } = useTranslation();
  return (
    <div className="flex aspect-video w-full items-center justify-center bg-slate-200 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
      <ImageOff className="h-7 w-7" aria-hidden="true" />
      <span className="sr-only">{t('flights.mediaThumbnailUnavailable')}</span>
    </div>
  );
}

function ThumbnailLoading() {
  const { t } = useTranslation();
  return (
    <div className="flex aspect-video w-full items-center justify-center bg-slate-200 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
      <LoaderCircle
        className="h-6 w-6 motion-safe:animate-spin"
        aria-hidden="true"
      />
      <span className="sr-only">{t('common.loading')}</span>
    </div>
  );
}

function LoadedThumbnail({ blob, alt }: { blob: Blob; alt: string }) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    const objectUrl = URL.createObjectURL(blob);
    // eslint-disable-next-line react/set-state-in-effect -- Object URLs must be created outside render.
    setSrc(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [blob]);

  if (hasError) return <ThumbnailUnavailable />;
  if (!src) return <ThumbnailLoading />;

  return (
    <>
      <button
        type="button"
        className="group/thumbnail relative block aspect-video w-full cursor-pointer overflow-hidden bg-slate-200 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500 dark:bg-slate-800"
        onClick={() => setIsOpen(true)}
        aria-label={t('flights.openMediaThumbnail', { name: alt })}
      >
        <img
          src={src}
          alt={alt}
          loading="lazy"
          className="h-full w-full object-cover transition-opacity duration-200 group-hover/thumbnail:opacity-90"
          onError={() => {
            URL.revokeObjectURL(src);
            setHasError(true);
          }}
        />
        <span className="absolute bottom-2 right-2 flex items-center gap-1 rounded-full bg-slate-950/75 px-2 py-1 text-xs font-semibold text-white">
          <Maximize2 className="h-3.5 w-3.5" aria-hidden="true" />
          {t('flights.enlargeMediaThumbnail')}
        </span>
      </button>
      <Lightbox
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        images={[{ src, alt }]}
      />
    </>
  );
}

export function FlightMediaThumbnail({ path, alt }: FlightMediaThumbnailProps) {
  const { data, dataUpdatedAt, isError } = useQuery({
    queryKey: ['flight-media-thumbnail', path],
    queryFn: ({ signal }) => api.get(path, { signal }).blob(),
    retry: false,
  });

  if (isError) return <ThumbnailUnavailable />;
  if (!data) return <ThumbnailLoading />;

  return (
    <LoadedThumbnail key={`${path}:${dataUpdatedAt}`} blob={data} alt={alt} />
  );
}
