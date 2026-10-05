import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Modal } from '@dashboard-parapente/design-system';
import { CircleAlert, Trash2 } from 'lucide-react';
import type { Flight } from '../../../types';
import {
  useDeleteFlightTemporaryMedia,
  useYoutubeSourcePublicationStatus,
  type TemporaryFlightMediaSource,
} from '../../../hooks/flights/useYoutubeUpload';
import { useToast } from '../../../hooks/useToast';
import { getApiErrorMessage } from '../../../lib/api';
import { FlightMediaThumbnail } from './FlightMediaThumbnail';
import { FlightYoutubeUploadControls } from './FlightYoutubeUploadControls';

interface FlightTemporaryMediaCardProps {
  flight: Flight;
  sourceType: TemporaryFlightMediaSource;
}

export function FlightTemporaryMediaCard({
  flight,
  sourceType,
}: FlightTemporaryMediaCardProps) {
  const { t } = useTranslation();
  const toast = useToast();
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const source = { source_type: sourceType } as const;
  const { upload, isPublished } = useYoutubeSourcePublicationStatus(
    flight.id,
    source,
    flight.youtube_urls ?? []
  );
  const deleteMedia = useDeleteFlightTemporaryMedia(flight.id);
  const isUploading =
    upload.data?.status === 'preparing' ||
    upload.data?.status === 'queued' ||
    upload.data?.status === 'uploading';
  const isCamera = sourceType === 'camera';
  const titleKey = {
    camera: 'flights.cameraBadge',
    pano: 'flights.panoBadge',
    face: 'flights.faceBadge',
    pilote: 'flights.piloteBadge',
  }[sourceType];
  let mediaPath = `temporary-media/${sourceType}`;
  if (isCamera) {
    mediaPath = 'gopro-camera';
  } else if (sourceType === 'pano') {
    mediaPath = 'pano';
  }
  let thumbnailAltKey = 'flights.temporaryVideoThumbnailAlt';
  if (isCamera) {
    thumbnailAltKey = 'flights.cameraThumbnailAlt';
  } else if (sourceType === 'pano') {
    thumbnailAltKey = 'flights.panoThumbnailAlt';
  }
  const title = t(titleKey);

  let publicationStatus = t('flights.temporarySourceReady');
  let publicationStatusStyle =
    'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100';
  if (isPublished) {
    publicationStatus = t('flights.temporarySourcePublished');
    publicationStatusStyle =
      'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-100';
  } else if (isUploading) {
    publicationStatus = t('flights.temporarySourceUploading', {
      progress: upload.data?.progress ?? 0,
    });
    publicationStatusStyle =
      'border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-100';
  } else if (upload.data?.status === 'failed') {
    publicationStatus = t('flights.temporarySourceFailed');
    publicationStatusStyle =
      'border-red-200 bg-red-50 text-red-900 dark:border-red-800 dark:bg-red-950/40 dark:text-red-100';
  }

  const handleDelete = async () => {
    try {
      await deleteMedia.mutateAsync(sourceType);
      setIsConfirmOpen(false);
      toast.success(t('flights.temporarySourceDeleted'));
    } catch (error) {
      toast.error(
        await getApiErrorMessage(error, t('flights.temporarySourceDeleteError'))
      );
    }
  };

  return (
    <>
      <article className="grid grid-cols-[5rem_minmax(0,1fr)] gap-3 rounded-xl border border-amber-200 bg-white p-3 dark:border-amber-900 dark:bg-slate-900/60 sm:grid-cols-[7rem_minmax(0,1fr)_auto] sm:items-center sm:gap-4">
        <div className="row-span-2 overflow-hidden rounded-lg sm:row-span-1">
          <FlightMediaThumbnail
            path={`/flights/${flight.id}/${mediaPath}/thumbnail`}
            videoPath={`/flights/${flight.id}/${mediaPath}`}
            alt={t(thumbnailAltKey, { role: title })}
          />
        </div>
        <div className="min-w-0 self-center">
          <h4 className="font-semibold text-slate-950 dark:text-white">
            {title}
          </h4>
          <p
            className={`mt-1 inline-flex min-h-7 items-center rounded-md border px-2 py-1 text-xs font-semibold ${publicationStatusStyle}`}
            aria-live={isUploading ? 'polite' : undefined}
          >
            {publicationStatus}
          </p>
          {upload.data?.status === 'failed' && upload.data.error && (
            <output
              aria-live="polite"
              title={upload.data.error}
              className="mt-1 flex items-start gap-1.5 break-words text-xs leading-5 text-red-800 dark:text-red-200"
            >
              <CircleAlert
                className="mt-0.5 h-3.5 w-3.5 shrink-0"
                aria-hidden="true"
              />
              <span className="line-clamp-2 min-w-0">{upload.data.error}</span>
            </output>
          )}
        </div>
        <div className="col-span-2 grid gap-2 sm:col-span-1 sm:flex sm:flex-col">
          <FlightYoutubeUploadControls
            flight={flight}
            source={source}
            compact
          />

          {isPublished && (
            <Button
              variant="danger"
              className="min-h-10 w-full rounded-lg px-3 py-2 text-sm sm:w-auto"
              onPress={() => setIsConfirmOpen(true)}
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
              {t('flights.temporarySourceDelete')}
            </Button>
          )}
        </div>
      </article>

      <Modal
        isOpen={isConfirmOpen}
        onClose={() => {
          if (!deleteMedia.isPending) setIsConfirmOpen(false);
        }}
        title={t('flights.temporarySourceDeleteTitle')}
        size="sm"
        role="alertdialog"
      >
        <div className="space-y-5">
          <p className="text-sm leading-6 text-gray-600 dark:text-gray-300">
            {t('flights.temporarySourceDeleteDescription', { title })}
          </p>
          <div className="flex gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
            <CircleAlert
              className="mt-0.5 h-5 w-5 shrink-0"
              aria-hidden="true"
            />
            <span>{t('flights.temporarySourceDeleteYoutubeNote')}</span>
          </div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              variant="ghost"
              onPress={() => setIsConfirmOpen(false)}
              isDisabled={deleteMedia.isPending}
            >
              {t('common.cancel')}
            </Button>
            <Button
              variant="danger"
              onPress={() => void handleDelete()}
              isDisabled={deleteMedia.isPending}
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
              {deleteMedia.isPending
                ? t('flights.temporarySourceDeleting')
                : t('flights.temporarySourceDelete')}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
