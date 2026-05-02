import { Suspense, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useSuspenseQuery } from '@tanstack/react-query';
import { Switch, Tab, TabList, TabPanel, Tabs } from 'react-aria-components';
import { Button } from '@dashboard-parapente/design-system';
import { sitesQueryOptions } from '../hooks/sites/useSites';
import {
  useWeatherSources,
  useWeatherSourceStats,
  useDeleteWeatherSource,
} from '../hooks/weather/useWeatherSources';
import { WeatherSourceCard } from '../components/settings/WeatherSourceCard';
import ScopeBadge from '../components/common/ScopeBadge';
import type { WeatherSource } from '../types/weatherSources';
import { useThemeStore } from '../stores/themeStore';
import type { ThemePreference } from '../stores/themeStore';
import { useCacheSettingsStore } from '../stores/cacheSettingsStore';
import type { FreshnessLevel, HttpTimeout } from '../stores/cacheSettingsStore';
import {
  useAppSettings,
  useUpdateAppSettings,
  type AppSettings as BackendAppSettings,
} from '../hooks/settings/useAppSettings';

// Site interface as returned by API
interface ApiSite {
  id: string;
  name: string;
  latitude?: number;
  longitude?: number;
  elevation_m?: number;
  description?: string;
  orientation?: string;
  difficulty_level?: string;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
}

// Default settings structure
interface AppSettings {
  units: {
    distance: 'km' | 'miles';
    altitude: 'm' | 'ft';
    speed: 'kmh' | 'mph';
  };
  language: 'fr' | 'en';
  theme: 'light' | 'dark' | 'auto';
  notifications: {
    weather: boolean;
    flights: boolean;
    alerts: boolean;
  };
  favoriteSites: string[];
}

type SettingsTabKey = 'general' | 'sites' | 'weather' | 'data';

const DEFAULT_SETTINGS: AppSettings = {
  units: {
    distance: 'km',
    altitude: 'm',
    speed: 'kmh',
  },
  language: 'fr',
  theme: 'light',
  notifications: {
    weather: true,
    flights: true,
    alerts: true,
  },
  favoriteSites: [],
};

// Sites Favorites Tab Component
function SitesTab({
  settings,
  toggleFavorite,
}: {
  settings: AppSettings;
  toggleFavorite: (siteId: string) => void;
}) {
  const { t } = useTranslation();
  const { data: sites } = useSuspenseQuery(sitesQueryOptions());

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-md">
      <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
        📍 {t('settings.favorites.title')}
      </h2>
      {sites.length === 0 ? (
        <p className="text-gray-600 dark:text-gray-300 text-center py-8">
          {t('settings.favorites.noSites')}
        </p>
      ) : (
        <div className="space-y-3">
          {(sites as unknown as ApiSite[]).map((site: ApiSite) => (
            <div
              key={site.id}
              className={`flex items-center justify-between p-4 rounded-lg border-2 transition-all ${
                settings.favoriteSites.includes(site.id)
                  ? 'border-sky-600 bg-sky-50 dark:bg-sky-900/20'
                  : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 hover:border-gray-300 dark:hover:border-gray-600'
              }`}
            >
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900 dark:text-white">
                  {site.name}
                </h3>
                {site.latitude && site.longitude && site.elevation_m && (
                  <div className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                    📍 {site.latitude.toFixed(4)}, {site.longitude.toFixed(4)} •
                    ⛰️ {site.elevation_m}m
                  </div>
                )}
                {site.description && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {site.description}
                  </p>
                )}
              </div>
              <Button
                onClick={() => toggleFavorite(site.id)}
                className={`ml-4 px-4 py-2 rounded-lg font-medium transition-all ${
                  settings.favoriteSites.includes(site.id)
                    ? 'bg-sky-600 text-white hover:bg-sky-700'
                    : 'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                }`}
              >
                {settings.favoriteSites.includes(site.id)
                  ? '⭐ ' + t('settings.favorites.favorite')
                  : '☆ ' + t('settings.favorites.add')}
              </Button>
            </div>
          ))}
        </div>
      )}
      <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-sm text-blue-800 dark:text-blue-200">
        💡 <strong>{t('settings.favorites.tip')}</strong>{' '}
        {t('settings.favorites.tipText')}
      </div>
    </div>
  );
}

// Weather Sources Tab Component
function WeatherSourcesTab() {
  const { t } = useTranslation();
  const { data: sources = [], isLoading, error } = useWeatherSources();
  const { data: stats } = useWeatherSourceStats();
  const deleteSource = useDeleteWeatherSource();

  const handleDelete = async (source: WeatherSource) => {
    if (
      !confirm(
        t('settings.weatherSources.deleteConfirm', {
          name: source.display_name,
        })
      )
    ) {
      return;
    }

    try {
      await deleteSource.mutateAsync(source.source_name);
      alert(
        t('settings.weatherSources.deleteSuccess', {
          name: source.display_name,
        })
      );
    } catch (error: unknown) {
      const errorMessage =
        (error as Error)?.message || t('settings.weatherSources.deleteError');
      alert(errorMessage);
    }
  };

  // Count active sources
  const activeSources = sources.filter((s) => s.is_enabled);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg p-4 text-red-800 dark:text-red-200">
        ❌ {t('settings.weatherSources.loadError')}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with stats */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-md">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
          🌦️ {t('settings.weatherSources.title')}
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
          {t('settings.weatherSources.description')}
        </p>

        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <div className="text-xs text-blue-600 dark:text-blue-400 font-semibold mb-1">
                {t('settings.weatherSources.activeSources')}
              </div>
              <div className="text-2xl font-bold text-blue-900 dark:text-blue-100">
                {stats.active_sources}/{stats.total_sources}
              </div>
            </div>
            <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <div className="text-xs text-green-600 dark:text-green-400 font-semibold mb-1">
                {t('settings.weatherSources.globalSuccessRate')}
              </div>
              <div className="text-2xl font-bold text-green-900 dark:text-green-100">
                {stats.global_success_rate.toFixed(0)}%
              </div>
            </div>
            <div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
              <div className="text-xs text-purple-600 dark:text-purple-400 font-semibold mb-1">
                {t('settings.weatherSources.avgTime')}
              </div>
              <div className="text-2xl font-bold text-purple-900 dark:text-purple-100">
                {stats.global_avg_response_time_ms
                  ? `${stats.global_avg_response_time_ms}ms`
                  : '-'}
              </div>
            </div>
            <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
              <div className="text-xs text-red-600 dark:text-red-400 font-semibold mb-1">
                {t('settings.weatherSources.sourcesWithErrors')}
              </div>
              <div className="text-2xl font-bold text-red-900 dark:text-red-100">
                {stats.sources_with_errors}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Sources Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {sources.map((source) => (
          <WeatherSourceCard
            key={source.id}
            source={source}
            isLastActive={activeSources.length === 1 && source.is_enabled}
            onDelete={handleDelete}
          />
        ))}
      </div>

      {sources.length === 0 && (
        <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-8 text-center text-gray-600 dark:text-gray-300">
          {t('settings.weatherSources.noSources')}
        </div>
      )}

      {/* Info Box */}
      <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg p-4">
        <h3 className="font-semibold text-yellow-900 dark:text-yellow-100 mb-2">
          ℹ️ {t('settings.weatherSources.aboutTitle')}
        </h3>
        <ul className="text-sm text-yellow-800 dark:text-yellow-200 space-y-1">
          <li>
            • <strong>Open-Meteo</strong>:{' '}
            {t('settings.weatherSources.openMeteoDesc')}
          </li>
          <li>
            • <strong>WeatherAPI</strong>:{' '}
            {t('settings.weatherSources.weatherApiDesc')}
          </li>
          <li>
            • <strong>Météo Parapente</strong>:{' '}
            {t('settings.weatherSources.meteoParaglideDesc')}
          </li>
          <li>
            • <strong>Météociel</strong>:{' '}
            {t('settings.weatherSources.meteocielDesc')}
          </li>
          <li>
            • <strong>Meteoblue</strong>:{' '}
            {t('settings.weatherSources.meteoblueDesc')}
          </li>
        </ul>
      </div>
    </div>
  );
}

// Performance Settings Section Component
function PerformanceSection() {
  const { t } = useTranslation();
  const {
    freshnessLevel,
    autoRefreshWeather,
    httpTimeout,
    setFreshnessLevel,
    setAutoRefreshWeather,
    setHttpTimeout,
  } = useCacheSettingsStore();
  const { data: backendSettings } = useAppSettings();
  const updateBackend = useUpdateAppSettings();

  const handleBackendSetting = (
    key: keyof BackendAppSettings,
    value: string
  ) => {
    updateBackend.mutate({ [key]: value });
  };

  const currentCacheTtl = backendSettings?.cache_ttl_default ?? '3600';
  const currentSpotairRadius =
    backendSettings?.spotair_live_wind_radius_km ?? '10';
  const currentSpotairCacheTtl =
    backendSettings?.spotair_live_wind_cache_ttl_seconds ?? '300';
  const currentSchedulerInterval =
    backendSettings?.scheduler_interval_minutes ?? '30';
  const currentVideoExportDir =
    backendSettings?.video_export_dir ?? '/app/video-exports';
  const currentVideoTempImagesDir =
    backendSettings?.video_temp_images_dir ?? '/app/video-temp-images';
  const thresholdSections = [
    {
      title: t('settings.thresholds.wind.title'),
      scope: 'backendFrontend',
      help: t('settings.thresholds.wind.help'),
      fields: [
        {
          key: 'para_wind_very_low_max',
          label: t(
            'settings.thresholds.wind.fields.para_wind_very_low_max.label'
          ),
          defaultValue: '3',
          step: '1',
        },
        {
          key: 'para_wind_low_max',
          label: t('settings.thresholds.wind.fields.para_wind_low_max.label'),
          defaultValue: '5',
          step: '1',
        },
        {
          key: 'para_wind_weak_max',
          label: t('settings.thresholds.wind.fields.para_wind_weak_max.label'),
          defaultValue: '8',
          step: '1',
        },
        {
          key: 'para_wind_optimal_max',
          label: t(
            'settings.thresholds.wind.fields.para_wind_optimal_max.label'
          ),
          defaultValue: '15',
          step: '1',
        },
        {
          key: 'para_wind_high_max',
          label: t('settings.thresholds.wind.fields.para_wind_high_max.label'),
          defaultValue: '20',
          step: '1',
        },
      ],
    },
    {
      title: t('settings.thresholds.gust.title'),
      scope: 'backendFrontend',
      help: t('settings.thresholds.gust.help'),
      fields: [
        {
          key: 'para_gust_low_max',
          label: t('settings.thresholds.gust.fields.para_gust_low_max.label'),
          defaultValue: '15',
          step: '1',
        },
        {
          key: 'para_gust_moderate_max',
          label: t(
            'settings.thresholds.gust.fields.para_gust_moderate_max.label'
          ),
          defaultValue: '20',
          step: '1',
        },
        {
          key: 'para_gust_high_max',
          label: t('settings.thresholds.gust.fields.para_gust_high_max.label'),
          defaultValue: '25',
          step: '1',
        },
      ],
    },
    {
      title: t('settings.thresholds.precipitation.title'),
      scope: 'backendFrontend',
      help: t('settings.thresholds.precipitation.help'),
      fields: [
        {
          key: 'para_precip_none_max',
          label: t(
            'settings.thresholds.precipitation.fields.para_precip_none_max.label'
          ),
          defaultValue: '0',
          step: '0.1',
        },
        {
          key: 'para_precip_light_max',
          label: t(
            'settings.thresholds.precipitation.fields.para_precip_light_max.label'
          ),
          defaultValue: '1',
          step: '0.1',
        },
        {
          key: 'para_precip_heavy_min',
          label: t(
            'settings.thresholds.precipitation.fields.para_precip_heavy_min.label'
          ),
          defaultValue: '2',
          step: '0.1',
        },
        {
          key: 'para_slot_precipitation_max',
          label: t(
            'settings.thresholds.precipitation.fields.para_slot_precipitation_max.label'
          ),
          defaultValue: '0.5',
          step: '0.1',
        },
      ],
    },
    {
      title: t('settings.thresholds.instability.title'),
      scope: 'backendFrontend',
      help: t('settings.thresholds.instability.help'),
      fields: [
        {
          key: 'para_li_stable_min',
          label: t(
            'settings.thresholds.instability.fields.para_li_stable_min.label'
          ),
          defaultValue: '-1',
          step: '0.1',
        },
        {
          key: 'para_li_slightly_unstable_min',
          label: t(
            'settings.thresholds.instability.fields.para_li_slightly_unstable_min.label'
          ),
          defaultValue: '-3',
          step: '0.1',
        },
        {
          key: 'para_li_very_unstable_max',
          label: t(
            'settings.thresholds.instability.fields.para_li_very_unstable_max.label'
          ),
          defaultValue: '-5',
          step: '0.1',
        },
      ],
    },
    {
      title: t('settings.thresholds.temperature.title'),
      scope: 'backendFrontend',
      help: t('settings.thresholds.temperature.help'),
      fields: [
        {
          key: 'para_temp_cool_min',
          label: t(
            'settings.thresholds.temperature.fields.para_temp_cool_min.label'
          ),
          defaultValue: '5',
          step: '1',
        },
        {
          key: 'para_temp_warm_min',
          label: t(
            'settings.thresholds.temperature.fields.para_temp_warm_min.label'
          ),
          defaultValue: '10',
          step: '1',
        },
      ],
    },
    {
      title: t('settings.thresholds.verdict.title'),
      scope: 'backendFrontend',
      help: t('settings.thresholds.verdict.help'),
      fields: [
        {
          key: 'para_verdict_good_min',
          label: t(
            'settings.thresholds.verdict.fields.para_verdict_good_min.label'
          ),
          defaultValue: '65',
          step: '1',
        },
        {
          key: 'para_verdict_medium_min',
          label: t(
            'settings.thresholds.verdict.fields.para_verdict_medium_min.label'
          ),
          defaultValue: '45',
          step: '1',
        },
        {
          key: 'para_verdict_limit_min',
          label: t(
            'settings.thresholds.verdict.fields.para_verdict_limit_min.label'
          ),
          defaultValue: '30',
          step: '1',
        },
      ],
    },
    {
      title: t('settings.thresholds.ui.title'),
      scope: 'frontendOnly',
      help: t('settings.thresholds.ui.help'),
      fields: [
        {
          key: 'ui_reason_wind_moderate_min',
          label: t(
            'settings.thresholds.ui.fields.ui_reason_wind_moderate_min.label'
          ),
          defaultValue: '25',
          step: '1',
        },
        {
          key: 'ui_reason_wind_very_strong_min',
          label: t(
            'settings.thresholds.ui.fields.ui_reason_wind_very_strong_min.label'
          ),
          defaultValue: '35',
          step: '1',
        },
        {
          key: 'ui_reason_gust_high_min',
          label: t(
            'settings.thresholds.ui.fields.ui_reason_gust_high_min.label'
          ),
          defaultValue: '45',
          step: '1',
        },
        {
          key: 'ui_reason_cloud_very_cloudy_min',
          label: t(
            'settings.thresholds.ui.fields.ui_reason_cloud_very_cloudy_min.label'
          ),
          defaultValue: '80',
          step: '1',
        },
      ],
    },
  ] as const;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-md">
      <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
        {t('settings.performance.title')}
      </h2>

      {/* Browser sub-section */}
      <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
        {t('settings.performance.browser')}
      </h3>
      <div className="space-y-4 mb-6">
        {/* Freshness Level */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {t('settings.performance.freshnessLevel')}
          </label>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
            {t('settings.performance.freshnessHelp')}
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            {(
              [
                {
                  value: 'realtime',
                  label: t('settings.performance.realtime'),
                },
                { value: 'normal', label: t('settings.performance.normal') },
                { value: 'economy', label: t('settings.performance.economy') },
              ] as const
            ).map((opt) => (
              <Button
                key={opt.value}
                onClick={() => setFreshnessLevel(opt.value as FreshnessLevel)}
                className={`px-5 py-2 rounded-lg font-medium transition-all text-sm ${
                  freshnessLevel === opt.value
                    ? 'bg-sky-600 text-white shadow-md'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                {opt.label}
              </Button>
            ))}
          </div>
        </div>

        {/* Auto-refresh weather */}
        <label className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-all cursor-pointer">
          <div>
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {t('settings.performance.autoRefresh')}
            </span>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              {t('settings.performance.autoRefreshHelp')}
            </p>
          </div>
          <input
            type="checkbox"
            checked={autoRefreshWeather}
            onChange={(e) => setAutoRefreshWeather(e.target.checked)}
            aria-label={t('settings.performance.autoRefresh')}
            className="w-5 h-5 text-sky-600 rounded focus:ring-2 focus:ring-sky-600 ml-4 shrink-0"
          />
        </label>

        {/* HTTP Timeout */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {t('settings.performance.httpTimeout')}
          </label>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
            {t('settings.performance.httpTimeoutHelp')}
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            {(
              [
                {
                  value: 15000,
                  label: '15 ' + t('settings.performance.seconds'),
                },
                {
                  value: 30000,
                  label:
                    '30 ' +
                    t('settings.performance.seconds') +
                    ' (' +
                    t('settings.performance.default') +
                    ')',
                },
                {
                  value: 60000,
                  label: '60 ' + t('settings.performance.seconds'),
                },
              ] as const
            ).map((opt) => (
              <Button
                key={opt.value}
                onClick={() => setHttpTimeout(opt.value as HttpTimeout)}
                className={`px-5 py-2 rounded-lg font-medium transition-all text-sm ${
                  httpTimeout === opt.value
                    ? 'bg-sky-600 text-white shadow-md'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                {opt.label}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* Server sub-section */}
      <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3 pt-4 border-t border-gray-200 dark:border-gray-700">
        {t('settings.performance.server')}
      </h3>
      <div className="space-y-4">
        {/* Backend Cache TTL */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {t('settings.performance.backendCache')}
          </label>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
            {t('settings.performance.backendCacheHelp')}
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            {(
              [
                {
                  value: '900',
                  label: '15 ' + t('settings.performance.minutes'),
                },
                {
                  value: '1800',
                  label: '30 ' + t('settings.performance.minutes'),
                },
                {
                  value: '3600',
                  label:
                    '60 ' +
                    t('settings.performance.minutes') +
                    ' (' +
                    t('settings.performance.default') +
                    ')',
                },
                {
                  value: '7200',
                  label: '120 ' + t('settings.performance.minutes'),
                },
              ] as const
            ).map((opt) => (
              <Button
                key={opt.value}
                onClick={() =>
                  handleBackendSetting('cache_ttl_default', opt.value)
                }
                disabled={updateBackend.isPending}
                className={`px-5 py-2 rounded-lg font-medium transition-all text-sm ${
                  currentCacheTtl === opt.value
                    ? 'bg-sky-600 text-white shadow-md'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                } disabled:opacity-50`}
              >
                {opt.label}
              </Button>
            ))}
          </div>
        </div>

        {/* SpotAiR live wind station radius */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {t('settings.performance.spotairLiveWindRadius')}
          </label>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
            {t('settings.performance.spotairLiveWindRadiusHelp')}
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            {(
              [
                {
                  value: '5',
                  label: '5 ' + t('settings.performance.kilometers'),
                },
                {
                  value: '10',
                  label:
                    '10 ' +
                    t('settings.performance.kilometers') +
                    ' (' +
                    t('settings.performance.default') +
                    ')',
                },
                {
                  value: '20',
                  label: '20 ' + t('settings.performance.kilometers'),
                },
              ] as const
            ).map((opt) => (
              <Button
                key={opt.value}
                onClick={() =>
                  handleBackendSetting('spotair_live_wind_radius_km', opt.value)
                }
                disabled={updateBackend.isPending}
                className={`px-5 py-2 rounded-lg font-medium transition-all text-sm ${
                  currentSpotairRadius === opt.value
                    ? 'bg-sky-600 text-white shadow-md'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                } disabled:opacity-50`}
              >
                {opt.label}
              </Button>
            ))}
          </div>
        </div>

        {/* SpotAiR live wind cache TTL */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {t('settings.performance.spotairLiveWindCache')}
          </label>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
            {t('settings.performance.spotairLiveWindCacheHelp')}
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            {(
              [
                {
                  value: '60',
                  label: '1 ' + t('settings.performance.minutes'),
                },
                {
                  value: '300',
                  label:
                    '5 ' +
                    t('settings.performance.minutes') +
                    ' (' +
                    t('settings.performance.default') +
                    ')',
                },
                {
                  value: '900',
                  label: '15 ' + t('settings.performance.minutes'),
                },
              ] as const
            ).map((opt) => (
              <Button
                key={opt.value}
                onClick={() =>
                  handleBackendSetting(
                    'spotair_live_wind_cache_ttl_seconds',
                    opt.value
                  )
                }
                disabled={updateBackend.isPending}
                className={`px-5 py-2 rounded-lg font-medium transition-all text-sm ${
                  currentSpotairCacheTtl === opt.value
                    ? 'bg-sky-600 text-white shadow-md'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                } disabled:opacity-50`}
              >
                {opt.label}
              </Button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {t('settings.performance.schedulerInterval')}
          </label>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
            {t('settings.performance.schedulerIntervalHelp')}
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            {(
              [
                {
                  value: '15',
                  label: '15 ' + t('settings.performance.minutes'),
                },
                {
                  value: '30',
                  label:
                    '30 ' +
                    t('settings.performance.minutes') +
                    ' (' +
                    t('settings.performance.default') +
                    ')',
                },
                {
                  value: '60',
                  label: '60 ' + t('settings.performance.minutes'),
                },
              ] as const
            ).map((opt) => (
              <Button
                key={opt.value}
                onClick={() =>
                  handleBackendSetting('scheduler_interval_minutes', opt.value)
                }
                disabled={updateBackend.isPending}
                className={`px-5 py-2 rounded-lg font-medium transition-all text-sm ${
                  currentSchedulerInterval === opt.value
                    ? 'bg-sky-600 text-white shadow-md'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                } disabled:opacity-50`}
              >
                {opt.label}
              </Button>
            ))}
          </div>
        </div>

        <div className="pt-4 border-t border-gray-200 dark:border-gray-700 space-y-4">
          <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-200">
            {t('settings.performance.videoStorageTitle')}
          </h4>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {t('settings.performance.videoStorageHelp')}
          </p>

          <label className="block">
            <span className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('settings.performance.videoExportDir')}
            </span>
            <input
              key={`video_export_dir-${currentVideoExportDir}`}
              type="text"
              defaultValue={currentVideoExportDir}
              placeholder="/app/video-exports"
              onBlur={(event) =>
                handleBackendSetting('video_export_dir', event.target.value)
              }
              className="w-full px-3 py-2 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm"
            />
          </label>

          <label className="block">
            <span className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('settings.performance.videoTempImagesDir')}
            </span>
            <input
              key={`video_temp_images_dir-${currentVideoTempImagesDir}`}
              type="text"
              defaultValue={currentVideoTempImagesDir}
              placeholder="/app/video-temp-images"
              onBlur={(event) =>
                handleBackendSetting('video_temp_images_dir', event.target.value)
              }
              className="w-full px-3 py-2 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm"
            />
          </label>
        </div>

        <div className="pt-4 border-t border-gray-200 dark:border-gray-700 space-y-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {t('settings.thresholds.title')}
          </label>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
            {t('settings.thresholds.description')}
          </p>
          {thresholdSections.map((section) => (
            <div
              key={section.title}
              className="rounded-lg border border-gray-200 dark:border-gray-700 p-3"
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <h4 className="text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wide">
                  {section.title}
                </h4>
                <ScopeBadge scope={section.scope} />
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                {section.help}
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {section.fields.map((item) => (
                  <label
                    key={`${item.key}-${backendSettings?.[item.key] ?? item.defaultValue}`}
                    className="flex flex-col gap-1 p-3 rounded-lg bg-gray-50 dark:bg-gray-900"
                  >
                    <span className="text-xs text-gray-600 dark:text-gray-300">
                      {item.label}
                    </span>
                    <input
                      type="number"
                      step={item.step}
                      defaultValue={
                        backendSettings?.[item.key] ?? item.defaultValue
                      }
                      onBlur={(event) =>
                        handleBackendSetting(item.key, event.target.value)
                      }
                      className="px-3 py-2 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100"
                    />
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>

        {updateBackend.isError && (
          <p className="text-sm text-red-600 dark:text-red-400">
            {t('settings.performance.serverError')}
          </p>
        )}
      </div>
    </div>
  );
}

export default function Settings() {
  const { t, i18n } = useTranslation();
  const { preference: themePreference, setPreference: setThemePreference } =
    useThemeStore();
  const [settings, setSettings] = useState<AppSettings>(() => {
    const stored = localStorage.getItem('paragliding-settings');
    if (stored) {
      try {
        return JSON.parse(stored) as AppSettings;
      } catch {
        // Invalid JSON in localStorage, keep defaults
      }
    }
    return DEFAULT_SETTINGS;
  });
  const [saved, setSaved] = useState(false);
  const [activeTab, setActiveTab] = useState<SettingsTabKey>('general');

  useEffect(() => {
    void i18n.changeLanguage(settings.language);
  }, [i18n, settings.language]);

  // Save settings to localStorage
  const saveSettings = () => {
    localStorage.setItem('paragliding-settings', JSON.stringify(settings));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  // Toggle favorite site
  const toggleFavorite = (siteId: string) => {
    setSettings((prev) => ({
      ...prev,
      favoriteSites: prev.favoriteSites.includes(siteId)
        ? prev.favoriteSites.filter((id) => id !== siteId)
        : [...prev.favoriteSites, siteId],
    }));
  };

  // Export data
  const exportData = () => {
    const cacheSettings = useCacheSettingsStore.getState();
    const data = {
      settings,
      cacheSettings: {
        freshnessLevel: cacheSettings.freshnessLevel,
        autoRefreshWeather: cacheSettings.autoRefreshWeather,
        httpTimeout: cacheSettings.httpTimeout,
      },
      exportDate: new Date().toISOString(),
      version: '1.1',
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `paragliding-settings-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Import data
  const importData = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const imported = JSON.parse(e.target?.result as string);
        if (imported.settings) {
          setSettings(imported.settings);
          saveSettings();
        }
        if (imported.cacheSettings) {
          const { setFreshnessLevel, setAutoRefreshWeather, setHttpTimeout } =
            useCacheSettingsStore.getState();
          const allowedFreshness: readonly FreshnessLevel[] = [
            'realtime',
            'normal',
            'economy',
          ];
          const allowedTimeouts: readonly HttpTimeout[] = [15000, 30000, 60000];

          if (
            allowedFreshness.includes(
              imported.cacheSettings.freshnessLevel as FreshnessLevel
            )
          ) {
            setFreshnessLevel(
              imported.cacheSettings.freshnessLevel as FreshnessLevel
            );
          }
          if (imported.cacheSettings.autoRefreshWeather !== undefined)
            setAutoRefreshWeather(imported.cacheSettings.autoRefreshWeather);
          if (
            allowedTimeouts.includes(
              imported.cacheSettings.httpTimeout as HttpTimeout
            )
          ) {
            setHttpTimeout(imported.cacheSettings.httpTimeout as HttpTimeout);
          }
        }
        alert(t('settings.data.importSuccess'));
      } catch {
        alert(t('settings.data.importError'));
      }
    };
    reader.readAsText(file);
  };

  // Clear all data
  const clearData = () => {
    if (window.confirm(t('settings.data.resetConfirm'))) {
      setSettings(DEFAULT_SETTINGS);
      localStorage.removeItem('paragliding-settings');
      // Reset cache settings to defaults
      const { setFreshnessLevel, setAutoRefreshWeather, setHttpTimeout } =
        useCacheSettingsStore.getState();
      setFreshnessLevel('normal');
      setAutoRefreshWeather(true);
      setHttpTimeout(30000);
      alert(t('settings.data.resetSuccess'));
    }
  };

  return (
    <div>
      <div className="mb-4 bg-white dark:bg-gray-800 rounded-xl p-4 shadow-md">
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">
          ⚙️ {t('settings.title')}
        </h1>
        <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
          {t('settings.subtitle')}
        </p>
      </div>

      <Tabs
        selectedKey={activeTab}
        onSelectionChange={(key) => setActiveTab(key as SettingsTabKey)}
        className="space-y-4"
      >
        {/* Tabs Navigation */}
        <TabList className="bg-white dark:bg-gray-800 rounded-xl shadow-md mb-4 p-2 grid grid-cols-2 gap-2 sm:flex">
          {(['general', 'sites', 'weather', 'data'] as const).map((tabKey) => (
            <Tab
              key={tabKey}
              id={tabKey}
              className="flex-1 px-4 py-2 rounded-lg font-medium transition-all cursor-pointer bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 selected:bg-sky-600 selected:text-white selected:shadow-md outline-none"
            >
              {tabKey === 'general' && `🎛️ ${t('settings.tabs.general')}`}
              {tabKey === 'sites' && `📍 ${t('settings.tabs.favoriteSites')}`}
              {tabKey === 'weather' &&
                `🌦️ ${t('settings.tabs.weatherSources')}`}
              {tabKey === 'data' && `💾 ${t('settings.tabs.data')}`}
            </Tab>
          ))}
        </TabList>

        {/* Content */}
        <div className="space-y-4">
          {/* GENERAL TAB */}
          <TabPanel id="general" className="space-y-4 outline-none">
            {/* Units Section */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-md">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
                📏 {t('settings.units.title')}
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('settings.units.distance')}
                  </label>
                  <div className="flex flex-wrap gap-2 sm:gap-4">
                    <Button
                      onClick={() =>
                        setSettings((prev) => ({
                          ...prev,
                          units: { ...prev.units, distance: 'km' },
                        }))
                      }
                      className={`px-6 py-2 rounded-lg font-medium transition-all ${
                        settings.units.distance === 'km'
                          ? 'bg-sky-600 text-white shadow-md'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                      }`}
                    >
                      {t('settings.units.kilometers')}
                    </Button>
                    <Button
                      onClick={() =>
                        setSettings((prev) => ({
                          ...prev,
                          units: { ...prev.units, distance: 'miles' },
                        }))
                      }
                      className={`px-6 py-2 rounded-lg font-medium transition-all ${
                        settings.units.distance === 'miles'
                          ? 'bg-sky-600 text-white shadow-md'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                      }`}
                    >
                      {t('settings.units.miles')}
                    </Button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('settings.units.altitude')}
                  </label>
                  <div className="flex flex-wrap gap-2 sm:gap-4">
                    <Button
                      onClick={() =>
                        setSettings((prev) => ({
                          ...prev,
                          units: { ...prev.units, altitude: 'm' },
                        }))
                      }
                      className={`px-6 py-2 rounded-lg font-medium transition-all ${
                        settings.units.altitude === 'm'
                          ? 'bg-sky-600 text-white shadow-md'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                      }`}
                    >
                      {t('settings.units.meters')}
                    </Button>
                    <Button
                      onClick={() =>
                        setSettings((prev) => ({
                          ...prev,
                          units: { ...prev.units, altitude: 'ft' },
                        }))
                      }
                      className={`px-6 py-2 rounded-lg font-medium transition-all ${
                        settings.units.altitude === 'ft'
                          ? 'bg-sky-600 text-white shadow-md'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                      }`}
                    >
                      {t('settings.units.feet')}
                    </Button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('settings.units.speed')}
                  </label>
                  <div className="flex flex-wrap gap-2 sm:gap-4">
                    <Button
                      onClick={() =>
                        setSettings((prev) => ({
                          ...prev,
                          units: { ...prev.units, speed: 'kmh' },
                        }))
                      }
                      className={`px-6 py-2 rounded-lg font-medium transition-all ${
                        settings.units.speed === 'kmh'
                          ? 'bg-sky-600 text-white shadow-md'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                      }`}
                    >
                      km/h
                    </Button>
                    <Button
                      onClick={() =>
                        setSettings((prev) => ({
                          ...prev,
                          units: { ...prev.units, speed: 'mph' },
                        }))
                      }
                      className={`px-6 py-2 rounded-lg font-medium transition-all ${
                        settings.units.speed === 'mph'
                          ? 'bg-sky-600 text-white shadow-md'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                      }`}
                    >
                      mph
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            {/* Language & Theme Section */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-md">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
                🌐 {t('settings.languageTheme.title')}
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('settings.languageTheme.language')}
                  </label>
                  <div className="flex flex-wrap gap-2 sm:gap-4">
                    <Button
                      onClick={() => {
                        setSettings((prev) => ({ ...prev, language: 'fr' }));
                      }}
                      className={`px-6 py-2 rounded-lg font-medium transition-all ${
                        settings.language === 'fr'
                          ? 'bg-sky-600 text-white shadow-md'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                      }`}
                    >
                      🇫🇷 Français
                    </Button>
                    <Button
                      onClick={() => {
                        setSettings((prev) => ({ ...prev, language: 'en' }));
                      }}
                      className={`px-6 py-2 rounded-lg font-medium transition-all ${
                        settings.language === 'en'
                          ? 'bg-sky-600 text-white shadow-md'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                      }`}
                    >
                      🇬🇧 English
                    </Button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('settings.languageTheme.theme')}
                  </label>
                  <div className="flex flex-wrap gap-2 sm:gap-4">
                    {(['light', 'dark', 'auto'] as const).map((theme) => (
                      <Button
                        key={theme}
                        onClick={() => {
                          setThemePreference(theme as ThemePreference);
                          setSettings((prev) => ({ ...prev, theme }));
                        }}
                        className={`px-6 py-2 rounded-lg font-medium transition-all ${
                          themePreference === theme
                            ? 'bg-sky-600 text-white shadow-md'
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                        }`}
                      >
                        {theme === 'light' && '☀️ '}
                        {theme === 'dark' && '🌙 '}
                        {theme === 'auto' && '🔄 '}
                        {t(`settings.languageTheme.${theme}`)}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Notifications Section */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-md">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
                🔔 {t('settings.notifications.title')}
              </h2>
              <div className="space-y-3">
                <label className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-all cursor-pointer">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    {t('settings.notifications.weatherAlerts')}
                  </span>
                  <Switch
                    isSelected={settings.notifications.weather}
                    onChange={(isSelected) =>
                      setSettings((prev) => ({
                        ...prev,
                        notifications: {
                          ...prev.notifications,
                          weather: isSelected,
                        },
                      }))
                    }
                    className="group"
                  >
                    <div className="relative inline-flex items-center cursor-pointer">
                      <div className="w-11 h-6 bg-gray-300 group-focus-visible:outline-none group-focus-visible:ring-2 group-focus-visible:ring-sky-300 rounded-full group-selected:bg-sky-600 transition-colors">
                        <div className="absolute top-[2px] left-[2px] bg-white border-gray-300 border rounded-full h-5 w-5 transition-transform group-selected:translate-x-full"></div>
                      </div>
                    </div>
                  </Switch>
                </label>
                <label className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-all cursor-pointer">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    {t('settings.notifications.newFlights')}
                  </span>
                  <Switch
                    isSelected={settings.notifications.flights}
                    onChange={(isSelected) =>
                      setSettings((prev) => ({
                        ...prev,
                        notifications: {
                          ...prev.notifications,
                          flights: isSelected,
                        },
                      }))
                    }
                    className="group"
                  >
                    <div className="relative inline-flex items-center cursor-pointer">
                      <div className="w-11 h-6 bg-gray-300 group-focus-visible:outline-none group-focus-visible:ring-2 group-focus-visible:ring-sky-300 rounded-full group-selected:bg-sky-600 transition-colors">
                        <div className="absolute top-[2px] left-[2px] bg-white border-gray-300 border rounded-full h-5 w-5 transition-transform group-selected:translate-x-full"></div>
                      </div>
                    </div>
                  </Switch>
                </label>
                <label className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-all cursor-pointer">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    {t('settings.notifications.customAlerts')}
                  </span>
                  <Switch
                    isSelected={settings.notifications.alerts}
                    onChange={(isSelected) =>
                      setSettings((prev) => ({
                        ...prev,
                        notifications: {
                          ...prev.notifications,
                          alerts: isSelected,
                        },
                      }))
                    }
                    className="group"
                  >
                    <div className="relative inline-flex items-center cursor-pointer">
                      <div className="w-11 h-6 bg-gray-300 group-focus-visible:outline-none group-focus-visible:ring-2 group-focus-visible:ring-sky-300 rounded-full group-selected:bg-sky-600 transition-colors">
                        <div className="absolute top-[2px] left-[2px] bg-white border-gray-300 border rounded-full h-5 w-5 transition-transform group-selected:translate-x-full"></div>
                      </div>
                    </div>
                  </Switch>
                </label>
              </div>
            </div>

            {/* Performance Section */}
            <PerformanceSection />
          </TabPanel>

          {/* SITES TAB */}
          <TabPanel id="sites" className="outline-none">
            <Suspense
              fallback={
                <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-md animate-pulse space-y-3">
                  {[...Array(4)].map((_, i) => (
                    <div
                      key={i}
                      className="h-16 bg-gray-200 dark:bg-gray-600 rounded-lg"
                    ></div>
                  ))}
                </div>
              }
            >
              <SitesTab settings={settings} toggleFavorite={toggleFavorite} />
            </Suspense>
          </TabPanel>

          {/* WEATHER SOURCES TAB */}
          <TabPanel id="weather" className="outline-none">
            <WeatherSourcesTab />
          </TabPanel>

          {/* DATA TAB */}
          <TabPanel id="data" className="outline-none">
            <div className="space-y-4">
              {/* Export/Import Section */}
              <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-md">
                <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
                  💾 {t('settings.data.backupTitle')}
                </h2>
                <div className="space-y-3">
                  <Button
                    onClick={exportData}
                    className="w-full px-6 py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition-all flex items-center justify-center gap-2"
                  >
                    <span>📥</span>
                    {t('settings.data.export')}
                  </Button>
                  <label className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-all flex items-center justify-center gap-2 cursor-pointer">
                    <span>📤</span>
                    {t('settings.data.import')}
                    <input
                      type="file"
                      accept=".json"
                      onChange={importData}
                      className="hidden"
                    />
                  </label>
                </div>
                <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg text-sm text-yellow-800 dark:text-yellow-200">
                  ⚠️ {t('settings.data.importWarning')}
                </div>
              </div>

              {/* Clear Data Section */}
              <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-md">
                <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
                  🗑️ {t('settings.data.resetTitle')}
                </h2>
                <Button
                  onClick={clearData}
                  className="w-full px-6 py-3 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition-all"
                >
                  {t('settings.data.resetAll')}
                </Button>
                <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg text-sm text-red-800 dark:text-red-200">
                  ⚠️ {t('settings.data.resetWarning')}
                </div>
              </div>

              {/* User Profile Placeholder */}
              <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-md">
                <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
                  👤 {t('settings.profile.title')}
                </h2>
                <div className="p-8 bg-gray-50 dark:bg-gray-900 rounded-lg text-center">
                  <p className="text-gray-600 dark:text-gray-300 mb-2">
                    🚧 {t('settings.profile.wip')}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {t('settings.profile.wipDetails')}
                  </p>
                </div>
              </div>
            </div>
          </TabPanel>
        </div>
      </Tabs>

      {/* Save Button */}
      <div className="mt-6 sticky bottom-4 z-10">
        <Button
          onClick={saveSettings}
          className={`w-full px-6 py-4 rounded-xl font-bold text-lg shadow-lg transition-all ${
            saved
              ? 'bg-green-600 text-white'
              : 'bg-sky-600 text-white hover:bg-sky-700 hover:shadow-xl'
          }`}
        >
          {saved
            ? '✅ ' + t('settings.saved')
            : '💾 ' + t('settings.saveButton')}
        </Button>
      </div>
    </div>
  );
}
