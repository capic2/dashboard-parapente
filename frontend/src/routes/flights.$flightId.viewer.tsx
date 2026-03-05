import { createFileRoute } from '@tanstack/react-router'
import { FlightViewer3D } from '../components/FlightViewer3D'

export const Route = createFileRoute('/flights/$flightId/viewer')({
  component: FlightViewerPage,
})

function FlightViewerPage() {
  const { flightId } = Route.useParams()
  
  return (
    <div className="w-full h-screen">
      <FlightViewer3D flightId={flightId} />
    </div>
  )
}
