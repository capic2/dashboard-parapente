import { useTranslation } from 'react-i18next';
import { weatherCardClassName } from './weatherUi';

export default function WeatherEmptyState() {
  const { t } = useTranslation();

  return (
    <section className={`${weatherCardClassName} p-6 text-center`}>
      <h2 className="text-xl font-bold text-gray-950 dark:text-white">
        {t('weather.page.emptyTitle')}
      </h2>
      <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
        {t('weather.page.emptyDescription')}
      </p>
    </section>
  );
}
