import { useTranslation } from 'react-i18next';
import { Button } from '@dashboard-parapente/design-system';
import { CloudUpload } from 'lucide-react';
import { useUploadFlightToSportstracklive } from '../../../hooks/flights/useSportstrackliveUpload';
import { useToast } from '../../../hooks/useToast';
import { getApiErrorMessage } from '../../../lib/api';

interface FlightSportstrackliveUploadButtonProps {
  flightId: string;
  status?: 'queued' | 'uploading' | 'uploaded' | 'failed' | null;
  error?: string | null;
}

export function FlightSportstrackliveUploadButton({
  flightId,
  status,
  error,
}: FlightSportstrackliveUploadButtonProps) {
  const { t } = useTranslation();
  const toast = useToast();
  const upload = useUploadFlightToSportstracklive(flightId);
  const isUploaded = status === 'uploaded';
  const isUploading =
    status === 'queued' || status === 'uploading' || upload.isPending;
  let label = t('flights.sportstrackliveUpload');
  if (isUploaded) {
    label = t('flights.sportstrackliveUploadDone');
  } else if (isUploading) {
    label = t('flights.sportstrackliveUploadInProgress');
  } else if (status === 'failed') {
    label = t('flights.sportstrackliveUploadRetry');
  }

  const handleUpload = async () => {
    try {
      await upload.mutateAsync();
      toast.success(t('flights.sportstrackliveUploadSuccess'));
    } catch (uploadError) {
      toast.error(
        await getApiErrorMessage(
          uploadError,
          t('flights.sportstrackliveUploadError')
        )
      );
    }
  };

  return (
    <div className="flex min-w-0 flex-col items-start gap-1">
      <Button
        variant="ghost"
        className="min-h-10 rounded-lg px-3 py-2 text-sm"
        onPress={() => void handleUpload()}
        isDisabled={isUploaded || isUploading}
      >
        <CloudUpload className="h-4 w-4" aria-hidden="true" />
        {label}
      </Button>
      {error && (
        <p
          role="alert"
          className="max-w-xs break-words text-xs text-red-600 dark:text-red-400"
        >
          {error}
        </p>
      )}
    </div>
  );
}
