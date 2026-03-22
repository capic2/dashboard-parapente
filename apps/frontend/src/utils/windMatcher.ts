/**
 * Wind Matching Utility
 * 
 * Determines how favorable wind conditions are for a specific takeoff orientation.
 * Used to show green/yellow/red indicators for each takeoff based on wind direction.
 */

export type WindFavorability = 'good' | 'moderate' | 'bad';

/**
 * Convert cardinal direction to degrees
 * N = 0°, E = 90°, S = 180°, W = 270°
 */
export function cardinalToDegrees(direction: string): number {
  const directions: Record<string, number> = {
    'N': 0,
    'NNE': 22.5,
    'NE': 45,
    'ENE': 67.5,
    'E': 90,
    'ESE': 112.5,
    'SE': 135,
    'SSE': 157.5,
    'S': 180,
    'SSW': 202.5,
    'SW': 225,
    'WSW': 247.5,
    'W': 270,
    'WNW': 292.5,
    'NW': 315,
    'NNW': 337.5,
  };
  
  return directions[direction.toUpperCase()] ?? 0;
}

/**
 * Calculate the angular difference between two directions (0-180°)
 * Takes into account that 0° and 360° are the same
 */
export function getAngularDifference(degrees1: number, degrees2: number): number {
  let diff = Math.abs(degrees1 - degrees2);
  
  // Handle wrap-around (e.g., 350° and 10° are only 20° apart)
  if (diff > 180) {
    diff = 360 - diff;
  }
  
  return diff;
}

/**
 * Determine if wind direction is favorable for a takeoff orientation
 * 
 * Logic:
 * - GOOD (🟢): Wind within ±45° of takeoff orientation
 * - MODERATE (🟡): Wind within ±45-90° of takeoff orientation
 * - BAD (🔴): Wind more than 90° off, or directly from behind (tailwind)
 * 
 * @param windDirection - Current wind direction (e.g., "SW", "N", "ESE")
 * @param siteOrientation - Direction the takeoff faces (e.g., "W", "N", "NW")
 * @param windSpeed - Wind speed in km/h (used for additional checks)
 * @returns 'good', 'moderate', or 'bad'
 */
export function getWindFavorability(
  windDirection: string | undefined,
  siteOrientation: string | undefined,
  windSpeed?: number
): WindFavorability {
  // If no data available, assume moderate
  if (!windDirection || !siteOrientation) {
    return 'moderate';
  }
  
  // If wind is too light (<5 km/h), it's always favorable
  if (windSpeed !== undefined && windSpeed < 5) {
    return 'good';
  }
  
  // If wind is dangerously strong (>40 km/h), it's always bad
  if (windSpeed !== undefined && windSpeed > 40) {
    return 'bad';
  }
  
  const windDeg = cardinalToDegrees(windDirection);
  const siteDeg = cardinalToDegrees(siteOrientation);
  
  const angularDiff = getAngularDifference(windDeg, siteDeg);
  
  // Good: Wind within ±45° of takeoff orientation (headwind or slight crosswind)
  if (angularDiff <= 45) {
    return 'good';
  }
  
  // Moderate: Wind within ±45-90° (crosswind)
  if (angularDiff <= 90) {
    return 'moderate';
  }
  
  // Bad: Wind more than 90° off (tailwind or very strong crosswind)
  return 'bad';
}

/**
 * Get a multiplier for scoring sites based on wind favorability
 * Used in useBestSpot to weight Para-Index by wind conditions
 * 
 * @returns 1.0 for good, 0.7 for moderate, 0.3 for bad
 */
export function getWindScoreMultiplier(favorability: WindFavorability): number {
  switch (favorability) {
    case 'good':
      return 1.0;
    case 'moderate':
      return 0.7;
    case 'bad':
      return 0.3;
    default:
      return 0.7;
  }
}

/**
 * Get a human-readable description of wind favorability
 */
export function getWindFavorabilityLabel(favorability: WindFavorability, locale = 'fr'): string {
  if (locale === 'fr') {
    switch (favorability) {
      case 'good':
        return 'Vent favorable';
      case 'moderate':
        return 'Vent acceptable';
      case 'bad':
        return 'Vent défavorable';
      default:
        return 'Vent inconnu';
    }
  }
  
  // English fallback
  switch (favorability) {
    case 'good':
      return 'Favorable wind';
    case 'moderate':
      return 'Acceptable wind';
    case 'bad':
      return 'Unfavorable wind';
    default:
      return 'Unknown wind';
  }
}

/**
 * Get emoji indicator for wind favorability
 */
export function getWindFavorabilityEmoji(favorability: WindFavorability): string {
  switch (favorability) {
    case 'good':
      return '🟢';
    case 'moderate':
      return '🟡';
    case 'bad':
      return '🔴';
    default:
      return '⚪';
  }
}

/**
 * Get Tailwind color class for wind favorability
 */
export function getWindFavorabilityColor(favorability: WindFavorability): string {
  switch (favorability) {
    case 'good':
      return 'text-green-500';
    case 'moderate':
      return 'text-yellow-500';
    case 'bad':
      return 'text-red-500';
    default:
      return 'text-gray-400';
  }
}
