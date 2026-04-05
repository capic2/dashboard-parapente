/**
 * Emagram Widget - AI-powered thermal forecasting
 * Displays emagram analysis with score visualization and thermal metrics
 */

import {
  useLatestEmagram,
  useTriggerEmagram,
} from '../../hooks/weather/useEmagramAnalysis';
import {
  parseAlerts,
  getScoreColor,
  getScoreCategory,
} from '../../types/emagram';
import { useState } from 'react';
import { Lightbox } from '@dashboard-parapente/design-system';

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

export default function EmagramWidget({
  siteId,
  dayIndex = 0,
}: EmagramWidgetProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  const {
    data: emagram,
    isLoading,
    error,
    refetch,
  } = useLatestEmagram(siteId, dayIndex);
  const triggerMutation = useTriggerEmagram();

  const handleRefresh = async () => {
    if (!siteId || isRefreshing) return;

    setIsRefreshing(true);
    try {
      await triggerMutation.mutateAsync({
        site_id: siteId,
        force_refresh: true,
        day_index: dayIndex,
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
          <button
            onClick={handleRefresh}
            disabled={isRefreshing || !siteId}
            className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
            title="Réessayer"
          >
            <span
              className={`text-base ${isRefreshing ? 'animate-spin inline-block' : ''}`}
            >
              🔄
            </span>
          </button>
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
          <button
            onClick={handleRefresh}
            disabled={isRefreshing || !siteId}
            className="p-1.5 rounded-full hover:bg-gray-100 transition-colors disabled:opacity-50"
            title="Actualiser"
          >
            <span
              className={`text-lg ${isRefreshing ? 'animate-spin inline-block' : ''}`}
            >
              🔄
            </span>
          </button>
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

  // Display error when analysis failed or trigger mutation failed
  if (analysisFailed) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-md border-l-4 border-orange-500">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm text-gray-600 dark:text-gray-300 font-semibold">
            🌡️ Analyse Thermique (Émagramme)
          </h2>
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
            title="Réessayer"
          >
            <span
              className={`text-base ${isRefreshing ? 'animate-spin inline-block' : ''}`}
            >
              🔄
            </span>
          </button>
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
        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
          title="Actualiser"
        >
          <span
            className={`text-base ${isRefreshing ? 'animate-spin inline-block' : ''}`}
          >
            🔄
          </span>
        </button>
      </div>

      {/* Score Gauge */}
      <div className="flex items-center gap-4 mb-4">
        <div className="relative w-24 h-24">
          <svg className="w-24 h-24 transform -rotate-90">
            {/* Background circle */}
            <circle
              cx="48"
              cy="48"
              r="40"
              stroke="#e5e7eb"
              strokeWidth="8"
              fill="none"
            />
            {/* Score arc */}
            <circle
              cx="48"
              cy="48"
              r="40"
              stroke={scoreColor}
              strokeWidth="8"
              fill="none"
              strokeDasharray={`${2 * Math.PI * 40 * (score / 100)} ${2 * Math.PI * 40}`}
              strokeLinecap="round"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center flex-col">
            <span className="text-2xl font-bold" style={{ color: scoreColor }}>
              {score}
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              / 100
            </span>
          </div>
        </div>

        <div className="flex-1">
          <div
            className="text-lg font-semibold capitalize mb-1"
            style={{ color: scoreColor }}
          >
            {translateCategory(scoreCategory)}
          </div>
          <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 mb-1">
            <span>📍</span>
            <span>
              {emagram.station_name}
              {emagram.distance_km != null &&
                ` (${emagram.distance_km.toFixed(0)} km)`}
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <span>🕒</span>
            <span>
              {timeAgo} • {emagram.sounding_time}
            </span>
          </div>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        {/* Plafond thermique */}
        {emagram.plafond_thermique_m && (
          <div className="flex items-center gap-2 bg-gradient-to-br from-blue-50 to-sky-50 dark:from-blue-900/20 dark:to-sky-900/20 rounded-lg p-2.5">
            <span className="text-xl flex-shrink-0">☁️</span>
            <div className="flex-1 min-w-0">
              <div className="text-xs text-gray-600 dark:text-gray-300">
                Plafond
              </div>
              <div className="text-base font-bold text-gray-900 dark:text-white truncate">
                {emagram.plafond_thermique_m}m
              </div>
            </div>
          </div>
        )}

        {/* Force thermique */}
        {emagram.force_thermique_ms && (
          <div className="flex items-center gap-2 bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-900/20 dark:to-amber-900/20 rounded-lg p-2.5">
            <span className="text-xl flex-shrink-0">📈</span>
            <div className="flex-1 min-w-0">
              <div className="text-xs text-gray-600 dark:text-gray-300">
                Force
              </div>
              <div className="text-base font-bold text-gray-900 dark:text-white truncate">
                {emagram.force_thermique_ms.toFixed(1)} m/s
              </div>
            </div>
          </div>
        )}

        {/* Heures volables */}
        {emagram.flyable_hours_formatted && (
          <div className="flex items-center gap-2 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-lg p-2.5">
            <span className="text-xl flex-shrink-0">⏰</span>
            <div className="flex-1 min-w-0">
              <div className="text-xs text-gray-600 dark:text-gray-300">
                Heures
              </div>
              <div className="text-sm font-bold text-gray-900 dark:text-white truncate">
                {emagram.flyable_hours_formatted}
              </div>
            </div>
          </div>
        )}

        {/* Stabilité */}
        {emagram.stabilite_atmospherique && (
          <div className="flex items-center gap-2 bg-gradient-to-br from-purple-50 to-violet-50 dark:from-purple-900/20 dark:to-violet-900/20 rounded-lg p-2.5">
            <span className="text-xl flex-shrink-0">
              {getStabilityEmoji(emagram.stabilite_atmospherique)}
            </span>
            <div className="flex-1 min-w-0">
              <div className="text-xs text-gray-600 dark:text-gray-300">
                Stabilité
              </div>
              <div className="text-sm font-semibold text-gray-900 dark:text-white truncate capitalize">
                {emagram.stabilite_atmospherique}
              </div>
            </div>
          </div>
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
                      <button
                        key={image.alt}
                        onClick={() => {
                          setLightboxIndex(idx);
                          setLightboxOpen(true);
                        }}
                        className="inline-flex items-center gap-1 px-3 py-2 text-xs bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors border border-blue-200 dark:border-blue-700 cursor-pointer"
                      >
                        <span>📸</span>
                        <span>{image.alt}</span>
                        <span className="text-blue-400">🔍</span>
                      </button>
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
          {emagram.risque_orage && (
            <span className="flex items-center gap-1">
              {getRiskEmoji(emagram.risque_orage)} Orage: {emagram.risque_orage}
            </span>
          )}
        </div>
      </div>
    </div>
  );
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
