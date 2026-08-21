import { Button, Modal } from '@dashboard-parapente/design-system';
import type { YoutubeVideoAssociation } from '@dashboard-parapente/shared-types';
import { TriangleAlert } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface YoutubeAssociationRemovalModalProps {
  association: YoutubeVideoAssociation | null;
  isPending: boolean;
  onCancel: () => void;
  onRemove: (deleteFromYoutube: boolean) => void;
}

export function YoutubeAssociationRemovalModal({
  association,
  isPending,
  onCancel,
  onRemove,
}: YoutubeAssociationRemovalModalProps) {
  const { t } = useTranslation();
  const canDelete = association?.can_delete_from_youtube === true;

  return (
    <Modal
      isOpen={association !== null}
      onClose={() => {
        if (!isPending) onCancel();
      }}
      title={t('flights.youtubeRemovalDialogTitle')}
      size="sm"
      role="alertdialog"
    >
      <div className="space-y-5">
        <p className="text-sm leading-6 text-gray-600 dark:text-gray-300">
          {canDelete
            ? t('flights.youtubeRemovalOwnedDescription')
            : t('flights.youtubeRemovalManualDescription')}
        </p>

        {canDelete && (
          <div className="flex gap-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900 dark:border-red-900 dark:bg-red-950/40 dark:text-red-100">
            <TriangleAlert
              className="mt-0.5 h-5 w-5 shrink-0"
              aria-hidden="true"
            />
            <span>{t('flights.youtubeRemovalPermanentWarning')}</span>
          </div>
        )}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
          <Button variant="ghost" onPress={onCancel} isDisabled={isPending}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="outline"
            onPress={() => onRemove(false)}
            isDisabled={isPending}
          >
            {isPending
              ? t('flights.youtubeAssociationRemoving')
              : t('flights.youtubeRemovalDissociate')}
          </Button>
          {canDelete && (
            <Button
              variant="danger"
              onPress={() => onRemove(true)}
              isDisabled={isPending}
            >
              {isPending
                ? t('flights.youtubeAssociationRemoving')
                : t('flights.youtubeRemovalDeletePermanently')}
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}
