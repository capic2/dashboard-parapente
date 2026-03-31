/**
 * Thermal Analysis Page - Detailed emagram analysis view
 */

import { useState } from 'react';
import {
  useLatestEmagram,
  useEmagramHistory,
  useTriggerEmagram,
} from '../hooks/useEmagramAnalysis';
import { useSite } from '../hooks/useSites';
import { parseAlerts, getScoreColor } from '../types/emagram';

export default function ThermalAnalysis() {
  const [selectedSiteId] = useState<string>('site-mont-poupet-ouest');
  const { data: site } = useSite(selectedSiteId);

  const userLat = site?.latitude || null;
  const userLon = site?.longitude || null;

  const { data: latest, isLoading, refetch } = useLatestEmagram(selectedSiteId);
  const { data: history } = useEmagramHistory(userLat, userLon, 7);
  const triggerMutation = useTriggerEmagram();

  const handleRefresh = async () => {
    if (!selectedSiteId) return;

    try {
      await triggerMutation.mutateAsync({
        site_id: selectedSiteId,
        force_refresh: true,
      });
      await refetch();
    } catch {
      // Error handled by mutation state
    }
  };

  if (isLoading) {
    return (
      <div className="p-4">
        <h1 className="text-2xl font-bold mb-4">🌡️ Analyse Thermique</h1>
        <div className="text-center py-8">Chargement...</div>
      </div>
    );
  }

  if (!latest) {
    return (
      <div className="p-4">
        <h1 className="text-2xl font-bold mb-4">🌡️ Analyse Thermique</h1>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-8 shadow-md text-center">
          <p className="text-gray-600 dark:text-gray-300 mb-4">
            Aucune analyse récente disponible
          </p>
          <button
            onClick={handleRefresh}
            disabled={triggerMutation.isPending}
            className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
          >
            {triggerMutation.isPending
              ? 'Analyse en cours...'
              : 'Lancer une analyse'}
          </button>
        </div>
      </div>
    );
  }

  const score = latest.score_volabilite || 0;
  const scoreColor = getScoreColor(score);
  const alerts = parseAlerts(latest.alertes_securite);

  return (
    <div className="p-4 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">🌡️ Analyse Thermique</h1>
        <button
          onClick={handleRefresh}
          disabled={triggerMutation.isPending}
          className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
        >
          {triggerMutation.isPending ? '⏳ En cours...' : '🔄 Actualiser'}
        </button>
      </div>

      {/* Main Analysis Card */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Left Column - Score & Metrics */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-md">
          <h2 className="text-lg font-bold mb-4">Score de Volabilité</h2>

          {/* Score Gauge */}
          <div className="flex justify-center mb-6">
            <div className="relative w-32 h-32">
              <svg className="w-32 h-32 transform -rotate-90">
                <circle
                  cx="64"
                  cy="64"
                  r="56"
                  stroke="#e5e7eb"
                  strokeWidth="12"
                  fill="none"
                />
                <circle
                  cx="64"
                  cy="64"
                  r="56"
                  stroke={scoreColor}
                  strokeWidth="12"
                  fill="none"
                  strokeDasharray={`${2 * Math.PI * 56 * (score / 100)} ${2 * Math.PI * 56}`}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center flex-col">
                <span
                  className="text-4xl font-bold"
                  style={{ color: scoreColor }}
                >
                  {score}
                </span>
                <span className="text-sm text-gray-500 dark:text-gray-400">/ 100</span>
              </div>
            </div>
          </div>

          {/* Key Metrics */}
          <div className="space-y-3">
            {latest.plafond_thermique_m && (
              <div className="flex justify-between items-center border-b dark:border-gray-700 pb-2">
                <span className="text-gray-600 dark:text-gray-300">☁️ Plafond</span>
                <span className="font-bold">{latest.plafond_thermique_m}m</span>
              </div>
            )}

            {latest.force_thermique_ms && (
              <div className="flex justify-between items-center border-b dark:border-gray-700 pb-2">
                <span className="text-gray-600 dark:text-gray-300">📈 Force</span>
                <span className="font-bold">
                  {latest.force_thermique_ms.toFixed(1)} m/s
                </span>
              </div>
            )}

            {latest.cape_jkg && (
              <div className="flex justify-between items-center border-b dark:border-gray-700 pb-2">
                <span className="text-gray-600 dark:text-gray-300">⚡ CAPE</span>
                <span className="font-bold">
                  {latest.cape_jkg.toFixed(0)} J/kg
                </span>
              </div>
            )}

            {latest.flyable_hours_formatted && (
              <div className="flex justify-between items-center border-b dark:border-gray-700 pb-2">
                <span className="text-gray-600 dark:text-gray-300">⏰ Heures</span>
                <span className="font-bold">
                  {latest.flyable_hours_formatted}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Middle Column - Skew-T Diagram */}
        <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-xl p-6 shadow-md">
          <h2 className="text-lg font-bold mb-4">Diagramme Skew-T</h2>

          {latest.skewt_image_path ? (
            <div className="bg-gray-100 dark:bg-gray-700 rounded-lg p-4">
              <img
                src={`/api/files${latest.skewt_image_path}`}
                alt="Skew-T Diagram"
                className="w-full h-auto rounded"
                onError={(e) => {
                  (e.target as HTMLImageElement).src =
                    'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400"><rect width="600" height="400" fill="%23f3f4f6"/><text x="50%" y="50%" text-anchor="middle" fill="%239ca3af" font-size="16">Image non disponible</text></svg>';
                }}
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 text-center">
                {latest.station_name} • {latest.sounding_time} •{' '}
                {new Date(latest.analysis_datetime).toLocaleDateString()}
              </p>
            </div>
          ) : (
            <div className="bg-gray-100 dark:bg-gray-700 rounded-lg p-8 text-center text-gray-500 dark:text-gray-400">
              Diagramme non disponible
            </div>
          )}
        </div>
      </div>

      {/* Analysis Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Conditions */}
        {latest.resume_conditions && (
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-md">
            <h2 className="text-lg font-bold mb-3">📊 Résumé des Conditions</h2>
            <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
              {latest.resume_conditions}
            </p>
          </div>
        )}

        {/* Conseils */}
        {latest.conseils_vol && (
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-6 shadow-md border border-blue-200 dark:border-blue-700">
            <h2 className="text-lg font-bold mb-3 text-blue-900 dark:text-blue-100">
              💡 Conseils de Vol
            </h2>
            <p className="text-blue-800 dark:text-blue-200 leading-relaxed">
              {latest.conseils_vol}
            </p>
          </div>
        )}
      </div>

      {/* Safety Alerts */}
      {alerts.length > 0 && (
        <div className="bg-red-50 dark:bg-red-900/20 rounded-xl p-6 shadow-md border border-red-200 dark:border-red-700 mb-6">
          <h2 className="text-lg font-bold mb-3 text-red-900 dark:text-red-100">
            ⚠️ Alertes de Sécurité
          </h2>
          <ul className="space-y-2">
            {alerts.map((alert, idx) => (
              <li key={idx} className="flex items-start gap-2 text-red-800 dark:text-red-200">
                <span>•</span>
                <span>{alert}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* History */}
      {history && history.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-md">
          <h2 className="text-lg font-bold mb-4">📈 Historique 7 Jours</h2>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b dark:border-gray-700">
                  <th className="text-left py-2">Date</th>
                  <th className="text-center py-2">Score</th>
                  <th className="text-center py-2">Plafond</th>
                  <th className="text-center py-2">Force</th>
                  <th className="text-center py-2">Méthode</th>
                </tr>
              </thead>
              <tbody>
                {history.slice(0, 10).map((item) => (
                  <tr key={item.id} className="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="py-2">
                      {new Date(item.created_at).toLocaleDateString()}
                    </td>
                    <td className="text-center">
                      <span
                        className="px-2 py-1 rounded-full text-sm font-bold"
                        style={{
                          backgroundColor: `${getScoreColor(item.score_volabilite)}20`,
                          color: getScoreColor(item.score_volabilite),
                        }}
                      >
                        {item.score_volabilite || '-'}
                      </span>
                    </td>
                    <td className="text-center">
                      {item.plafond_thermique_m
                        ? `${item.plafond_thermique_m}m`
                        : '-'}
                    </td>
                    <td className="text-center">
                      {item.force_thermique_ms
                        ? `${item.force_thermique_ms.toFixed(1)} m/s`
                        : '-'}
                    </td>
                    <td className="text-center text-xs text-gray-500 dark:text-gray-400">
                      {item.analysis_method === 'llm_vision'
                        ? '🤖 IA'
                        : '📊 Classique'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
