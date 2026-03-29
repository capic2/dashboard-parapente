import { useEffect } from 'react';
import { useSearch } from '@tanstack/react-router';
import { FlightViewer3D } from '../components/complex/FlightViewer3D';

declare global {
  interface Window {
    _exportMode?: string;
  }
}

/**
 * Dedicated page for video export - shows only the 3D viewer
 * Used by Playwright for capturing video frames
 */
export function ViewerExport() {
  // Get flightId from URL search params (?flightId=xxx)
  const search = useSearch({ strict: false }) as { flightId?: string };
  const flightId =
    search?.flightId ||
    new URLSearchParams(window.location.search).get('flightId') ||
    '';

  // Setup export mode for Playwright
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window._exportMode = 'manual_render';

      console.log('🎥 Export mode: manual_render');
      console.log('📍 Flight ID:', flightId);

      // Expose flight data when viewer is ready
      // This will be set by FlightViewer3D component
    }
  }, [flightId]);

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
    <div className="w-full h-screen" style={{ backgroundColor: '#000' }}>
      <FlightViewer3D flightId={flightId} />
    </div>
  );
}
