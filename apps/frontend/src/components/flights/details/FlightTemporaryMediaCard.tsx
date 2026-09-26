import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Modal } from '@dashboard-parapente/design-system';
import { Camera, CircleAlert, Clock3, Orbit, Trash2 } from 'lucide-react';
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
  const title = t(isCamera ? 'flights.cameraBadge' : 'flights.panoBadge');
  const mediaPath = isCamera ? 'gopro-camera' : 'pano';

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
      <article className="overflow-hidden rounded-xl border border-amber-200 bg-white shadow-sm dark:border-amber-900 dark:bg-slate-900/60">
        <FlightMediaThumbnail
          path={`/flights/${flight.id}/${mediaPath}/thumbnail`}
          videoPath={`/flights/${flight.id}/${mediaPath}`}
          alt={t(
            isCamera ? 'flights.cameraThumbnailAlt' : 'flights.panoThumbnailAlt'
          )}
        />
        <div className="space-y-3 p-3">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-200">
              {isCamera ? (
                <Camera className="h-5 w-5" aria-hidden="true" />
              ) : (
                <Orbit className="h-5 w-5" aria-hidden="true" />
              )}
            </span>
            <div className="min-w-0 flex-1">
              <h4 className="font-semibold text-slate-950 dark:text-white">
                {title}
              </h4>
              <span className="mt-1 inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                <Clock3 className="h-3 w-3" aria-hidden="true" />
                {t('flights.temporarySourceBadge')}
              </span>
            </div>
          </div>

          <p
            className={`flex min-h-8 items-center rounded-lg border px-2.5 py-1.5 text-xs font-semibold ${publicationStatusStyle}`}
            aria-live={isUploading ? 'polite' : undefined}
          >
            {publicationStatus}
          </p>

          <FlightYoutubeUploadControls flight={flight} source={source} />

          {isPublished && (
            <Button
              variant="danger"
              className="min-h-10 w-full rounded-lg px-3 py-2 text-sm"
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
