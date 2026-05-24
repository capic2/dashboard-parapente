import { useTranslation } from 'react-i18next';
import { weatherCardClassName } from './weatherUi';

export default function WeatherLiveWindPanel() {
  const { t } = useTranslation();

  return (
    <section
      className={`${weatherCardClassName} border-l-4 border-l-cyan-500 p-4 sm:p-5`}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            {t('weather.liveWindTitle')}
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            {t('weather.liveWindExternalInfo')}
          </p>
        </div>
        <a
          href="https://www.spotair.mobi/"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex cursor-pointer items-center justify-center rounded-xl bg-slate-950 px-4 py-2 text-sm font-bold text-white shadow-sm transition-colors hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 dark:bg-cyan-500 dark:text-slate-950 dark:hover:bg-cyan-400"
        >
          {t('weather.liveWindOpenSpotair')}
        </a>
      </div>
    </section>
  );
}
