import { useTranslation } from 'react-i18next';
import { VideoExportJobsPanel } from '../components/flights/VideoExportJobsPanel';
import { ToastContainer } from '@dashboard-parapente/design-system';
import { useToastStore } from '../hooks/useToast';

export default function VideoExports() {
  const { t } = useTranslation();
  const { toasts, removeToast } = useToastStore();

  return (
    <div>
      <ToastContainer toasts={toasts} onClose={removeToast} />

      <div className="mb-4 rounded-xl bg-white p-4 shadow-md dark:bg-gray-800">
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">
          {t('videoJobs.pageTitle', 'Exportations vidéo')}
        </h1>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
          {t(
            'videoJobs.pageSubtitle',
            'Suivez les générations vidéo en cours et les derniers exports.'
          )}
        </p>
      </div>

      <VideoExportJobsPanel />
    </div>
  );
}
