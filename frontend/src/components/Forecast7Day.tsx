import { useDailySummary, createWeatherQueryFn } from '../hooks/useWeather';
import { useQueryClient } from '@tanstack/react-query';

interface Forecast7DayProps {
  spotId: string;
  selectedDayIndex?: number;
  onSelectDay?: (index: number) => void;
}

const getVerdictClass = (verdict: string): string => {
  const v = verdict.toLowerCase();
  if (v === 'bon') return 'bg-green-100 text-green-800';
  if (v === 'moyen') return 'bg-yellow-100 text-yellow-800';
  if (v === 'limite') return 'bg-orange-100 text-orange-800';
  return 'bg-red-100 text-red-900';
};

const getVerdictEmoji = (verdict: string): string => {
  const v = verdict.toLowerCase();
  if (v === 'bon') return '🟢';
  if (v === 'moyen') return '🟡';
  if (v === 'limite') return '🟠';
  return '🔴';
};

const formatDate = (dateStr: string): string => {
  const date = new Date(dateStr);
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  if (date.toDateString() === today.toDateString()) return 'Aujourd\'hui';
  if (date.toDateString() === tomorrow.toDateString()) return 'Demain';
  
  return date.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
};

export default function Forecast7Day({ spotId, selectedDayIndex = 0, onSelectDay }: Forecast7DayProps) {
  // OPTIMISATION: Use daily summary instead of full weather data
  // This loads 7 days of aggregate data (para_index, temps, wind) WITHOUT hourly details
  // → 2-3x faster than loading full hourly forecasts
  const { data: dailySummary, isLoading, error } = useDailySummary(spotId);
  const queryClient = useQueryClient();
  
  // Prefetch full hourly data on hover for instant navigation
  // Uses the SAME transformation logic as useWeather (shared queryFn)
  const handleMouseEnter = (dayIndex: number) => {
    if (!spotId || dayIndex === selectedDayIndex) return;
    
    queryClient.prefetchQuery({
      queryKey: ['weather', 'combined', spotId, dayIndex],
      queryFn: createWeatherQueryFn(spotId, dayIndex),
      staleTime: 1000 * 60 * 5,
    });
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl p-4 shadow-md">
        <h2 className="text-sm text-gray-600 mb-3 font-semibold">Prévisions 7 Jours</h2>
        <div className="py-5 text-center text-gray-500 text-sm">Chargement...</div>
      </div>
    );
  }

  if (error || !dailySummary || !dailySummary.days) {
    return (
      <div className="bg-white rounded-xl p-4 shadow-md">
        <h2 className="text-sm text-gray-600 mb-3 font-semibold">Prévisions 7 Jours</h2>
        <div className="py-5 text-center text-red-500 text-sm">Données non disponibles</div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl p-4 shadow-md">
      <h2 className="text-sm text-gray-600 mb-3 font-semibold">Prévisions 7 Jours</h2>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-3">
        {dailySummary.days.map((day: any, index: number) => {
          const isSelected = index === selectedDayIndex;
          
          return (
            <button 
              key={index}
              onClick={() => onSelectDay?.(index)}
              onMouseEnter={() => handleMouseEnter(index)}
              className={`bg-gray-50 rounded-lg p-3 border-2 transition-all hover:border-sky-600 hover:-translate-y-1 hover:shadow-md cursor-pointer relative ${
                isSelected 
                  ? 'border-sky-600 shadow-lg bg-sky-50 ring-2 ring-sky-200' 
                  : 'border-gray-200'
              }`}
            >
              {isSelected && (
                <div className="absolute top-1 right-1 w-2 h-2 bg-sky-600 rounded-full" />
              )}
              <div className="text-xs font-semibold text-gray-700 mb-2 text-center">
                {formatDate(day.date)}
              </div>
              <div className="flex items-center justify-center gap-2 mb-2">
                <span className="text-2xl font-bold text-sky-600">{day.para_index}</span>
                <span className={`text-xl ${getVerdictClass(day.verdict)} px-1.5 py-0.5 rounded-full`}>
                  {getVerdictEmoji(day.verdict)}
                </span>
              </div>
              <div className="text-sm text-gray-700 font-medium text-center mb-1">
                {day.temp_min}° - {day.temp_max}°
              </div>
              <div className="text-xs text-gray-600 text-center mb-1">
                💨 {Math.round(day.wind_avg)} km/h
              </div>
              <div className="text-xs text-gray-500 text-center truncate">
                {day.verdict}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
