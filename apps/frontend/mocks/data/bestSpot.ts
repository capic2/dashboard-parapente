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
    reason: 'Vent favorable Nord 12km/h, thermiques excellents (15h-18h)',
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
    reason: 'Vent léger Est 8km/h, conditions optimales toute la journée',
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
    reason: 'Vent modéré Nord-Ouest 15km/h, bon créneau 14h-17h',
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
    reason: 'Vent soutenu Nord 18km/h, vol possible pour pilotes confirmés',
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
    reason: 'Vent faible Sud-Est 10km/h, bonnes conditions thermiques',
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
    reason:
      'Vent fort Ouest 22km/h, conditions difficiles, prudence recommandée',
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
    reason: 'Vent modéré Nord-Est 14km/h, amélioration en fin de journée',
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
