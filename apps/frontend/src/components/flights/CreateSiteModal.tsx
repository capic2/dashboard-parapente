import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Label, Input, TextField, Button } from 'react-aria-components';
import { Modal } from '@dashboard-parapente/design-system';
import { useCreateSite, useGeocode } from '../../hooks/sites/useSites';
import { useFlightGPX } from '../../hooks/flights/useFlightGPX';
import type { Site } from '../../types';

interface CreateSiteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSiteCreated: (site: Site) => void;
  flightId?: string; // For auto-detection from GPX
}

export const CreateSiteModal: React.FC<CreateSiteModalProps> = ({
  isOpen,
  onClose,
  onSiteCreated,
  flightId,
}) => {
  const { t } = useTranslation();
  const [mode, setMode] = useState<'auto' | 'search' | 'manual'>('search');
  const [error, setError] = useState<string | null>(null);

  // Search mode
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResult, setSearchResult] = useState<{
    latitude: number;
    longitude: number;
    display_name: string;
  } | null>(null);

  // Manual mode
  const [siteName, setSiteName] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [elevation, setElevation] = useState('');

  const createSite = useCreateSite();
  const geocode = useGeocode();
  const { data: gpxData } = useFlightGPX(flightId || '');

  const handleAutoDetect = () => {
    if (!gpxData?.coordinates || gpxData.coordinates.length === 0) {
      setError(t('createSite.noGpxAvailable'));
      return;
    }

    setError(null);
    const firstPoint = gpxData.coordinates[0];
    setSiteName('');
    setLatitude(firstPoint.lat.toString());
    setLongitude(firstPoint.lon.toString());
    setElevation(Math.round(firstPoint.elevation).toString());
    setMode('manual');
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    setError(null);
    try {
      const result = await geocode.mutateAsync({ query: searchQuery });
      setSearchResult(result);
      setSiteName(searchQuery);
      setLatitude(result.latitude.toString());
      setLongitude(result.longitude.toString());
    } catch {
      setError(t('createSite.cityNotFound'));
      setSearchResult(null);
    }
  };

  const handleCreate = async () => {
    const lat = parseFloat(latitude);
    const lon = parseFloat(longitude);
    const elev = elevation ? parseInt(elevation) : undefined;

    if (!siteName.trim()) {
      setError(t('createSite.nameRequired'));
      return;
    }

    if (isNaN(lat) || isNaN(lon)) {
      setError(t('createSite.invalidCoordinates'));
      return;
    }

    setError(null);
    try {
      const newSite = await createSite.mutateAsync({
        name: siteName,
        latitude: lat,
        longitude: lon,
        elevation_m: elev,
        country: 'FR',
      });

      onSiteCreated(newSite);
      onClose();

      // Reset form
      setSiteName('');
      setLatitude('');
      setLongitude('');
      setElevation('');
      setSearchQuery('');
      setSearchResult(null);
      setError(null);
    } catch (error: unknown) {
      setError(
        (error instanceof Error ? error.message : null) ||
          t('createSite.createError')
      );
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('createSite.title')}>
      <div className="space-y-4">
        {/* Mode selector */}
        <div className="flex gap-2">
          {flightId && gpxData?.coordinates && (
            <Button
              onPress={() => {
                setMode('auto');
                setError(null);
              }}
              className={`px-4 py-2 rounded ${
                mode === 'auto' ? 'bg-blue-500 text-white' : 'bg-gray-200 dark:bg-gray-600 dark:text-gray-200'
              }`}
            >
              {t('createSite.autoDetect')}
            </Button>
          )}
          <Button
            onPress={() => {
              setMode('search');
              setError(null);
            }}
            className={`px-4 py-2 rounded ${
              mode === 'search' ? 'bg-blue-500 text-white' : 'bg-gray-200 dark:bg-gray-600 dark:text-gray-200'
            }`}
          >
            {t('createSite.search')}
          </Button>
          <Button
            onPress={() => {
              setMode('manual');
              setError(null);
            }}
            className={`px-4 py-2 rounded ${
              mode === 'manual' ? 'bg-blue-500 text-white' : 'bg-gray-200 dark:bg-gray-600 dark:text-gray-200'
            }`}
          >
            {t('createSite.manualEntry')}
          </Button>
        </div>

        {/* Error display */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg p-3">
            <p className="text-sm text-red-800 dark:text-red-200">
              <span className="font-semibold">❌ Erreur : </span>
              {error}
            </p>
          </div>
        )}

        {/* Auto-detect mode */}
        {mode === 'auto' && (
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">
              Utiliser le premier point GPS du fichier de vol
            </p>
            <Button
              onPress={handleAutoDetect}
              className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
            >
              Détecter depuis le GPX
            </Button>
          </div>
        )}

        {/* Search mode */}
        {mode === 'search' && (
          <div>
            <TextField className="flex flex-col gap-1">
              <Label className="block text-sm font-medium">
                Nom de la ville
              </Label>
              <div className="flex gap-2">
                <Input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Ex: Besançon, Arguel..."
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded outline-none focus:ring-2 focus:ring-blue-500"
                  onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                />
                <Button
                  onPress={handleSearch}
                  isDisabled={geocode.isPending}
                  className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:opacity-50"
                >
                  {geocode.isPending ? 'Recherche...' : 'Rechercher'}
                </Button>
              </div>
            </TextField>

            {searchResult && (
              <div className="mt-3 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded">
                <p className="text-sm font-medium text-green-800 dark:text-green-200">✓ Trouvé !</p>
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  {searchResult.display_name}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {searchResult.latitude.toFixed(5)},{' '}
                  {searchResult.longitude.toFixed(5)}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Manual mode OR after search/auto */}
        {(mode === 'manual' || searchResult) && (
          <div className="space-y-3">
            <TextField className="flex flex-col gap-1">
              <Label className="block text-sm font-medium">Nom du site *</Label>
              <Input
                type="text"
                value={siteName}
                onChange={(e) => setSiteName(e.target.value)}
                placeholder="Ex: Mont Poupet"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded outline-none focus:ring-2 focus:ring-blue-500"
              />
            </TextField>

            <div className="grid grid-cols-2 gap-3">
              <TextField className="flex flex-col gap-1">
                <Label className="block text-sm font-medium">Latitude *</Label>
                <Input
                  type="number"
                  step="0.000001"
                  value={latitude}
                  onChange={(e) => setLatitude(e.target.value)}
                  placeholder="47.238"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded outline-none focus:ring-2 focus:ring-blue-500"
                />
              </TextField>

              <TextField className="flex flex-col gap-1">
                <Label className="block text-sm font-medium">Longitude *</Label>
                <Input
                  type="number"
                  step="0.000001"
                  value={longitude}
                  onChange={(e) => setLongitude(e.target.value)}
                  placeholder="6.024"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded outline-none focus:ring-2 focus:ring-blue-500"
                />
              </TextField>
            </div>

            <TextField className="flex flex-col gap-1">
              <Label className="block text-sm font-medium">Altitude (m)</Label>
              <Input
                type="number"
                value={elevation}
                onChange={(e) => setElevation(e.target.value)}
                placeholder="450"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded outline-none focus:ring-2 focus:ring-blue-500"
              />
            </TextField>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-4 border-t border-gray-200 dark:border-gray-700">
          <Button
            onPress={onClose}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
          >
            Annuler
          </Button>
          <Button
            onPress={handleCreate}
            isDisabled={
              createSite.isPending || !siteName || !latitude || !longitude
            }
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
          >
            {createSite.isPending ? 'Création...' : 'Créer le site'}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
