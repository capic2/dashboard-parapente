import { http, HttpResponse } from 'msw'
import { mockSites } from './data/sites'
import { mockFlights } from './data/flights'
import { mockWeather } from './data/weather'
import { mockWeatherSources } from './data/weatherSources'

export const handlers = [
  // Sites/Spots
  http.get('/api/spots', () => {
    return HttpResponse.json({ sites: mockSites })
  }),
  
  http.post('/api/spots', async ({ request }) => {
    const body = await request.json() as any
    return HttpResponse.json({ 
      id: `site-${Date.now()}`, 
      ...body,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
  }),
  
  http.get('/api/spots/:spotId', ({ params }) => {
    const site = mockSites.find(s => s.id === params.spotId)
    if (!site) {
      return new HttpResponse(null, { status: 404 })
    }
    return HttpResponse.json(site)
  }),
  
  http.patch('/api/sites/:siteId', async ({ params, request }) => {
    const body = await request.json() as any
    const site = mockSites.find(s => s.id === params.siteId)
    return HttpResponse.json({ 
      ...site,
      ...body,
      id: params.siteId, 
      updated_at: new Date().toISOString(),
    })
  }),
  
  http.delete('/api/sites/:siteId', () => {
    return HttpResponse.json({ success: true })
  }),
  
  // Best spot
  http.get('/api/spots/best', () => {
    return HttpResponse.json({
      spot: mockSites[0],
      score: 8.5,
      reason: 'Vent favorable, conditions thermiques excellentes',
    })
  }),
  
  // Weather
  http.get('/api/weather/:spotId', () => {
    return HttpResponse.json(mockWeather)
  }),
  
  http.get('/api/weather/:spotId/today', () => {
    return HttpResponse.json(mockWeather.hourly.slice(0, 24))
  }),
  
  http.get('/api/weather/:spotId/summary', () => {
    return HttpResponse.json({
      current: mockWeather.current,
      today: mockWeather.hourly.slice(0, 24),
    })
  }),
  
  // Flights
  http.get('/api/flights', () => {
    return HttpResponse.json({ flights: mockFlights })
  }),
  
  http.get('/api/flights/stats', () => {
    return HttpResponse.json({
      total_flights: mockFlights.length,
      total_hours: 25.5,
      max_altitude: 2450,
      total_distance: 150.5,
    })
  }),
  
  http.get('/api/flights/records', () => {
    return HttpResponse.json({
      longest_flight: 180,
      highest_altitude: 2450,
      longest_distance: 45.2,
    })
  }),
  
  http.get('/api/flights/:flightId', ({ params }) => {
    const flight = mockFlights.find(f => f.id === params.flightId)
    if (!flight) {
      return new HttpResponse(null, { status: 404 })
    }
    return HttpResponse.json(flight)
  }),
  
  http.post('/api/flights', async ({ request }) => {
    const body = await request.json() as any
    return HttpResponse.json({ 
      id: `flight-${Date.now()}`, 
      ...body,
      created_at: new Date().toISOString(),
    })
  }),
  
  http.patch('/api/flights/:flightId', async ({ params, request }) => {
    const body = await request.json() as any
    return HttpResponse.json({ 
      id: params.flightId, 
      ...body,
      updated_at: new Date().toISOString(),
    })
  }),
  
  http.delete('/api/flights/:flightId', () => {
    return HttpResponse.json({ success: true })
  }),
  
  // Weather Sources
  http.get('/api/weather-sources', () => {
    return HttpResponse.json(mockWeatherSources)
  }),
  
  http.get('/api/weather-sources/stats', () => {
    return HttpResponse.json({
      total_sources: mockWeatherSources.length,
      active_sources: mockWeatherSources.filter(s => s.is_enabled).length,
      avg_response_time: 145,
    })
  }),
  
  http.get('/api/weather-sources/:sourceName', ({ params }) => {
    const source = mockWeatherSources.find(s => s.source_name === params.sourceName)
    if (!source) {
      return new HttpResponse(null, { status: 404 })
    }
    return HttpResponse.json(source)
  }),
  
  http.post('/api/weather-sources', async ({ request }) => {
    const body = await request.json() as any
    return HttpResponse.json({ 
      id: `source-${Date.now()}`,
      ...body,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { status: 201 })
  }),
  
  http.patch('/api/weather-sources/:sourceName', async ({ params, request }) => {
    const body = await request.json() as any
    const source = mockWeatherSources.find(s => s.source_name === params.sourceName)
    return HttpResponse.json({ 
      ...source, 
      ...body,
      updated_at: new Date().toISOString(),
    })
  }),
  
  http.delete('/api/weather-sources/:sourceName', () => {
    return HttpResponse.json({ success: true })
  }),
  
  http.post('/api/weather-sources/:sourceName/test', () => {
    return HttpResponse.json({
      success: true,
      response_time_ms: 145,
      tested_at: new Date().toISOString(),
    })
  }),
  
  // Alerts
  http.get('/api/alerts', () => {
    return HttpResponse.json({ alerts: [] })
  }),
  
  http.post('/api/alerts', async ({ request }) => {
    const body = await request.json() as any
    return HttpResponse.json({ 
      id: `alert-${Date.now()}`, 
      ...body,
      created_at: new Date().toISOString(),
    })
  }),
  
  // Strava sync
  http.post('/api/flights/sync-strava', async () => {
    return HttpResponse.json({
      success: true,
      synced_flights: 3,
    })
  }),
]
