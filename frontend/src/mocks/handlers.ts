import { http, HttpResponse } from 'msw';
import { sites, flights, gpxData, weatherData, flightStats } from './data';

const API_BASE = '/api';

export const handlers = [
  // GET /api/spots - Retourne tous les sites
  http.get(`${API_BASE}/spots`, () => {
    return HttpResponse.json({
      sites: sites
    });
  }),

  // GET /api/spots/:spot_id - Retourne un site spécifique
  http.get(`${API_BASE}/spots/:spotId`, ({ params }) => {
    const { spotId } = params;
    const site = sites.find(s => s.id === spotId);
    
    if (!site) {
      return new HttpResponse(null, {
        status: 404,
        statusText: 'Spot not found'
      });
    }
    
    return HttpResponse.json(site);
  }),

  // GET /api/flights - Retourne les vols récents
  http.get(`${API_BASE}/flights`, ({ request }) => {
    const url = new URL(request.url);
    const limitParam = url.searchParams.get('limit');
    const limit = limitParam ? parseInt(limitParam) : 10;
    
    const limitedFlights = flights.slice(0, limit);
    
    return HttpResponse.json({
      flights: limitedFlights
    });
  }),

  // GET /api/flights/:flight_id - Retourne un vol spécifique
  http.get(`${API_BASE}/flights/:flightId`, ({ params }) => {
    const { flightId } = params;
    const flight = flights.find(f => f.id === flightId);
    
    if (!flight) {
      return new HttpResponse(null, {
        status: 404,
        statusText: 'Flight not found'
      });
    }
    
    return HttpResponse.json(flight);
  }),

  // GET /api/flights/:flight_id/gpx-data - Retourne les données GPX d'un vol
  http.get(`${API_BASE}/flights/:flightId/gpx-data`, ({ params }) => {
    const { flightId } = params;
    const flight = flights.find(f => f.id === flightId);
    
    if (!flight) {
      return new HttpResponse(null, {
        status: 404,
        statusText: 'Flight not found'
      });
    }
    
    const data = gpxData[flightId as string];
    
    if (!data) {
      return new HttpResponse(null, {
        status: 404,
        statusText: 'GPX data not found'
      });
    }
    
    return HttpResponse.json(data);
  }),

  // GET /api/flights/stats - Retourne les statistiques des vols
  http.get(`${API_BASE}/flights/stats`, () => {
    return HttpResponse.json(flightStats);
  }),

  // GET /api/weather/:spot_id - Retourne la météo pour un site
  http.get(`${API_BASE}/weather/:spotId`, ({ params, request }) => {
    const { spotId } = params;
    const url = new URL(request.url);
    const dayIndex = url.searchParams.get('day_index') || '0';
    
    const weather = weatherData[spotId as string];
    
    if (!weather) {
      const site = sites.find(s => s.id === spotId);
      if (!site) {
        return new HttpResponse(null, {
          status: 404,
          statusText: 'Spot not found'
        });
      }
      
      // Retourne une erreur météo si le site existe mais pas de données météo
      return HttpResponse.json({
        site_id: spotId,
        site_name: site.name,
        error: 'Failed to fetch weather data',
        day_index: parseInt(dayIndex)
      });
    }
    
    return HttpResponse.json({
      ...weather,
      day_index: parseInt(dayIndex)
    });
  }),

  // GET /api/weather/:spot_id/today - Retourne la météo d'aujourd'hui
  http.get(`${API_BASE}/weather/:spotId/today`, ({ params }) => {
    const { spotId } = params;
    const weather = weatherData[spotId as string];
    
    if (!weather) {
      const site = sites.find(s => s.id === spotId);
      if (!site) {
        return new HttpResponse(null, {
          status: 404,
          statusText: 'Spot not found'
        });
      }
      
      return HttpResponse.json({
        site_id: spotId,
        site_name: site.name,
        error: 'Failed to fetch weather data',
        day_index: 0
      });
    }
    
    return HttpResponse.json({
      ...weather,
      day_index: 0
    });
  })
];
