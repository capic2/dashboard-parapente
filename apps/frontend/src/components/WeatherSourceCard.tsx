/**
 * WeatherSourceCard Component
 * Displays individual weather source configuration with stats and controls
 */

import React, { useState } from 'react';
import {
  Button,
  Switch,
  TextField,
  Input,
  Text,
  Link,
} from 'react-aria-components';
import type { WeatherSource } from '../types/weatherSources';
import {
  useUpdateWeatherSource,
  useTestWeatherSource,
} from '../hooks/useWeatherSources';

interface WeatherSourceCardProps {
  source: WeatherSource;
  isLastActive: boolean; // True if this is the only active source
  onDelete?: (source: WeatherSource) => void;
}

export const WeatherSourceCard: React.FC<WeatherSourceCardProps> = ({
  source,
  isLastActive,
  onDelete,
}) => {
  const updateSource = useUpdateWeatherSource();
  const testSource = useTestWeatherSource();

  const [showApiKey, setShowApiKey] = useState(false);
  const [apiKeyValue, setApiKeyValue] = useState('');
  const [isEditingApiKey, setIsEditingApiKey] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);
  const [notification, setNotification] = useState<{
    type: 'error' | 'success' | 'warning';
    message: string;
  } | null>(null);

  // Status badge styling
  const getStatusBadge = () => {
    const statusLabels = {
      active: 'Actif',
      error: 'Erreur',
      disabled: 'Désactivé',
      unknown: 'Non testé',
    };

    const statusClasses = {
      active: 'bg-green-100 text-green-800',
      error: 'bg-red-100 text-red-800',
      disabled: 'bg-gray-100 text-gray-600',
      unknown: 'bg-yellow-100 text-yellow-800',
    };

    return (
      <span
        className={`px-2 py-1 text-xs font-semibold rounded ${statusClasses[source.status]}`}
        role="status"
        aria-label={`Statut de la source: ${statusLabels[source.status]}`}
      >
        ● {statusLabels[source.status]}
      </span>
    );
  };

  // Scraper type icon
  const getScraperIcon = () => {
    switch (source.scraper_type) {
      case 'api':
        return '🌐';
      case 'playwright':
        return '🎭';
      case 'stealth':
        return '🥷';
    }
  };

  // Show notification helper
  const showNotification = (
    type: 'error' | 'success' | 'warning',
    message: string
  ) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 5000);
  };

  // Toggle enabled/disabled
  const handleToggleEnabled = async () => {
    if (isLastActive && source.is_enabled) {
      showNotification(
        'warning',
        'Impossible de désactiver la dernière source active. Au moins une source doit rester activée.'
      );
      return;
    }

    try {
      await updateSource.mutateAsync({
        sourceName: source.source_name,
        data: { is_enabled: !source.is_enabled },
      });
    } catch (error: unknown) {
      showNotification(
        'error',
        (error instanceof Error ? error.message : null) ||
          'Impossible de modifier la source'
      );
    }
  };

  // Save API key
  const handleSaveApiKey = async () => {
    if (!apiKeyValue.trim()) {
      showNotification('warning', 'Veuillez entrer une clé API');
      return;
    }

    try {
      await updateSource.mutateAsync({
        sourceName: source.source_name,
        data: { api_key: apiKeyValue },
      });
      setIsEditingApiKey(false);
      setApiKeyValue('');
      showNotification('success', 'Clé API sauvegardée avec succès');
    } catch (error: unknown) {
      showNotification(
        'error',
        (error instanceof Error ? error.message : null) ||
          'Impossible de sauvegarder la clé API'
      );
    }
  };

  // Test source
  const handleTest = async () => {
    setIsTesting(true);
    setTestResult(null);

    try {
      // Use a default test location (Besançon area)
      const result = await testSource.mutateAsync({
        sourceName: source.source_name,
        lat: 47.24,
        lon: 6.02,
      });

      if (result.success) {
        setTestResult({
          success: true,
          message: `✅ Test réussi en ${result.response_time_ms}ms`,
        });
      } else {
        setTestResult({
          success: false,
          message: `❌ Échec: ${result.error || 'Erreur inconnue'}`,
        });
      }
    } catch (error: unknown) {
      setTestResult({
        success: false,
        message: `❌ Erreur: ${error instanceof Error ? error.message : 'Test échoué'}`,
      });
    } finally {
      setIsTesting(false);
      // Clear test result after 5 seconds
      setTimeout(() => setTestResult(null), 5000);
    }
  };

  // Format timestamp
  const formatTimestamp = (timestamp: string | null) => {
    if (!timestamp) return 'Jamais';
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return "À l'instant";
    if (diffMins < 60) return `Il y a ${diffMins}min`;
    if (diffMins < 1440) return `Il y a ${Math.floor(diffMins / 60)}h`;
    return `Il y a ${Math.floor(diffMins / 1440)}j`;
  };

  return (
    <article
      className={`bg-white rounded-lg shadow-md p-5 border-2 transition-all ${
        source.is_enabled ? 'border-sky-200' : 'border-gray-200'
      }`}
      aria-label={`Configuration de la source météo ${source.display_name}`}
    >
      {/* Notification */}
      {notification && (
        <div
          className={`mb-3 p-3 rounded-lg text-sm font-medium ${
            notification.type === 'error'
              ? 'bg-red-50 text-red-800 border border-red-200'
              : notification.type === 'success'
                ? 'bg-green-50 text-green-800 border border-green-200'
                : 'bg-yellow-50 text-yellow-800 border border-yellow-200'
          }`}
          role="alert"
          aria-live="assertive"
          aria-atomic="true"
        >
          {notification.message}
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-2xl" aria-hidden="true">
              {getScraperIcon()}
            </span>
            <h3 className="text-lg font-bold text-gray-900">
              {source.display_name}
            </h3>
            {getStatusBadge()}
          </div>
          <Text slot="description" className="text-sm text-gray-600">
            {source.description}
          </Text>
        </div>

        {/* Toggle Switch */}
        <Switch
          isSelected={source.is_enabled}
          onChange={handleToggleEnabled}
          isDisabled={updateSource.isPending}
          className="group ml-3"
          aria-label={`${source.is_enabled ? 'Désactiver' : 'Activer'} la source ${source.display_name}`}
        >
          <div className="relative inline-flex items-center cursor-pointer">
            <div className="w-11 h-6 bg-gray-300 group-focus-visible:outline-none group-focus-visible:ring-2 group-focus-visible:ring-sky-300 rounded-full group-selected:bg-sky-600 transition-colors">
              <div className="absolute top-[2px] left-[2px] bg-white border-gray-300 border rounded-full h-5 w-5 transition-transform group-selected:translate-x-full"></div>
            </div>
          </div>
        </Switch>
      </div>

      {/* API Key Section */}
      {source.requires_api_key && (
        <div className="mb-3 p-3 bg-blue-50 rounded border border-blue-200">
          <div className="flex items-center justify-between mb-2">
            <span
              className="text-sm font-medium text-gray-700"
              aria-hidden="true"
            >
              🔑 Clé API
            </span>
            {source.api_key_configured ? (
              <span
                className="text-xs text-green-600 font-semibold"
                role="status"
                aria-label="Clé API configurée"
              >
                ✓ Configurée
              </span>
            ) : (
              <span
                className="text-xs text-red-600 font-semibold"
                role="status"
                aria-label="Clé API manquante"
              >
                ✗ Manquante
              </span>
            )}
          </div>

          {isEditingApiKey ? (
            <div className="flex gap-2">
              <TextField
                value={apiKeyValue}
                onChange={setApiKeyValue}
                type={showApiKey ? 'text' : 'password'}
                aria-label="Clé API"
                className="flex-1"
              >
                <Input
                  placeholder="Entrez votre clé API"
                  className="w-full px-2 py-1 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-sky-300"
                />
              </TextField>
              <Button
                onPress={() => setShowApiKey(!showApiKey)}
                className="px-2 py-1 text-xs bg-gray-200 rounded hover:bg-gray-300 pressed:bg-gray-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
                aria-label={
                  showApiKey ? 'Masquer la clé API' : 'Afficher la clé API'
                }
              >
                <span aria-hidden="true">{showApiKey ? '🙈' : '👁️'}</span>
              </Button>
              <Button
                onPress={handleSaveApiKey}
                isDisabled={updateSource.isPending}
                className="px-3 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 pressed:bg-green-800 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
                aria-label="Sauvegarder la clé API"
              >
                <span aria-hidden="true">✓</span>
              </Button>
              <Button
                onPress={() => {
                  setIsEditingApiKey(false);
                  setApiKeyValue('');
                }}
                className="px-3 py-1 text-xs bg-gray-400 text-white rounded hover:bg-gray-500 pressed:bg-gray-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
                aria-label="Annuler la modification"
              >
                <span aria-hidden="true">✗</span>
              </Button>
            </div>
          ) : (
            <Button
              onPress={() => setIsEditingApiKey(true)}
              className="w-full px-3 py-1 text-sm bg-white border rounded hover:bg-gray-50 pressed:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
            >
              {source.api_key_configured
                ? 'Modifier la clé API'
                : 'Configurer la clé API'}
            </Button>
          )}

          {source.documentation_url && (
            <Link
              href={source.documentation_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-blue-600 hover:underline mt-1 inline-block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 rounded"
            >
              <span aria-hidden="true">📖 </span>Documentation API
            </Link>
          )}
        </div>
      )}

      {/* Statistics */}
      <div
        className="grid grid-cols-3 gap-2 mb-3 text-center"
        role="group"
        aria-label="Statistiques de performance"
      >
        <div className="p-2 bg-gray-50 rounded">
          <div
            className="text-xs text-gray-600"
            id={`success-rate-label-${source.source_name}`}
          >
            Taux succès
          </div>
          <div
            className={`text-lg font-bold ${
              source.success_rate >= 95
                ? 'text-green-600'
                : source.success_rate >= 80
                  ? 'text-yellow-600'
                  : 'text-red-600'
            }`}
            aria-labelledby={`success-rate-label-${source.source_name}`}
            aria-live="polite"
          >
            {source.success_rate.toFixed(0)}%
          </div>
        </div>
        <div className="p-2 bg-gray-50 rounded">
          <div
            className="text-xs text-gray-600"
            id={`response-time-label-${source.source_name}`}
          >
            Temps moy
          </div>
          <div
            className="text-lg font-bold text-gray-900"
            aria-labelledby={`response-time-label-${source.source_name}`}
            aria-live="polite"
          >
            {source.avg_response_time_ms
              ? `${source.avg_response_time_ms}ms`
              : '-'}
          </div>
        </div>
        <div className="p-2 bg-gray-50 rounded">
          <div
            className="text-xs text-gray-600"
            id={`calls-count-label-${source.source_name}`}
          >
            Appels
          </div>
          <div
            className="text-lg font-bold text-gray-900"
            aria-labelledby={`calls-count-label-${source.source_name}`}
            aria-live="polite"
          >
            {source.success_count + source.error_count}
          </div>
        </div>
      </div>

      {/* Last activity */}
      <div
        className="text-xs text-gray-600 mb-3"
        role="region"
        aria-label="Historique d'activité"
      >
        {source.last_success_at && (
          <div role="status">
            <span aria-hidden="true">✓ </span>Dernier succès:{' '}
            {formatTimestamp(source.last_success_at)}
          </div>
        )}
        {source.last_error_at && (
          <div className="text-red-600" role="alert">
            <span aria-hidden="true">✗ </span>Dernière erreur:{' '}
            {formatTimestamp(source.last_error_at)}
            {source.last_error_message && (
              <div
                className="text-xs mt-1 p-1 bg-red-50 rounded truncate"
                title={source.last_error_message}
                role="status"
                aria-label={`Message d'erreur: ${source.last_error_message}`}
              >
                {source.last_error_message}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Test Result */}
      {testResult && (
        <div
          className={`mb-3 p-2 rounded text-sm ${
            testResult.success
              ? 'bg-green-50 text-green-800'
              : 'bg-red-50 text-red-800'
          }`}
          role={testResult.success ? 'status' : 'alert'}
          aria-live="polite"
          aria-atomic="true"
        >
          {testResult.message}
        </div>
      )}

      {/* Actions */}
      <div
        className="flex gap-2"
        role="group"
        aria-label="Actions sur la source météo"
      >
        <Button
          onPress={handleTest}
          isDisabled={isTesting || !source.is_enabled}
          className="flex-1 px-3 py-2 text-sm font-medium bg-blue-600 text-white rounded hover:bg-blue-700 pressed:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
          aria-label={`Tester la source ${source.display_name}`}
        >
          {isTesting ? (
            <>
              <span aria-hidden="true">⏳ </span>
              <span>Test en cours...</span>
            </>
          ) : (
            <>
              <span aria-hidden="true">🔍 </span>
              <span>Tester</span>
            </>
          )}
        </Button>

        {onDelete &&
          ![
            'open-meteo',
            'weatherapi',
            'meteo-parapente',
            'meteociel',
            'meteoblue',
          ].includes(source.source_name) && (
            <Button
              onPress={() => onDelete(source)}
              className="px-3 py-2 text-sm font-medium bg-red-600 text-white rounded hover:bg-red-700 pressed:bg-red-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
              aria-label={`Supprimer la source ${source.display_name}`}
            >
              <span aria-hidden="true">🗑️</span>
              <span className="sr-only">Supprimer</span>
            </Button>
          )}
      </div>
    </article>
  );
};
