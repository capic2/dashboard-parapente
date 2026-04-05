/**
 * Emagram Widget - AI-powered thermal forecasting
 * Displays emagram analysis with score visualization and thermal metrics
 */

import {
  useLatestEmagram,
  useEmagramHours,
  useTriggerEmagram,
  type EmagramHourEntry,
} from '../../hooks/weather/useEmagramAnalysis';
import {
  parseAlerts,
  parseSourcesErrors,
  getScoreColor,
  getScoreCategory,
} from '../../types/emagram';
import { useState, useMemo } from 'react';
import { Lightbox } from '@dashboard-parapente/design-system';
import {
  Slider,
  SliderTrack,
  SliderThumb,
  SliderOutput,
  Button,
} from 'react-aria-components';

interface EmagramWidgetProps {
  siteId: string;
  dayIndex?: number;
}

const getStabilityEmoji = (stabilite: string | null): string => {
  if (!stabilite) return '❓';
  const s = stabilite.toLowerCase();
  if (s.includes('très instable')) return '⚡';
  if (s.includes('instable')) return '🌀';
  if (s.includes('stable')) return '🌤️';
  return '☁️';
};

const getRiskEmoji = (risque: string | null): string => {
  if (!risque) return '';
  const r = risque.toLowerCase();
  if (r === 'élevé') return '⛈️';
  if (r === 'modéré') return '🌩️';
  if (r === 'faible') return '⚡';
  return '';
};

function HourSlider({
  hours,
  selectedHour,
  onHourChange,
}: {
  hours: EmagramHourEntry[];
  selectedHour: number | null;
  onHourChange: (hour: number) => void;
}) {
  if (hours.length === 0) return null;

  const foundIndex = hours.findIndex((h) => h.hour === selectedHour);
  const currentIndex = foundIndex >= 0 ? foundIndex : 0;
  const effectiveHour = hours[currentIndex].hour;

  return (
    <div className="mb-3">
      <Slider
        minValue={0}
        maxValue={hours.length - 1}
        step={1}
        value={currentIndex}
        onChange={(value) => onHourChange(hours[value].hour)}
        aria-label="Sélection de l'heure"
      >
        <SliderOutput className="text-xs text-purple-700 dark:text-purple-300 font-semibold mb-1 block text-center">
          {effectiveHour}h
        </SliderOutput>
        <SliderTrack className="relative w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full">
          {({ state }) => (
            <>
              {/* Fill */}
              <div
                className="absolute h-full bg-purple-600 rounded-full"
                style={{ width: `${state.getThumbPercent(0) * 100}%` }}
              />
              <SliderThumb className="top-1/2 h-4 w-4 rounded-full bg-purple-600 border-2 border-white dark:border-gray-800 shadow-md cursor-grab dragging:cursor-grabbing focus-visible:outline focus-visible:outline-2 focus-visible:outline-purple-400 focus-visible:outline-offset-1 transition-shadow" />
            </>
          )}
        </SliderTrack>
      </Slider>
      <div className="relative mt-1 h-7">
        {hours.map((h, idx) => {
          const percent =
            hours.length > 1 ? (idx / (hours.length - 1)) * 100 : 50;
          return (
            <Button
              key={h.hour}
              onPress={() => onHourChange(h.hour)}
              className={`absolute -translate-x-1/2 text-[10px] px-1 py-0.5 rounded transition-colors ${
                h.hour === effectiveHour
                  ? 'font-bold text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-900/30'
                  : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'
              }`}
              style={{ left: `${percent}%` }}
            >
              {h.hour}h
              {h.score != null && h.status === 'completed' && (
                <span
                  className="block w-1.5 h-1.5 rounded-full mx-auto mt-0.5"
                  style={{ backgroundColor: getScoreColor(h.score) }}
                />
              )}
            </Button>
          );
        })}
      </div>
    </div>
  );
}

export default function EmagramWidget({
  siteId,
  dayIndex = 0,
}: EmagramWidgetProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [selectedHour, setSelectedHour] = useState<number | null>(null);

  const { data: hoursData } = useEmagramHours(siteId, dayIndex);

  // Determine which hour to display: selected, or current hour if in range, or null
  const activeHour = useMemo(() => {
    if (selectedHour !== null) return selectedHour;
    if (!hoursData?.hours?.length) return null;
    const now = new Date().getHours();
    const available = hoursData.hours.map((h) => h.hour);
    if (available.includes(now)) return now;
    // Default to closest available hour
    return available.reduce((prev, curr) =>
      Math.abs(curr - now) < Math.abs(prev - now) ? curr : prev
    );
  }, [selectedHour, hoursData]);

  const hasHourlyData = (hoursData?.hours?.length ?? 0) > 0;

  const {
    data: emagram,
    isLoading,
    error,
    refetch,
  } = useLatestEmagram(
    siteId,
    dayIndex,
    hasHourlyData ? activeHour : undefined
  );
  const triggerMutation = useTriggerEmagram();

  const handleRefresh = async () => {
    if (!siteId || isRefreshing) return;

    setIsRefreshing(true);
    try {
      await triggerMutation.mutateAsync({
        site_id: siteId,
        force_refresh: true,
        day_index: dayIndex,
        hour: activeHour,
      });
      await refetch();
    } catch {
      // Error handled by mutation state
    } finally {
      setIsRefreshing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-md border-l-4 border-purple-600">
        <h2 className="text-sm text-gray-600 dark:text-gray-300 mb-3.5 font-semibold">
          🌡️ Analyse Thermique (Émagramme)
        </h2>
        <div className="py-5 text-center text-gray-500 dark:text-gray-400 text-sm">
          Chargement...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-md border-l-4 border-red-500">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm text-gray-600 dark:text-gray-300 font-semibold">
            🌡️ Analyse Thermique (Émagramme)
          </h2>
          <Button
            onPress={handleRefresh}
            isDisabled={isRefreshing || !siteId}
            className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
            aria-label="Réessayer"
          >
            <span
              className={`text-base ${isRefreshing ? 'animate-spin inline-block' : ''}`}
            >
              🔄
            </span>
          </Button>
        </div>
        <div className="text-red-600 dark:text-red-400 text-sm">
          Erreur : {error.message}
        </div>
      </div>
    );
  }

  // Analysis returned but failed
  const analysisFailed = emagram?.analysis_status === 'failed';

  if (!emagram) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-md border-l-4 border-purple-600">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm text-gray-600 dark:text-gray-300 font-semibold">
            🌡️ Analyse Thermique (Émagramme)
          </h2>
          <Button
            onPress={handleRefresh}
            isDisabled={isRefreshing || !siteId}
            className="p-1.5 rounded-full hover:bg-gray-100 transition-colors disabled:opacity-50"
            aria-label="Actualiser"
          >
            <span
              className={`text-lg ${isRefreshing ? 'animate-spin inline-block' : ''}`}
            >
              🔄
            </span>
          </Button>
        </div>
        <div className="py-5 text-center text-gray-500 dark:text-gray-400 text-sm">
          {!siteId ? 'Aucun site selectionne' : 'Analyse en cours...'}
        </div>
        {siteId && (
          <div className="flex justify-center mt-2">
            <div className="animate-spin h-6 w-6 border-2 border-purple-600 border-t-transparent rounded-full" />
          </div>
        )}
      </div>
    );
  }

  // Display error when analysis failed
  if (analysisFailed) {
    const sourcesErrors = parseSourcesErrors(emagram.sources_errors);
    const errorEntries = Object.entries(sourcesErrors);

    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-md border-l-4 border-orange-500">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm text-gray-600 dark:text-gray-300 font-semibold">
            🌡️ Analyse Thermique (Émagramme)
          </h2>
          <Button
            onPress={handleRefresh}
            isDisabled={isRefreshing}
            className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
            aria-label="Réessayer"
          >
            <span
              className={`text-base ${isRefreshing ? 'animate-spin inline-block' : ''}`}
            >
              🔄
            </span>
          </Button>
        </div>
        <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-700 rounded-lg p-3">
          <div className="flex items-start gap-2">
            <span className="text-base flex-shrink-0">⚠️</span>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-orange-800 dark:text-orange-200 mb-1">
                L&apos;analyse a échoué
              </div>
              {emagram.error_message && (
                <p className="text-xs text-orange-700 dark:text-orange-300 break-words">
                  {emagram.error_message}
                </p>
              )}
            </div>
          </div>
        </div>
        {errorEntries.length > 0 && (
          <div className="mt-2 space-y-1">
            {errorEntries.map(([source, errorMsg]) => (
              <div
                key={source}
                className="flex items-start gap-2 text-xs text-orange-700 dark:text-orange-300 bg-orange-50 dark:bg-orange-900/10 rounded px-2 py-1.5"
              >
                <span className="flex-shrink-0">📡</span>
                <span>
                  <span className="font-medium capitalize">
                    {source.replace('-', ' ')}
                  </span>{' '}
                  — {errorMsg}
                </span>
              </div>
            ))}
          </div>
        )}
        {triggerMutation.error && (
          <div className="mt-2 text-xs text-red-600 dark:text-red-400">
            Erreur lors du rafraîchissement : {triggerMutation.error.message}
          </div>
        )}
      </div>
    );
  }

  const score = emagram.score_volabilite || 0;
  const scoreColor = getScoreColor(score);
  const scoreCategory = getScoreCategory(score);
  const alerts = parseAlerts(emagram.alertes_securite);

  // Format analysis time
  const analysisDate = new Date(emagram.analysis_datetime);
  const timeAgo = getTimeAgo(analysisDate);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-md border-l-4 border-purple-600 flex-1 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm text-gray-600 dark:text-gray-300 font-semibold">
          🌡️ Analyse Thermique (Émagramme)
        </h2>
        <Button
          onPress={handleRefresh}
          isDisabled={isRefreshing}
          className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
          aria-label="Actualiser"
        >
          <span
            className={`text-base ${isRefreshing ? 'animate-spin inline-block' : ''}`}
          >
            🔄
          </span>
        </Button>
      </div>

      {/* Hour Slider */}
      {hasHourlyData && hoursData && (
        <HourSlider
          hours={hoursData.hours}
          selectedHour={activeHour}
          onHourChange={setSelectedHour}
        />
      )}

      {/* Verdict + metadata */}
      <div className="flex items-center justify-between mb-3">
        <div
          className="text-lg font-bold capitalize"
          style={{ color: scoreColor }}
        >
          {translateCategory(scoreCategory)}
        </div>
        <div className="text-xs text-gray-500 dark:text-gray-400 text-right">
          <span>
            📍 {emagram.station_name}
            {emagram.distance_km != null &&
              ` (${emagram.distance_km.toFixed(0)} km)`}
          </span>
          <span className="ml-2">🕒 {timeAgo}</span>
        </div>
      </div>

      {/* Thermal condition badges */}
      <div className="flex flex-wrap gap-2 mb-4">
        {emagram.force_thermique_ms != null && (
          <ThermalBadge
            icon={getThermalStrengthIcon(emagram.force_thermique_ms)}
            label={getThermalStrengthLabel(emagram.force_thermique_ms)}
            detail={`${emagram.force_thermique_ms.toFixed(1)} m/s`}
            color={getThermalStrengthColor(emagram.force_thermique_ms)}
          />
        )}
        {emagram.plafond_thermique_m != null &&
          emagram.plafond_thermique_m > 0 && (
            <ThermalBadge
              icon="☁️"
              label={`Plafond ${emagram.plafond_thermique_m}m`}
              color={
                emagram.plafond_thermique_m >= 2000
                  ? 'green'
                  : emagram.plafond_thermique_m >= 1200
                    ? 'amber'
                    : 'gray'
              }
            />
          )}
        {emagram.stabilite_atmospherique && (
          <ThermalBadge
            icon={getStabilityEmoji(emagram.stabilite_atmospherique)}
            label={emagram.stabilite_atmospherique}
            color={getStabilityBadgeColor(emagram.stabilite_atmospherique)}
          />
        )}
        {emagram.cisaillement_vent &&
          emagram.cisaillement_vent.toLowerCase() !== 'faible' && (
            <ThermalBadge
              icon={
                emagram.cisaillement_vent.toLowerCase().includes('fort')
                  ? '⚡'
                  : '💨'
              }
              label={`Cisaillement ${emagram.cisaillement_vent.toLowerCase()}`}
              color={
                emagram.cisaillement_vent.toLowerCase().includes('fort')
                  ? 'red'
                  : 'amber'
              }
            />
          )}
        {emagram.risque_orage &&
          emagram.risque_orage.toLowerCase() !== 'faible' &&
          emagram.risque_orage.toLowerCase() !== 'nul' && (
            <ThermalBadge
              icon={getRiskEmoji(emagram.risque_orage)}
              label={`Orage ${emagram.risque_orage.toLowerCase()}`}
              color={
                emagram.risque_orage.toLowerCase().includes('élev')
                  ? 'red'
                  : 'amber'
              }
            />
          )}
        {emagram.flyable_hours_formatted && (
          <ThermalBadge
            icon="⏰"
            label={emagram.flyable_hours_formatted}
            color="blue"
          />
        )}
      </div>

      {/* Summary */}
      {emagram.resume_conditions && (
        <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3 mb-3">
          <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
            {emagram.resume_conditions}
          </p>
        </div>
      )}

      {/* Conseils */}
      {emagram.conseils_vol && (
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 mb-3">
          <div className="flex items-start gap-2">
            <span className="text-base flex-shrink-0">💡</span>
            <p className="text-sm text-blue-900 dark:text-blue-100 leading-relaxed flex-1">
              {emagram.conseils_vol}
            </p>
          </div>
        </div>
      )}

      {/* Safety Alerts */}
      {alerts.length > 0 && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg p-3">
          <div className="flex items-start gap-2 mb-2">
            <span className="text-base flex-shrink-0">⚠️</span>
            <span className="text-sm font-semibold text-red-900 dark:text-red-100">
              Alertes de sécurité
            </span>
          </div>
          <ul className="space-y-1 ml-6">
            {alerts.map((alert, idx) => (
              <li
                key={idx}
                className="text-xs text-red-800 dark:text-red-200 list-disc"
              >
                {alert}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Screenshots - Multi-source Gemini analysis */}
      {emagram.screenshot_paths &&
        (() => {
          try {
            const screenshots = JSON.parse(emagram.screenshot_paths);
            const sourceKeys = Object.keys(screenshots);
            if (sourceKeys.length > 0) {
              const forecastLabel = emagram.forecast_date
                ? new Date(
                    emagram.forecast_date + 'T00:00:00'
                  ).toLocaleDateString('fr-FR', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                  })
                : '';
              const lightboxImages = sourceKeys.map((source) => ({
                src: `/api/emagram/screenshot/${emagram.id}/${source}`,
                alt: [
                  source
                    .replace('-', ' ')
                    .split(' ')
                    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
                    .join(' '),
                  forecastLabel,
                ]
                  .filter(Boolean)
                  .join(' — '),
              }));
              return (
                <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
                  <div className="text-xs text-gray-600 dark:text-gray-300 font-semibold mb-2">
                    📊 Émagrammes capturés ({sourceKeys.length})
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {lightboxImages.map((image, idx) => (
                      <Button
                        key={image.alt}
                        onPress={() => {
                          setLightboxIndex(idx);
                          setLightboxOpen(true);
                        }}
                        className="inline-flex items-center gap-1 px-3 py-2 text-xs bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors border border-blue-200 dark:border-blue-700 cursor-pointer"
                      >
                        <span>📸</span>
                        <span>{image.alt}</span>
                        <span className="text-blue-400">🔍</span>
                      </Button>
                    ))}
                  </div>
                  {emagram.sources_agreement && (
                    <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                      Consensus:{' '}
                      <span className="font-medium">
                        {emagram.sources_agreement}
                      </span>
                    </div>
                  )}
                  {(() => {
                    const srcErrors = parseSourcesErrors(
                      emagram.sources_errors
                    );
                    const entries = Object.entries(srcErrors);
                    if (entries.length === 0) return null;
                    return (
                      <div className="mt-2 space-y-1">
                        {entries.map(([source, errMsg]) => (
                          <div
                            key={source}
                            className="flex items-start gap-1.5 text-xs text-orange-600 dark:text-orange-400"
                          >
                            <span className="flex-shrink-0">⚠️</span>
                            <span>
                              <span className="font-medium capitalize">
                                {source.replace('-', ' ')}
                              </span>{' '}
                              — {errMsg}
                            </span>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                  <Lightbox
                    isOpen={lightboxOpen}
                    onClose={() => setLightboxOpen(false)}
                    images={lightboxImages}
                    initialIndex={lightboxIndex}
                  />
                </div>
              );
            }
          } catch {
            // Invalid JSON, skip
          }
          return null;
        })()}

      {/* Method indicator */}
      <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
        <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
          <span>
            {emagram.is_from_llm
              ? `🤖 Analyse IA (${emagram.llm_model?.split('-')[0] || 'AI'})`
              : '📊 Calculs classiques'}
          </span>
          <span>{emagram.sounding_time}</span>
        </div>
      </div>
    </div>
  );
}

// Badge colors mapping
const badgeColors: Record<string, string> = {
  green: 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200',
  amber: 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200',
  red: 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200',
  blue: 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200',
  purple:
    'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-200',
  gray: 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300',
};

function ThermalBadge({
  icon,
  label,
  detail,
  color,
}: {
  icon: string;
  label: string;
  detail?: string;
  color: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${badgeColors[color] || badgeColors.gray}`}
    >
      <span>{icon}</span>
      <span className="capitalize">{label}</span>
      {detail && <span className="opacity-70">({detail})</span>}
    </span>
  );
}

function getThermalStrengthIcon(force: number): string {
  if (force >= 3) return '🔥';
  if (force >= 1.5) return '🌀';
  if (force >= 0.5) return '↑';
  return '—';
}

function getThermalStrengthLabel(force: number): string {
  if (force >= 3) return 'Thermiques forts';
  if (force >= 1.5) return 'Thermiques modérés';
  if (force >= 0.5) return 'Thermiques faibles';
  return 'Pas de thermiques';
}

function getThermalStrengthColor(force: number): string {
  if (force >= 3) return 'red';
  if (force >= 1.5) return 'green';
  if (force >= 0.5) return 'amber';
  return 'gray';
}

function getStabilityBadgeColor(stabilite: string): string {
  const s = stabilite.toLowerCase();
  if (s.includes('très instable')) return 'red';
  if (s.includes('instable')) return 'amber';
  if (s.includes('stable')) return 'green';
  return 'gray';
}

// Helper function to format time ago
function getTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);

  if (diffHours < 1) return `Il y a ${diffMins}min`;
  if (diffHours < 24) return `Il y a ${diffHours}h`;

  const diffDays = Math.floor(diffHours / 24);
  return `Il y a ${diffDays}j`;
}

// Helper to translate score category
function translateCategory(category: string): string {
  const translations: Record<string, string> = {
    excellent: 'Excellent',
    good: 'Bon',
    moderate: 'Moyen',
    poor: 'Limite',
    unflyable: 'Non volable',
  };
  return translations[category] || category;
}
