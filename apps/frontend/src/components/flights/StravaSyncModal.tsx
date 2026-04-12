import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, DatePicker, Button } from '@dashboard-parapente/design-system';
import { useStravaSyncMutation } from '../../hooks/flights/useFlights';
import { useToast } from '../../hooks/useToast';

interface StravaSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSyncComplete: () => void;
}

export function StravaSyncModal({
  isOpen,
  onClose,
  onSyncComplete,
}: StravaSyncModalProps) {
  const { t } = useTranslation();
  const [dateFrom, setDateFrom] = useState(
    () =>
      new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split('T')[0]
  );
  const [dateTo, setDateTo] = useState(
    () => new Date().toISOString().split('T')[0]
  );

  const { mutate: syncStrava, isPending, data } = useStravaSyncMutation();
  const toast = useToast();

  const handleSync = () => {
    syncStrava(
      { date_from: dateFrom, date_to: dateTo },
      {
        onSuccess: (result) => {
          toast.success(
            `${result.imported} ${t('strava.imported')}${result.skipped > 0 ? ` • ${result.skipped} ${t('strava.skipped')}` : ''}`
          );
          onSyncComplete();
          setTimeout(() => onClose(), 2000); // Fermer après 2s
        },
        onError: (error: Error) => {
          toast.error(`${t('strava.syncError')} ${error.message}`);
        },
      }
    );
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`🔄 ${t('strava.title')}`}
      size="md"
    >
      <div className="space-y-4">
        <p className="text-sm text-gray-600 dark:text-gray-300">
          {t('strava.description')}
        </p>

        <div className="grid grid-cols-2 gap-4">
          <DatePicker
            label={t('strava.from')}
            value={dateFrom}
            onChange={setDateFrom}
          />
          <DatePicker
            label={t('strava.to')}
            value={dateTo}
            onChange={setDateTo}
          />
        </div>

        {/* Résultat de la sync */}
        {data && (
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg p-4">
            <p className="font-semibold text-green-800 dark:text-green-200 mb-2">
              ✅ {t('strava.syncComplete')}
            </p>
            <ul className="text-sm text-green-700 dark:text-green-300 space-y-1">
              <li>
                • {data.imported} {t('strava.imported')}
              </li>
              {data.skipped > 0 && (
                <li>
                  • {data.skipped} {t('strava.skipped')}
                </li>
              )}
              {data.failed > 0 && (
                <li className="text-orange-700 dark:text-orange-400">
                  • {data.failed} {t('strava.failures')}
                </li>
              )}
            </ul>
          </div>
        )}

        {/* Boutons */}
        <div className="flex gap-3 justify-end">
          <Button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-all"
            disabled={isPending}
          >
            {t('common.cancel')}
          </Button>
          <Button
            onClick={handleSync}
            disabled={isPending || !dateFrom || !dateTo}
            className="px-6 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {isPending ? (
              <>
                <span className="inline-block animate-spin mr-2">⏳</span>
                {t('strava.syncing')}
              </>
            ) : (
              `🔄 ${t('strava.sync')}`
            )}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
