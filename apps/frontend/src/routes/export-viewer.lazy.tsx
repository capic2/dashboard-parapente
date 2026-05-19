import { createLazyFileRoute } from '@tanstack/react-router';
import { lazy, Suspense } from 'react';

const FlightViewer3D = lazy(() =>
  import('../components/flights/FlightViewer3D').then((m) => ({
    default: m.FlightViewer3D,
  }))
);

export const Route = createLazyFileRoute('/export-viewer')({
  component: ExportViewer,
});

function ExportViewer() {
  const search = new URLSearchParams(window.location.search);
  const flightId = search.get('flightId') || '';
  const exportJobId = search.get('jobId') || null;
  const exportToken = search.get('exportToken') || null;

  if (!flightId) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-black">
        <p className="text-gray-600 dark:text-gray-300">
          No flight ID provided. Use ?flightId=xxx
        </p>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 overflow-hidden bg-black">
      <Suspense
        fallback={
          <div className="flex h-screen items-center justify-center text-gray-500 dark:text-gray-400">
            Chargement...
          </div>
        }
      >
        <FlightViewer3D
          flightId={flightId}
          exportOnly
          exportJobId={exportJobId}
          exportToken={exportToken}
        />
      </Suspense>
    </div>
  );
}
