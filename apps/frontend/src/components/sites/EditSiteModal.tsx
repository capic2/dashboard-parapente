import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { TextField, Label, Input, Button } from 'react-aria-components';
import type {
  Site,
  SiteUpdate,
  CreateSiteData,
} from '@dashboard-parapente/shared-types';
import { Modal } from '@dashboard-parapente/design-system';
import LandingAssociationsManager from './LandingAssociationsManager';

type SiteFormData = Required<SiteUpdate>;

const inputClass =
  'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded outline-none focus:ring-2 focus:ring-blue-500';
const labelClass = 'block text-sm font-medium mb-1 dark:text-gray-200';

interface EditSiteModalProps {
  site: Site | null; // null = create mode, Site = edit mode
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (data: SiteUpdate) => Promise<void>;
  onCreate: (data: CreateSiteData) => Promise<void>;
}

export const EditSiteModal: React.FC<EditSiteModalProps> = ({
  site,
  isOpen,
  onClose,
  onUpdate,
  onCreate,
}) => {
  const { t } = useTranslation();
  const [formData, setFormData] = useState<SiteFormData>({
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

  // Raw string values for numeric fields (avoids parsing on every keystroke)
  const [latitudeRaw, setLatitudeRaw] = useState('0');
  const [longitudeRaw, setLongitudeRaw] = useState('0');
  const [elevationRaw, setElevationRaw] = useState('0');

  const [originalData, setOriginalData] = useState<SiteFormData | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);

  // Initialize form when site changes or modal opens
  useEffect(() => {
    if (!isOpen) return;

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
      setLatitudeRaw(String(initialData.latitude));
      setLongitudeRaw(String(initialData.longitude));
      setElevationRaw(String(initialData.elevation_m));
    } else {
      // Reset for create mode
      setFormData({
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
      setOriginalData(null);
      setLatitudeRaw('');
      setLongitudeRaw('');
      setElevationRaw('');
    }
    setErrors({});
  }, [site, isOpen]);

  const parseNumericFields = () => {
    const lat = parseFloat(latitudeRaw) || 0;
    const lon = parseFloat(longitudeRaw) || 0;
    const elev = parseInt(elevationRaw) || 0;
    setFormData((prev) => ({
      ...prev,
      latitude: lat,
      longitude: lon,
      elevation_m: elev,
    }));
    return { latitude: lat, longitude: lon, elevation_m: elev };
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};
    const lat = parseFloat(latitudeRaw) || 0;
    const lon = parseFloat(longitudeRaw) || 0;

    if (!formData.name || formData.name.length < 2) {
      newErrors.name = t('editSite.nameMinLength');
    }

    if (lat < -90 || lat > 90) {
      newErrors.latitude = t('editSite.invalidLatitude');
    }

    if (lon < -180 || lon > 180) {
      newErrors.longitude = t('editSite.invalidLongitude');
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const parsed = parseNumericFields();

    if (!validate()) return;

    setIsSaving(true);
    try {
      if (originalData) {
        // Edit mode: only send changed fields
        const current = { ...formData, ...parsed };
        const changedData: SiteUpdate = {};
        for (const [key, value] of Object.entries(current)) {
          if (value !== originalData[key as keyof SiteFormData]) {
            (changedData as Record<string, unknown>)[key] = value;
          }
        }
        await onUpdate(changedData);
      } else {
        // Create mode: formData has all concrete values
        await onCreate({
          name: formData.name,
          latitude: parsed.latitude,
          longitude: parsed.longitude,
          ...(formData.code && { code: formData.code }),
          ...(parsed.elevation_m !== undefined && {
            elevation_m: parsed.elevation_m,
          }),
          ...(formData.region && { region: formData.region }),
          ...(formData.country && { country: formData.country }),
          ...(formData.orientation && { orientation: formData.orientation }),
          ...(formData.camera_angle !== undefined && {
            camera_angle: formData.camera_angle,
          }),
          ...(formData.camera_distance !== undefined && {
            camera_distance: formData.camera_distance,
          }),
          ...(formData.usage_type && { usage_type: formData.usage_type }),
          ...(formData.description && { description: formData.description }),
        });
      }
      onClose();
    } catch (error) {
      console.error('Failed to save site:', error);
      alert(t('editSite.saveError'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        site ? `${t('editSite.title')} ${site.name}` : t('editSite.newSite')
      }
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Nom */}
        <TextField
          isRequired
          value={formData.name}
          onChange={(v) => setFormData({ ...formData, name: v })}
          className="flex flex-col gap-1"
        >
          <Label className={labelClass}>{t('editSite.siteName')} *</Label>
          <Input className={inputClass} />
          {errors.name && (
            <p className="text-red-500 text-xs mt-1">{errors.name}</p>
          )}
        </TextField>

        {/* Code */}
        <TextField
          value={formData.code}
          onChange={(v) => setFormData({ ...formData, code: v })}
          isDisabled={!!site}
          className="flex flex-col gap-1"
        >
          <Label className={labelClass}>{t('editSite.code')}</Label>
          <Input
            className={`${inputClass} disabled:bg-gray-100 dark:disabled:bg-gray-600`}
          />
          {site && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {t('editSite.codeReadonly')}
            </p>
          )}
        </TextField>

        {/* Type de site */}
        <div>
          <label className="block text-sm font-medium mb-2 dark:text-gray-200">
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
          <TextField
            isRequired
            value={latitudeRaw}
            onChange={setLatitudeRaw}
            className="flex flex-col gap-1"
          >
            <Label className={labelClass}>{t('editSite.latitude')} *</Label>
            <Input type="number" step={0.0001} className={inputClass} />
            {errors.latitude && (
              <p className="text-red-500 text-xs mt-1">{errors.latitude}</p>
            )}
          </TextField>

          <TextField
            isRequired
            value={longitudeRaw}
            onChange={setLongitudeRaw}
            className="flex flex-col gap-1"
          >
            <Label className={labelClass}>{t('editSite.longitude')} *</Label>
            <Input type="number" step={0.0001} className={inputClass} />
            {errors.longitude && (
              <p className="text-red-500 text-xs mt-1">{errors.longitude}</p>
            )}
          </TextField>

          <TextField
            value={elevationRaw}
            onChange={setElevationRaw}
            className="flex flex-col gap-1"
          >
            <Label className={labelClass}>{t('editSite.elevation')}</Label>
            <Input type="number" className={inputClass} />
          </TextField>
        </div>

        {/* Region & Country */}
        <div className="grid grid-cols-2 gap-3">
          <TextField
            value={formData.region}
            onChange={(v) => setFormData({ ...formData, region: v })}
            className="flex flex-col gap-1"
          >
            <Label className={labelClass}>{t('editSite.region')}</Label>
            <Input
              className={inputClass}
              placeholder={t('editSite.regionPlaceholder')}
            />
          </TextField>

          <div>
            <label className="block text-sm font-medium mb-1 dark:text-gray-200">
              {t('editSite.country')}
            </label>
            <select
              value={formData.country}
              onChange={(e) =>
                setFormData({ ...formData, country: e.target.value })
              }
              className={inputClass}
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
          <label className="block text-sm font-medium mb-1 dark:text-gray-200">
            {t('editSite.orientation')}
          </label>
          <select
            value={formData.orientation}
            onChange={(e) =>
              setFormData({ ...formData, orientation: e.target.value })
            }
            className={inputClass}
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
        <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded border border-blue-200 dark:border-blue-700">
          <h4 className="text-sm font-semibold mb-3 dark:text-gray-200">
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
              value={formData.camera_angle ?? 180}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  camera_angle: parseInt(e.target.value),
                })
              }
              className="w-full"
            />
            <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
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
              value={formData.camera_distance ?? 500}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  camera_distance: parseInt(e.target.value),
                })
              }
              className="w-full"
            />
            <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
              <span>100m</span>
              <span>2000m</span>
            </div>
          </div>
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium mb-1 dark:text-gray-200">
            {t('editSite.description')}
          </label>
          <textarea
            value={formData.description}
            onChange={(e) =>
              setFormData({ ...formData, description: e.target.value })
            }
            className={inputClass}
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
        <div className="flex gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
          <Button
            type="button"
            onPress={onClose}
            className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-100 rounded hover:bg-gray-300 dark:hover:bg-gray-500 cursor-pointer"
            isDisabled={isSaving}
          >
            {t('common.cancel')}
          </Button>
          <Button
            type="submit"
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
            isDisabled={isSaving}
          >
            {isSaving
              ? `⏳ ${t('editSite.saving')}`
              : `💾 ${t('editSite.saveButton')}`}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
