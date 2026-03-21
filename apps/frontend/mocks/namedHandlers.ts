// Named MSW handlers for easy override in Storybook stories
// Import this instead of the array version for selective overrides
//
// Usage:
// import { handlers } from '../../../mocks/namedHandlers';
// 
// export const MyStory = {
//   parameters: {
//     msw: {
//       handlers: {
//         ...handlers,
//         // Override specific handler
//         weatherGet: http.get('/api/weather/:spotId', () => 
//           HttpResponse.json(customData)
//         ),
//       },
//     },
//   },
// };

import { handlers as globalHandlers } from './handlers';

// Export handlers as named object for selective overrides
export const handlers = {
  // Spots/Sites
  spotsList: globalHandlers[0],           // GET /api/spots
  spotsBest: globalHandlers[1],           // GET /api/spots/best
  spotsGet: globalHandlers[2],            // GET /api/spots/:spotId
  spotsGeocode: globalHandlers[3],        // GET /api/spots/geocode
  spotsCreate: globalHandlers[4],         // POST /api/spots
  sitesUpdate: globalHandlers[5],         // PATCH /api/sites/:siteId
  sitesDelete: globalHandlers[6],         // DELETE /api/sites/:siteId
  
  // Flights
  flightsList: globalHandlers[7],         // GET /api/flights
  flightsStats: globalHandlers[8],        // GET /api/flights/stats
  flightsRecords: globalHandlers[9],      // GET /api/flights/records
  flightsGetGpxData: globalHandlers[10],  // GET /api/flights/:flightId/gpx-data
  flightsGet: globalHandlers[11],         // GET /api/flights/:flightId
  flightsCreate: globalHandlers[12],      // POST /api/flights
  flightsCreateFromGpx: globalHandlers[13], // POST /api/flights/create-from-gpx
  flightsUpdate: globalHandlers[14],      // PATCH /api/flights/:flightId
  flightsSyncStrava: globalHandlers[15],  // POST /api/flights/sync-strava
  flightsUploadGpx: globalHandlers[16],   // POST /api/flights/:flightId/upload-gpx
  flightsDelete: globalHandlers[17],      // DELETE /api/flights/:flightId
  
  // Weather
  weatherGet: globalHandlers[18],         // GET /api/weather/:spotId
  weatherToday: globalHandlers[19],       // GET /api/weather/:spotId/today
  weatherSummary: globalHandlers[20],     // GET /api/weather/:spotId/summary
  weatherDailySummary: globalHandlers[21], // GET /api/weather/:spotId/daily-summary
  
  // Weather Sources
  weatherSourcesList: globalHandlers[22], // GET /api/weather-sources
  weatherSourcesStats: globalHandlers[23], // GET /api/weather-sources/stats
  weatherSourcesGet: globalHandlers[24],  // GET /api/weather-sources/:sourceName
  weatherSourcesCreate: globalHandlers[25], // POST /api/weather-sources
  weatherSourcesUpdate: globalHandlers[26], // PATCH /api/weather-sources/:sourceName
  weatherSourcesDelete: globalHandlers[27], // DELETE /api/weather-sources/:sourceName
  weatherSourcesTest: globalHandlers[28], // POST /api/weather-sources/:sourceName/test
  
  // Alerts
  alertsList: globalHandlers[29],         // GET /api/alerts
  alertsCreate: globalHandlers[30],       // POST /api/alerts
};

// Also export as array for backward compatibility
export const handlersArray = Object.values(handlers);
