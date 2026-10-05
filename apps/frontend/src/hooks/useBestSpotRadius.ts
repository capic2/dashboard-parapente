import { useEffect, useState } from 'react';

export const BEST_SPOT_RADIUS_OPTIONS_KM = [25, 50, 100, 200] as const;
export const DEFAULT_BEST_SPOT_RADIUS_KM = 50;

const STORAGE_KEY = 'best-spot-radius-km';

const readRadius = (): number => {
  if (typeof window === 'undefined') return DEFAULT_BEST_SPOT_RADIUS_KM;

  const stored = Number(window.localStorage.getItem(STORAGE_KEY));
  return BEST_SPOT_RADIUS_OPTIONS_KM.includes(
    stored as (typeof BEST_SPOT_RADIUS_OPTIONS_KM)[number]
  )
    ? stored
    : DEFAULT_BEST_SPOT_RADIUS_KM;
};

export function useBestSpotRadius() {
  const [radiusKm, setRadiusKm] = useState(readRadius);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, radiusKm.toString());
  }, [radiusKm]);

  return { radiusKm, setRadiusKm };
}
