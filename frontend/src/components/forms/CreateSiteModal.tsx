import { useState } from 'react';
import { Modal } from '../ui/Modal';
import { useCreateSite, useGeocode } from '../../hooks/useSites';
import { useFlightGPX } from '../../hooks/useFlightGPX';
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
  const [mode, setMode] = useState<'auto' | 'search' | 'manual'>('search');
  const [error, setError] = useState<string | null>(null);
  
  // Search mode
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResult, setSearchResult] = useState<any>(null);
  
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
      setError('Aucune trace GPX disponible pour auto-détection');
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
    } catch (error) {
      setError('Ville non trouvée. Veuillez vérifier l\'orthographe ou essayer une autre recherche.');
      setSearchResult(null);
    }
  };

  const handleCreate = async () => {
    const lat = parseFloat(latitude);
    const lon = parseFloat(longitude);
    const elev = elevation ? parseInt(elevation) : undefined;

    if (!siteName.trim()) {
      setError('Le nom du site est requis');
      return;
    }

    if (isNaN(lat) || isNaN(lon)) {
      setError('Coordonnées invalides. Veuillez entrer des nombres valides pour la latitude et longitude.');
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
    } catch (error: any) {
      setError(error?.message || 'Erreur lors de la création du site. Veuillez réessayer.');
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Créer un nouveau site">
      <div className="space-y-4">
        {/* Mode selector */}
        <div className="flex gap-2">
          {flightId && gpxData?.coordinates && (
            <button
              onClick={() => { setMode('auto'); setError(null); }}
              className={`px-4 py-2 rounded ${
                mode === 'auto' ? 'bg-blue-500 text-white' : 'bg-gray-200'
              }`}
            >
              Auto-détection
            </button>
          )}
          <button
            onClick={() => { setMode('search'); setError(null); }}
            className={`px-4 py-2 rounded ${
              mode === 'search' ? 'bg-blue-500 text-white' : 'bg-gray-200'
            }`}
          >
            Recherche
          </button>
          <button
            onClick={() => { setMode('manual'); setError(null); }}
            className={`px-4 py-2 rounded ${
              mode === 'manual' ? 'bg-blue-500 text-white' : 'bg-gray-200'
            }`}
          >
            Saisie manuelle
          </button>
        </div>

        {/* Error display */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <p className="text-sm text-red-800">
              <span className="font-semibold">❌ Erreur : </span>
              {error}
            </p>
          </div>
        )}

        {/* Auto-detect mode */}
        {mode === 'auto' && (
          <div>
            <p className="text-sm text-gray-600 mb-2">
              Utiliser le premier point GPS du fichier de vol
            </p>
            <button
              onClick={handleAutoDetect}
              className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
            >
              Détecter depuis le GPX
            </button>
          </div>
        )}

        {/* Search mode */}
        {mode === 'search' && (
          <div>
            <label className="block text-sm font-medium mb-1">
              Nom de la ville
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Ex: Besançon, Arguel..."
                className="flex-1 px-3 py-2 border rounded"
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              />
              <button
                onClick={handleSearch}
                disabled={geocode.isPending}
                className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:opacity-50"
              >
                {geocode.isPending ? 'Recherche...' : 'Rechercher'}
              </button>
            </div>
            
            {searchResult && (
              <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded">
                <p className="text-sm font-medium text-green-800">✓ Trouvé !</p>
                <p className="text-sm text-gray-600">{searchResult.display_name}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {searchResult.latitude.toFixed(5)}, {searchResult.longitude.toFixed(5)}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Manual mode OR after search/auto */}
        {(mode === 'manual' || searchResult) && (
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium mb-1">
                Nom du site *
              </label>
              <input
                type="text"
                value={siteName}
                onChange={(e) => setSiteName(e.target.value)}
                placeholder="Ex: Mont Poupet"
                className="w-full px-3 py-2 border rounded"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Latitude *
                </label>
                <input
                  type="number"
                  step="0.000001"
                  value={latitude}
                  onChange={(e) => setLatitude(e.target.value)}
                  placeholder="47.238"
                  className="w-full px-3 py-2 border rounded"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Longitude *
                </label>
                <input
                  type="number"
                  step="0.000001"
                  value={longitude}
                  onChange={(e) => setLongitude(e.target.value)}
                  placeholder="6.024"
                  className="w-full px-3 py-2 border rounded"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Altitude (m)
              </label>
              <input
                type="number"
                value={elevation}
                onChange={(e) => setElevation(e.target.value)}
                placeholder="450"
                className="w-full px-3 py-2 border rounded"
              />
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-4 border-t">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded"
          >
            Annuler
          </button>
          <button
            onClick={handleCreate}
            disabled={createSite.isPending || !siteName || !latitude || !longitude}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
          >
            {createSite.isPending ? 'Création...' : 'Créer le site'}
          </button>
        </div>
      </div>
    </Modal>
  );
};
