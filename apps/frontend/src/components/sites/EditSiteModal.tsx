import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import type { Site } from '@dashboard-parapente/shared-types';
import { SiteUpdate } from '../../hooks/sites/useSiteMutations';
import LandingAssociationsManager from './LandingAssociationsManager';

interface EditSiteModalProps {
  site: Site | null; // null = create mode, Site = edit mode
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: SiteUpdate) => Promise<void>;
}

export const EditSiteModal: React.FC<EditSiteModalProps> = ({
  site,
  isOpen,
  onClose,
  onSave,
}) => {
  const { t } = useTranslation();
  const [formData, setFormData] = useState<SiteUpdate>({
    name: '',
    code: '',
    latitude: 0,
    longitude: 0,
    elevation_m: 0,
    region: '',
    country: 'FR',
    orientation: '',
    camera_angle: 180,
    camera_distance: 500,
    usage_type: 'both',
    description: '',
  });

  const [originalData, setOriginalData] = useState<SiteUpdate>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);

  // Initialize form when site changes
  useEffect(() => {
    if (site) {
      const initialData = {
        name: site.name,
        code: site.code || '',
        latitude: site.latitude || 0,
        longitude: site.longitude || 0,
        elevation_m: site.elevation_m || 0,
        region: site.region || '',
        country: site.country || 'FR',
        orientation: site.orientation || '',
        camera_angle: site.camera_angle || 180,
        camera_distance: site.camera_distance || 500,
        usage_type: site.usage_type || 'both',
        description: site.description || '',
      };
      setFormData(initialData);
      setOriginalData(initialData);
    } else {
      // Reset for create mode
      const initialData: SiteUpdate = {
        name: '',
        code: '',
        latitude: 0,
        longitude: 0,
        elevation_m: 0,
        region: '',
        country: 'FR',
        orientation: '',
        camera_angle: 180,
        camera_distance: 500,
        usage_type: 'both',
        description: '',
      };
      setFormData(initialData);
      setOriginalData({});
    }
    setErrors({});
  }, [site]);

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name || formData.name.length < 2) {
      newErrors.name = t('editSite.nameMinLength');
    }

    if (
      formData.latitude !== undefined &&
      (formData.latitude < -90 || formData.latitude > 90)
    ) {
      newErrors.latitude = t('editSite.invalidLatitude');
    }

    if (
      formData.longitude !== undefined &&
      (formData.longitude < -180 || formData.longitude > 180)
    ) {
      newErrors.longitude = t('editSite.invalidLongitude');
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) return;

    setIsSaving(true);
    try {
      // For edit mode: only send changed fields
      // For create mode: send all fields with values
      const cleanedData: SiteUpdate = {};

      Object.entries(formData).forEach(([key, value]) => {
        const typedKey = key as keyof SiteUpdate;
        const originalValue = originalData[typedKey];

        // Include field if:
        // 1. It's a new site (no originalData) and has a non-empty value
        // 2. It's an edit and the value has changed
        if (Object.keys(originalData).length === 0) {
          // Create mode: include all non-empty values
          if (value !== '' && value !== undefined && value !== null) {
            cleanedData[typedKey] = value;
          }
        } else {
          // Edit mode: only include changed values
          if (value !== originalValue) {
            cleanedData[typedKey] = value;
          }
        }
      });

      await onSave(cleanedData);
      onClose();
    } catch (error) {
      console.error('Failed to save site:', error);
      alert(t('editSite.saveError'));
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-20 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <h2 className="text-2xl font-bold mb-4">
          {site ? `${t('editSite.title')} ${site.name}` : t('editSite.newSite')}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Nom */}
          <div>
            <label className="block text-sm font-medium mb-1">
              {t('editSite.siteName')} *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              className="w-full px-3 py-2 border rounded"
              required
            />
            {errors.name && (
              <p className="text-red-500 text-xs mt-1">{errors.name}</p>
            )}
          </div>

          {/* Code */}
          <div>
            <label className="block text-sm font-medium mb-1">{t('editSite.code')}</label>
            <input
              type="text"
              value={formData.code}
              onChange={(e) =>
                setFormData({ ...formData, code: e.target.value })
              }
              className="w-full px-3 py-2 border rounded disabled:bg-gray-100"
              disabled={!!site}
            />
            {site && (
              <p className="text-xs text-gray-500 mt-1">
                {t('editSite.codeReadonly')}
              </p>
            )}
          </div>

          {/* Type de site */}
          <div>
            <label className="block text-sm font-medium mb-2">
              {t('editSite.siteType')} *
            </label>
            <div className="space-y-2">
              <label className="flex items-center cursor-pointer">
                <input
                  type="radio"
                  value="takeoff"
                  checked={formData.usage_type === 'takeoff'}
                  onChange={() =>
                    setFormData({ ...formData, usage_type: 'takeoff' })
                  }
                  className="mr-2"
                />
                <span>{t('sites.takeoffOnly')}</span>
              </label>
              <label className="flex items-center cursor-pointer">
                <input
                  type="radio"
                  value="landing"
                  checked={formData.usage_type === 'landing'}
                  onChange={() =>
                    setFormData({ ...formData, usage_type: 'landing' })
                  }
                  className="mr-2"
                />
                <span>{t('sites.landingOnly')}</span>
              </label>
              <label className="flex items-center cursor-pointer">
                <input
                  type="radio"
                  value="both"
                  checked={formData.usage_type === 'both'}
                  onChange={() =>
                    setFormData({ ...formData, usage_type: 'both' })
                  }
                  className="mr-2"
                />
                <span>{t('editSite.takeoffAndLanding')}</span>
              </label>
            </div>
          </div>

          {/* GPS Coordinates */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">
                {t('editSite.latitude')} *
              </label>
              <input
                type="number"
                step="0.0001"
                value={formData.latitude}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    latitude: parseFloat(e.target.value) || 0,
                  })
                }
                className="w-full px-3 py-2 border rounded"
                required
              />
              {errors.latitude && (
                <p className="text-red-500 text-xs mt-1">{errors.latitude}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">
                {t('editSite.longitude')} *
              </label>
              <input
                type="number"
                step="0.0001"
                value={formData.longitude}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    longitude: parseFloat(e.target.value) || 0,
                  })
                }
                className="w-full px-3 py-2 border rounded"
                required
              />
              {errors.longitude && (
                <p className="text-red-500 text-xs mt-1">{errors.longitude}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">
                {t('editSite.elevation')}
              </label>
              <input
                type="number"
                value={formData.elevation_m}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    elevation_m: parseInt(e.target.value) || 0,
                  })
                }
                className="w-full px-3 py-2 border rounded"
              />
            </div>
          </div>

          {/* Region & Country */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">{t('editSite.region')}</label>
              <input
                type="text"
                value={formData.region}
                onChange={(e) =>
                  setFormData({ ...formData, region: e.target.value })
                }
                className="w-full px-3 py-2 border rounded"
                placeholder={t('editSite.regionPlaceholder')}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">{t('editSite.country')}</label>
              <select
                value={formData.country}
                onChange={(e) =>
                  setFormData({ ...formData, country: e.target.value })
                }
                className="w-full px-3 py-2 border rounded"
              >
                <option value="FR">{t('editSite.france')}</option>
                <option value="CH">{t('editSite.switzerland')}</option>
                <option value="IT">{t('editSite.italy')}</option>
                <option value="ES">{t('editSite.spain')}</option>
              </select>
            </div>
          </div>

          {/* Orientation */}
          <div>
            <label className="block text-sm font-medium mb-1">
              {t('editSite.orientation')}
            </label>
            <select
              value={formData.orientation}
              onChange={(e) =>
                setFormData({ ...formData, orientation: e.target.value })
              }
              className="w-full px-3 py-2 border rounded"
            >
              <option value="">{t('editSite.undefined')}</option>
              <option value="N">Nord (N)</option>
              <option value="NE">Nord-Est (NE)</option>
              <option value="E">Est (E)</option>
              <option value="SE">Sud-Est (SE)</option>
              <option value="S">Sud (S)</option>
              <option value="SW">Sud-Ouest (SW)</option>
              <option value="W">Ouest (W)</option>
              <option value="NW">Nord-Ouest (NW)</option>
            </select>
          </div>

          {/* Camera Settings */}
          <div className="p-3 bg-blue-50 rounded border border-blue-200">
            <h4 className="text-sm font-semibold mb-3">
              📷 {t('editSite.camera3D')}
            </h4>

            <div className="mb-3">
              <label className="block text-sm mb-1">
                {t('editSite.angle')}: {formData.camera_angle}°
              </label>
              <input
                type="range"
                min="0"
                max="360"
                step="5"
                value={formData.camera_angle}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    camera_angle: parseInt(e.target.value),
                  })
                }
                className="w-full"
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>0° (N)</span>
                <span>90° (E)</span>
                <span>180° (S)</span>
                <span>270° (W)</span>
              </div>
            </div>

            <div>
              <label className="block text-sm mb-1">
                {t('editSite.distance')}: {formData.camera_distance}m
              </label>
              <input
                type="range"
                min="100"
                max="2000"
                step="50"
                value={formData.camera_distance}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    camera_distance: parseInt(e.target.value),
                  })
                }
                className="w-full"
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>100m</span>
                <span>2000m</span>
              </div>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium mb-1">
              {t('editSite.description')}
            </label>
            <textarea
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              className="w-full px-3 py-2 border rounded"
              rows={3}
              placeholder={t('editSite.additionalInfo')}
            />
          </div>

          {/* Landing Associations - only for takeoff sites in edit mode */}
          {site &&
            (formData.usage_type === 'takeoff' ||
              formData.usage_type === 'both') && (
              <LandingAssociationsManager takeoffSiteId={site.id} />
            )}

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300"
              disabled={isSaving}
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              disabled={isSaving}
            >
              {isSaving ? `⏳ ${t('editSite.saving')}` : `💾 ${t('editSite.saveButton')}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
