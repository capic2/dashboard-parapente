import { useTranslation } from 'react-i18next';
import { Button } from '@dashboard-parapente/design-system';
import { Clapperboard, Video, Wand2 } from 'lucide-react';
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
  let goproOverlayVariant: 'danger' | 'warning' | 'outline' = 'outline';
  if (isGoproOverlayRunning) {
    goproOverlayVariant = 'danger';
  } else if (canRegenerateGoproOverlay) {
    goproOverlayVariant = 'warning';
  }

  return (
    <section
      aria-labelledby="flight-media-creation-title"
      className="w-full rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-gray-800 sm:p-5"
    >
      <div className="mb-4 flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300">
          <Clapperboard className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3
              id="flight-media-creation-title"
              className="text-base font-semibold text-slate-950 dark:text-white"
            >
              {t('flights.mediaCreationTitle')}
            </h3>
            {(isVideoExportRunning || isGoproOverlayRunning) && (
              <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-semibold text-blue-800 dark:bg-blue-950/50 dark:text-blue-200">
                {t('flights.mediaExportInProgress')}
              </span>
            )}
          </div>
          <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-300">
            {t('flights.mediaCreationDescription')}
          </p>
        </div>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {hasGpx ? (
          <FlightVideoExportControls
            flight={flight}
            className="min-w-0"
            buttonClassName="min-h-10 w-full rounded-lg px-3 py-2 text-sm"
            compact
            showModeSelector={false}
            showCancelAction={false}
            showLogsPanel={false}
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
          variant={goproOverlayVariant}
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
    </section>
  );
}
