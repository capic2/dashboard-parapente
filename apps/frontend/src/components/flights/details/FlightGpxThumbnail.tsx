import { useId, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { LoaderCircle, Map } from 'lucide-react';
import { useFlightGPX } from '../../../hooks/flights/useFlightGPX';
import type { GeoPoint } from '../../../types/flight';

interface FlightGpxThumbnailProps {
  flightId: string;
}

const VIEWBOX_WIDTH = 320;
const VIEWBOX_HEIGHT = 180;
const PADDING = 24;
const EMPTY_COORDINATES: GeoPoint[] = [];

function getPolylinePoints(coordinates: GeoPoint[]) {
  if (coordinates.length === 0) return '';

  const longitudes = coordinates.map(({ lon }) => lon);
  const unwrappedLongitudes = longitudes.reduce<number[]>(
    (unwrapped, longitude, index) => {
      if (index === 0) return [longitude];

      const previous = unwrapped[index - 1] ?? longitude;
      let delta = longitude - (longitudes[index - 1] ?? longitude);
      if (delta > 180) delta -= 360;
      if (delta < -180) delta += 360;
      return [...unwrapped, previous + delta];
    },
    []
  );
  const latitudes = coordinates.map(({ lat }) => lat);
  const minLon = Math.min(...unwrappedLongitudes);
  const maxLon = Math.max(...unwrappedLongitudes);
  const minLat = Math.min(...latitudes);
  const maxLat = Math.max(...latitudes);
  const lonRange = Math.max(maxLon - minLon, 0.00001);
  const latRange = Math.max(maxLat - minLat, 0.00001);
  const scale = Math.min(
    (VIEWBOX_WIDTH - PADDING * 2) / lonRange,
    (VIEWBOX_HEIGHT - PADDING * 2) / latRange
  );
  const width = lonRange * scale;
  const height = latRange * scale;
  const offsetX = (VIEWBOX_WIDTH - width) / 2;
  const offsetY = (VIEWBOX_HEIGHT - height) / 2;

  return coordinates
    .map(({ lat }, index) => {
      const longitude = unwrappedLongitudes[index] ?? minLon;
      const x = offsetX + (longitude - minLon) * scale;
      const y = VIEWBOX_HEIGHT - (offsetY + (lat - minLat) * scale);
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(' ');
}

export function FlightGpxThumbnail({ flightId }: FlightGpxThumbnailProps) {
  const { t } = useTranslation();
  const patternId = useId();
  const { data, isPending, isError } = useFlightGPX(flightId);
  const coordinates = data?.coordinates ?? EMPTY_COORDINATES;
  const points = useMemo(() => getPolylinePoints(coordinates), [coordinates]);
  const pointList = points.split(' ');
  const startPoint = pointList[0]?.split(',');
  const endPoint = pointList[pointList.length - 1]?.split(',');

  return (
    <div className="relative flex aspect-video w-full items-center justify-center overflow-hidden bg-slate-100 dark:bg-slate-800">
      <svg
        viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
        className="h-full w-full"
        aria-label={t('flights.gpxThumbnailAlt')}
        focusable="false"
      >
        <defs>
          <pattern
            id={patternId}
            width="32"
            height="32"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M 32 0 L 0 0 0 32"
              fill="none"
              stroke="currentColor"
              strokeOpacity="0.08"
            />
          </pattern>
        </defs>
        <rect
          width={VIEWBOX_WIDTH}
          height={VIEWBOX_HEIGHT}
          fill={`url(#${patternId})`}
          className="text-slate-700 dark:text-slate-200"
        />
        {points && (
          <>
            <polyline
              points={points}
              fill="none"
              stroke="currentColor"
              strokeOpacity="0.18"
              strokeWidth="7"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-emerald-700 dark:text-emerald-300"
            />
            <polyline
              points={points}
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-emerald-600 dark:text-emerald-300"
            />
            <circle
              cx={startPoint?.[0]}
              cy={startPoint?.[1]}
              r="5"
              className="fill-sky-600 dark:fill-sky-300"
            />
            <circle
              cx={endPoint?.[0]}
              cy={endPoint?.[1]}
              r="5"
              className="fill-rose-600 dark:fill-rose-300"
            />
          </>
        )}
      </svg>
      {(isPending || isError || !points) && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-100/80 dark:bg-slate-800/80">
          {isPending ? (
            <LoaderCircle
              className="h-6 w-6 text-slate-500 motion-safe:animate-spin dark:text-slate-300"
              aria-hidden="true"
            />
          ) : (
            <Map
              className="h-7 w-7 text-slate-400 dark:text-slate-500"
              aria-hidden="true"
            />
          )}
          <span className="sr-only">
            {isPending
              ? t('common.loading')
              : t('flights.gpxThumbnailUnavailable')}
          </span>
        </div>
      )}
    </div>
  );
}
