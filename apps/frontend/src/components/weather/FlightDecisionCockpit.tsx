import { useTranslation } from 'react-i18next';
import {
  AlertTriangle,
  Clock,
  Compass,
  ShieldCheck,
  Target,
} from 'lucide-react';
import type {
  FlightDecisionResponse,
  FlightObjective,
} from '@dashboard-parapente/shared-types';
import { Button } from '@dashboard-parapente/design-system';
import {
  FLIGHT_OBJECTIVES,
  DEFAULT_FLIGHT_OBJECTIVE,
} from '../../hooks/weather/useFlightDecision';
import {
  getVerdictVisual,
  weatherCardClassName,
  weatherSectionTitleClassName,
} from './weatherUi';

type FlightDecisionCockpitProps = {
  decision?: FlightDecisionResponse;
  objective: FlightObjective;
  isLoading?: boolean;
  isError?: boolean;
  isCityContext?: boolean;
  onObjectiveChange: (objective: FlightObjective) => void;
};

const levelToVerdict = (level: string) => {
  if (level === 'favorable') return 'bon';
  if (level === 'vigilance') return 'moyen';
  if (level === 'limite') return 'limite';
  return 'mauvais';
};

const formatHourWindow = (start: number, end: number) =>
  start === end ? `${start}h` : `${start}h-${end}h`;

export default function FlightDecisionCockpit({
  decision,
  objective,
  isLoading = false,
  isError = false,
  isCityContext = false,
  onObjectiveChange,
}: FlightDecisionCockpitProps) {
  const { t } = useTranslation();
  const activeObjective = objective ?? DEFAULT_FLIGHT_OBJECTIVE;
  const translate = (key: string, params?: Record<string, unknown>) =>
    String(t(key, params));

  if (isCityContext) {
    return (
      <section className={`${weatherCardClassName} p-4 sm:p-5`}>
        <p className={weatherSectionTitleClassName}>
          {t('flightDecision.context.title')}
        </p>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          {t('flightDecision.context.description')}
        </p>
      </section>
    );
  }

  if (isLoading) {
    return (
      <section
        className={`${weatherCardClassName} p-4 sm:p-5`}
        aria-live="polite"
      >
        <p className={weatherSectionTitleClassName}>
          {t('flightDecision.title')}
        </p>
        <div className="mt-4 rounded-2xl bg-slate-100 p-4 text-sm font-semibold text-slate-500 dark:bg-slate-900 dark:text-slate-400">
          {t('common.loading')}
        </div>
      </section>
    );
  }

  if (isError || !decision) {
    return (
      <section className={`${weatherCardClassName} p-4 sm:p-5`} role="alert">
        <p className={weatherSectionTitleClassName}>
          {t('flightDecision.title')}
        </p>
        <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300">
          {t('flightDecision.loadError')}
        </div>
      </section>
    );
  }

  const visual = getVerdictVisual(levelToVerdict(decision.summary.level));
  const VerdictIcon = visual.Icon;
  const window = decision.best_window ?? decision.least_unfavorable_window;
  const topRisks = decision.risks.slice(0, 3);

  return (
    <section className={`${weatherCardClassName} overflow-hidden`}>
      <div className="border-l-4 border-l-sky-600 p-4 sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <p className={weatherSectionTitleClassName}>
              {t('flightDecision.title')}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-black ${visual.badgeClassName}`}
              >
                <VerdictIcon className="h-3.5 w-3.5" aria-hidden="true" />
                {t(decision.summary.translation_key)}
              </span>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                {t('flightDecision.objective.active', {
                  objective: t(
                    `flightDecision.objective.${decision.objective}`
                  ),
                })}
              </span>
            </div>
            <h2 className="mt-3 text-2xl font-black tracking-tight text-slate-950 dark:text-white">
              {t(decision.summary.title_key)}
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">
              {translate(
                decision.summary.message_key,
                decision.summary.message_params
              )}
            </p>
          </div>

          <div className="rounded-3xl bg-gradient-to-br from-sky-600 to-cyan-600 p-4 text-white shadow-lg shadow-sky-900/20 lg:min-w-44">
            <span className="text-xs font-bold uppercase tracking-[0.18em] text-sky-100">
              {t('flightDecision.scoreObjectif')}
            </span>
            <strong className="mt-1 block text-5xl font-black leading-none">
              {decision.summary.score_objectif}
            </strong>
            <span className="text-sm font-bold text-sky-100">/100</span>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {FLIGHT_OBJECTIVES.map((nextObjective) => (
            <Button
              key={nextObjective}
              type="button"
              onClick={() => onObjectiveChange(nextObjective)}
              className={`cursor-pointer rounded-full border px-3 py-1.5 text-xs font-black transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 ${
                activeObjective === nextObjective
                  ? 'border-sky-600 bg-sky-600 text-white'
                  : 'border-slate-200 bg-white text-slate-700 hover:border-sky-400 hover:bg-sky-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-sky-950/30'
              }`}
            >
              <Target className="mr-1 inline h-3.5 w-3.5" aria-hidden="true" />
              {t(`flightDecision.objective.${nextObjective}`)}
            </Button>
          ))}
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900/60">
            <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              <Clock className="h-4 w-4 text-sky-500" aria-hidden="true" />
              {decision.best_window
                ? t('flightDecision.bestWindow')
                : t('flightDecision.leastUnfavorable')}
            </span>
            <strong className="mt-1 block text-lg font-black text-slate-950 dark:text-white">
              {window
                ? formatHourWindow(window.start_hour, window.end_hour)
                : t('flightDecision.noWindow')}
            </strong>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900/60">
            <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              <ShieldCheck
                className="h-4 w-4 text-emerald-500"
                aria-hidden="true"
              />
              {t('flightDecision.confidence.title')}
            </span>
            <strong className="mt-1 block text-lg font-black text-slate-950 dark:text-white">
              {t(decision.confidence.translation_key)} ·{' '}
              {decision.confidence.score}/100
            </strong>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900/60">
            <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              <Compass className="h-4 w-4 text-violet-500" aria-hidden="true" />
              {t('flightDecision.landing.title')}
            </span>
            <strong className="mt-1 block text-lg font-black text-slate-950 dark:text-white">
              {t(decision.landing_safety.translation_key)}
            </strong>
          </div>
        </div>

        {topRisks.length > 0 && (
          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-3 dark:border-amber-900/60 dark:bg-amber-950/25">
            <div className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-wide text-amber-700 dark:text-amber-300">
              <AlertTriangle className="h-4 w-4" aria-hidden="true" />
              {t('flightDecision.mainRisks')}
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {topRisks.map((risk) => (
                <span
                  key={risk.code}
                  className="rounded-full bg-white px-3 py-1 text-xs font-bold text-amber-800 shadow-sm dark:bg-slate-950/60 dark:text-amber-200"
                >
                  {translate(risk.translation_key, risk.params)}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
