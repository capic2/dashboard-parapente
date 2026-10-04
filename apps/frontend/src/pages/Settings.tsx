import {
  Suspense,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from '@tanstack/react-router';
import { useQuery, useSuspenseQuery } from '@tanstack/react-query';
import { Input, Label, TextField } from 'react-aria-components';
import { Search } from 'lucide-react';
import {
  Button,
  Tab,
  TabList,
  TabPanel,
  Tabs,
} from '@dashboard-parapente/design-system';
import { sitesQueryOptions } from '../hooks/sites/useSites';
import {
  useWeatherSources,
  useDeleteWeatherSource,
} from '../hooks/weather/useWeatherSources';
import {
  WeatherSourceCard,
  type WeatherTestLocation,
} from '../components/settings/WeatherSourceCard';
import { SportstrackliveSettingsCard } from '../components/settings/SportstrackliveSettingsCard';
import type { WeatherSource } from '../types/weatherSources';
import {
  DEFAULT_APP_SETTINGS,
  useAppSettingsStore,
  type AppSettings,
} from '../stores/appSettingsStore';
import { useThemeStore } from '../stores/themeStore';
import type { ThemePreference } from '../stores/themeStore';
import { useCacheSettingsStore } from '../stores/cacheSettingsStore';
import type { FreshnessLevel, HttpTimeout } from '../stores/cacheSettingsStore';
import {
  useAppSettings,
  useUpdateAppSettings,
  type AppSettings as BackendAppSettings,
} from '../hooks/settings/useAppSettings';
import { getSiteDisplayName } from '../lib/siteDisplay';
import { Route, settingsTabs, type SettingsTabKey } from '../routes/settings';

// Site interface as returned by API
interface ApiSite {
  id: string;
  name: string;
  region?: string | null;
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

function normalizeSiteSearch(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/gu, '')
    .toLowerCase()
    .trim();
}

type SettingsIconName =
  | 'bell'
  | 'check'
  | 'database'
  | 'globe'
  | 'mapPin'
  | 'ruler'
  | 'settings'
  | 'sliders'
  | 'upload'
  | 'weather';

function SettingsIcon({ name }: { name: SettingsIconName }) {
  const paths: Record<SettingsIconName, React.ReactNode> = {
    bell: (
      <path d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 0 0-5-5.9V4a1 1 0 1 0-2 0v1.1A6 6 0 0 0 6 11v3.2c0 .5-.2 1-.6 1.4L4 17h5m6 0a3 3 0 0 1-6 0" />
    ),
    check: <path d="m5 12 4 4L19 6" />,
    database: (
      <path d="M4 6c0-1.7 3.6-3 8-3s8 1.3 8 3-3.6 3-8 3-8-1.3-8-3Zm0 0v6c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6" />
    ),
    globe: (
      <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0 0c2 0 3.5-4 3.5-9S14 3 12 3 8.5 7 8.5 12 10 21 12 21ZM3 12h18" />
    ),
    mapPin: (
      <path d="M12 21s7-5.1 7-11a7 7 0 1 0-14 0c0 5.9 7 11 7 11Zm0-8a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
    ),
    ruler: <path d="m4 17 13-13 3 3L7 20l-3-3Zm4-4 2 2m1-5 2 2m1-5 2 2" />,
    settings: (
      <path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm7.4-2.5a7.8 7.8 0 0 0 0-2l2-1.5-2-3.5-2.4 1a8 8 0 0 0-1.7-1L15 3h-4l-.4 3a8 8 0 0 0-1.7 1l-2.4-1-2 3.5 2 1.5a7.8 7.8 0 0 0 0 2l-2 1.5 2 3.5 2.4-1a8 8 0 0 0 1.7 1l.4 3h4l.4-3a8 8 0 0 0 1.7-1l2.4 1 2-3.5-2-1.5Z" />
    ),
    sliders: (
      <path d="M4 6h10m4 0h2M4 12h2m4 0h10M4 18h10m4 0h2M14 4v4M8 10v4m8 2v4" />
    ),
    upload: <path d="M12 16V4m0 0L7 9m5-5 5 5M5 14v5h14v-5" />,
    weather: (
      <path d="M17.5 18H8a5 5 0 1 1 1.2-9.9A6 6 0 0 1 20 11.7 3.5 3.5 0 0 1 17.5 18Z" />
    ),
  };

  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5 shrink-0"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}

function SettingsCard({
  icon,
  title,
  description,
  children,
}: {
  icon: SettingsIconName;
  title: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-sky-100 bg-white p-5 shadow-md shadow-sky-100/50 dark:border-gray-700 dark:bg-gray-800 dark:shadow-black/20 sm:p-6">
      <div className="mb-5 flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300">
          <SettingsIcon name={icon} />
        </div>
        <div className="min-w-0">
          <h2 className="text-lg font-bold text-gray-950 dark:text-white">
            {title}
          </h2>
          {description && (
            <p className="mt-1 text-sm leading-5 text-gray-600 dark:text-gray-300">
              {description}
            </p>
          )}
        </div>
      </div>
      {children}
    </section>
  );
}

function SavedStatus({ isVisible }: { isVisible: boolean }) {
  const { t } = useTranslation();

  return (
    <output
      aria-live="polite"
      aria-atomic="true"
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-bold transition-opacity duration-200 ${
        isVisible
          ? 'border-emerald-200 bg-emerald-50 text-emerald-700 opacity-100 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300'
          : 'border-sky-200 bg-white/80 text-sky-700 opacity-70 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-300'
      }`}
    >
      <SettingsIcon name={isVisible ? 'check' : 'settings'} />
      <span>{isVisible ? t('settings.saved') : t('settings.autoSave')}</span>
    </output>
  );
}

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
  const [searchQuery, setSearchQuery] = useState('');
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const siteList = sites as unknown as ApiSite[];
  const normalizedSearchQuery = normalizeSiteSearch(deferredSearchQuery);
  const filteredSites = useMemo(
    () =>
      siteList.filter((site) => {
        if (!normalizedSearchQuery) return true;

        return [site.name, site.region ?? ''].some((value) =>
          normalizeSiteSearch(value).includes(normalizedSearchQuery)
        );
      }),
    [normalizedSearchQuery, siteList]
  );
  const favoriteCount = settings.favoriteSites.length;

  return (
    <SettingsCard
      icon="mapPin"
      title={t('settings.favorites.title')}
      description={t('settings.favorites.description', {
        count: favoriteCount,
      })}
    >
      {sites.length === 0 ? (
        <div className="py-8 text-center">
          <p className="font-semibold text-gray-800 dark:text-gray-100">
            {t('settings.favorites.noSites')}
          </p>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
            {t('settings.favorites.noSitesDescription')}
          </p>
          <Link
            to="/sites"
            className="mt-4 inline-flex min-h-11 items-center justify-center rounded-lg bg-sky-600 px-4 py-2 font-medium text-white transition-colors hover:bg-sky-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-800"
          >
            {t('settings.favorites.manageSites')}
          </Link>
        </div>
      ) : (
        <>
          <TextField
            value={searchQuery}
            onChange={setSearchQuery}
            className="mb-4 flex max-w-xl flex-col gap-1"
          >
            <Label className="text-sm font-medium text-gray-700 dark:text-gray-200">
              {t('settings.favorites.searchLabel')}
            </Label>
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
                aria-hidden="true"
              />
              <Input
                type="search"
                placeholder={t('settings.favorites.searchPlaceholder')}
                className="min-h-11 w-full rounded-lg border border-gray-300 bg-white py-2 pl-9 pr-3 text-gray-900 outline-none transition-colors focus:border-sky-500 focus:ring-2 focus:ring-sky-500/30 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
              />
            </div>
          </TextField>
          {filteredSites.length === 0 ? (
            <output className="block py-6 text-center text-gray-600 dark:text-gray-300">
              {t('settings.favorites.noSearchResults', {
                query: deferredSearchQuery.trim(),
              })}
            </output>
          ) : (
            <div className="space-y-3">
              {filteredSites.map((site: ApiSite) => (
                <div
                  key={site.id}
                  className={`flex flex-col gap-3 rounded-xl border p-4 transition-colors sm:flex-row sm:items-center sm:justify-between ${
                    settings.favoriteSites.includes(site.id)
                      ? 'border-sky-300 bg-sky-50 dark:border-sky-700 dark:bg-sky-900/20'
                      : 'border-gray-200 bg-gray-50 hover:border-gray-300 dark:border-gray-700 dark:bg-gray-900 dark:hover:border-gray-600'
                  }`}
                >
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 dark:text-white">
                      {getSiteDisplayName(site)}
                    </h3>
                    {site.latitude && site.longitude && site.elevation_m && (
                      <div className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                        {site.latitude.toFixed(4)}, {site.longitude.toFixed(4)}
                        {' · '}
                        {site.elevation_m}m
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
                    aria-pressed={settings.favoriteSites.includes(site.id)}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors sm:ml-4 ${
                      settings.favoriteSites.includes(site.id)
                        ? 'bg-sky-600 text-white hover:bg-sky-700'
                        : 'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                    }`}
                  >
                    {settings.favoriteSites.includes(site.id)
                      ? t('settings.favorites.favorite')
                      : t('settings.favorites.add')}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </SettingsCard>
  );
}

// Weather Sources Tab Component
function WeatherSourcesTab() {
  const { t } = useTranslation();
  const { data: sources = [], isLoading, error } = useWeatherSources();
  const deleteSource = useDeleteWeatherSource();
  const {
    data: sites = [],
    isLoading: areSitesLoading,
    isError: sitesFailedToLoad,
  } = useQuery(sitesQueryOptions());
  const favoriteSiteIds = useAppSettingsStore(
    (state) => state.settings.favoriteSites
  );
  const [selectedTestSiteId, setSelectedTestSiteId] = useState('');
  const [deleteSuccess, setDeleteSuccess] = useState<string | null>(null);

  const testableSites = sites
    .filter(
      (site) =>
        Number.isFinite(site.latitude) && Number.isFinite(site.longitude)
    )
    .sort(
      (left, right) =>
        Number(favoriteSiteIds.includes(right.id)) -
        Number(favoriteSiteIds.includes(left.id))
    );
  const preferredTestSite =
    testableSites.find((site) => favoriteSiteIds.includes(site.id)) ??
    testableSites[0];
  const selectedTestSite =
    testableSites.find((site) => site.id === selectedTestSiteId) ??
    preferredTestSite;
  const testLocation: WeatherTestLocation | null = selectedTestSite
    ? {
        id: selectedTestSite.id,
        name: getSiteDisplayName(selectedTestSite),
        latitude: selectedTestSite.latitude,
        longitude: selectedTestSite.longitude,
      }
    : null;

  const handleDelete = async (source: WeatherSource) => {
    setDeleteSuccess(null);
    await deleteSource.mutateAsync(source.source_name);
    setDeleteSuccess(
      t('settings.weatherSources.deleteSuccess', {
        name: source.display_name,
      })
    );
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
        {t('settings.weatherSources.loadError')}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
        <div className="flex items-center gap-2 text-xl font-bold text-gray-900 dark:text-white">
          <SettingsIcon name="weather" />
          <h2>{t('settings.weatherSources.title')}</h2>
        </div>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
          {t('settings.weatherSources.description')}
        </p>
        <p className="mt-3 text-sm font-medium text-gray-800 dark:text-gray-200">
          {t('settings.weatherSources.sourceCountSummary', {
            active: activeSources.length,
            total: sources.length,
          })}
        </p>

        <div className="mt-4 max-w-xl">
          <label
            htmlFor="weather-test-site"
            className="block text-sm font-semibold text-gray-800 dark:text-gray-200"
          >
            {t('settings.weatherSources.testLocation')}
          </label>
          <select
            id="weather-test-site"
            value={testLocation?.id ?? ''}
            onChange={(event) => setSelectedTestSiteId(event.target.value)}
            disabled={areSitesLoading || testableSites.length === 0}
            aria-describedby="weather-test-site-help"
            className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
          >
            {testableSites.length === 0 && (
              <option value="">
                {areSitesLoading
                  ? t('common.loading')
                  : t(
                      sitesFailedToLoad
                        ? 'settings.weatherSources.testLocationsLoadError'
                        : 'settings.weatherSources.noTestLocation'
                    )}
              </option>
            )}
            {testableSites.map((site) => (
              <option key={site.id} value={site.id}>
                {getSiteDisplayName(site)}
                {favoriteSiteIds.includes(site.id)
                  ? ` · ${t('settings.favorites.favorite')}`
                  : ''}
              </option>
            ))}
          </select>
          <p
            id="weather-test-site-help"
            className="mt-1 text-xs leading-5 text-gray-600 dark:text-gray-300"
          >
            {t('settings.weatherSources.testLocationHelp')}
          </p>
        </div>
      </div>

      {deleteSuccess && (
        <output
          className="block rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800 dark:border-green-800 dark:bg-green-900/20 dark:text-green-200"
          aria-live="polite"
          aria-atomic="true"
        >
          {deleteSuccess}
        </output>
      )}

      {/* Sources Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {sources.map((source) => (
          <WeatherSourceCard
            key={source.id}
            source={source}
            testLocation={testLocation}
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

  const handleBackendNumberSetting = (
    key: keyof BackendAppSettings,
    value: string
  ) => {
    if (!value.trim() || Number.isNaN(Number(value))) return;
    handleBackendSetting(key, value);
  };

  const currentCacheTtl = backendSettings?.cache_ttl_default ?? '3600';
  const currentSpotairRadius =
    backendSettings?.spotair_live_wind_radius_km ?? '10';
  const currentSpotairCacheTtl =
    backendSettings?.spotair_live_wind_cache_ttl_seconds ?? '300';
  const currentSchedulerInterval =
    backendSettings?.scheduler_interval_minutes ?? '30';
  const thresholdSections = [
    {
      title: t('settings.thresholds.wind.title'),
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
                aria-pressed={freshnessLevel === opt.value}
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
                aria-pressed={httpTimeout === opt.value}
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
                aria-pressed={currentCacheTtl === opt.value}
                isDisabled={updateBackend.isPending}
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
                aria-pressed={currentSpotairRadius === opt.value}
                isDisabled={updateBackend.isPending}
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
                aria-pressed={currentSpotairCacheTtl === opt.value}
                isDisabled={updateBackend.isPending}
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
                aria-pressed={currentSchedulerInterval === opt.value}
                isDisabled={updateBackend.isPending}
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
              <div className="mb-2">
                <h4 className="text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wide">
                  {section.title}
                </h4>
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
                        handleBackendNumberSetting(item.key, event.target.value)
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
  const { tab } = Route.useSearch();
  const navigate = Route.useNavigate();
  const { preference: themePreference, setPreference: setThemePreference } =
    useThemeStore();
  const settings = useAppSettingsStore((state) => state.settings);
  const setSettings = useAppSettingsStore((state) => state.setSettings);
  const resetSettings = useAppSettingsStore((state) => state.resetSettings);
  const [saved, setSaved] = useState(false);
  const activeTab: SettingsTabKey =
    tab === 'weather' ? 'sites' : (tab ?? 'general');

  useEffect(() => {
    void i18n.changeLanguage(settings.language);
  }, [i18n, settings.language]);

  const showSaved = () => {
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1800);
  };

  const updateSettings = (
    updater: AppSettings | ((current: AppSettings) => AppSettings)
  ) => {
    setSettings(updater);
    showSaved();
  };

  // Toggle favorite site
  const toggleFavorite = (siteId: string) => {
    updateSettings((prev) => ({
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
          updateSettings(imported.settings as AppSettings);
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
      resetSettings();
      // Reset cache settings to defaults
      const { setFreshnessLevel, setAutoRefreshWeather, setHttpTimeout } =
        useCacheSettingsStore.getState();
      setFreshnessLevel('normal');
      setAutoRefreshWeather(true);
      setHttpTimeout(30000);
      setThemePreference(DEFAULT_APP_SETTINGS.theme);
      alert(t('settings.data.resetSuccess'));
    }
  };

  return (
    <div className="space-y-4 pb-8">
      <section className="overflow-hidden rounded-3xl border border-sky-100 bg-gradient-to-br from-white via-sky-50/70 to-blue-50 p-5 shadow-lg shadow-sky-100/70 dark:border-slate-700/80 dark:from-slate-950 dark:via-slate-900 dark:to-sky-950/50 dark:shadow-black/30 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-sky-200 bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-sky-700 shadow-sm dark:border-sky-800/80 dark:bg-sky-950/50 dark:text-sky-300">
              <SettingsIcon name="settings" />
              {t('settings.title')}
            </div>
            <h1 className="text-2xl font-black tracking-tight text-slate-950 dark:text-white sm:text-3xl">
              {t('settings.subtitle')}
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-300">
              {t('settings.description')}
            </p>
          </div>
          <SavedStatus isVisible={saved} />
        </div>
      </section>

      <Link
        to="/settings/telemetry-layout"
        className="flex items-center justify-between gap-4 rounded-2xl border border-violet-200 bg-violet-50/70 p-4 text-violet-950 transition-colors hover:bg-violet-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 dark:border-violet-900 dark:bg-violet-950/20 dark:text-violet-100 dark:hover:bg-violet-950/40"
      >
        <span>
          <span className="block font-semibold">
            {t('telemetryLayout.title')}
          </span>
          <span className="mt-1 block text-sm text-violet-800/80 dark:text-violet-200/80">
            {t('telemetryLayout.description')}
          </span>
        </span>
        <span className="shrink-0 text-sm font-semibold">
          {t('telemetryLayout.configure')} →
        </span>
      </Link>

      <Tabs
        selectedKey={activeTab}
        onSelectionChange={(key) => {
          const selectedTab = key as SettingsTabKey;
          void navigate({
            search: (previous) => ({
              ...previous,
              tab: selectedTab === 'general' ? undefined : selectedTab,
            }),
          });
        }}
        className="space-y-4"
      >
        {/* Tabs Navigation */}
        <TabList className="mb-4 grid-cols-2 sm:flex">
          {settingsTabs.map((tabKey) => (
            <Tab key={tabKey} id={tabKey} className="flex-1">
              {tabKey === 'general' && (
                <span className="inline-flex items-center justify-center gap-2">
                  <SettingsIcon name="sliders" />
                  {t('settings.tabs.general')}
                </span>
              )}
              {tabKey === 'sites' && (
                <span className="inline-flex items-center justify-center gap-2">
                  <SettingsIcon name="mapPin" />
                  {t('settings.tabs.sitesAndWeather')}
                </span>
              )}
              {tabKey === 'sportstracklive' && (
                <span className="inline-flex items-center justify-center gap-2">
                  <SettingsIcon name="upload" />
                  {t('settings.tabs.sportstracklive')}
                </span>
              )}
              {tabKey === 'data' && (
                <span className="inline-flex items-center justify-center gap-2">
                  <SettingsIcon name="database" />
                  {t('settings.tabs.data')}
                </span>
              )}
            </Tab>
          ))}
        </TabList>

        {/* Content */}
        <div className="space-y-4">
          {/* GENERAL TAB */}
          <TabPanel id="general" className="space-y-4 outline-none">
            {/* Units Section */}
            <SettingsCard
              icon="ruler"
              title={t('settings.units.title')}
              description={t('settings.units.description')}
            >
              <div className="space-y-4">
                <fieldset className="min-w-0">
                  <legend className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                    {t('settings.units.distance')}
                  </legend>
                  <div className="flex flex-wrap gap-2 sm:gap-4">
                    <Button
                      onClick={() =>
                        updateSettings((prev) => ({
                          ...prev,
                          units: { ...prev.units, distance: 'km' },
                        }))
                      }
                      aria-pressed={settings.units.distance === 'km'}
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
                        updateSettings((prev) => ({
                          ...prev,
                          units: { ...prev.units, distance: 'miles' },
                        }))
                      }
                      aria-pressed={settings.units.distance === 'miles'}
                      className={`px-6 py-2 rounded-lg font-medium transition-all ${
                        settings.units.distance === 'miles'
                          ? 'bg-sky-600 text-white shadow-md'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                      }`}
                    >
                      {t('settings.units.miles')}
                    </Button>
                  </div>
                </fieldset>

                <fieldset className="min-w-0">
                  <legend className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                    {t('settings.units.altitude')}
                  </legend>
                  <div className="flex flex-wrap gap-2 sm:gap-4">
                    <Button
                      onClick={() =>
                        updateSettings((prev) => ({
                          ...prev,
                          units: { ...prev.units, altitude: 'm' },
                        }))
                      }
                      aria-pressed={settings.units.altitude === 'm'}
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
                        updateSettings((prev) => ({
                          ...prev,
                          units: { ...prev.units, altitude: 'ft' },
                        }))
                      }
                      aria-pressed={settings.units.altitude === 'ft'}
                      className={`px-6 py-2 rounded-lg font-medium transition-all ${
                        settings.units.altitude === 'ft'
                          ? 'bg-sky-600 text-white shadow-md'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                      }`}
                    >
                      {t('settings.units.feet')}
                    </Button>
                  </div>
                </fieldset>

                <fieldset className="min-w-0">
                  <legend className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                    {t('settings.units.speed')}
                  </legend>
                  <div className="flex flex-wrap gap-2 sm:gap-4">
                    <Button
                      onClick={() =>
                        updateSettings((prev) => ({
                          ...prev,
                          units: { ...prev.units, speed: 'kmh' },
                        }))
                      }
                      aria-pressed={settings.units.speed === 'kmh'}
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
                        updateSettings((prev) => ({
                          ...prev,
                          units: { ...prev.units, speed: 'mph' },
                        }))
                      }
                      aria-pressed={settings.units.speed === 'mph'}
                      className={`px-6 py-2 rounded-lg font-medium transition-all ${
                        settings.units.speed === 'mph'
                          ? 'bg-sky-600 text-white shadow-md'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                      }`}
                    >
                      mph
                    </Button>
                  </div>
                </fieldset>
              </div>
            </SettingsCard>

            {/* Language & Theme Section */}
            <SettingsCard
              icon="globe"
              title={t('settings.languageTheme.title')}
              description={t('settings.languageTheme.description')}
            >
              <div className="space-y-4">
                <fieldset className="min-w-0">
                  <legend className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                    {t('settings.languageTheme.language')}
                  </legend>
                  <div className="flex flex-wrap gap-2 sm:gap-4">
                    <Button
                      onClick={() => {
                        updateSettings((prev) => ({ ...prev, language: 'fr' }));
                      }}
                      aria-pressed={settings.language === 'fr'}
                      className={`px-6 py-2 rounded-lg font-medium transition-all ${
                        settings.language === 'fr'
                          ? 'bg-sky-600 text-white shadow-md'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                      }`}
                    >
                      Français
                    </Button>
                    <Button
                      onClick={() => {
                        updateSettings((prev) => ({ ...prev, language: 'en' }));
                      }}
                      aria-pressed={settings.language === 'en'}
                      className={`px-6 py-2 rounded-lg font-medium transition-all ${
                        settings.language === 'en'
                          ? 'bg-sky-600 text-white shadow-md'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                      }`}
                    >
                      English
                    </Button>
                  </div>
                </fieldset>

                <fieldset className="min-w-0">
                  <legend className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                    {t('settings.languageTheme.theme')}
                  </legend>
                  <p className="mb-2 text-xs text-gray-500 dark:text-gray-400">
                    {t('settings.languageTheme.themeHelp')}
                  </p>
                  <div className="flex flex-wrap gap-2 sm:gap-4">
                    {(['light', 'dark', 'auto'] as const).map((theme) => (
                      <Button
                        key={theme}
                        onClick={() => {
                          setThemePreference(theme as ThemePreference);
                          updateSettings((prev) => ({ ...prev, theme }));
                        }}
                        aria-pressed={themePreference === theme}
                        className={`px-6 py-2 rounded-lg font-medium transition-all ${
                          themePreference === theme
                            ? 'bg-sky-600 text-white shadow-md'
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                        }`}
                      >
                        {t(`settings.languageTheme.${theme}`)}
                      </Button>
                    ))}
                  </div>
                </fieldset>
              </div>
            </SettingsCard>

            {/* Notifications Section */}
            <SettingsCard
              icon="bell"
              title={t('settings.notifications.title')}
              description={t('settings.notifications.description')}
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
                  <div>
                    <span className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      {t('settings.notifications.weatherAlerts')}
                    </span>
                    <span className="mt-0.5 block text-xs text-gray-500 dark:text-gray-400">
                      {t('settings.notifications.weatherAlertsHelp')}
                    </span>
                  </div>
                  <span className="shrink-0 rounded-full border border-gray-200 px-2.5 py-1 text-xs font-medium text-gray-500 dark:border-gray-700 dark:text-gray-400">
                    {t('settings.notifications.unavailable')}
                  </span>
                </div>
                <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
                  <div>
                    <span className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      {t('settings.notifications.newFlights')}
                    </span>
                    <span className="mt-0.5 block text-xs text-gray-500 dark:text-gray-400">
                      {t('settings.notifications.newFlightsHelp')}
                    </span>
                  </div>
                  <span className="shrink-0 rounded-full border border-gray-200 px-2.5 py-1 text-xs font-medium text-gray-500 dark:border-gray-700 dark:text-gray-400">
                    {t('settings.notifications.unavailable')}
                  </span>
                </div>
                <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
                  <div>
                    <span className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      {t('settings.notifications.customAlerts')}
                    </span>
                    <span className="mt-0.5 block text-xs text-gray-500 dark:text-gray-400">
                      {t('settings.notifications.customAlertsHelp')}
                    </span>
                  </div>
                  <span className="shrink-0 rounded-full border border-gray-200 px-2.5 py-1 text-xs font-medium text-gray-500 dark:border-gray-700 dark:text-gray-400">
                    {t('settings.notifications.unavailable')}
                  </span>
                </div>
              </div>
            </SettingsCard>

            {/* Performance Section */}
            <PerformanceSection />
          </TabPanel>

          {/* SITES TAB */}
          <TabPanel id="sites" className="outline-none">
            <Tabs
              selectedKey={tab === 'weather' ? 'weather' : 'sites'}
              onSelectionChange={(key) => {
                void navigate({
                  search: (previous) => ({
                    ...previous,
                    tab: key === 'weather' ? 'weather' : 'sites',
                  }),
                });
              }}
              className="space-y-4"
            >
              <TabList
                aria-label={t('settings.tabs.siteConfiguration')}
                className="mb-4 flex flex-wrap"
              >
                <Tab id="sites">{t('settings.tabs.favoriteSites')}</Tab>
                <Tab id="weather">{t('settings.tabs.weatherSources')}</Tab>
              </TabList>
              <TabPanel id="sites" className="outline-none">
                <Suspense
                  fallback={
                    <div className="space-y-3 rounded-xl bg-white p-6 shadow-md dark:bg-gray-800">
                      {[...Array(4)].map((_, i) => (
                        <div
                          key={i}
                          className="h-16 rounded-lg bg-gray-200 dark:bg-gray-600"
                        />
                      ))}
                    </div>
                  }
                >
                  <SitesTab
                    settings={settings}
                    toggleFavorite={toggleFavorite}
                  />
                </Suspense>
              </TabPanel>
              <TabPanel id="weather" className="outline-none">
                <WeatherSourcesTab />
              </TabPanel>
            </Tabs>
          </TabPanel>

          <TabPanel id="sportstracklive" className="outline-none">
            <SportstrackliveSettingsCard />
          </TabPanel>

          {/* DATA TAB */}
          <TabPanel id="data" className="outline-none">
            <div className="space-y-4">
              {/* Export/Import Section */}
              <SettingsCard
                icon="database"
                title={t('settings.data.backupTitle')}
                description={t('settings.data.backupDescription')}
              >
                <div className="space-y-3">
                  <Button
                    onClick={exportData}
                    className="w-full px-6 py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition-all flex items-center justify-center gap-2"
                  >
                    {t('settings.data.export')}
                  </Button>
                  <label className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-all flex items-center justify-center gap-2 cursor-pointer">
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
                  {t('settings.data.importWarning')}
                </div>
              </SettingsCard>

              {/* Clear Data Section */}
              <SettingsCard
                icon="settings"
                title={t('settings.data.resetTitle')}
                description={t('settings.data.resetDescription')}
              >
                <Button
                  onClick={clearData}
                  className="w-full px-6 py-3 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition-all"
                >
                  {t('settings.data.resetAll')}
                </Button>
                <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg text-sm text-red-800 dark:text-red-200">
                  {t('settings.data.resetWarning')}
                </div>
              </SettingsCard>

              {/* User Profile Placeholder */}
              <SettingsCard icon="bell" title={t('settings.profile.title')}>
                <div className="p-8 bg-gray-50 dark:bg-gray-900 rounded-lg text-center">
                  <p className="text-gray-600 dark:text-gray-300 mb-2">
                    {t('settings.profile.wip')}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {t('settings.profile.wipDetails')}
                  </p>
                </div>
              </SettingsCard>
            </div>
          </TabPanel>
        </div>
      </Tabs>
    </div>
  );
}
