import { useTranslation } from 'react-i18next';
import { weatherCardClassName } from './weatherUi';

type WeatherLiveWindPanelProps = {
  latitude?: number;
  longitude?: number;
};

export const getSpotairUrl = (latitude?: number, longitude?: number) => {
  if (
    typeof latitude !== 'number' ||
    typeof longitude !== 'number' ||
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude)
  ) {
    return 'https://www.spotair.mobi/';
  }

  const params = new URLSearchParams({
    lat: String(latitude),
    lng: String(longitude),
    zoom: '10',
  });

  return `https://www.spotair.mobi/?${params.toString()}`;
};

export default function WeatherLiveWindPanel({
  latitude,
  longitude,
}: WeatherLiveWindPanelProps) {
  const { t } = useTranslation();
  const spotairUrl = getSpotairUrl(latitude, longitude);

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
          href={spotairUrl}
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
