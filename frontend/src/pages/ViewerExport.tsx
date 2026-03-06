import { useSearch } from '@tanstack/react-router'
import { FlightViewer3D } from '../components/FlightViewer3D'

/**
 * Dedicated page for video export - shows only the 3D viewer
 * Used by Playwright for capturing video frames
 */
export function ViewerExport() {
  // Get flightId from URL search params (?flightId=xxx)
  const search = useSearch({ strict: false }) as { flightId?: string }
  const flightId = search?.flightId || new URLSearchParams(window.location.search).get('flightId') || ''
  
  if (!flightId) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-gray-600">No flight ID provided. Use ?flightId=xxx</p>
      </div>
    )
  }
  
  // Force optimal rendering for export
  // Disable UI throttling and force requestAnimationFrame sync
  if (typeof window !== 'undefined') {
    // @ts-ignore
    window._exportMode = true
  }
  
  return (
    <div className="w-full h-screen" style={{ backgroundColor: '#000' }}>
      <FlightViewer3D flightId={flightId} />
    </div>
  )
}
