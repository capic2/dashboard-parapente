import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { Flight } from '@dashboard-parapente/shared-types';
import { api } from '../../lib/api';
import { useToastStore } from '../../hooks/useToast';

declare global {
  interface Window {
    NativeGpxShare?: {
      consumeSharedGpx: () => string | null;
    };
  }
}

type SharedGpx = {
  filename: string;
  base64: string;
};

const MAX_START_TIME_DIFFERENCE_MS = 30 * 60 * 1000;
const MIN_MATCH_SEPARATION_MS = 10 * 60 * 1000;
const parisTimeFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/Paris',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

function parseFlightDepartureTime(value: string): number {
  if (/[zZ]|[+-]\d{2}:?\d{2}$/u.test(value)) return Date.parse(value);

  const match = value.match(
    /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?$/u
  );
  if (!match) return Date.parse(value);

  const [, year, month, day, hour, minute, second, fraction = '0'] = match;
  const millis = Number(`0.${fraction}`) * 1000;
  const localAsUtc = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second),
    millis
  );
  let timestamp = localAsUtc;
  for (let iteration = 0; iteration < 2; iteration += 1) {
    const parisParts = Object.fromEntries(
      parisTimeFormatter
        .formatToParts(new Date(timestamp))
        .filter((part) => part.type !== 'literal')
        .map((part) => [part.type, Number(part.value)])
    );
    const parisAsUtc = Date.UTC(
      parisParts.year,
      parisParts.month - 1,
      parisParts.day,
      parisParts.hour,
      parisParts.minute,
      parisParts.second,
      millis
    );
    timestamp += localAsUtc - parisAsUtc;
  }
  return timestamp;
}

function getTrackTimeRange(file: File): Promise<[number, number]> {
  return file.text().then((text) => {
    const document = new DOMParser().parseFromString(text, 'application/xml');
    if (document.querySelector('parsererror')) {
      throw new Error('invalid');
    }

    const timestamps = Array.from(document.getElementsByTagNameNS('*', 'trkpt'))
      .flatMap((point) =>
        Array.from(point.getElementsByTagNameNS('*', 'time')).map((time) =>
          Date.parse(time.textContent ?? '')
        )
      )
      .filter(Number.isFinite)
      .sort((left, right) => left - right);

    if (timestamps.length === 0) {
      throw new Error('no-timestamps');
    }
    return [timestamps[0], timestamps[timestamps.length - 1]];
  });
}

function dateOffset(timestamp: number, days: number): string {
  const date = new Date(timestamp);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

async function findMatchingFlight(startTime: number, endTime: number) {
  const flights = await api
    .get('flights', {
      searchParams: {
        date_from: dateOffset(startTime, -1),
        date_to: dateOffset(endTime, 1),
        limit: '500',
      },
    })
    .json<{ flights: Flight[] }>()
    .then((response) => response.flights);

  const candidates = flights
    .flatMap((flight) => {
      if (!flight.departure_time) return [];
      const distance = Math.abs(
        parseFlightDepartureTime(flight.departure_time) - startTime
      );
      return Number.isFinite(distance) &&
        distance <= MAX_START_TIME_DIFFERENCE_MS
        ? [{ flight, distance }]
        : [];
    })
    .sort((left, right) => left.distance - right.distance);

  const best = candidates[0];
  const secondBest = candidates[1];
  if (
    !best ||
    (secondBest &&
      secondBest.distance - best.distance < MIN_MATCH_SEPARATION_MS)
  ) {
    return null;
  }
  return best.flight;
}

function decodeSharedFile(shared: SharedGpx): File {
  const binary = window.atob(shared.base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new File([bytes], shared.filename || 'zepp.gpx', {
    type: 'application/gpx+xml',
  });
}

export function NativeGpxImportHandler() {
  const queryClient = useQueryClient();
  const addToast = useToastStore((state) => state.addToast);
  const { t } = useTranslation();

  useEffect(() => {
    if (!window.NativeGpxShare) return;

    let handlingShare = false;
    const timer = window.setInterval(() => {
      if (handlingShare) return;

      let serialized: string | null;
      try {
        serialized = window.NativeGpxShare?.consumeSharedGpx() ?? null;
      } catch {
        return;
      }
      if (!serialized) return;

      handlingShare = true;
      void (async () => {
        try {
          const shared = JSON.parse(serialized) as SharedGpx;
          const file = decodeSharedFile(shared);
          const [startTime, endTime] = await getTrackTimeRange(file);
          const flight = await findMatchingFlight(startTime, endTime);
          if (!flight) {
            throw new Error('no-match');
          }

          const formData = new FormData();
          formData.append('gpx_file', file);
          await api.post(`flights/${flight.id}/upload-gpx`, { body: formData });
          await queryClient.invalidateQueries({ queryKey: ['flights'] });
          addToast({
            type: 'success',
            title: t('flights.sharedGpxSuccess', {
              flight: flight.title || flight.name,
            }),
          });
        } catch (error) {
          const errorKey = error instanceof Error ? error.message : 'unknown';
          let title = t('flights.gpxUploadError', { error: errorKey });
          if (errorKey === 'invalid') title = t('flights.sharedGpxInvalid');
          if (errorKey === 'no-timestamps') {
            title = t('flights.sharedGpxNoTimestamps');
          }
          if (errorKey === 'no-match') title = t('flights.sharedGpxNoMatch');
          addToast({
            type: 'error',
            title,
          });
        } finally {
          handlingShare = false;
        }
      })();
    }, 750);

    return () => window.clearInterval(timer);
  }, [addToast, queryClient, t]);

  return null;
}
