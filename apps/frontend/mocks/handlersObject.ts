// Named handlers as object for easy override in stories
// This allows selective override without replacing all handlers

import { handlers as handlersArray } from './handlers';

// Convert array of handlers to named object
// Extract meaningful names from handler paths
export const handlersObject = {
  // Sites/Spots
  spotsList: handlersArray[0],
  spotsBest: handlersArray[1],
  spotsGet: handlersArray[2],
  spotsCreate: handlersArray[3],
  sitesUpdate: handlersArray[4],
  sitesDelete: handlersArray[5],
  
  // Flights
  flightsList: handlersArray[6],
  flightsGet: handlersArray[7],
  flightsGetGpx: handlersArray[8],
  flightsCreate: handlersArray[9],
  flightsUpdate: handlersArray[10],
  flightsDelete: handlersArray[11],
  flightsRecords: handlersArray[12],
  flightsStats: handlersArray[13],
  
  // Weather
  weatherGet: handlersArray[14],
  weatherToday: handlersArray[15],
  weatherSummary: handlersArray[16],
  weatherDailySummary: handlersArray[17],
  weatherSources: handlersArray[18],
  
  // Weather Alerts
  alertsList: handlersArray[19],
  alertsCreate: handlersArray[20],
} as const;

// Helper to merge handlers object with overrides
export function mergeHandlers(overrides: Partial<typeof handlersObject> = {}) {
  return {
    ...handlersObject,
    ...overrides,
  };
}

// Export as array for backward compatibility
export const handlers = Object.values(handlersObject);
