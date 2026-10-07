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

function parseParisLocalTimestamp(value: string): number {
  const match = value.match(
    /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?$/u
  );
  if (!match) return Number.NaN;

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

function parseFlightDepartureTimes(value: string): number[] {
  if (/[zZ]|[+-]\d{2}:?\d{2}$/u.test(value)) return [Date.parse(value)];

  const parisTimestamp = parseParisLocalTimestamp(value);
  if (!Number.isFinite(parisTimestamp)) return [Date.parse(value)];

  // Flight.departure_time is stored without a timezone. Older GPX imports
  // stored Paris wall time, while replacement uploads can store UTC after the
  // timezone is dropped by the database. Try both interpretations so either
  // kind of existing flight can be matched to the GPX's explicit timestamp.
  const utcTimestamp = Date.parse(`${value.replace(' ', 'T')}Z`);
  return [...new Set([parisTimestamp, utcTimestamp].filter(Number.isFinite))];
}

function parseFlightNameDepartureTime(flight: Flight): number | null {
  const name = flight.name || flight.title || '';
  const automaticName = name.match(
    /^Vol du (\d{2})\/(\d{2})\/(\d{4}) à (\d{2}):(\d{2})(?:\s+\[[\da-f]{16}\])?$/iu
  );
  const manualName = name.match(/(?:^| )(\d{2})-(\d{2}) (\d{1,2})h(\d{2})$/u);
  const [, year, month, day] =
    flight.flight_date.match(/^(\d{4})-(\d{2})-(\d{2})$/u) ?? [];
  if (!year || !month || !day) return null;

  let hour: string | undefined;
  let minute: string | undefined;
  if (automaticName) {
    if (
      automaticName[1] !== day ||
      automaticName[2] !== month ||
      automaticName[3] !== year
    ) {
      return null;
    }
    hour = automaticName[4];
    minute = automaticName[5];
  } else if (manualName) {
    if (manualName[1] !== day || manualName[2] !== month) return null;
    hour = manualName[3];
    minute = manualName[4];
  } else {
    return null;
  }
  if (!hour || !minute) return null;

  const parsed = parseParisLocalTimestamp(
    `${flight.flight_date}T${hour.padStart(2, '0')}:${minute}:00`
  );
  return Number.isFinite(parsed) ? parsed : null;
}

function parseZeppFilenameTimestamp(filename: string): number | null {
  const match = filename.match(/Zepp(\d{14})/iu);
  if (!match) return null;

  const [, timestamp] = match;
  const localTimestamp = `${timestamp.slice(0, 4)}-${timestamp.slice(4, 6)}-${timestamp.slice(6, 8)}T${timestamp.slice(8, 10)}:${timestamp.slice(10, 12)}:${timestamp.slice(12, 14)}`;
  const parsed = parseParisLocalTimestamp(localTimestamp);
  return Number.isFinite(parsed) ? parsed : null;
}

function getTrackTimeRange(
  file: File,
  filenameTimestamp: number | null
): Promise<[number, number]> {
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
      if (filenameTimestamp !== null) {
        return [filenameTimestamp, filenameTimestamp];
      }
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

async function findMatchingFlight(
  startTime: number,
  endTime: number,
  filenameTimestamp: number | null
) {
  const rangeStart = Math.min(startTime, filenameTimestamp ?? startTime);
  const rangeEnd = Math.max(endTime, filenameTimestamp ?? endTime);
  const flights = await api
    .get('flights', {
      searchParams: {
        date_from: dateOffset(rangeStart, -1),
        date_to: dateOffset(rangeEnd, 1),
        limit: '500',
      },
    })
    .json<{ flights: Flight[] }>()
    .then((response) => response.flights);

  const findUniqueMatch = (timestamp: number) => {
    const candidates = flights
      .flatMap((flight) => {
        const namedDepartureTime = parseFlightNameDepartureTime(flight);
        let departureTimes: number[] = [];
        if (namedDepartureTime !== null) {
          departureTimes = [namedDepartureTime];
        } else if (flight.departure_time) {
          departureTimes = parseFlightDepartureTimes(flight.departure_time);
        }
        const distance = Math.min(
          ...departureTimes.map((departure) => Math.abs(departure - timestamp))
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
  };

  const trackMatch = findUniqueMatch(startTime);
  if (trackMatch) return trackMatch;

  if (filenameTimestamp !== null && filenameTimestamp !== startTime) {
    return findUniqueMatch(filenameTimestamp);
  }
  return null;
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
          const filenameTimestamp = parseZeppFilenameTimestamp(file.name);
          const [startTime, endTime] = await getTrackTimeRange(
            file,
            filenameTimestamp
          );
          const flight = await findMatchingFlight(
            startTime,
            endTime,
            filenameTimestamp
          );
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
