import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { Button, Modal } from '@dashboard-parapente/design-system';
import { Tv, Upload, X } from 'lucide-react';
import type { Flight } from '../../../types';
import {
  useCancelYoutubeUpload,
  useStartYoutubeUpload,
  useYoutubeAuthorizationUrl,
  useYoutubeStatus,
  useYoutubeUpload,
  youtubeVideoAssociationsQueryKey,
  type YoutubeUploadSource,
} from '../../../hooks/flights/useYoutubeUpload';
import { useToast } from '../../../hooks/useToast';
import { getApiErrorMessage } from '../../../lib/api';

interface FlightYoutubeUploadControlsProps {
  flight: Flight;
  source: YoutubeUploadSource;
}

type PrivacyStatus = 'private' | 'unlisted' | 'public';

export function FlightYoutubeUploadControls({
  flight,
  source,
}: FlightYoutubeUploadControlsProps) {
  const { t } = useTranslation();
  const toast = useToast();
  const queryClient = useQueryClient();
  const connection = useYoutubeStatus();
  const upload = useYoutubeUpload(flight.id, source);
  const activeUpload = useYoutubeUpload(flight.id);
  const startUpload = useStartYoutubeUpload(flight.id);
  const cancelUpload = useCancelYoutubeUpload(flight.id);
  const authorizationUrl = useYoutubeAuthorizationUrl();
  const previousStatus = useRef(upload.data?.status);
  const [isOpen, setIsOpen] = useState(false);
  const [title, setTitle] = useState(
    flight.name ?? flight.title ?? `Vol du ${flight.flight_date}`
  );
  const [description, setDescription] = useState(
    flight.description ?? flight.notes ?? ''
  );
  const [privacyStatus, setPrivacyStatus] = useState<PrivacyStatus>('private');

  const hasActiveUpload =
    activeUpload.data?.status === 'queued' ||
    activeUpload.data?.status === 'uploading';
  const isActive =
    upload.data?.status === 'queued' || upload.data?.status === 'uploading';
  const isPublished = Boolean(
    upload.data?.status === 'completed' &&
    upload.data.youtube_url &&
    flight.youtube_urls?.includes(upload.data.youtube_url)
  );

  useEffect(() => {
    if (
      previousStatus.current &&
      previousStatus.current !== 'completed' &&
      upload.data?.status === 'completed'
    ) {
      toast.success(t('flights.youtubeUploadCompleted'));
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: ['flights'] }),
        queryClient.invalidateQueries({
          queryKey: youtubeVideoAssociationsQueryKey(flight.id),
        }),
      ]);
    }
    previousStatus.current = upload.data?.status;
  }, [flight.id, queryClient, t, toast, upload.data?.status]);

  const handlePrimaryAction = async () => {
    if (!connection.data?.configured) {
      toast.error(t('flights.youtubeUploadNotConfigured'));
      return;
    }
    if (!connection.data.connected) {
      try {
        const returnTo = `${window.location.pathname}${window.location.search}`;
        const result = await authorizationUrl.mutateAsync(returnTo);
        window.location.assign(result.authorization_url);
      } catch (error) {
        toast.error(
          await getApiErrorMessage(error, t('flights.youtubeConnectionError'))
        );
      }
      return;
    }
    setIsOpen(true);
  };

  const handleUpload = async () => {
    try {
      await startUpload.mutateAsync({
        ...source,
        title,
        description,
        privacy_status: privacyStatus,
      });
      setIsOpen(false);
      toast.success(t('flights.youtubeUploadStarted'));
    } catch (error) {
      toast.error(
        await getApiErrorMessage(error, t('flights.youtubeUploadError'))
      );
    }
  };

  const handleCancel = async () => {
    try {
      await cancelUpload.mutateAsync();
      toast.success(t('flights.youtubeUploadCancelled'));
    } catch (error) {
      toast.error(
        await getApiErrorMessage(error, t('flights.youtubeUploadCancelError'))
      );
    }
  };

  let label = t('flights.youtubeUpload');
  if (connection.isLoading || upload.isLoading) {
    label = t('common.loading');
  } else if (isActive) {
    label = cancelUpload.isPending
      ? t('common.stopping')
      : t('flights.youtubeUploadStop', {
          progress: upload.data?.progress ?? 0,
        });
  } else if (!connection.data?.connected) {
    label = t('flights.youtubeConnect');
  } else if (isPublished) {
    label = t('flights.youtubeUploadPublished');
  } else if (upload.data?.status === 'failed') {
    label = t('flights.youtubeUploadRetry');
  }
  let buttonTitle = upload.data?.error ?? t('flights.youtubeUploadTitle');
  if (isActive) {
    buttonTitle = t('flights.youtubeUploadStopTitle');
  } else if (isPublished) {
    buttonTitle = t('flights.youtubeUploadPublished');
  } else if (hasActiveUpload) {
    buttonTitle = t('flights.youtubeUploadOtherOverlayInProgress');
  }

  return (
    <>
      <Button
        variant="outline"
        className="min-h-10 w-full rounded-lg border-red-200 px-3 py-2 text-sm text-red-700 transition-colors hover:bg-red-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950/30"
        onPress={() => void (isActive ? handleCancel() : handlePrimaryAction())}
        isDisabled={
          connection.isLoading ||
          upload.isLoading ||
          isPublished ||
          (hasActiveUpload && !isActive) ||
          authorizationUrl.isPending ||
          cancelUpload.isPending
        }
        title={buttonTitle}
      >
        {isActive ? (
          <X className="h-4 w-4" aria-hidden="true" />
        ) : (
          <Tv className="h-4 w-4" aria-hidden="true" />
        )}
        {label}
      </Button>

      <Modal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title={t('flights.youtubeUploadDialogTitle')}
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-300">
            {t('flights.youtubeUploadDialogDescription')}
          </p>
          <div className="flex flex-col gap-1">
            <label
              htmlFor={`youtube-title-${flight.id}-${source.source_type}`}
              className="text-sm font-medium text-gray-700 dark:text-gray-200"
            >
              {t('flights.youtubeUploadTitleLabel')}
            </label>
            <input
              id={`youtube-title-${flight.id}-${source.source_type}`}
              value={title}
              maxLength={100}
              onChange={(event) => setTitle(event.currentTarget.value)}
              className="min-h-10 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label
              htmlFor={`youtube-description-${flight.id}-${source.source_type}`}
              className="text-sm font-medium text-gray-700 dark:text-gray-200"
            >
              {t('flights.youtubeUploadDescriptionLabel')}
            </label>
            <textarea
              id={`youtube-description-${flight.id}-${source.source_type}`}
              value={description}
              maxLength={5000}
              rows={4}
              onChange={(event) => setDescription(event.currentTarget.value)}
              className="resize-y rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label
              htmlFor={`youtube-privacy-${flight.id}-${source.source_type}`}
              className="text-sm font-medium text-gray-700 dark:text-gray-200"
            >
              {t('flights.youtubeUploadPrivacyLabel')}
            </label>
            <select
              id={`youtube-privacy-${flight.id}-${source.source_type}`}
              value={privacyStatus}
              onChange={(event) =>
                setPrivacyStatus(event.currentTarget.value as PrivacyStatus)
              }
              className="min-h-10 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
            >
              <option value="private">
                {t('flights.youtubePrivacyPrivate')}
              </option>
              <option value="unlisted">
                {t('flights.youtubePrivacyUnlisted')}
              </option>
              <option value="public">
                {t('flights.youtubePrivacyPublic')}
              </option>
            </select>
          </div>
          <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">
            {t('flights.youtubeUploadPrivacyHint')}
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onPress={() => setIsOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              onPress={() => void handleUpload()}
              isDisabled={!title.trim() || startUpload.isPending}
            >
              <Upload className="h-4 w-4" aria-hidden="true" />
              {startUpload.isPending
                ? t('flights.youtubeUploadStarting')
                : t('flights.youtubeUploadConfirm')}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
