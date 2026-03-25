import { useState } from 'react';
import { Modal, DatePicker } from '@dashboard-parapente/design-system';
import { useStravaSyncMutation } from '../../hooks/useFlights';
import { useToast } from '../../hooks/useToast';

interface StravaSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSyncComplete: () => void;
}

export function StravaSyncModal({ isOpen, onClose, onSyncComplete }: StravaSyncModalProps) {
  const [dateFrom, setDateFrom] = useState(() => new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().split('T')[0]);
  
  const { mutate: syncStrava, isPending, data } = useStravaSyncMutation();
  const toast = useToast();

  const handleSync = () => {
    syncStrava(
      { date_from: dateFrom, date_to: dateTo },
      {
        onSuccess: (result) => {
          toast.success(
            `${result.imported} vols importés${result.skipped > 0 ? ` • ${result.skipped} ignorés (doublons)` : ''}`
          );
          onSyncComplete();
          setTimeout(() => onClose(), 2000); // Fermer après 2s
        },
        onError: (error: Error) => {
          toast.error(`Échec de la synchronisation: ${error.message}`);
        }
      }
    );
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="🔄 Synchroniser avec Strava" size="md">
      <div className="space-y-4">
        <p className="text-sm text-gray-600">
          Importe tous les vols paragliding depuis Strava pour la période sélectionnée.
          Les vols déjà importés seront ignorés.
        </p>
        
        <div className="grid grid-cols-2 gap-4">
          <DatePicker
            label="Du"
            value={dateFrom}
            onChange={setDateFrom}
          />
          <DatePicker
            label="Au"
            value={dateTo}
            onChange={setDateTo}
          />
        </div>

        {/* Résultat de la sync */}
        {data && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <p className="font-semibold text-green-800 mb-2">✅ Synchronisation terminée</p>
            <ul className="text-sm text-green-700 space-y-1">
              <li>• {data.imported} vols importés</li>
              {data.skipped > 0 && <li>• {data.skipped} vols ignorés (doublons)</li>}
              {data.failed > 0 && <li className="text-orange-700">• {data.failed} échecs</li>}
            </ul>
          </div>
        )}

        {/* Boutons */}
        <div className="flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-all"
            disabled={isPending}
          >
            Annuler
          </button>
          <button
            onClick={handleSync}
            disabled={isPending || !dateFrom || !dateTo}
            className="px-6 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {isPending ? (
              <>
                <span className="inline-block animate-spin mr-2">⏳</span>
                Synchronisation...
              </>
            ) : (
              '🔄 Synchroniser'
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
}
