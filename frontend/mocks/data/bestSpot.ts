/**
 * Mock data for Best Spot API responses
 */

export const mockBestSpot = {
  site: {
    id: 'site-arguel',
    code: 'arguel',
    name: 'Arguel',
    latitude: 47.2369,
    longitude: 6.0636,
    orientation: 'W',
    rating: 4,
  },
  paraIndex: 75,
  windDirection: 'W',
  windSpeed: 15,
  windFavorability: 'good' as const,
  score: 75,
  reason: 'Excellentes conditions (Para-Index 75), vent favorable W 15km/h',
  verdict: 'BON',
};

export const mockBestSpotDay1 = {
  site: {
    id: 'site-arguel',
    code: 'arguel',
    name: 'Arguel',
    latitude: 47.2369,
    longitude: 6.0636,
    orientation: 'W',
    rating: 4,
  },
  paraIndex: 70,
  windDirection: 'W',
  windSpeed: 14,
  windFavorability: 'good' as const,
  score: 70,
  reason: 'Bonnes conditions (Para-Index 70), vent favorable W 14km/h',
  verdict: 'BON',
};

export const mockBestSpotDay2 = {
  site: {
    id: 'site-arguel',
    code: 'arguel',
    name: 'Arguel',
    latitude: 47.2369,
    longitude: 6.0636,
    orientation: 'W',
    rating: 4,
  },
  paraIndex: 65,
  windDirection: 'W',
  windSpeed: 13,
  windFavorability: 'good' as const,
  score: 65,
  reason: 'Bonnes conditions (Para-Index 65), vent favorable W 13km/h',
  verdict: 'MOYEN',
};

export const mockBestSpotDay3 = {
  site: {
    id: 'site-mont-poupet-ouest',
    code: 'mont-poupet-ouest',
    name: 'Mont Poupet Ouest',
    latitude: 46.8,
    longitude: 5.9,
    orientation: 'W',
    rating: 5,
  },
  paraIndex: 65,
  windDirection: 'W',
  windSpeed: 12,
  windFavorability: 'good' as const,
  score: 65,
  reason: 'Bonnes conditions (Para-Index 65), vent favorable W 12km/h',
  verdict: 'MOYEN',
};

export const mockBestSpotDay4 = {
  site: {
    id: 'site-la-cote',
    code: 'la-cote',
    name: 'La Côte',
    latitude: 47.15,
    longitude: 6.1,
    orientation: 'E',
    rating: 3,
  },
  paraIndex: 55,
  windDirection: 'E',
  windSpeed: 11,
  windFavorability: 'good' as const,
  score: 55,
  reason: 'Conditions moyennes (Para-Index 55), vent favorable E 11km/h',
  verdict: 'MOYEN',
};

export const mockBestSpotDay5 = {
  site: {
    id: 'site-arguel',
    code: 'arguel',
    name: 'Arguel',
    latitude: 47.2369,
    longitude: 6.0636,
    orientation: 'W',
    rating: 4,
  },
  paraIndex: 50,
  windDirection: 'SW',
  windSpeed: 10,
  windFavorability: 'moderate' as const,
  score: 35, // 50 * 0.7
  reason: 'Conditions moyennes (Para-Index 50)',
  verdict: 'LIMITE',
};

export const mockBestSpotDay6 = {
  site: {
    id: 'site-arguel',
    code: 'arguel',
    name: 'Arguel',
    latitude: 47.2369,
    longitude: 6.0636,
    orientation: 'W',
    rating: 4,
  },
  paraIndex: 45,
  windDirection: 'W',
  windSpeed: 9,
  windFavorability: 'moderate' as const,
  score: 31.5, // 45 * 0.7
  reason: 'Conditions limites (Para-Index 45)',
  verdict: 'LIMITE',
};

/**
 * Array of all best spots by day index
 */
export const mockBestSpotsByDay = [
  mockBestSpot,      // Day 0
  mockBestSpotDay1,  // Day 1
  mockBestSpotDay2,  // Day 2
  mockBestSpotDay3,  // Day 3
  mockBestSpotDay4,  // Day 4
  mockBestSpotDay5,  // Day 5
  mockBestSpotDay6,  // Day 6
];
