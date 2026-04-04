/**
 * Mock data for Best Spot API
 * Different best spot for each day (0-6)
 */

import type { BestSpotResult } from '@dashboard-parapente/shared-types';

const bestSpotByDay: Record<number, BestSpotResult> = {
  // Day 0 - Today: Arguel is best (favorable wind, good thermals)
  0: {
    site: {
      id: 'site-arguel',
      name: 'Arguel',
      rating: 4,
      orientation: 'S',
    },
    paraIndex: 85,
    windDirection: 'N',
    windSpeed: 12,
    windFavorability: 'good',
    verdict: 'EXCELLENT',
    reason:
      'Excellentes conditions (Para-Index 85), 22°C, ciel dégagé, vent favorable N 12km/h',
    flyableSlot: '10h-17h',
    thermalCeiling: 2500,
    cached_at: '2025-06-15T08:30:00Z',
  },

  // Day 1 - Tomorrow: Mont Poupet is best (light wind, good conditions)
  1: {
    site: {
      id: 'site-mont-poupet',
      name: 'Mont Poupet',
      rating: 5,
      orientation: 'W',
    },
    paraIndex: 92,
    windDirection: 'E',
    windSpeed: 8,
    windFavorability: 'good',
    verdict: 'EXCELLENT',
    reason:
      'Excellentes conditions (Para-Index 92), 24°C, ciel dégagé, atmosphère stable',
    flyableSlot: '9h-18h',
    thermalCeiling: 3000,
    cached_at: '2025-06-15T09:00:00Z',
  },

  // Day 2 - La Côte is best (moderate wind)
  2: {
    site: {
      id: 'site-la-cote',
      name: 'La Côte',
      rating: 3,
      orientation: 'SE',
    },
    paraIndex: 72,
    windDirection: 'NW',
    windSpeed: 15,
    windFavorability: 'moderate',
    verdict: 'BON',
    reason: 'Bonnes conditions (Para-Index 72), 18°C, nuageux 40%',
    flyableSlot: '14h-17h',
    thermalCeiling: 2200,
    cached_at: '2025-06-15T09:30:00Z',
  },

  // Day 3 - Arguel again (wind picks up)
  3: {
    site: {
      id: 'site-arguel',
      name: 'Arguel',
      rating: 4,
      orientation: 'S',
    },
    paraIndex: 68,
    windDirection: 'N',
    windSpeed: 18,
    windFavorability: 'good',
    verdict: 'BON',
    reason:
      'Bonnes conditions (Para-Index 68), 16°C, rafales 22km/h, vent favorable N 18km/h',
    flyableSlot: '11h-15h',
    cached_at: '2025-06-15T10:00:00Z',
  },

  // Day 4 - Mont Poupet (calmer conditions)
  4: {
    site: {
      id: 'site-mont-poupet',
      name: 'Mont Poupet',
      rating: 5,
      orientation: 'W',
    },
    paraIndex: 78,
    windDirection: 'SE',
    windSpeed: 10,
    windFavorability: 'moderate',
    verdict: 'BON',
    reason:
      'Bonnes conditions (Para-Index 78), 20°C, ciel dégagé, atmosphère stable',
    flyableSlot: '10h-17h',
    thermalCeiling: 2600,
    cached_at: '2025-06-15T10:30:00Z',
  },

  // Day 5 - La Côte (variable conditions)
  5: {
    site: {
      id: 'site-la-cote',
      name: 'La Côte',
      rating: 3,
      orientation: 'SE',
    },
    paraIndex: 55,
    windDirection: 'W',
    windSpeed: 22,
    windFavorability: 'bad',
    verdict: 'MOYEN',
    reason:
      'Conditions moyennes (Para-Index 55), 14°C, très couvert 70%, rafales 28km/h, vent défavorable W 22km/h',
    cached_at: '2025-06-15T11:00:00Z',
  },

  // Day 6 - Arguel (improving conditions)
  6: {
    site: {
      id: 'site-arguel',
      name: 'Arguel',
      rating: 4,
      orientation: 'S',
    },
    paraIndex: 81,
    windDirection: 'NE',
    windSpeed: 14,
    windFavorability: 'good',
    verdict: 'EXCELLENT',
    reason:
      'Excellentes conditions (Para-Index 81), 19°C, nuageux 35%, vent favorable NE 14km/h',
    flyableSlot: '12h-18h',
    thermalCeiling: 2400,
    cached_at: '2025-06-15T11:30:00Z',
  },
};

/**
 * Get best spot for a specific day
 * @param dayIndex - Day index (0-6)
 * @returns Best spot data for that day
 */
export function getBestSpotForDay(dayIndex: number): BestSpotResult {
  const day = Math.max(0, Math.min(6, dayIndex)); // Clamp to 0-6
  return bestSpotByDay[day];
}
