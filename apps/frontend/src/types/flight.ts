/**
 * Shared types for flight data
 */

export interface GeoPoint {
  lat: number;
  lon: number;
  elevation: number;
  timestamp: number;
  segment?: number;
  speed_kmh?: number;
  heart_rate?: number;
}
