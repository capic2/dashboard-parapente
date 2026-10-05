/**
 * WeatherSourceCard Component
 * Displays individual weather source configuration with stats and controls
 */

import React, { useEffect, useRef, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { Switch, TextField, Input, Text, Link } from 'react-aria-components';
import { Button } from '@dashboard-parapente/design-system';
import { parseApiUtcDate } from '../../lib/date';
import type { WeatherSource } from '../../types/weatherSources';
import {
  useUpdateWeatherSource,
  useTestWeatherSource,
} from '../../hooks/weather/useWeatherSources';

export interface WeatherTestLocation {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
}

interface WeatherSourceCardProps {
  source: WeatherSource;
  testLocation: WeatherTestLocation | null;
  isLastActive: boolean; // True if this is the only active source
  onDelete?: (source: WeatherSource) => Promise<void> | void;
}

export const WeatherSourceCard: React.FC<WeatherSourceCardProps> = ({
  source,
  testLocation,
  isLastActive,
  onDelete,
}) => {
  const { t, i18n } = useTranslation();
  const updateSource = useUpdateWeatherSource();
  const testSource = useTestWeatherSource();

  const [showApiKey, setShowApiKey] = useState(false);
  const [apiKeyValue, setApiKeyValue] = useState('');
  const [isEditingApiKey, setIsEditingApiKey] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);
  const [notification, setNotification] = useState<{
    type: 'error' | 'success' | 'warning';
    message: string;
  } | null>(null);

  const getLatestCheckStatus = () => {
    if (source.requires_api_key && !source.api_key_configured) {
      return 'missingKey' as const;
    }

    const latestSuccess = source.last_success_at
      ? parseApiUtcDate(source.last_success_at).getTime()
      : null;
    const latestError = source.last_error_at
      ? parseApiUtcDate(source.last_error_at).getTime()
      : null;

    if (
      latestError !== null &&
      Number.isFinite(latestError) &&
      (latestSuccess === null ||
        !Number.isFinite(latestSuccess) ||
        latestError > latestSuccess)
    ) {
      return 'error' as const;
    }

    return latestSuccess !== null && Number.isFinite(latestSuccess)
      ? ('active' as const)
      : ('unknown' as const);
  };

  const latestCheckStatus = getLatestCheckStatus();
  const checkStatusLabels = {
    active: t('settings.weatherSources.lastCheckSucceeded'),
    error: t('settings.weatherSources.lastCheckFailed'),
    missingKey: t('settings.weatherSources.missingApiKeyState'),
    unknown: t('settings.weatherSources.neverChecked'),
  };
  const checkStatusClasses = {
    active:
      'bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-200',
    error: 'bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-200',
    missingKey:
      'bg-yellow-100 dark:bg-yellow-900/20 text-yellow-900 dark:text-yellow-100',
    unknown: 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200',
  };

  const getNotificationClassName = () => {
    switch (notification?.type) {
      case 'error':
        return 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200 border border-red-200 dark:border-red-700';
      case 'success':
        return 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200 border border-green-200 dark:border-green-700';
      case 'warning':
        return 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-200 border border-yellow-200 dark:border-yellow-700';
      default:
        return '';
    }
  };

  const notificationTimerRef = useRef<ReturnType<typeof setTimeout>>(null);

  useEffect(() => {
    return () => {
      if (notificationTimerRef.current)
        clearTimeout(notificationTimerRef.current);
    };
  }, []);

  // Show notification helper
  const showNotification = (
    type: 'error' | 'success' | 'warning',
    message: string
  ) => {
    setNotification({ type, message });
    if (notificationTimerRef.current)
      clearTimeout(notificationTimerRef.current);
    notificationTimerRef.current = setTimeout(
      () => setNotification(null),
      5000
    );
  };

  // Toggle enabled/disabled
  const handleToggleEnabled = async () => {
    if (isLastActive && source.is_enabled) {
      showNotification(
        'warning',
        t('settings.weatherSources.cannotDisableLast')
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
          t('settings.weatherSources.cannotModify')
      );
    }
  };

  // Save API key
  const handleSaveApiKey = async () => {
    if (!apiKeyValue.trim()) {
      showNotification(
        'warning',
        t('settings.weatherSources.enterApiKeyWarning')
      );
      return;
    }

    try {
      await updateSource.mutateAsync({
        sourceName: source.source_name,
        data: { api_key: apiKeyValue },
      });
      setIsEditingApiKey(false);
      setApiKeyValue('');
      showNotification('success', t('settings.weatherSources.apiKeySaved'));
    } catch (error: unknown) {
      showNotification(
        'error',
        (error instanceof Error ? error.message : null) ||
          t('settings.weatherSources.apiKeySaveError')
      );
    }
  };

  // Test source
  const handleTest = async () => {
    if (!testLocation) return;

    setIsTesting(true);
    setTestResult(null);

    try {
      const result = await testSource.mutateAsync({
        sourceName: source.source_name,
        lat: testLocation.latitude,
        lon: testLocation.longitude,
      });

      if (result.success) {
        setTestResult({
          success: true,
          message: t('settings.weatherSources.testSuccess', {
            site: testLocation.name,
            time: result.response_time_ms,
          }),
        });
      } else {
        setTestResult({
          success: false,
          message: t('settings.weatherSources.testFailure', {
            site: testLocation.name,
            error: result.error || t('settings.weatherSources.unknownError'),
          }),
        });
      }
    } catch (error: unknown) {
      setTestResult({
        success: false,
        message: t('settings.weatherSources.testError', {
          site: testLocation.name,
          error:
            error instanceof Error
              ? error.message
              : t('settings.weatherSources.testFailed'),
        }),
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!onDelete) return;

    setIsDeleting(true);
    try {
      await onDelete(source);
      setIsConfirmingDelete(false);
    } catch {
      showNotification(
        'error',
        t('settings.weatherSources.deleteError', {
          name: source.display_name,
        })
      );
      setIsConfirmingDelete(false);
    } finally {
      setIsDeleting(false);
    }
  };

  // Format timestamp
  const formatTimestamp = (timestamp: string | null) => {
    if (!timestamp) return t('common.never');
    const date = parseApiUtcDate(timestamp);
    return new Intl.DateTimeFormat(i18n.language, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(date);
  };

  return (
    <article
      className={`bg-white dark:bg-gray-800 rounded-lg shadow-md p-5 border-2 transition-all ${
        source.is_enabled
          ? 'border-sky-200 dark:border-sky-700'
          : 'border-gray-200 dark:border-gray-700'
      }`}
      aria-label={t('settings.weatherSources.configAria', {
        name: source.display_name,
      })}
    >
      {/* Notification */}
      {notification && (
        <div
          className={`mb-3 p-3 rounded-lg text-sm font-medium ${getNotificationClassName()}`}
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
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">
              {source.display_name}
            </h3>
            <span
              className={`rounded-full px-2 py-1 text-xs font-semibold ${
                source.is_enabled
                  ? 'bg-sky-100 text-sky-900 dark:bg-sky-900/30 dark:text-sky-100'
                  : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200'
              }`}
              // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role
              role="status"
            >
              {t(
                source.is_enabled
                  ? 'settings.weatherSources.sourceEnabled'
                  : 'settings.weatherSources.sourceDisabled'
              )}
            </span>
            <span
              className={`rounded-full px-2 py-1 text-xs font-semibold ${checkStatusClasses[latestCheckStatus]}`}
              // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role
              role="status"
            >
              {checkStatusLabels[latestCheckStatus]}
            </span>
          </div>
          <Text
            slot="description"
            className="text-sm text-gray-600 dark:text-gray-300"
          >
            {source.description}
          </Text>
        </div>

        {/* Toggle Switch */}
        <Switch
          isSelected={source.is_enabled}
          onChange={handleToggleEnabled}
          isDisabled={updateSource.isPending}
          className="group ml-3"
          aria-label={
            source.is_enabled
              ? t('settings.weatherSources.disableSource', {
                  name: source.display_name,
                })
              : t('settings.weatherSources.enableSource', {
                  name: source.display_name,
                })
          }
        >
          <div className="relative inline-flex items-center cursor-pointer">
            <div className="w-11 h-6 bg-gray-300 group-focus-visible:outline-none group-focus-visible:ring-2 group-focus-visible:ring-sky-300 rounded-full group-data-[selected]:bg-sky-600 transition-colors">
              <div className="absolute top-[2px] left-[2px] bg-white border-gray-300 border rounded-full h-5 w-5 transition-transform group-data-[selected]:translate-x-full"></div>
            </div>
          </div>
        </Switch>
      </div>

      {/* API Key Section */}
      {source.requires_api_key && (
        <div className="mb-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded border border-blue-200 dark:border-blue-700">
          <div className="flex items-center justify-between mb-2">
            <span
              className="text-sm font-medium text-gray-700 dark:text-gray-300"
              aria-hidden="true"
            >
              {t('settings.weatherSources.apiKey')}
            </span>
            {source.api_key_configured ? (
              <span
                className="text-xs text-green-600 dark:text-green-400 font-semibold"
                // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role
                role="status"
                aria-label={t('settings.weatherSources.apiKeyConfigured')}
              >
                {t('settings.weatherSources.apiKeyConfigured')}
              </span>
            ) : (
              <span
                className="text-xs text-red-600 dark:text-red-400 font-semibold"
                // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role
                role="status"
                aria-label={t('settings.weatherSources.apiKeyMissing')}
              >
                {t('settings.weatherSources.apiKeyMissing')}
              </span>
            )}
          </div>

          {isEditingApiKey ? (
            <div className="flex flex-col sm:flex-row gap-2">
              <TextField
                value={apiKeyValue}
                onChange={setApiKeyValue}
                type={showApiKey ? 'text' : 'password'}
                aria-label={t('settings.weatherSources.apiKey')}
                className="flex-1"
              >
                <Input
                  placeholder={t('settings.weatherSources.enterApiKey')}
                  className="w-full px-2 py-1 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-sky-300"
                />
              </TextField>
              <Button
                onPress={() => setShowApiKey(!showApiKey)}
                className="px-2 py-1 text-xs bg-gray-200 dark:bg-gray-600 rounded hover:bg-gray-300 dark:hover:bg-gray-500 pressed:bg-gray-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
                aria-label={
                  showApiKey
                    ? t('settings.weatherSources.hideApiKey')
                    : t('settings.weatherSources.showApiKey')
                }
              >
                {showApiKey
                  ? t('settings.weatherSources.hideApiKey')
                  : t('settings.weatherSources.showApiKey')}
              </Button>
              <Button
                onPress={handleSaveApiKey}
                isDisabled={updateSource.isPending}
                className="px-3 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 pressed:bg-green-800 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
                aria-label={t('common.save')}
              >
                {t('common.save')}
              </Button>
              <Button
                onPress={() => {
                  setIsEditingApiKey(false);
                  setApiKeyValue('');
                }}
                className="px-3 py-1 text-xs bg-gray-400 text-white rounded hover:bg-gray-500 pressed:bg-gray-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
                aria-label={t('common.cancel')}
              >
                {t('common.cancel')}
              </Button>
            </div>
          ) : (
            <Button
              onPress={() => setIsEditingApiKey(true)}
              className="w-full px-3 py-1 text-sm bg-white dark:bg-gray-700 border dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-600 pressed:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
            >
              {source.api_key_configured
                ? t('settings.weatherSources.modifyApiKey')
                : t('settings.weatherSources.configureApiKey')}
            </Button>
          )}

          {source.documentation_url && (
            <Link
              href={source.documentation_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-blue-600 dark:text-blue-400 hover:underline dark:hover:text-blue-300 mt-1 inline-block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 rounded"
            >
              {t('settings.weatherSources.documentation')}
            </Link>
          )}
        </div>
      )}

      <details className="mb-3 rounded-md border border-gray-200 px-3 py-2 dark:border-gray-700">
        <summary className="cursor-pointer text-sm font-medium text-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 dark:text-gray-200">
          {t('settings.weatherSources.diagnostics')}
        </summary>
        <div
          className="mt-3 space-y-3 text-sm"
          // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role
          role="group"
          aria-label={t('settings.weatherSources.performanceStatsAria')}
        >
          <p className="text-xs leading-5 text-gray-600 dark:text-gray-300">
            {t('settings.weatherSources.diagnosticsHelp')}
          </p>
          <dl className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <div className="rounded bg-gray-50 p-2 dark:bg-gray-900">
              <dt className="text-xs text-gray-600 dark:text-gray-300">
                {t('settings.weatherSources.recordedSuccessRate')}
              </dt>
              <dd className="mt-1 font-semibold text-gray-900 dark:text-white">
                {source.success_rate.toFixed(0)}%
              </dd>
            </div>
            <div className="rounded bg-gray-50 p-2 dark:bg-gray-900">
              <dt className="text-xs text-gray-600 dark:text-gray-300">
                {t('settings.weatherSources.avgSuccessfulResponseTime')}
              </dt>
              <dd className="mt-1 font-semibold text-gray-900 dark:text-white">
                {typeof source.avg_response_time_ms === 'number'
                  ? `${source.avg_response_time_ms} ms`
                  : '–'}
              </dd>
            </div>
            <div className="rounded bg-gray-50 p-2 dark:bg-gray-900">
              <dt className="text-xs text-gray-600 dark:text-gray-300">
                {t('settings.weatherSources.recordedRequests')}
              </dt>
              <dd className="mt-1 font-semibold text-gray-900 dark:text-white">
                {source.success_count + source.error_count}
              </dd>
            </div>
          </dl>
        </div>
      </details>

      {/* Last activity */}
      <div
        className="text-xs text-gray-600 dark:text-gray-300 mb-3"
        // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role
        role="region"
        aria-label={t('settings.weatherSources.activityHistoryAria')}
      >
        {source.last_success_at && (
          <div
            // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role
            role="status"
          >
            <Trans
              i18nKey="settings.weatherSources.lastSuccessMessage"
              values={{ date: formatTimestamp(source.last_success_at) }}
            />
          </div>
        )}
        {source.last_error_at && (
          <div className="text-red-600 dark:text-red-400" role="alert">
            <Trans
              i18nKey="settings.weatherSources.lastErrorMessage"
              values={{ date: formatTimestamp(source.last_error_at) }}
            />
            {source.last_error_message && (
              <div
                className="text-xs mt-1 p-1 bg-red-50 dark:bg-red-900/20 rounded truncate"
                title={source.last_error_message}
                // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role
                role="status"
                aria-label={t('settings.weatherSources.errorMessageAria', {
                  message: source.last_error_message,
                })}
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
              ? 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200'
              : 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200'
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
        className="flex flex-col sm:flex-row gap-2"
        // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role
        role="group"
        aria-label={t('settings.weatherSources.actionsAria')}
      >
        <Button
          onPress={handleTest}
          isDisabled={isTesting || !source.is_enabled || !testLocation}
          className="flex-1 px-3 py-2 text-sm font-medium bg-blue-600 text-white rounded hover:bg-blue-700 pressed:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
          aria-label={t('settings.weatherSources.testSourceAria', {
            name: source.display_name,
          })}
        >
          <span>
            {isTesting
              ? t('settings.weatherSources.testing')
              : t('settings.weatherSources.test')}
          </span>
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
              onPress={() => setIsConfirmingDelete(true)}
              className="px-3 py-2 text-sm font-medium bg-red-600 text-white rounded hover:bg-red-700 pressed:bg-red-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
              aria-label={t('settings.weatherSources.deleteSourceAria', {
                name: source.display_name,
              })}
            >
              {t('common.delete')}
            </Button>
          )}
      </div>

      {isConfirmingDelete && (
        <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-800 dark:bg-red-950/30">
          <p className="text-sm text-red-900 dark:text-red-100">
            {t('settings.weatherSources.deleteConfirmInline', {
              name: source.display_name,
            })}
          </p>
          <div className="mt-3 flex flex-wrap justify-end gap-2">
            <Button
              onPress={() => setIsConfirmingDelete(false)}
              isDisabled={isDeleting}
              className="rounded px-3 py-2 text-sm font-medium text-gray-700 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 disabled:opacity-50 dark:text-gray-200 dark:hover:bg-gray-800"
            >
              {t('common.cancel')}
            </Button>
            <Button
              onPress={handleConfirmDelete}
              isDisabled={isDeleting}
              className="rounded bg-red-700 px-3 py-2 text-sm font-semibold text-white hover:bg-red-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 disabled:opacity-50"
            >
              {isDeleting
                ? t('settings.weatherSources.deletePending')
                : t('settings.weatherSources.confirmDelete')}
            </Button>
          </div>
        </div>
      )}
    </article>
  );
};
