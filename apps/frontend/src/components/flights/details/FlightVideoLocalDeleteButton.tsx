import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Modal } from '@dashboard-parapente/design-system';
import { CircleAlert, Trash2 } from 'lucide-react';
import type { Flight } from '../../../types';
import {
  useDeleteFlightTemporaryMedia,
  useYoutubeSourcePublicationStatus,
} from '../../../hooks/flights/useYoutubeUpload';
import { useToast } from '../../../hooks/useToast';
import { getApiErrorMessage } from '../../../lib/api';

interface FlightVideoLocalDeleteButtonProps {
  flight: Flight;
}

export function FlightVideoLocalDeleteButton({
  flight,
}: FlightVideoLocalDeleteButtonProps) {
  const { t } = useTranslation();
  const toast = useToast();
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const source = { source_type: 'video' } as const;
  const { isPublished } = useYoutubeSourcePublicationStatus(
    flight.id,
    source,
    flight.youtube_urls ?? []
  );
  const deleteMedia = useDeleteFlightTemporaryMedia(flight.id);

  const handleDelete = async () => {
    try {
      await deleteMedia.mutateAsync('video');
      setIsConfirmOpen(false);
      toast.success(t('flights.temporarySourceDeleted'));
    } catch (error) {
      toast.error(
        await getApiErrorMessage(error, t('flights.temporarySourceDeleteError'))
      );
    }
  };

  if (!isPublished) return null;

  const title = t('flights.videoBadge');

  return (
    <>
      <Button
        variant="danger"
        className="min-h-10 w-full rounded-lg px-3 py-2 text-sm sm:w-auto"
        onPress={() => setIsConfirmOpen(true)}
      >
        <Trash2 className="h-4 w-4" aria-hidden="true" />
        {t('flights.temporarySourceDelete')}
      </Button>

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
