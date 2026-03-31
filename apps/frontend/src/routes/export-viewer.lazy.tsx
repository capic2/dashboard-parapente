import { createLazyFileRoute } from '@tanstack/react-router';
import { lazy, Suspense } from 'react';

const FlightViewer3D = lazy(() => import('../components/flights/FlightViewer3D').then(m => ({ default: m.FlightViewer3D })));

export const Route = createLazyFileRoute('/export-viewer')({
  component: ExportViewer,
});

function ExportViewer() {
  const search = new URLSearchParams(window.location.search);
  const flightId = search.get('flightId') || '';

  if (!flightId) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-gray-600">
          No flight ID provided. Use ?flightId=xxx
        </p>
      </div>
    );
  }

  return (
    <div className="w-full h-screen">
      <Suspense fallback={<div className="h-screen flex items-center justify-center text-gray-500">Chargement...</div>}>
        <FlightViewer3D flightId={flightId} />
      </Suspense>
    </div>
  );
}
