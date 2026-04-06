import { useTranslation } from 'react-i18next';
import { addDays } from 'date-fns';

interface DaySelectorProps {
  selectedDayIndex: number;
  onSelectDay: (index: number) => void;
}

export default function DaySelector({
  selectedDayIndex,
  onSelectDay,
}: DaySelectorProps) {
  const { t, i18n } = useTranslation();

  const getDayLabel = (index: number): string => {
    if (index === 0) return t('common.today');
    if (index === 1) return t('common.tomorrow');

    const date = addDays(new Date(), index);
    return date.toLocaleDateString(
      i18n.language.startsWith('en') ? 'en-US' : 'fr-FR',
      { weekday: 'short', day: 'numeric', month: 'short' }
    );
  };

  return (
    <div className="flex gap-2 flex-wrap">
      {Array.from({ length: 7 }, (_, i) => {
        const isSelected = i === selectedDayIndex;
        return (
          <button
            key={i}
            type="button"
            onClick={() => onSelectDay(i)}
            aria-pressed={isSelected}
            className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
              isSelected
                ? 'bg-sky-600 text-white shadow-md'
                : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:border-sky-400 hover:text-sky-600'
            }`}
          >
            {getDayLabel(i)}
          </button>
        );
      })}
    </div>
  );
}
