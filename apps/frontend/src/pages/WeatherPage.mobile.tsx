import { type ReactNode } from 'react';
import { ChevronRight, Wind } from 'lucide-react';
import { weatherCardClassName } from '../components/weather/weatherUi';

type WeatherPageMobileProps = {
  activeWeatherName?: string;
  selectedDayLabel: string;
  sourceLabel: string;
  selectedSiteId?: string;
  isSearchMode: boolean;
  isAuthenticated: boolean;
  selectionPanel: ReactNode;
  searchResultPanel?: ReactNode;
  emptyPanel?: ReactNode;
  currentConditions?: ReactNode;
  liveWindPanel?: ReactNode;
  landingPanel?: ReactNode;
  forecastPanel?: ReactNode;
  emagramPanel?: ReactNode;
  hourlyPanel?: ReactNode;
};

const ExpandableSection = ({
  title,
  summary,
  children,
  defaultOpen = false,
}: {
  title: string;
  summary?: string;
  children: ReactNode;
  defaultOpen?: boolean;
}) => (
  <details
    className={`${weatherCardClassName} group overflow-hidden`}
    open={defaultOpen}
  >
    <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 dark:hover:bg-slate-800/70">
      <span className="min-w-0">
        <span className="block text-sm font-black text-slate-950 dark:text-white">
          {title}
        </span>
        {summary && (
          <span className="mt-0.5 block truncate text-xs text-slate-500 dark:text-slate-400">
            {summary}
          </span>
        )}
      </span>
      <ChevronRight
        className="h-4 w-4 shrink-0 text-slate-500 transition-transform duration-200 group-open:rotate-90"
        aria-hidden="true"
      />
    </summary>
    <div className="border-t border-slate-100 p-3 dark:border-slate-800">
      {children}
    </div>
  </details>
);

export default function WeatherPageMobileLayout({
  activeWeatherName,
  selectedDayLabel,
  sourceLabel,
  selectedSiteId,
  isSearchMode,
  isAuthenticated,
  selectionPanel,
  searchResultPanel,
  emptyPanel,
  currentConditions,
  liveWindPanel,
  landingPanel,
  forecastPanel,
  emagramPanel,
  hourlyPanel,
}: WeatherPageMobileProps) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-3 pb-24 sm:max-w-lg lg:max-w-xl">
      <ExpandableSection
        title="Choix du site"
        summary="Changer de site ou chercher une ville"
        defaultOpen
      >
        {selectionPanel}
      </ExpandableSection>

      <section className="overflow-hidden rounded-3xl border border-sky-900/20 bg-gradient-to-br from-slate-950 via-sky-900 to-cyan-800 p-4 text-white shadow-xl shadow-sky-950/20">
        <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-sky-100">
          <Wind className="h-3.5 w-3.5" aria-hidden="true" />
          Météo mobile
        </div>
        <h1 className="mt-3 text-2xl font-black tracking-tight">
          {activeWeatherName ?? 'Prévisions météo'}
        </h1>
        <p className="mt-2 text-sm leading-6 text-sky-100">
          Lire l&apos;essentiel sans scroll long, ouvrir seulement le détail
          utile.
        </p>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <div className="rounded-2xl border border-white/15 bg-white/10 px-3 py-2">
            <span className="text-xs font-semibold text-sky-100">Jour</span>
            <strong className="block text-sm">{selectedDayLabel}</strong>
          </div>
          <div className="rounded-2xl border border-white/15 bg-white/10 px-3 py-2">
            <span className="text-xs font-semibold text-sky-100">Source</span>
            <strong className="block truncate text-sm">{sourceLabel}</strong>
          </div>
        </div>
      </section>

      {emptyPanel}
      {currentConditions}
      {searchResultPanel}
      <ExpandableSection title="Vent live" summary="Source externe Spotair">
        {liveWindPanel}
      </ExpandableSection>
      <ExpandableSection title="Prévision 7 jours" summary="Comparer les jours">
        {forecastPanel}
      </ExpandableSection>
      <ExpandableSection
        title="Détail heure par heure"
        summary="Ouvrir seulement si besoin"
        defaultOpen
      >
        {hourlyPanel}
      </ExpandableSection>
      <ExpandableSection
        title="Atterros et analyse avancée"
        summary="Données secondaires"
      >
        <div className="space-y-3">
          {landingPanel}
          {emagramPanel}
        </div>
      </ExpandableSection>

      <section className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-3 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-950/70 dark:text-slate-300">
        <p className="font-bold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
          Etat mobile
        </p>
        <dl className="mt-2 grid grid-cols-2 gap-2">
          <div>
            <dt className="font-semibold">Mode</dt>
            <dd>{isSearchMode ? 'Recherche' : 'Favori'}</dd>
          </div>
          <div>
            <dt className="font-semibold">Emagramme</dt>
            <dd>{isAuthenticated ? 'Disponible' : 'Masqué'}</dd>
          </div>
          <div className="col-span-2">
            <dt className="font-semibold">Météo active</dt>
            <dd>{activeWeatherName ?? selectedSiteId ?? 'Aucune'}</dd>
          </div>
        </dl>
      </section>
    </div>
  );
}
