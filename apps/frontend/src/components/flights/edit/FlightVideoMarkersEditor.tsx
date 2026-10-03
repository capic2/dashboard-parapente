import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@dashboard-parapente/design-system';
import type { FlightVideoMarker } from '@dashboard-parapente/shared-types';
import { getYoutubeVideoId } from '../../../lib/youtube';

interface Props {
  youtubeUrls: string[];
  value: FlightVideoMarker[];
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
  youtubeUrls,
  value,
  onChange,
  onValidityChange,
}: Props) {
  const { t } = useTranslation();
  const [times, setTimes] = useState<Record<string, string>>({});
  const [invalidIds, setInvalidIds] = useState<string[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copyFailed, setCopyFailed] = useState(false);
  const videos = youtubeUrls.flatMap((url, index) => {
    const id = getYoutubeVideoId(url);
    return id
      ? [{ id, label: t('flights.youtubeVideoLabel', { count: index + 1 }) }]
      : [];
  });

  const addMarker = (kind: FlightVideoMarker['kind']) => {
    if (!videos[0]) return;
    onChange([
      ...value,
      {
        id: crypto.randomUUID(),
        youtube_video_id: videos[0].id,
        kind,
        timestamp_seconds: 0,
        title:
          kind === 'interest'
            ? t('flights.videoMarkerInterestDefaultTitle')
            : '',
        include_in_youtube_chapters: true,
      },
    ]);
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

  const chaptersByVideo = videos.map((video) => {
    const markers = value
      .filter(
        (marker) =>
          marker.youtube_video_id === video.id &&
          marker.include_in_youtube_chapters
      )
      .sort((a, b) => a.timestamp_seconds - b.timestamp_seconds);
    const chapters: { seconds: number; title: string }[] = [];
    if (markers[0]?.timestamp_seconds !== 0)
      chapters.push({
        seconds: 0,
        title: t('flights.videoMarkerChapterIntro'),
      });
    for (const marker of markers) {
      if (chapters[chapters.length - 1]?.seconds === marker.timestamp_seconds)
        continue;
      let fallback = '';
      if (marker.kind === 'takeoff')
        fallback = t('flights.videoMarkerKindTakeoff');
      else if (marker.kind === 'landing')
        fallback = t('flights.videoMarkerKindLanding');
      chapters.push({
        seconds: marker.timestamp_seconds,
        title: marker.title.trim() || fallback,
      });
    }
    return { video, chapters };
  });

  const copy = async (
    id: string,
    chapters: { seconds: number; title: string }[]
  ) => {
    try {
      await navigator.clipboard.writeText(
        chapters.map((c) => `${formatTime(c.seconds)} ${c.title}`).join('\n')
      );
      setCopiedId(id);
      setCopyFailed(false);
    } catch {
      setCopyFailed(true);
    }
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
      {videos.length === 0 ? (
        <p className="rounded-lg bg-gray-50 p-3 text-sm text-gray-600 dark:bg-gray-900 dark:text-gray-300">
          {t('flights.videoMarkersNoVideos')}
        </p>
      ) : (
        <>
          <div className="space-y-3">
            {value.map((marker, index) => {
              const missingVideo = !videos.some(
                (video) => video.id === marker.youtube_video_id
              );
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
                    {t('flights.videoMarkerVideoLabel')}
                    <select
                      className="mt-1 block min-h-10 w-full rounded-md border border-gray-300 bg-white px-2 text-sm dark:border-gray-600 dark:bg-gray-700"
                      value={marker.youtube_video_id}
                      onChange={(event) =>
                        update({ youtube_video_id: event.target.value })
                      }
                    >
                      {missingVideo && (
                        <option value={marker.youtube_video_id}>
                          {t('flights.videoMarkerMissingVideo')}
                        </option>
                      )}
                      {videos.map((video) => (
                        <option key={video.id} value={video.id}>
                          {video.label}
                        </option>
                      ))}
                    </select>
                  </label>
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
                        onChange={(event) =>
                          update({ title: event.target.value })
                        }
                        className="mt-1 block min-h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm dark:border-gray-600 dark:bg-gray-700"
                      />
                    </label>
                  )}
                  <label className="flex min-h-10 items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                    <input
                      type="checkbox"
                      checked={marker.include_in_youtube_chapters}
                      onChange={(event) =>
                        update({
                          include_in_youtube_chapters: event.target.checked,
                        })
                      }
                    />
                    {t('flights.videoMarkerChapterCheckbox')}
                  </label>
                  <div className="flex items-end justify-end">
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
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              variant="ghost"
              className="min-h-10 rounded-lg px-3 py-2 text-sm"
              onPress={() => addMarker('takeoff')}
            >
              {t('flights.videoMarkerAddTakeoff')}
            </Button>
            <Button
              variant="ghost"
              className="min-h-10 rounded-lg px-3 py-2 text-sm"
              onPress={() => addMarker('landing')}
            >
              {t('flights.videoMarkerAddLanding')}
            </Button>
            <Button
              variant="ghost"
              className="min-h-10 rounded-lg px-3 py-2 text-sm"
              onPress={() => addMarker('interest')}
            >
              {t('flights.videoMarkerAddInterest')}
            </Button>
          </div>
          {invalidIds.length > 0 && (
            <p
              role="alert"
              className="mt-2 text-sm text-red-700 dark:text-red-300"
            >
              {t('flights.videoMarkerBadTime')}
            </p>
          )}
          <div className="mt-4 space-y-3">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {t('flights.videoMarkerChapterHint')}
            </p>
            {chaptersByVideo.map(
              ({ video, chapters }) =>
                chapters.length > 0 && (
                  <div
                    key={video.id}
                    className="rounded-lg bg-gray-50 p-3 dark:bg-gray-900"
                  >
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <h4 className="text-sm font-medium text-gray-800 dark:text-gray-200">
                        {video.label}
                      </h4>
                      <Button
                        variant="ghost"
                        className="min-h-9 rounded-lg px-3 py-1.5 text-sm"
                        onPress={() => void copy(video.id, chapters)}
                      >
                        {copiedId === video.id
                          ? t('flights.videoMarkerCopied')
                          : t('flights.videoMarkerCopyChapters')}
                      </Button>
                    </div>
                    <pre className="whitespace-pre-wrap rounded bg-white p-2 text-sm text-gray-700 dark:bg-gray-800 dark:text-gray-200">
                      {chapters
                        .map((c) => `${formatTime(c.seconds)} ${c.title}`)
                        .join('\n')}
                    </pre>
                  </div>
                )
            )}
            {copyFailed && (
              <output className="text-sm text-gray-600 dark:text-gray-300">
                {t('flights.videoMarkerCopyError')}
              </output>
            )}
          </div>
        </>
      )}
    </section>
  );
}
