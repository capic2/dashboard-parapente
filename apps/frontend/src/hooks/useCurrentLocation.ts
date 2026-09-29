import { useCallback, useEffect, useState } from 'react';

export interface CurrentLocation {
  latitude: number;
  longitude: number;
}

interface CurrentLocationState {
  location: CurrentLocation | null;
  isLoading: boolean;
  requestLocation: () => void;
}

export function useCurrentLocation(): CurrentLocationState {
  const [location, setLocation] = useState<CurrentLocation | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const requestLocation = useCallback(() => {
    setLocation(null);
    setIsLoading(true);

    if (typeof navigator === 'undefined' || !navigator.geolocation) {
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
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 10000,
      }
    );
  }, []);

  useEffect(() => {
    requestLocation();
  }, [requestLocation]);

  return { location, isLoading, requestLocation };
}
