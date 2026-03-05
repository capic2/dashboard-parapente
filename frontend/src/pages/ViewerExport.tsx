import { useParams } from '@tanstack/react-router'
import { FlightViewer3D } from '../components/FlightViewer3D'

/**
 * Dedicated page for video export - shows only the 3D viewer
 * Used by Playwright for capturing video frames
 */
export function ViewerExport() {
  const { flightId } = useParams({ strict: false })
  
  if (!flightId) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-gray-600">No flight ID provided</p>
      </div>
    )
  }
  
  return (
    <div className="w-full h-screen">
      <FlightViewer3D flightId={flightId} />
    </div>
  )
}
