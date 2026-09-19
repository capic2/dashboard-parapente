import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@dashboard-parapente/design-system';
import { CheckCircle2, CircleAlert, LoaderCircle, Wand2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  useFlightOverlayLayer,
  useGenerateFlightOverlayLayer,
} from '../../../hooks/gopro/useGoproOverlay';
import { GoproOverlaySyncPreview } from './GoproOverlaySyncPreview';

interface FlightOverlayWorkspaceProps {
  flightId: string;
  initialOffset: string;
  onSaveOffset: (offset: string) => Promise<void>;
  showHeader?: boolean;
}

const ACTIVE_LAYER_STATUSES = new Set(['queued', 'preparing', 'running']);

export function FlightOverlayWorkspace({
  flightId,
  initialOffset,
  onSaveOffset,
  showHeader = true,
}: FlightOverlayWorkspaceProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const layer = useFlightOverlayLayer(flightId);
  const generateLayer = useGenerateFlightOverlayLayer(flightId);
  const [offset, setOffset] = useState(initialOffset);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => setOffset(initialOffset), [initialOffset]);

  const isDirty = offset !== initialOffset;
  const hasValidOffset =
    offset.trim() !== '' && Number.isFinite(Number(offset));
  const isGenerating = ACTIVE_LAYER_STATUSES.has(
    layer.data?.status ?? 'missing'
  );
  const layerJob = layer.data?.job;
  const progress = Math.max(
    0,
    Math.min(100, Math.round(layerJob?.progress ?? 0))
  );
  const isReady = layer.data?.status === 'completed' && !isDirty;

  const saveOffset = async () => {
    if (!isDirty || !hasValidOffset) return;
    setIsSaving(true);
    try {
      await onSaveOffset(offset);
      await queryClient.invalidateQueries({
        queryKey: ['flights', flightId, 'overlay-layer'],
      });
    } finally {
      setIsSaving(false);
    }
  };

  const saveAndGenerate = async () => {
    if (isGenerating || generateLayer.isPending) return;
    await saveOffset();
    await generateLayer.mutateAsync();
    await queryClient.invalidateQueries({
      queryKey: ['flights', flightId, 'overlay-layer'],
    });
  };

  let status = t('flights.overlayLayerMissing');
  let statusIcon: ReactNode = (
    <CircleAlert className="h-3.5 w-3.5" aria-hidden="true" />
  );
  if (isGenerating) {
    status = t('flights.overlayLayerGenerating');
    statusIcon = (
      <LoaderCircle
        className="h-3.5 w-3.5 motion-safe:animate-spin"
        aria-hidden="true"
      />
    );
  } else if (isReady) {
    status = t('flights.overlayLayerReady');
    statusIcon = <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />;
  } else if (isDirty) {
    status = t('flights.overlayLayerOutdated');
  }

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
          <span className="flex items-center gap-1.5 rounded-full border border-cyan-200 bg-white px-3 py-1.5 text-xs font-semibold text-cyan-900 dark:border-cyan-800 dark:bg-slate-900 dark:text-cyan-100">
            {statusIcon}
            {status}
          </span>
        </div>
      )}

      <GoproOverlaySyncPreview
        flightId={flightId}
        offset={offset}
        resetOffset={initialOffset}
        onOffsetChange={setOffset}
        onOffsetSave={async (nextOffset) => {
          await onSaveOffset(nextOffset);
          await queryClient.invalidateQueries({
            queryKey: ['flights', flightId, 'overlay-layer'],
          });
        }}
      />

      {isGenerating && layerJob && (
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

      <div className="mt-4 flex flex-wrap items-center justify-end gap-2 border-t border-cyan-200 pt-4 dark:border-cyan-900">
        <Button
          onPress={() => void saveAndGenerate()}
          isDisabled={
            isSaving ||
            generateLayer.isPending ||
            isGenerating ||
            !hasValidOffset
          }
        >
          {isSaving || generateLayer.isPending || isGenerating ? (
            <LoaderCircle
              className="h-4 w-4 motion-safe:animate-spin"
              aria-hidden="true"
            />
          ) : (
            <Wand2 className="h-4 w-4" aria-hidden="true" />
          )}
          {isReady
            ? t('flights.overlayRegenerateLayer')
            : t('flights.overlayGenerateLayer')}
        </Button>
      </div>
      {generateLayer.isError && (
        <p role="alert" className="mt-3 text-sm text-red-700 dark:text-red-300">
          {t('flights.overlayLayerGenerationError')}
        </p>
      )}
    </section>
  );
}
