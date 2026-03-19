import preview from '../../.storybook/preview'
import { http, HttpResponse } from 'msw'
import StatsPanel from './StatsPanel'

const mockStats = {
  total_flights: 42,
  total_hours: 85.5,
  total_distance: 425.8,
  avg_duration: 2.04,
  favorite_spot: 'Arguel',
  last_flight_date: '2024-03-15T14:30:00Z',
}

const meta = preview.meta({
  title: 'Components/StatsPanel',
  component: StatsPanel,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Statistics panel displaying flight metrics including total flights, hours, distance, averages, favorite spot, and last flight date. Fetches data using useFlightStats hook.',
      },
    },
    msw: {
      handlers: [
        http.get('/api/flights/stats', () => {
          return HttpResponse.json(mockStats)
        }),
      ],
    },
  },
  tags: ['autodocs'],
})

// Default with stats
export const Default = meta.story({})

// Loading state
export const Loading = meta.story({
  parameters: {
    msw: {
      handlers: [
        http.get('/api/flights/stats', async () => {
          await new Promise(resolve => setTimeout(resolve, 100000))
          return HttpResponse.json(mockStats)
        }),
      ],
    },
  },
})

// Error state
export const Error = meta.story({
  parameters: {
    msw: {
      handlers: [
        http.get('/api/flights/stats', () => {
          return new HttpResponse(null, { status: 500 })
        }),
      ],
    },
  },
})

// No flights yet
export const NoFlights = meta.story({
  name: 'No Flights',
  parameters: {
    msw: {
      handlers: [
        http.get('/api/flights/stats', () => {
          return HttpResponse.json({
            total_flights: 0,
            total_hours: 0,
            total_distance: 0,
            avg_duration: 0,
            favorite_spot: null,
            last_flight_date: null,
          })
        }),
      ],
    },
  },
})

// Many flights
export const ManyFlights = meta.story({
  name: 'Many Flights',
  parameters: {
    msw: {
      handlers: [
        http.get('/api/flights/stats', () => {
          return HttpResponse.json({
            total_flights: 256,
            total_hours: 512.8,
            total_distance: 3456.2,
            avg_duration: 2.0,
            favorite_spot: 'Mont Poupet',
            last_flight_date: '2024-03-17T10:15:00Z',
          })
        }),
      ],
    },
  },
})
