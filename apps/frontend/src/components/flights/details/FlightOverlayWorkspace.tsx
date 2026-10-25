import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Wand2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useFlightOverlayLayer } from '../../../hooks/gopro/useGoproOverlay';
import { GoproOverlaySyncPreview } from './GoproOverlaySyncPreview';

interface FlightOverlayWorkspaceProps {
  flightId: string;
  initialOffset: string;
  onOffsetPreviewChange?: (offset: string) => void;
  onSaveOffset: (offset: string) => Promise<void>;
  youtubeUrls?: string[];
  onCurrentYoutubePositionChange?: (
    position: { videoId: string; seconds: number } | null
  ) => void;
  showHeader?: boolean;
}

async function invalidateOverlaySyncQueries(
  queryClient: ReturnType<typeof useQueryClient>,
  flightId: string
) {
  await Promise.all([
    queryClient.invalidateQueries({
      queryKey: ['flights', flightId, 'overlay-layer'],
    }),
    queryClient.invalidateQueries({
      queryKey: ['flights', flightId, 'gopro-overlay-preview'],
    }),
  ]);
}

export function FlightOverlayWorkspace({
  flightId,
  initialOffset,
  onOffsetPreviewChange,
  onSaveOffset,
  youtubeUrls,
  onCurrentYoutubePositionChange,
  showHeader = true,
}: FlightOverlayWorkspaceProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const layer = useFlightOverlayLayer(flightId);
  const [offset, setOffset] = useState(initialOffset);

  useEffect(() => setOffset(initialOffset), [initialOffset]);

  const layerJob = layer.data?.job;
  const progress = Math.max(
    0,
    Math.min(100, Math.round(layerJob?.progress ?? 0))
  );

  return (
    <section
      aria-labelledby="flight-overlay-workspace-title"
      className={
        showHeader
          ? 'rounded-2xl border border-cyan-200 bg-cyan-50/50 p-4 shadow-sm dark:border-cyan-900 dark:bg-cyan-950/20 sm:p-5'
          : 'rounded-b-2xl bg-cyan-50/50 p-4 dark:bg-cyan-950/20 sm:p-5'
      }
    >
      {showHeader && (
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cyan-100 text-cyan-700 dark:bg-cyan-950/60 dark:text-cyan-300">
              <Wand2 className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <h2
                id="flight-overlay-workspace-title"
                className="text-base font-semibold text-slate-950 dark:text-white"
              >
                {t('flights.overlayWorkspaceTitle')}
              </h2>
              <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-300">
                {t('flights.overlayWorkspaceDescription')}
              </p>
            </div>
          </div>
        </div>
      )}

      <GoproOverlaySyncPreview
        flightId={flightId}
        youtubeUrls={youtubeUrls}
        onCurrentYoutubePositionChange={onCurrentYoutubePositionChange}
        offset={offset}
        onOffsetChange={(nextOffset) => {
          setOffset(nextOffset);
          onOffsetPreviewChange?.(nextOffset);
        }}
        onOffsetSave={async (nextOffset) => {
          await onSaveOffset(nextOffset);
          await invalidateOverlaySyncQueries(queryClient, flightId);
        }}
      />

      {layer.data?.status &&
        ['queued', 'preparing', 'running'].includes(layer.data.status) &&
        layerJob && (
          <div
            className="mt-4 rounded-xl border border-cyan-200 bg-white/80 p-3 dark:border-cyan-800 dark:bg-slate-900/50"
            aria-live="polite"
          >
            <div className="flex items-center justify-between gap-3 text-sm font-semibold text-cyan-950 dark:text-cyan-100">
              <span>
                {layerJob.message || t('flights.overlayLayerGenerating')}
              </span>
              <span>{progress}%</span>
            </div>
            <progress
              className="mt-2 h-2 w-full overflow-hidden rounded-full bg-cyan-100 accent-cyan-600 dark:bg-cyan-950 dark:accent-cyan-400"
              aria-label={t('flights.overlayLayerProgress')}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={progress}
              value={progress}
              max={100}
            />
            <p className="mt-2 text-xs text-slate-600 dark:text-slate-300">
              {t('flights.overlayLayerJobId', { jobId: layerJob.job_id })}
            </p>
          </div>
        )}
    </section>
  );
}
