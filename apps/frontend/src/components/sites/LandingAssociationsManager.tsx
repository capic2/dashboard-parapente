import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSites } from '../../hooks/sites/useSites';
import { Button } from '@dashboard-parapente/design-system';
import {
  useLandingAssociations,
  useAddLandingAssociation,
  useUpdateLandingAssociation,
  useRemoveLandingAssociation,
} from '../../hooks/sites/useLandingAssociations';

interface LandingAssociationsManagerProps {
  takeoffSiteId: string;
}

export default function LandingAssociationsManager({
  takeoffSiteId,
}: LandingAssociationsManagerProps) {
  const { t } = useTranslation();
  const { data: associations = [], isLoading } =
    useLandingAssociations(takeoffSiteId);
  const { data: allSites = [] } = useSites();
  const addMutation = useAddLandingAssociation();
  const updateMutation = useUpdateLandingAssociation();
  const removeMutation = useRemoveLandingAssociation();

  const [showAddDropdown, setShowAddDropdown] = useState(false);
  const [newNotes, setNewNotes] = useState('');
  const [selectedLandingId, setSelectedLandingId] = useState('');

  const associatedIds = new Set(associations.map((a) => a.landing_site_id));
  const availableLandings = allSites.filter(
    (s) =>
      s.id !== takeoffSiteId &&
      !associatedIds.has(s.id) &&
      (s.usage_type === 'landing' || s.usage_type === 'both')
  );

  const handleAdd = () => {
    if (!selectedLandingId) return;
    addMutation.mutate(
      {
        siteId: takeoffSiteId,
        data: {
          landing_site_id: selectedLandingId,
          notes: newNotes || undefined,
        },
      },
      {
        onSuccess: () => {
          setSelectedLandingId('');
          setNewNotes('');
          setShowAddDropdown(false);
        },
      }
    );
  };

  const handleSetPrimary = (assocId: string) => {
    updateMutation.mutate({
      siteId: takeoffSiteId,
      assocId,
      data: { is_primary: true },
    });
  };

  const handleRemove = (assocId: string) => {
    removeMutation.mutate({ siteId: takeoffSiteId, assocId });
  };

  if (isLoading) {
    return (
      <div className="text-sm text-gray-500 dark:text-gray-400">
        {t('landings.loading')}
      </div>
    );
  }

  return (
    <div className="border-t border-gray-200 dark:border-gray-600 pt-3 mt-3">
      <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
        {t('landings.associated')}
      </h4>

      {/* List of current associations */}
      {associations.length === 0 ? (
        <p className="text-xs text-gray-400 dark:text-gray-500 mb-2">
          {t('landings.none')}
        </p>
      ) : (
        <ul className="space-y-2 mb-3">
          {associations.map((assoc) => (
            <li
              key={assoc.id}
              className="flex items-center justify-between bg-gray-50 dark:bg-gray-700 rounded px-2 py-1.5 text-sm"
            >
              <div className="flex items-center gap-2 min-w-0">
                <Button
                  size="icon"
                  type="button"
                  onClick={() => handleSetPrimary(assoc.id)}
                  className={`w-4 h-4 rounded-full border-2 flex-shrink-0 ${
                    assoc.is_primary
                      ? 'bg-blue-500 border-blue-500'
                      : 'border-gray-300 dark:border-gray-500 hover:border-blue-400'
                  }`}
                  title={
                    assoc.is_primary
                      ? t('landings.mainLanding')
                      : t('landings.setAsMain')
                  }
                />
                <div className="min-w-0">
                  <span className="font-medium truncate block">
                    {assoc.landing_site?.name || assoc.landing_site_id}
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {assoc.distance_km != null ? `${assoc.distance_km} km` : ''}
                    {assoc.notes && ` - ${assoc.notes}`}
                  </span>
                </div>
              </div>
              <Button
                size="icon"
                type="button"
                onClick={() => handleRemove(assoc.id)}
                tone="ghost"
                className="text-red-400 hover:text-red-600 flex-shrink-0 ml-2"
                title="Supprimer"
              >
                &times;
              </Button>
            </li>
          ))}
        </ul>
      )}

      {/* Add new association */}
      {!showAddDropdown ? (
        <Button
          type="button"
          onClick={() => setShowAddDropdown(true)}
          tone="ghost"
          className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
          disabled={availableLandings.length === 0}
        >
          + {t('landings.addLanding')}
        </Button>
      ) : (
        <div className="space-y-2 bg-gray-50 dark:bg-gray-700 rounded p-2">
          <select
            value={selectedLandingId}
            onChange={(e) => setSelectedLandingId(e.target.value)}
            className="w-full text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 rounded px-2 py-1"
          >
            <option value="">{t('landings.chooseSite')}</option>
            {availableLandings.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
                {s.elevation_m ? ` (${s.elevation_m}m)` : ''}
              </option>
            ))}
          </select>
          <input
            type="text"
            placeholder={t('landings.notesOptional')}
            value={newNotes}
            onChange={(e) => setNewNotes(e.target.value)}
            className="w-full text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 rounded px-2 py-1"
          />
          <div className="flex gap-2">
            <Button
              type="button"
              onClick={handleAdd}
              tone="ghost"
              disabled={!selectedLandingId || addMutation.isPending}
              className="text-xs bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {addMutation.isPending ? t('landings.adding') : t('common.add')}
            </Button>
            <Button
              type="button"
              onClick={() => {
                setShowAddDropdown(false);
                setSelectedLandingId('');
                setNewNotes('');
              }}
              tone="ghost"
              className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              {t('common.cancel')}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
