import { createFileRoute } from '@tanstack/react-router'
import { FlightViewer3D } from '../components/FlightViewer3D'

export const Route = createFileRoute('/export-viewer')({
  component: ExportViewer,
})

function ExportViewer() {
  // Get flightId from URL search params
  const search = new URLSearchParams(window.location.search)
  const flightId = search.get('flightId') || ''
  
  if (!flightId) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-gray-600">No flight ID provided. Use ?flightId=xxx</p>
      </div>
    )
  }
  
  return (
    <div className="w-full h-screen">
      <FlightViewer3D flightId={flightId} />
    </div>
  )
}
