import { createFileRoute } from '@tanstack/react-router'
import { ViewerExport } from '../pages/ViewerExport'

export const Route = createFileRoute('/viewer/$flightId')({
  component: ViewerExport,
})
