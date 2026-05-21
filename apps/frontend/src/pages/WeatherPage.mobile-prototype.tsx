import { useEffect, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight, ShieldAlert, Wind } from 'lucide-react';
import { weatherCardClassName } from '../components/weather/weatherUi';

// PROTOTYPE - throwaway variants for mobile weather expandable layouts.
// Three variants of /weather, switchable via ?variant=, to compare mobile information hierarchy.
export type WeatherMobilePrototypeVariant = 'A' | 'B' | 'C';

type WeatherMobilePrototypeProps = {
  variant: WeatherMobilePrototypeVariant;
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
  onVariantChange: (variant: WeatherMobilePrototypeVariant) => void;
};

const variants: {
  id: WeatherMobilePrototypeVariant;
  label: string;
}[] = [
  { id: 'A', label: 'Synthèse + accordéons' },
  { id: 'B', label: 'Timeline mobile' },
  { id: 'C', label: "Risques d'abord" },
];

const getVariantIndex = (variant: WeatherMobilePrototypeVariant) =>
  variants.findIndex((item) => item.id === variant);

const PrototypeDetails = ({
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

const PrototypeState = ({
  variant,
  activeWeatherName,
  selectedDayLabel,
  sourceLabel,
  selectedSiteId,
  isSearchMode,
  isAuthenticated,
}: Pick<
  WeatherMobilePrototypeProps,
  | 'variant'
  | 'activeWeatherName'
  | 'selectedDayLabel'
  | 'sourceLabel'
  | 'selectedSiteId'
  | 'isSearchMode'
  | 'isAuthenticated'
>) => (
  <section className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-3 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-950/70 dark:text-slate-300">
    <p className="font-bold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
      Etat prototype
    </p>
    <dl className="mt-2 grid grid-cols-2 gap-2">
      <div>
        <dt className="font-semibold">Variant</dt>
        <dd>{variant}</dd>
      </div>
      <div>
        <dt className="font-semibold">Jour</dt>
        <dd>{selectedDayLabel}</dd>
      </div>
      <div>
        <dt className="font-semibold">Source</dt>
        <dd>{sourceLabel}</dd>
      </div>
      <div>
        <dt className="font-semibold">Mode</dt>
        <dd>{isSearchMode ? 'Recherche' : 'Favori'}</dd>
      </div>
      <div className="col-span-2">
        <dt className="font-semibold">Météo active</dt>
        <dd>{activeWeatherName ?? selectedSiteId ?? 'Aucune'}</dd>
      </div>
      <div className="col-span-2">
        <dt className="font-semibold">Emagramme</dt>
        <dd>{isAuthenticated ? 'Disponible' : 'Masqué'}</dd>
      </div>
    </dl>
  </section>
);

const PrototypeHero = ({
  activeWeatherName,
  selectedDayLabel,
  sourceLabel,
  variantLabel,
}: {
  activeWeatherName?: string;
  selectedDayLabel: string;
  sourceLabel: string;
  variantLabel: string;
}) => (
  <section className="overflow-hidden rounded-3xl border border-sky-900/20 bg-gradient-to-br from-slate-950 via-sky-900 to-cyan-800 p-4 text-white shadow-xl shadow-sky-950/20">
    <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-sky-100">
      <Wind className="h-3.5 w-3.5" aria-hidden="true" />
      Prototype mobile
    </div>
    <h1 className="mt-3 text-2xl font-black tracking-tight">
      {activeWeatherName ?? 'Prévisions météo'}
    </h1>
    <p className="mt-2 text-sm leading-6 text-sky-100">
      {variantLabel}: lire l&apos;essentiel sans scroll long, ouvrir seulement
      le détail utile.
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
);

const PrototypeSwitcher = ({
  variant,
  onVariantChange,
}: Pick<WeatherMobilePrototypeProps, 'variant' | 'onVariantChange'>) => {
  const currentIndex = getVariantIndex(variant);
  const current = variants[currentIndex] ?? variants[0];
  const previous =
    variants[(currentIndex + variants.length - 1) % variants.length];
  const next = variants[(currentIndex + 1) % variants.length];

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target?.closest('input, textarea, select, [contenteditable="true"]')
      ) {
        return;
      }

      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        onVariantChange(previous.id);
      }
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        onVariantChange(next.id);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [next.id, onVariantChange, previous.id]);

  if (import.meta.env.PROD) return null;

  return (
    <div className="fixed inset-x-0 bottom-4 z-50 flex justify-center px-4">
      <div className="flex items-center gap-2 rounded-full border border-slate-700 bg-slate-950 p-1 text-white shadow-2xl shadow-slate-950/30">
        <button
          type="button"
          className="inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-full transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
          onClick={() => onVariantChange(previous.id)}
          aria-label={`Afficher ${previous.id}`}
        >
          <ChevronLeft className="h-5 w-5" aria-hidden="true" />
        </button>
        <div className="min-w-44 px-2 text-center text-xs font-bold">
          {current.id} - {current.label}
        </div>
        <button
          type="button"
          className="inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-full transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
          onClick={() => onVariantChange(next.id)}
          aria-label={`Afficher ${next.id}`}
        >
          <ChevronRight className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
};

export default function WeatherMobilePrototype({
  variant,
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
  onVariantChange,
}: WeatherMobilePrototypeProps) {
  const currentVariant = variants[getVariantIndex(variant)] ?? variants[0];
  const state = (
    <PrototypeState
      variant={variant}
      activeWeatherName={activeWeatherName}
      selectedDayLabel={selectedDayLabel}
      sourceLabel={sourceLabel}
      selectedSiteId={selectedSiteId}
      isSearchMode={isSearchMode}
      isAuthenticated={isAuthenticated}
    />
  );
  const hero = (
    <PrototypeHero
      activeWeatherName={activeWeatherName}
      selectedDayLabel={selectedDayLabel}
      sourceLabel={sourceLabel}
      variantLabel={currentVariant.label}
    />
  );

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-3 pb-24 sm:max-w-lg lg:max-w-xl">
      {hero}
      {state}
      {emptyPanel}

      {variant === 'A' && (
        <>
          {currentConditions}
          <PrototypeDetails
            title="Choix du site"
            summary="Changer de site ou chercher une ville"
          >
            {selectionPanel}
          </PrototypeDetails>
          {searchResultPanel}
          <PrototypeDetails title="Vent live" summary="Source externe Spotair">
            {liveWindPanel}
          </PrototypeDetails>
          <PrototypeDetails
            title="Prévision 7 jours"
            summary="Comparer les jours"
          >
            {forecastPanel}
          </PrototypeDetails>
          <PrototypeDetails
            title="Détail heure par heure"
            summary="Ouvrir seulement si besoin"
            defaultOpen
          >
            {hourlyPanel}
          </PrototypeDetails>
          <PrototypeDetails
            title="Atterros et analyse avancée"
            summary="Données secondaires"
          >
            <div className="space-y-3">
              {landingPanel}
              {emagramPanel}
            </div>
          </PrototypeDetails>
        </>
      )}

      {variant === 'B' && (
        <>
          <PrototypeDetails
            title="Timeline du créneau"
            summary="Le quand d'abord"
            defaultOpen
          >
            {hourlyPanel}
          </PrototypeDetails>
          <PrototypeDetails
            title="Décision actuelle"
            summary="Indice, vent et résumé"
            defaultOpen
          >
            {currentConditions}
          </PrototypeDetails>
          <PrototypeDetails
            title="Changer le contexte"
            summary="Site, recherche, jour"
          >
            <div className="space-y-3">
              {selectionPanel}
              {searchResultPanel}
              {forecastPanel}
            </div>
          </PrototypeDetails>
          <PrototypeDetails
            title="Compléments"
            summary="Vent live, atterros, emagramme"
          >
            <div className="space-y-3">
              {liveWindPanel}
              {landingPanel}
              {emagramPanel}
            </div>
          </PrototypeDetails>
        </>
      )}

      {variant === 'C' && (
        <>
          <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-950 shadow-sm dark:border-amber-800/70 dark:bg-amber-950/30 dark:text-amber-100">
            <div className="flex gap-3">
              <ShieldAlert
                className="mt-0.5 h-5 w-5 shrink-0"
                aria-hidden="true"
              />
              <div>
                <h2 className="text-sm font-black">Lecture sécurité</h2>
                <p className="mt-1 text-sm leading-6">
                  Cette variante force d&apos;abord la vérification des risques,
                  puis laisse ouvrir les détails confort.
                </p>
              </div>
            </div>
          </section>
          <PrototypeDetails
            title="Risques immédiats"
            summary="Vent, rafales, météo actuelle"
            defaultOpen
          >
            <div className="space-y-3">
              {liveWindPanel}
              {currentConditions}
            </div>
          </PrototypeDetails>
          <PrototypeDetails
            title="Créneaux exploitables"
            summary="Heures à surveiller"
            defaultOpen
          >
            {hourlyPanel}
          </PrototypeDetails>
          <PrototypeDetails
            title="Comparer avant de partir"
            summary="7 jours et atterros"
          >
            <div className="space-y-3">
              {forecastPanel}
              {landingPanel}
            </div>
          </PrototypeDetails>
          <PrototypeDetails
            title="Configuration"
            summary="Changer site ou cible"
          >
            <div className="space-y-3">
              {selectionPanel}
              {searchResultPanel}
            </div>
          </PrototypeDetails>
          <PrototypeDetails
            title="Analyse avancée"
            summary="Pour confirmer la masse d'air"
          >
            {emagramPanel}
          </PrototypeDetails>
        </>
      )}

      <PrototypeSwitcher variant={variant} onVariantChange={onVariantChange} />
    </div>
  );
}
