import { lazy, Suspense } from 'react';
import { useTranslation } from 'react-i18next';

const FlightViewer3D = lazy(() =>
  import('../FlightViewer3D').then((m) => ({
    default: m.FlightViewer3D,
  }))
);

interface FlightReplayCardProps {
  hasGpx: boolean;
  flightId: string;
  flightTitle: string;
  compact: boolean;
}

export function FlightReplayCard({
  hasGpx,
  flightId,
  flightTitle,
  compact,
}: FlightReplayCardProps) {
  const { t } = useTranslation();

  if (!hasGpx) {
    return (
      <div className="rounded-xl bg-white p-8 text-center shadow-md dark:bg-gray-800">
        <p className="text-sm text-gray-700 dark:text-gray-300">
          {t('flights.replayUnavailable')}
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl bg-white shadow-md dark:bg-gray-800">
      <Suspense
        fallback={
          <div className="flex h-96 items-center justify-center text-gray-500 dark:text-gray-400">
            {t('flights.loading3dViewer')}
          </div>
        }
      >
        <FlightViewer3D
          flightId={flightId}
          flightTitle={flightTitle}
          compact={compact}
        />
      </Suspense>
    </div>
  );
}
