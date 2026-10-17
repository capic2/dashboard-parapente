import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@dashboard-parapente/design-system';
import type { FlightVideoMarker } from '@dashboard-parapente/shared-types';

interface Props {
  value: FlightVideoMarker[];
  currentYoutubePosition: { videoId: string; seconds: number } | null;
  onChange: (markers: FlightVideoMarker[]) => void;
  onValidityChange: (isValid: boolean) => void;
}

function formatTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = seconds % 60;
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`
    : `${minutes}:${String(remainder).padStart(2, '0')}`;
}

function parseTime(value: string): number | null {
  const parts = value.trim().split(':');
  if (
    parts.length < 2 ||
    parts.length > 3 ||
    parts.some((part) => !/^\d+$/u.test(part))
  )
    return null;
  const values = parts.map(Number);
  const [hours, minutes, seconds] =
    values.length === 3 ? values : [0, values[0], values[1]];
  if (minutes >= 60 || seconds >= 60 || hours > 24) return null;
  const total = hours * 3600 + minutes * 60 + seconds;
  return total <= 86400 ? total : null;
}

export function FlightVideoMarkersEditor({
  value,
  currentYoutubePosition,
  onChange,
  onValidityChange,
}: Props) {
  const { t } = useTranslation();
  const [newMarkerKind, setNewMarkerKind] =
    useState<FlightVideoMarker['kind']>('takeoff');
  const [newMarkerTitle, setNewMarkerTitle] = useState('');
  const [times, setTimes] = useState<Record<string, string>>({});
  const [invalidIds, setInvalidIds] = useState<string[]>([]);

  const addMarker = () => {
    if (
      !currentYoutubePosition ||
      (newMarkerKind === 'interest' && !newMarkerTitle.trim())
    )
      return;

    onChange([
      ...value,
      {
        id: crypto.randomUUID(),
        kind: newMarkerKind,
        timestamp_seconds: currentYoutubePosition.seconds,
        title: newMarkerKind === 'interest' ? newMarkerTitle.trim() : '',
      },
    ]);
    setNewMarkerTitle('');
  };

  const removeMarker = (id: string) => {
    const nextInvalidIds = invalidIds.filter((item) => item !== id);
    setInvalidIds(nextInvalidIds);
    onValidityChange(nextInvalidIds.length === 0);
    setTimes((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
    onChange(value.filter((marker) => marker.id !== id));
  };

  const updateTime = (id: string, raw: string) => {
    setTimes((current) => ({ ...current, [id]: raw }));
    const seconds = parseTime(raw);
    const nextInvalid =
      seconds === null
        ? [...new Set([...invalidIds, id])]
        : invalidIds.filter((item) => item !== id);
    setInvalidIds(nextInvalid);
    onValidityChange(nextInvalid.length === 0);
    if (seconds !== null)
      onChange(
        value.map((marker) =>
          marker.id === id ? { ...marker, timestamp_seconds: seconds } : marker
        )
      );
  };

  return (
    <section
      className="mt-4 border-t border-gray-200 pt-4 dark:border-gray-700"
      aria-labelledby="flight-video-markers-title"
    >
      <h3
        id="flight-video-markers-title"
        className="text-sm font-semibold text-gray-900 dark:text-gray-100"
      >
        {t('flights.videoMarkersTitle')}
      </h3>
      <p className="mb-3 mt-1 text-xs text-gray-500 dark:text-gray-400">
        {t('flights.videoMarkersHint')}
      </p>
      <div className="mb-3 flex flex-wrap items-end gap-2 rounded-lg bg-gray-50 p-3 dark:bg-gray-900">
        <label className="min-w-36 flex-1 text-xs font-medium text-gray-700 dark:text-gray-300">
          {t('flights.videoMarkerKindLabel')}
          <select
            className="mt-1 block min-h-10 w-full rounded-md border border-gray-300 bg-white px-2 text-sm dark:border-gray-600 dark:bg-gray-700"
            value={newMarkerKind}
            onChange={(event) =>
              setNewMarkerKind(event.target.value as FlightVideoMarker['kind'])
            }
          >
            <option value="takeoff">
              {t('flights.videoMarkerKindTakeoff')}
            </option>
            <option value="landing">
              {t('flights.videoMarkerKindLanding')}
            </option>
            <option value="interest">
              {t('flights.videoMarkerKindInterest')}
            </option>
          </select>
        </label>
        {newMarkerKind === 'interest' && (
          <label className="min-w-44 flex-1 text-xs font-medium text-gray-700 dark:text-gray-300">
            {t('flights.videoMarkerTitleLabel')}
            <input
              type="text"
              maxLength={100}
              required
              value={newMarkerTitle}
              onChange={(event) => setNewMarkerTitle(event.target.value)}
              className="mt-1 block min-h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm dark:border-gray-600 dark:bg-gray-700"
            />
          </label>
        )}
        <span className="min-h-10 self-end py-2 text-xs text-gray-600 dark:text-gray-300">
          {t('flights.videoMarkerCurrentTime', {
            time: currentYoutubePosition
              ? formatTime(currentYoutubePosition.seconds)
              : '—',
          })}
        </span>
        <Button
          variant="primary"
          className="min-h-10 rounded-lg px-3 py-2 text-sm"
          isDisabled={
            !currentYoutubePosition ||
            (newMarkerKind === 'interest' && !newMarkerTitle.trim())
          }
          onPress={addMarker}
        >
          {t('flights.videoMarkerAdd')}
        </Button>
      </div>
      <div className="space-y-3">
        {value.map((marker, index) => {
          const update = (changes: Partial<FlightVideoMarker>) =>
            onChange(
              value.map((item) =>
                item.id === marker.id ? { ...item, ...changes } : item
              )
            );
          return (
            <div
              key={marker.id}
              className="grid grid-cols-1 gap-3 rounded-lg border border-gray-200 p-3 dark:border-gray-700 sm:grid-cols-2 xl:grid-cols-4"
            >
              <label className="text-xs font-medium text-gray-700 dark:text-gray-300">
                {t('flights.videoMarkerKindLabel')}
                <select
                  className="mt-1 block min-h-10 w-full rounded-md border border-gray-300 bg-white px-2 text-sm dark:border-gray-600 dark:bg-gray-700"
                  value={marker.kind}
                  onChange={(event) =>
                    update({
                      kind: event.target.value as FlightVideoMarker['kind'],
                    })
                  }
                >
                  <option value="takeoff">
                    {t('flights.videoMarkerKindTakeoff')}
                  </option>
                  <option value="landing">
                    {t('flights.videoMarkerKindLanding')}
                  </option>
                  <option value="interest">
                    {t('flights.videoMarkerKindInterest')}
                  </option>
                </select>
              </label>
              <label className="text-xs font-medium text-gray-700 dark:text-gray-300">
                {t('flights.videoMarkerTimeLabel')}
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="mm:ss"
                  value={
                    times[marker.id] ?? formatTime(marker.timestamp_seconds)
                  }
                  aria-invalid={invalidIds.includes(marker.id)}
                  onChange={(event) =>
                    updateTime(marker.id, event.target.value)
                  }
                  className="mt-1 block min-h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm dark:border-gray-600 dark:bg-gray-700 aria-[invalid=true]:border-red-500"
                />
                {invalidIds.includes(marker.id) && (
                  <span className="mt-1 block text-xs text-red-700 dark:text-red-300">
                    {t('flights.videoMarkerBadTime')}
                  </span>
                )}
              </label>
              {marker.kind === 'interest' && (
                <label className="text-xs font-medium text-gray-700 dark:text-gray-300">
                  {t('flights.videoMarkerTitleLabel')}
                  <input
                    type="text"
                    maxLength={100}
                    required
                    value={marker.title}
                    onChange={(event) => update({ title: event.target.value })}
                    className="mt-1 block min-h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm dark:border-gray-600 dark:bg-gray-700"
                  />
                </label>
              )}
              <div className="flex items-end justify-end xl:col-start-4">
                <Button
                  variant="ghost"
                  className="min-h-10 rounded-lg px-3 py-2 text-sm text-red-600 dark:text-red-400"
                  aria-label={t('flights.videoMarkerRemove', {
                    count: index + 1,
                  })}
                  onPress={() => removeMarker(marker.id)}
                >
                  {t('flights.videoMarkerRemoveShort')}
                </Button>
              </div>
            </div>
          );
        })}
      </div>
      {invalidIds.length > 0 && (
        <p role="alert" className="mt-2 text-sm text-red-700 dark:text-red-300">
          {t('flights.videoMarkerBadTime')}
        </p>
      )}
    </section>
  );
}
