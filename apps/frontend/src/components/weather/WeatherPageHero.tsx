import { useTranslation } from 'react-i18next';
import { CalendarDays, MapPin, Search, Wind } from 'lucide-react';

type WeatherPageHeroProps = {
  activeWeatherName?: string;
  selectedDayLabel: string;
  sourceLabel: string;
  isSearchMode: boolean;
  variant?: 'desktop' | 'mobile';
};

export default function WeatherPageHero({
  activeWeatherName,
  selectedDayLabel,
  sourceLabel,
  isSearchMode,
  variant = 'desktop',
}: WeatherPageHeroProps) {
  const { t } = useTranslation();

  if (variant === 'mobile') {
    return (
      <section className="overflow-hidden rounded-3xl border border-sky-900/20 bg-gradient-to-br from-slate-950 via-sky-900 to-cyan-800 p-4 text-white shadow-xl shadow-sky-950/20">
        <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-sky-100">
          <Wind className="h-3.5 w-3.5" aria-hidden="true" />
          {t('weather.mobile.badge')}
        </div>
        <h1 className="mt-3 text-2xl font-black tracking-tight">
          {activeWeatherName ?? t('weather.page.defaultTitle')}
        </h1>
        <p className="mt-2 text-sm leading-6 text-sky-100">
          {t('weather.mobile.description')}
        </p>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <div className="rounded-2xl border border-white/15 bg-white/10 px-3 py-2">
            <span className="text-xs font-semibold text-sky-100">
              {t('weather.page.day')}
            </span>
            <strong className="block text-sm">{selectedDayLabel}</strong>
          </div>
          <div className="rounded-2xl border border-white/15 bg-white/10 px-3 py-2">
            <span className="text-xs font-semibold text-sky-100">
              {t('weather.page.source')}
            </span>
            <strong className="block truncate text-sm">{sourceLabel}</strong>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-br from-sky-700 via-blue-700 to-slate-950 p-4 text-white shadow-xl shadow-sky-900/20 dark:border-slate-700 sm:p-5 lg:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-sky-100">
            <Wind className="h-3.5 w-3.5" aria-hidden="true" />
            {t('weather.page.badge')}
          </div>
          <h1 className="mt-3 truncate text-2xl font-black tracking-tight sm:text-3xl">
            {activeWeatherName ?? t('weather.page.defaultTitle')}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-sky-100 sm:text-base">
            {t('weather.page.description')}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:justify-end">
          <div className="rounded-2xl border border-white/15 bg-white/10 px-3 py-2 backdrop-blur">
            <span className="flex items-center gap-1.5 text-xs font-semibold text-sky-100">
              <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
              {t('weather.page.day')}
            </span>
            <strong className="mt-1 block text-sm">{selectedDayLabel}</strong>
          </div>
          <div className="rounded-2xl border border-white/15 bg-white/10 px-3 py-2 backdrop-blur">
            <span className="flex items-center gap-1.5 text-xs font-semibold text-sky-100">
              {isSearchMode ? (
                <Search className="h-3.5 w-3.5" aria-hidden="true" />
              ) : (
                <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
              )}
              {t('weather.page.source')}
            </span>
            <strong className="mt-1 block truncate text-sm">
              {sourceLabel}
            </strong>
          </div>
        </div>
      </div>
    </section>
  );
}
