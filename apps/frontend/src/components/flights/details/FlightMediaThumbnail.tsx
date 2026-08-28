import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Lightbox } from '@dashboard-parapente/design-system';
import { ImageOff, LoaderCircle, Maximize2, Play } from 'lucide-react';
import { api, getApiUrl } from '../../../lib/api';

interface FlightMediaThumbnailProps {
  path: string;
  alt: string;
  interactive?: boolean;
  videoPath?: string;
}

function ThumbnailUnavailable({ inline = false }: { inline?: boolean }) {
  const { t } = useTranslation();
  const Container = inline ? 'span' : 'div';
  return (
    <Container className="flex aspect-video w-full items-center justify-center bg-slate-200 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
      <ImageOff className="h-7 w-7" aria-hidden="true" />
      <span className="sr-only">{t('flights.mediaThumbnailUnavailable')}</span>
    </Container>
  );
}

function ThumbnailLoading({ inline = false }: { inline?: boolean }) {
  const { t } = useTranslation();
  const Container = inline ? 'span' : 'div';
  return (
    <Container className="flex aspect-video w-full items-center justify-center bg-slate-200 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
      <LoaderCircle
        className="h-6 w-6 motion-safe:animate-spin"
        aria-hidden="true"
      />
      <span className="sr-only">{t('common.loading')}</span>
    </Container>
  );
}

function LoadedThumbnail({
  blob,
  alt,
  interactive,
  videoPath,
}: {
  blob: Blob;
  alt: string;
  interactive: boolean;
  videoPath?: string;
}) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    const objectUrl = URL.createObjectURL(blob);
    // eslint-disable-next-line react/set-state-in-effect -- Object URLs must be created outside render.
    setSrc(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [blob]);

  if (hasError) return <ThumbnailUnavailable inline={!interactive} />;
  if (!src) return <ThumbnailLoading inline={!interactive} />;

  if (!interactive) {
    return (
      <span className="relative block aspect-video w-full overflow-hidden bg-slate-200 dark:bg-slate-800">
        <img
          src={src}
          alt={alt}
          loading="lazy"
          className="h-full w-full object-cover"
          onError={() => {
            URL.revokeObjectURL(src);
            setHasError(true);
          }}
        />
      </span>
    );
  }

  if (videoPath && isPlaying) {
    return (
      <div className="relative block aspect-video w-full overflow-hidden bg-black">
        <video
          className="h-full w-full object-contain"
          src={getApiUrl(videoPath)}
          controls
          autoPlay
          playsInline
          preload="metadata"
          aria-label={alt}
        >
          <track kind="captions" />
        </video>
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        className="group/thumbnail relative block aspect-video w-full cursor-pointer overflow-hidden bg-slate-200 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500 dark:bg-slate-800"
        onClick={() => (videoPath ? setIsPlaying(true) : setIsOpen(true))}
        aria-label={
          videoPath
            ? t('flights.playMediaVideo', { name: alt })
            : t('flights.openMediaThumbnail', { name: alt })
        }
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
          {videoPath ? (
            <Play className="h-3.5 w-3.5" aria-hidden="true" />
          ) : (
            <Maximize2 className="h-3.5 w-3.5" aria-hidden="true" />
          )}
          {videoPath
            ? t('flights.playMediaVideoShort')
            : t('flights.enlargeMediaThumbnail')}
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

export function FlightMediaThumbnail({
  path,
  alt,
  interactive = true,
  videoPath,
}: FlightMediaThumbnailProps) {
  const { data, dataUpdatedAt, isError } = useQuery({
    queryKey: ['flight-media-thumbnail', path],
    queryFn: ({ signal }) => api.get(path, { signal }).blob(),
    retry: false,
  });

  if (isError) return <ThumbnailUnavailable inline={!interactive} />;
  if (!data) return <ThumbnailLoading inline={!interactive} />;

  return (
    <LoadedThumbnail
      key={`${path}:${dataUpdatedAt}`}
      blob={data}
      alt={alt}
      interactive={interactive}
      videoPath={videoPath}
    />
  );
}
