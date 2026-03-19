/**
 * useBestSpotAPI Hook
 * 
 * Fetches the best spot recommendation from the backend API
 * The backend calculates the best spot based on:
 * 1. Para-Index scores from all sites
 * 2. Wind favorability matching
 * 3. Results are cached for 60 minutes (aligned with scheduler)
 */

import { useState, useEffect } from 'react';
import type { BestSpotResult } from './useBestSpot';
import { api } from '../lib/api';

export interface ApiBestSpotResponse {
  site: {
    id: string;
    code: string;
    name: string;
    latitude: number;
    longitude: number;
    orientation?: string;
    rating?: number;
  };
  paraIndex: number;
  windDirection?: string;
  windSpeed?: number;
  windFavorability: 'good' | 'moderate' | 'bad';
  score: number;
  reason: string;
  verdict?: string;
}

export function useBestSpotAPI() {
  const [bestSpot, setBestSpot] = useState<BestSpotResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function fetchBestSpot() {
      try {
        setLoading(true);
        setError(null);

        const data: ApiBestSpotResponse = await api.get('spots/best').json();

        if (!mounted) return;

        // Transform API response to BestSpotResult format
        const result: BestSpotResult = {
          site: {
            id: data.site.id,
            code: data.site.code,
            name: data.site.name,
            latitude: data.site.latitude,
            longitude: data.site.longitude,
            orientation: data.site.orientation || null,
            rating: data.site.rating,
            elevation_m: undefined, // Not provided by API
            region: undefined,
            country: 'FR',
            description: undefined,
            camera_distance: null,
            flight_count: 0,
            is_active: true,
          },
          paraIndex: data.paraIndex,
          windDirection: data.windDirection,
          windSpeed: data.windSpeed,
          windFavorability: data.windFavorability,
          score: data.score,
          reason: data.reason,
        };

        setBestSpot(result);
      } catch (err: any) {
        if (!mounted) return;
        
        // Handle HTTPError from Ky
        if (err.response) {
          if (err.response.status === 404) {
            setError('Aucune donnée disponible. Le scheduler n\'a peut-être pas encore été exécuté.');
            setBestSpot(null);
            return;
          }
          const message = `HTTP ${err.response.status}: ${err.response.statusText}`;
          setError(message);
        } else {
          const message = err instanceof Error ? err.message : 'Erreur inconnue';
          if (import.meta.env.DEV) {
            console.error('Error fetching best spot:', err);
          }
          setError(message);
        }
        setBestSpot(null);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    fetchBestSpot();

    return () => {
      mounted = false;
    };
  }, []);

  return { bestSpot, loading, error };
}

/**
 * Get just the best site ID (useful for auto-selecting on dashboard)
 */
export function useBestSiteIdAPI(): string | null {
  const { bestSpot } = useBestSpotAPI();
  return bestSpot?.site?.id || null;
}
