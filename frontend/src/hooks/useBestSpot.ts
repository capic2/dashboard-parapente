/**
 * useBestSpot Hook
 * 
 * Determines the best flying spot for today based on:
 * 1. Para-Index (flyability score)
 * 2. Wind favorability (matching wind direction to takeoff orientation)
 * 
 * Returns the recommended spot with reasoning.
 */

import { useMemo } from 'react';
import type { Site } from '../types';
import { 
  getWindFavorability, 
  getWindScoreMultiplier,
  type WindFavorability 
} from '../utils/windMatcher';

export interface BestSpotResult {
  site: Site | null;
  paraIndex: number;
  windDirection?: string;
  windSpeed?: number;
  windFavorability: WindFavorability;
  score: number;
  reason: string;
}

export interface SiteWithWeather {
  site: Site;
  paraIndex?: number;
  windDirection?: string;
  windSpeed?: number;
  verdict?: string;
}

/**
 * Calculate best spot based on Para-Index and wind conditions
 * 
 * Scoring algorithm:
 * - Base score = Para-Index (0-100)
 * - Apply wind multiplier: 1.0 (good), 0.7 (moderate), 0.3 (bad)
 * - Highest score wins
 * 
 * @param sitesWithWeather - Array of sites with their current weather data
 * @returns The best spot to fly today
 */
export function useBestSpot(sitesWithWeather: SiteWithWeather[]): BestSpotResult {
  return useMemo(() => {
    // If no data, return null result
    if (!sitesWithWeather || sitesWithWeather.length === 0) {
      return {
        site: null,
        paraIndex: 0,
        windFavorability: 'moderate' as WindFavorability,
        score: 0,
        reason: 'Aucune donnée météo disponible',
      };
    }

    // Calculate scores for each site
    const scoredSites = sitesWithWeather.map(({ site, paraIndex, windDirection, windSpeed }) => {
      // Default Para-Index to 0 if not available
      const baseScore = paraIndex ?? 0;
      
      // Calculate wind favorability
      const windFavorability = getWindFavorability(
        windDirection,
        site.orientation || undefined,
        windSpeed
      );
      
      // Apply wind multiplier to Para-Index
      const windMultiplier = getWindScoreMultiplier(windFavorability);
      const finalScore = baseScore * windMultiplier;
      
      // Generate reason text
      let reason = '';
      if (baseScore >= 70) {
        reason = `Excellentes conditions (Para-Index ${baseScore})`;
      } else if (baseScore >= 50) {
        reason = `Bonnes conditions (Para-Index ${baseScore})`;
      } else if (baseScore >= 30) {
        reason = `Conditions moyennes (Para-Index ${baseScore})`;
      } else {
        reason = `Conditions limites (Para-Index ${baseScore})`;
      }
      
      // Add wind info to reason
      if (windDirection && windSpeed) {
        if (windFavorability === 'good') {
          reason += `, vent favorable ${windDirection} ${windSpeed}km/h`;
        } else if (windFavorability === 'bad') {
          reason += `, vent défavorable ${windDirection} ${windSpeed}km/h`;
        }
      }
      
      return {
        site,
        paraIndex: baseScore,
        windDirection,
        windSpeed,
        windFavorability,
        score: finalScore,
        reason,
      };
    });

    // Sort by score (highest first) and get the best
    const sortedSites = [...scoredSites].sort((a, b) => b.score - a.score);
    const bestSite = sortedSites[0];

    // If best score is too low (<20), warn user
    if (bestSite.score < 20) {
      bestSite.reason = `Conditions défavorables partout (meilleur: ${bestSite.site.name}, score ${Math.round(bestSite.score)})`;
    }

    return bestSite;
  }, [sitesWithWeather]);
}

/**
 * Get a simplified version that just returns the site ID
 * Useful for auto-selecting the default site on dashboard load
 */
export function useBestSiteId(sitesWithWeather: SiteWithWeather[]): string | null {
  const { site } = useBestSpot(sitesWithWeather);
  return site?.id ?? null;
}

/**
 * Filter out sites with very poor conditions (Para-Index < 20)
 * Returns only flyable sites
 */
export function useFlyableSites(sitesWithWeather: SiteWithWeather[]): SiteWithWeather[] {
  return useMemo(() => {
    return sitesWithWeather.filter(({ paraIndex }) => (paraIndex ?? 0) >= 20);
  }, [sitesWithWeather]);
}
