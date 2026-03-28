import { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal } from '@dashboard-parapente/design-system';
import { useCreateFlightFromGPX } from '../../hooks/useFlights';
import { useToast } from '../../hooks/useToast';

interface CreateFlightModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateComplete: () => void;
}

export function CreateFlightModal({
  isOpen,
  onClose,
  onCreateComplete,
}: CreateFlightModalProps) {
  const { t } = useTranslation();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { mutate: createFlight, isPending, data } = useCreateFlightFromGPX();
  const toast = useToast();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const fileName = file.name.toLowerCase();
      if (!fileName.endsWith('.gpx') && !fileName.endsWith('.igc')) {
        toast.error(t('flights.selectValidFile'));
        return;
      }
      setSelectedFile(file);
      setError(null); // Clear any previous errors
    }
  };

  const handleUpload = () => {
    if (!selectedFile) return;

    setError(null); // Clear any previous errors
    const formData = new FormData();
    formData.append('gpx_file', selectedFile);

    createFlight(formData, {
      onSuccess: (result) => {
        toast.success(
          t('flights.createdSuccess') + ` ${result.flight.name || 'Sans nom'}`
        );
        onCreateComplete();
        setSelectedFile(null);
        setError(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
        setTimeout(() => onClose(), 2000); // Fermer après 2s
      },
      onError: (error: Error) => {
        const errorMessage = error.message || t('flights.createGenericError');
        setError(errorMessage);
        toast.error(t('flights.createFailure') + ` ${errorMessage}`);
      },
    });
  };

  const handleClose = () => {
    if (!isPending) {
      setSelectedFile(null);
      setError(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      onClose();
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={`📤 ${t('flights.createFromGpx')}`}
      size="md"
    >
      <div className="space-y-4">
        <p className="text-sm text-gray-600">
          {t('flights.createDescription')}
        </p>

        {/* File Input */}
        <div className="space-y-2">
          <label
            htmlFor="gpx-file-input"
            className="block text-sm font-medium text-gray-700"
          >
            {t('flights.gpxFile')}
          </label>
          <div className="flex items-center gap-3">
            <input
              id="gpx-file-input"
              ref={fileInputRef}
              type="file"
              accept=".gpx,.igc"
              onChange={handleFileChange}
              disabled={isPending}
              className="block w-full text-sm text-gray-500
                file:mr-4 file:py-2 file:px-4
                file:rounded-lg file:border-0
                file:text-sm file:font-semibold
                file:bg-orange-50 file:text-orange-700
                hover:file:bg-orange-100
                file:cursor-pointer cursor-pointer
                disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </div>
          {selectedFile && (
            <p className="text-sm text-gray-600">
              📄 {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)}{' '}
              KB)
            </p>
          )}
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <p className="text-sm text-blue-800">
            💡 <strong>{t('flights.autoDetection')}</strong>{' '}
            {t('flights.autoDetectionText')}
          </p>
        </div>

        {/* Résultat de la création */}
        {data && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <p className="font-semibold text-green-800 mb-2">
              ✅ {t('flights.createSuccess')}
            </p>
            <ul className="text-sm text-green-700 space-y-1">
              <li>
                • <strong>{t('flights.name')}</strong>{' '}
                {data.flight.name || 'Sans nom'}
              </li>
              <li>
                • <strong>{t('flights.date')}</strong> {data.flight.flight_date}
              </li>
              {data.flight.site_name && (
                <li>
                  • <strong>{t('flights.site')}</strong> {data.flight.site_name}
                </li>
              )}
              {data.flight.duration_minutes && (
                <li>
                  • <strong>{t('flights.duration')}</strong>{' '}
                  {data.flight.duration_minutes} min
                </li>
              )}
              {data.flight.distance_km && (
                <li>
                  • <strong>{t('flights.distance')}</strong>{' '}
                  {data.flight.distance_km.toFixed(2)} km
                </li>
              )}
            </ul>
          </div>
        )}

        {/* Affichage de l'erreur */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="font-semibold text-red-800 mb-2">
              ❌ {t('flights.createError')}
            </p>
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Boutons */}
        <div className="flex gap-3 justify-end">
          <button
            onClick={handleClose}
            className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-all"
            disabled={isPending}
          >
            {t('common.cancel')}
          </button>
          <button
            onClick={handleUpload}
            disabled={isPending || !selectedFile}
            className="px-6 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {isPending ? (
              <>
                <span className="inline-block animate-spin mr-2">⏳</span>
                Création en cours...
              </>
            ) : (
              '📤 Créer le vol'
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
}
