/**
 * Camera Orientation Utilities
 * 
 * Map site orientation (compass direction) to Cesium camera heading.
 * 
 * Orientation Semantics:
 * - Represents the direction the pilot FACES at takeoff
 * - Example: "N" = Pilot faces North, camera looks North
 * - This aligns with wind direction (favorable wind comes from the same direction)
 * 
 * Usage:
 * ```typescript
 * const heading = getHeadingFromOrientation("N") // Returns 0° (North)
 * const heading = getHeadingFromOrientation("E") // Returns 90° (East)
 * ```
 */

/**
 * Mapping from compass direction to heading in degrees
 * 0° = North, 90° = East, 180° = South, 270° = West
 */
const ORIENTATION_TO_HEADING: Record<string, number> = {
  'N': 0,       // North
  'NNE': 22.5,  // North-North-East
  'NE': 45,     // North-East
  'ENE': 67.5,  // East-North-East
  'E': 90,      // East
  'ESE': 112.5, // East-South-East
  'SE': 135,    // South-East
  'SSE': 157.5, // South-South-East
  'S': 180,     // South
  'SSW': 202.5, // South-South-West
  'SW': 225,    // South-West
  'WSW': 247.5, // West-South-West
  'W': 270,     // West
  'WNW': 292.5, // West-North-West
  'NW': 315,    // North-West
  'NNW': 337.5  // North-North-West
}

/**
 * Convert site orientation to Cesium camera heading in degrees
 * 
 * @param orientation - Compass direction (N, NE, E, etc.)
 * @returns Heading in degrees (0-360), or null if invalid/undefined
 */
export function getHeadingFromOrientation(orientation?: string): number | null {
  if (!orientation) return null
  
  const heading = ORIENTATION_TO_HEADING[orientation.toUpperCase()]
  return heading !== undefined ? heading : null
}

/**
 * Get human-readable label for orientation in French
 * 
 * @param orientation - Compass direction
 * @returns French label (e.g., "N" -> "Nord")
 */
export function getOrientationLabel(orientation: string): string {
  const labels: Record<string, string> = {
    'N': 'Nord',
    'NNE': 'Nord-Nord-Est',
    'NE': 'Nord-Est',
    'ENE': 'Est-Nord-Est',
    'E': 'Est',
    'ESE': 'Est-Sud-Est',
    'SE': 'Sud-Est',
    'SSE': 'Sud-Sud-Est',
    'S': 'Sud',
    'SSW': 'Sud-Sud-Ouest',
    'SW': 'Sud-Ouest',
    'WSW': 'Ouest-Sud-Ouest',
    'W': 'Ouest',
    'WNW': 'Ouest-Nord-Ouest',
    'NW': 'Nord-Ouest',
    'NNW': 'Nord-Nord-Ouest'
  }
  
  return labels[orientation.toUpperCase()] || orientation
}

/**
 * Get all valid orientations with labels
 * Useful for dropdowns/selectors
 */
export function getOrientationOptions(): Array<{ value: string; label: string }> {
  const orientations = [
    'N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE',
    'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'
  ]
  
  return orientations.map(value => ({
    value,
    label: `${value} - ${getOrientationLabel(value)}`
  }))
}
