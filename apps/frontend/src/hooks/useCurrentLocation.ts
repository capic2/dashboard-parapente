import { useEffect, useState } from 'react';

export interface CurrentLocation {
  latitude: number;
  longitude: number;
}

interface CurrentLocationState {
  location: CurrentLocation | null;
  isLoading: boolean;
}

export function useCurrentLocation(): CurrentLocationState {
  const [location, setLocation] = useState<CurrentLocation | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!navigator.geolocation) {
      setIsLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setLocation({
          latitude: coords.latitude,
          longitude: coords.longitude,
        });
        setIsLoading(false);
      },
      () => setIsLoading(false),
      {
        enableHighAccuracy: false,
        maximumAge: 15 * 60 * 1000,
        timeout: 5000,
      }
    );
  }, []);

  return { location, isLoading };
}
