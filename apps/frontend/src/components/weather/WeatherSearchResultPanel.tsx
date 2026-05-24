import { useTranslation } from 'react-i18next';
import { weatherCardClassName } from './weatherUi';

type WeatherSearchResultPanelProps = {
  selectedSearchTitle: string;
  selectedDayIndex: number;
  getDayLabel: (day: number) => string;
  onSelectDay: (day: number) => void;
};

export default function WeatherSearchResultPanel({
  selectedSearchTitle,
  selectedDayIndex,
  getDayLabel,
  onSelectDay,
}: WeatherSearchResultPanelProps) {
  const { t } = useTranslation();

  return (
    <section className={`${weatherCardClassName} p-4`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-sky-700 dark:text-sky-300">
            {t('weather.page.selectedSearchResult')}
          </p>
          <h2 className="text-xl font-bold text-gray-950 dark:text-white">
            {selectedSearchTitle}
          </h2>
        </div>
        <div
          aria-label={t('weather.forecast7Days')}
          className="flex flex-wrap gap-2"
          role="tablist"
        >
          {Array.from({ length: 7 }, (_, day) => (
            <button
              key={day}
              aria-selected={day === selectedDayIndex}
              type="button"
              onClick={() => onSelectDay(day)}
              role="tab"
              className={`cursor-pointer rounded-xl px-3 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 ${
                day === selectedDayIndex
                  ? 'bg-sky-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-700'
              }`}
            >
              {getDayLabel(day)}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
