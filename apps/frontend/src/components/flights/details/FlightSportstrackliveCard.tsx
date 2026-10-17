import { useTranslation } from 'react-i18next';
import { ArrowUpRight, Activity } from 'lucide-react';

interface FlightSportstrackliveCardProps {
  trackId: number;
}

export function FlightSportstrackliveCard({
  trackId,
}: FlightSportstrackliveCardProps) {
  const { t } = useTranslation();
  const url = `https://www.sportstracklive.com/track/permalink/${trackId}`;

  return (
    <a
      href={url}
      aria-label={t('flights.openSportstrackliveFlight')}
      className="group flex items-center justify-between gap-3 rounded-xl border border-sky-200 bg-sky-50/70 p-4 text-sky-950 transition-colors hover:bg-sky-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 dark:border-sky-900 dark:bg-sky-950/30 dark:text-sky-100 dark:hover:bg-sky-950/60"
    >
      <span className="flex min-w-0 items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-sky-100 text-sky-700 dark:bg-sky-900/70 dark:text-sky-200">
          <Activity className="h-5 w-5" aria-hidden="true" />
        </span>
        <span className="min-w-0">
          <span className="block font-semibold">
            {t('flights.sportstrackliveCardTitle')}
          </span>
          <span className="mt-0.5 block text-sm text-sky-800 dark:text-sky-300">
            {t('flights.sportstrackliveCardDescription')}
          </span>
        </span>
      </span>
      <ArrowUpRight
        className="h-5 w-5 shrink-0 text-sky-700 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 dark:text-sky-300"
        aria-hidden="true"
      />
    </a>
  );
}
