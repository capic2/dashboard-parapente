import { useTranslation } from 'react-i18next';
import { Button } from '@dashboard-parapente/design-system';
import { Layers, Video, Wand2 } from 'lucide-react';
import type { Flight } from '../../../types';
import { FlightVideoExportControls } from '../video-export/FlightVideoExportControls';

interface FlightMediaExportActionsProps {
  flight: Flight;
  hasGpx: boolean;
  isVideoExportRunning: boolean;
  isGoproOverlayRunning: boolean;
  canRegenerateGoproOverlay: boolean;
  canUseGoproOverlayAction: boolean;
  isCreatingGoproOverlay: boolean;
  isCancellingGoproOverlay: boolean;
  goproOverlayLabel: string;
  goproOverlayCompactLabel: string;
  goproOverlayTitle: string;
  goproOverlayUnavailableReason: string | null;
  onGoproOverlayAction: () => void;
}

export function FlightMediaExportActions({
  flight,
  hasGpx,
  isVideoExportRunning,
  isGoproOverlayRunning,
  canRegenerateGoproOverlay,
  canUseGoproOverlayAction,
  isCreatingGoproOverlay,
  isCancellingGoproOverlay,
  goproOverlayLabel,
  goproOverlayCompactLabel,
  goproOverlayTitle,
  goproOverlayUnavailableReason,
  onGoproOverlayAction,
}: FlightMediaExportActionsProps) {
  const { t } = useTranslation();

  return (
    <div className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 dark:border-slate-700 dark:bg-slate-900/50 sm:w-auto sm:min-w-80">
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
          <Layers className="h-3.5 w-3.5" aria-hidden="true" />
          {t('flights.mediaExportActions')}
        </div>
        {(isVideoExportRunning || isGoproOverlayRunning) && (
          <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-semibold text-blue-800 dark:bg-blue-950/50 dark:text-blue-200">
            {t('flights.mediaExportInProgress')}
          </span>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2">
        {hasGpx ? (
          <FlightVideoExportControls
            flight={flight}
            className="min-w-0"
            buttonClassName="min-h-10 w-full rounded-lg px-3 py-2 text-sm"
            compact
            showModeSelector={false}
            showCancelAction={false}
          />
        ) : (
          <Button
            variant="outline"
            className="min-h-10 w-full rounded-lg px-3 py-2 text-sm"
            isDisabled
            title={t('flights.replayUnavailable')}
          >
            <Video className="h-4 w-4" aria-hidden="true" />
            {t('flights.viewer.generateVideoShort')}
          </Button>
        )}
        <Button
          variant={
            isGoproOverlayRunning
              ? 'danger'
              : canRegenerateGoproOverlay
                ? 'warning'
                : 'outline'
          }
          className={`min-h-10 w-full rounded-lg px-3 py-2 text-sm ${
            isGoproOverlayRunning || canRegenerateGoproOverlay
              ? ''
              : 'border-cyan-200 text-cyan-800 transition-colors hover:bg-cyan-50 dark:border-cyan-800 dark:text-cyan-200 dark:hover:bg-cyan-950/40'
          }`}
          onPress={onGoproOverlayAction}
          isDisabled={
            !canUseGoproOverlayAction ||
            isCreatingGoproOverlay ||
            isCancellingGoproOverlay
          }
          title={goproOverlayTitle}
          aria-label={goproOverlayLabel}
        >
          <Wand2 className="h-4 w-4" aria-hidden="true" />
          {goproOverlayCompactLabel}
        </Button>
      </div>
      {goproOverlayUnavailableReason && (
        <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2 text-xs font-medium text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">
          {goproOverlayUnavailableReason}
        </p>
      )}
    </div>
  );
}
