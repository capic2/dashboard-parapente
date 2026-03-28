import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useSites } from '../hooks/useSites';
import {
  useWeatherSources,
  useWeatherSourceStats,
  useDeleteWeatherSource,
} from '../hooks/useWeatherSources';
import { WeatherSourceCard } from '../components/WeatherSourceCard';
import type { WeatherSource } from '../types/weatherSources';

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
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
        ❌ {t('settings.weatherSources.loadError')}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with stats */}
      <div className="bg-white rounded-xl p-6 shadow-md">
        <h2 className="text-xl font-bold text-gray-900 mb-2">
          🌦️ {t('settings.weatherSources.title')}
        </h2>
        <p className="text-sm text-gray-600 mb-4">
          {t('settings.weatherSources.description')}
        </p>

        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="p-3 bg-blue-50 rounded-lg">
              <div className="text-xs text-blue-600 font-semibold mb-1">
                {t('settings.weatherSources.activeSources')}
              </div>
              <div className="text-2xl font-bold text-blue-900">
                {stats.active_sources}/{stats.total_sources}
              </div>
            </div>
            <div className="p-3 bg-green-50 rounded-lg">
              <div className="text-xs text-green-600 font-semibold mb-1">
                {t('settings.weatherSources.globalSuccessRate')}
              </div>
              <div className="text-2xl font-bold text-green-900">
                {stats.global_success_rate.toFixed(0)}%
              </div>
            </div>
            <div className="p-3 bg-purple-50 rounded-lg">
              <div className="text-xs text-purple-600 font-semibold mb-1">
                {t('settings.weatherSources.avgTime')}
              </div>
              <div className="text-2xl font-bold text-purple-900">
                {stats.global_avg_response_time_ms
                  ? `${stats.global_avg_response_time_ms}ms`
                  : '-'}
              </div>
            </div>
            <div className="p-3 bg-red-50 rounded-lg">
              <div className="text-xs text-red-600 font-semibold mb-1">
                {t('settings.weatherSources.sourcesWithErrors')}
              </div>
              <div className="text-2xl font-bold text-red-900">
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
        <div className="bg-gray-50 rounded-lg p-8 text-center text-gray-600">
          {t('settings.weatherSources.noSources')}
        </div>
      )}

      {/* Info Box */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <h3 className="font-semibold text-yellow-900 mb-2">
          ℹ️ {t('settings.weatherSources.aboutTitle')}
        </h3>
        <ul className="text-sm text-yellow-800 space-y-1">
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

export default function Settings() {
  const { t, i18n } = useTranslation();
  const { data: sites = [], isLoading: sitesLoading } = useSites();
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
  const [activeTab, setActiveTab] = useState<
    'general' | 'sites' | 'weather' | 'data'
  >('general');

  useEffect(() => {
    i18n.changeLanguage(settings.language);
  }, []);

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
    const data = {
      settings,
      exportDate: new Date().toISOString(),
      version: '1.0',
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
          alert(t('settings.data.importSuccess'));
        }
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
      alert(t('settings.data.resetSuccess'));
    }
  };

  return (
    <div>
      <div className="mb-4 bg-white rounded-xl p-4 shadow-md">
        <h1 className="text-xl font-bold text-gray-900">
          ⚙️ {t('settings.title')}
        </h1>
        <p className="text-sm text-gray-600 mt-1">{t('settings.subtitle')}</p>
      </div>

      {/* Tabs Navigation */}
      <div className="bg-white rounded-xl shadow-md mb-4 p-2 flex gap-2">
        <button
          onClick={() => setActiveTab('general')}
          className={`flex-1 px-4 py-2 rounded-lg font-medium transition-all ${
            activeTab === 'general'
              ? 'bg-sky-600 text-white shadow-md'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          🎛️ {t('settings.tabs.general')}
        </button>
        <button
          onClick={() => setActiveTab('sites')}
          className={`flex-1 px-4 py-2 rounded-lg font-medium transition-all ${
            activeTab === 'sites'
              ? 'bg-sky-600 text-white shadow-md'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          📍 {t('settings.tabs.favoriteSites')}
        </button>
        <button
          onClick={() => setActiveTab('weather')}
          className={`flex-1 px-4 py-2 rounded-lg font-medium transition-all ${
            activeTab === 'weather'
              ? 'bg-sky-600 text-white shadow-md'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          🌦️ {t('settings.tabs.weatherSources')}
        </button>
        <button
          onClick={() => setActiveTab('data')}
          className={`flex-1 px-4 py-2 rounded-lg font-medium transition-all ${
            activeTab === 'data'
              ? 'bg-sky-600 text-white shadow-md'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          💾 {t('settings.tabs.data')}
        </button>
      </div>

      {/* Content */}
      <div className="space-y-4">
        {/* GENERAL TAB */}
        {activeTab === 'general' && (
          <>
            {/* Units Section */}
            <div className="bg-white rounded-xl p-6 shadow-md">
              <h2 className="text-lg font-bold text-gray-900 mb-4">
                📏 {t('settings.units.title')}
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('settings.units.distance')}
                  </label>
                  <div className="flex gap-4">
                    <button
                      onClick={() =>
                        setSettings((prev) => ({
                          ...prev,
                          units: { ...prev.units, distance: 'km' },
                        }))
                      }
                      className={`px-6 py-2 rounded-lg font-medium transition-all ${
                        settings.units.distance === 'km'
                          ? 'bg-sky-600 text-white shadow-md'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {t('settings.units.kilometers')}
                    </button>
                    <button
                      onClick={() =>
                        setSettings((prev) => ({
                          ...prev,
                          units: { ...prev.units, distance: 'miles' },
                        }))
                      }
                      className={`px-6 py-2 rounded-lg font-medium transition-all ${
                        settings.units.distance === 'miles'
                          ? 'bg-sky-600 text-white shadow-md'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {t('settings.units.miles')}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('settings.units.altitude')}
                  </label>
                  <div className="flex gap-4">
                    <button
                      onClick={() =>
                        setSettings((prev) => ({
                          ...prev,
                          units: { ...prev.units, altitude: 'm' },
                        }))
                      }
                      className={`px-6 py-2 rounded-lg font-medium transition-all ${
                        settings.units.altitude === 'm'
                          ? 'bg-sky-600 text-white shadow-md'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {t('settings.units.meters')}
                    </button>
                    <button
                      onClick={() =>
                        setSettings((prev) => ({
                          ...prev,
                          units: { ...prev.units, altitude: 'ft' },
                        }))
                      }
                      className={`px-6 py-2 rounded-lg font-medium transition-all ${
                        settings.units.altitude === 'ft'
                          ? 'bg-sky-600 text-white shadow-md'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {t('settings.units.feet')}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('settings.units.speed')}
                  </label>
                  <div className="flex gap-4">
                    <button
                      onClick={() =>
                        setSettings((prev) => ({
                          ...prev,
                          units: { ...prev.units, speed: 'kmh' },
                        }))
                      }
                      className={`px-6 py-2 rounded-lg font-medium transition-all ${
                        settings.units.speed === 'kmh'
                          ? 'bg-sky-600 text-white shadow-md'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      km/h
                    </button>
                    <button
                      onClick={() =>
                        setSettings((prev) => ({
                          ...prev,
                          units: { ...prev.units, speed: 'mph' },
                        }))
                      }
                      className={`px-6 py-2 rounded-lg font-medium transition-all ${
                        settings.units.speed === 'mph'
                          ? 'bg-sky-600 text-white shadow-md'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      mph
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Language & Theme Section */}
            <div className="bg-white rounded-xl p-6 shadow-md">
              <h2 className="text-lg font-bold text-gray-900 mb-4">
                🌐 {t('settings.languageTheme.title')}
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('settings.languageTheme.language')}
                  </label>
                  <div className="flex gap-4">
                    <button
                      onClick={() => {
                        setSettings((prev) => ({ ...prev, language: 'fr' }));
                        i18n.changeLanguage('fr');
                      }}
                      className={`px-6 py-2 rounded-lg font-medium transition-all ${
                        settings.language === 'fr'
                          ? 'bg-sky-600 text-white shadow-md'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      🇫🇷 Français
                    </button>
                    <button
                      onClick={() => {
                        setSettings((prev) => ({ ...prev, language: 'en' }));
                        i18n.changeLanguage('en');
                      }}
                      className={`px-6 py-2 rounded-lg font-medium transition-all ${
                        settings.language === 'en'
                          ? 'bg-sky-600 text-white shadow-md'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      🇬🇧 English
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('settings.languageTheme.theme')}
                  </label>
                  <div className="flex gap-4">
                    <button
                      onClick={() =>
                        setSettings((prev) => ({ ...prev, theme: 'light' }))
                      }
                      className={`px-6 py-2 rounded-lg font-medium transition-all ${
                        settings.theme === 'light'
                          ? 'bg-sky-600 text-white shadow-md'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      ☀️ {t('settings.languageTheme.light')}
                    </button>
                    <button
                      onClick={() =>
                        setSettings((prev) => ({ ...prev, theme: 'dark' }))
                      }
                      className={`px-6 py-2 rounded-lg font-medium transition-all ${
                        settings.theme === 'dark'
                          ? 'bg-sky-600 text-white shadow-md'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      🌙 {t('settings.languageTheme.dark')}
                    </button>
                    <button
                      onClick={() =>
                        setSettings((prev) => ({ ...prev, theme: 'auto' }))
                      }
                      className={`px-6 py-2 rounded-lg font-medium transition-all ${
                        settings.theme === 'auto'
                          ? 'bg-sky-600 text-white shadow-md'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      🔄 {t('settings.languageTheme.auto')}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Notifications Section */}
            <div className="bg-white rounded-xl p-6 shadow-md">
              <h2 className="text-lg font-bold text-gray-900 mb-4">
                🔔 {t('settings.notifications.title')}
              </h2>
              <div className="space-y-3">
                <label className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-all cursor-pointer">
                  <span className="text-sm font-medium text-gray-700">
                    {t('settings.notifications.weatherAlerts')}
                  </span>
                  <input
                    type="checkbox"
                    checked={settings.notifications.weather}
                    onChange={(e) =>
                      setSettings((prev) => ({
                        ...prev,
                        notifications: {
                          ...prev.notifications,
                          weather: e.target.checked,
                        },
                      }))
                    }
                    className="w-5 h-5 text-sky-600 rounded focus:ring-2 focus:ring-sky-600"
                  />
                </label>
                <label className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-all cursor-pointer">
                  <span className="text-sm font-medium text-gray-700">
                    {t('settings.notifications.newFlights')}
                  </span>
                  <input
                    type="checkbox"
                    checked={settings.notifications.flights}
                    onChange={(e) =>
                      setSettings((prev) => ({
                        ...prev,
                        notifications: {
                          ...prev.notifications,
                          flights: e.target.checked,
                        },
                      }))
                    }
                    className="w-5 h-5 text-sky-600 rounded focus:ring-2 focus:ring-sky-600"
                  />
                </label>
                <label className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-all cursor-pointer">
                  <span className="text-sm font-medium text-gray-700">
                    {t('settings.notifications.customAlerts')}
                  </span>
                  <input
                    type="checkbox"
                    checked={settings.notifications.alerts}
                    onChange={(e) =>
                      setSettings((prev) => ({
                        ...prev,
                        notifications: {
                          ...prev.notifications,
                          alerts: e.target.checked,
                        },
                      }))
                    }
                    className="w-5 h-5 text-sky-600 rounded focus:ring-2 focus:ring-sky-600"
                  />
                </label>
              </div>
            </div>
          </>
        )}

        {/* SITES TAB */}
        {activeTab === 'sites' && (
          <div className="bg-white rounded-xl p-6 shadow-md">
            <h2 className="text-lg font-bold text-gray-900 mb-4">
              📍 {t('settings.favorites.title')}
            </h2>
            {sitesLoading ? (
              <div className="animate-pulse space-y-3">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="h-16 bg-gray-200 rounded-lg"></div>
                ))}
              </div>
            ) : sites.length === 0 ? (
              <p className="text-gray-600 text-center py-8">
                {t('settings.favorites.noSites')}
              </p>
            ) : (
              <div className="space-y-3">
                {(sites as unknown as ApiSite[]).map((site: ApiSite) => (
                  <div
                    key={site.id}
                    className={`flex items-center justify-between p-4 rounded-lg border-2 transition-all ${
                      settings.favoriteSites.includes(site.id)
                        ? 'border-sky-600 bg-sky-50'
                        : 'border-gray-200 bg-gray-50 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900">
                        {site.name}
                      </h3>
                      {site.latitude && site.longitude && site.elevation_m && (
                        <div className="text-sm text-gray-600 mt-1">
                          📍 {site.latitude.toFixed(4)},{' '}
                          {site.longitude.toFixed(4)} • ⛰️ {site.elevation_m}m
                        </div>
                      )}
                      {site.description && (
                        <p className="text-xs text-gray-500 mt-1">
                          {site.description}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => toggleFavorite(site.id)}
                      className={`ml-4 px-4 py-2 rounded-lg font-medium transition-all ${
                        settings.favoriteSites.includes(site.id)
                          ? 'bg-sky-600 text-white hover:bg-sky-700'
                          : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                      }`}
                    >
                      {settings.favoriteSites.includes(site.id)
                        ? '⭐ ' + t('settings.favorites.favorite')
                        : '☆ ' + t('settings.favorites.add')}
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-4 p-3 bg-blue-50 rounded-lg text-sm text-blue-800">
              💡 <strong>{t('settings.favorites.tip')}</strong>{' '}
              {t('settings.favorites.tipText')}
            </div>
          </div>
        )}

        {/* WEATHER SOURCES TAB */}
        {activeTab === 'weather' && <WeatherSourcesTab />}

        {/* DATA TAB */}
        {activeTab === 'data' && (
          <div className="space-y-4">
            {/* Export/Import Section */}
            <div className="bg-white rounded-xl p-6 shadow-md">
              <h2 className="text-lg font-bold text-gray-900 mb-4">
                💾 {t('settings.data.backupTitle')}
              </h2>
              <div className="space-y-3">
                <button
                  onClick={exportData}
                  className="w-full px-6 py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition-all flex items-center justify-center gap-2"
                >
                  <span>📥</span>
                  {t('settings.data.export')}
                </button>
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
              <div className="mt-4 p-3 bg-yellow-50 rounded-lg text-sm text-yellow-800">
                ⚠️ {t('settings.data.importWarning')}
              </div>
            </div>

            {/* Clear Data Section */}
            <div className="bg-white rounded-xl p-6 shadow-md">
              <h2 className="text-lg font-bold text-gray-900 mb-4">
                🗑️ {t('settings.data.resetTitle')}
              </h2>
              <button
                onClick={clearData}
                className="w-full px-6 py-3 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition-all"
              >
                {t('settings.data.resetAll')}
              </button>
              <div className="mt-4 p-3 bg-red-50 rounded-lg text-sm text-red-800">
                ⚠️ {t('settings.data.resetWarning')}
              </div>
            </div>

            {/* User Profile Placeholder */}
            <div className="bg-white rounded-xl p-6 shadow-md">
              <h2 className="text-lg font-bold text-gray-900 mb-4">
                👤 {t('settings.profile.title')}
              </h2>
              <div className="p-8 bg-gray-50 rounded-lg text-center">
                <p className="text-gray-600 mb-2">
                  🚧 {t('settings.profile.wip')}
                </p>
                <p className="text-sm text-gray-500">
                  {t('settings.profile.wipDetails')}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Save Button */}
      <div className="mt-6 sticky bottom-4 z-10">
        <button
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
        </button>
      </div>
    </div>
  );
}
