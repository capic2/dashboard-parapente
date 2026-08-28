import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useForm } from '@tanstack/react-form';
import { tv } from 'tailwind-variants';
import {
  Form,
  TextField,
  NumberField,
  Label,
  Input,
  TextArea,
} from 'react-aria-components';
import { Select, Button } from '@dashboard-parapente/design-system';
import type { YoutubeVideoAssociation } from '@dashboard-parapente/shared-types';
import type { Key } from 'react-aria-components';
import type { Flight, FlightFormData, Site } from '../../../types';
import { getSiteDisplayName } from '../../../lib/siteDisplay';
import { Plus, Trash2 } from 'lucide-react';
import { YoutubeAssociationRemovalModal } from '../YoutubeAssociationRemovalModal';

export interface PendingYoutubeRemoval {
  url: string;
  videoId: string;
  deleteFromYoutube: boolean;
}

export interface FlightEditSubmission {
  values: FlightFormData;
  pendingYoutubeRemovals: PendingYoutubeRemoval[];
}

interface YoutubeUrlRow {
  id: string;
  value: string;
  originalUrl?: string;
}

const EMPTY_YOUTUBE_ASSOCIATIONS: YoutubeVideoAssociation[] = [];

interface FlightEditFormProps {
  flight: Flight;
  sites: Site[];
  youtubeAssociations?: YoutubeVideoAssociation[];
  onSubmit: (submission: FlightEditSubmission) => Promise<void>;
  onCancel: () => void;
  onShowCreateSiteModal: () => void;
}

const styles = tv({
  slots: {
    input:
      'block w-full mt-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-sky-600 dark:bg-gray-700 dark:text-gray-100',
    label: 'text-gray-600 dark:text-gray-300',
    button: 'rounded-md transition-all text-sm',
    error: 'text-sm text-red-500 dark:text-red-400 mb-4',
    textarea:
      'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-600 resize-none dark:bg-gray-700 dark:text-gray-100',
  },
  variants: {
    size: {
      sm: {
        input: 'px-2 py-1',
        label: 'text-xs',
        button: 'min-h-11 px-4 py-2.5 sm:min-h-0 sm:px-3 sm:py-1 text-xs',
      },
      md: {
        input: 'px-3 py-2',
        label: 'text-sm font-semibold',
        button: 'min-h-11 px-4 py-2.5 sm:min-h-0 sm:px-3 sm:py-1.5',
      },
    },
    intent: {
      primary: {
        button:
          'bg-green-600 text-white hover:bg-green-700 disabled:opacity-50',
      },
      secondary: {
        button:
          'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-500',
      },
      accent: {
        button: 'bg-green-500 text-white hover:bg-green-600',
      },
    },
  },
  defaultVariants: {
    size: 'sm',
  },
});

export function FlightEditForm({
  flight,
  sites,
  youtubeAssociations = EMPTY_YOUTUBE_ASSOCIATIONS,
  onSubmit,
  onCancel,
  onShowCreateSiteModal,
}: FlightEditFormProps) {
  const { t } = useTranslation();
  const initialYoutubeUrls = flight.youtube_urls ?? [];
  const initialYoutubeRows = initialYoutubeUrls.map((url, index) => ({
    id: `persisted-${index}`,
    value: url,
    originalUrl: url,
  }));
  const nextYoutubeRowId = useRef(0);
  const [youtubeRows, setYoutubeRows] =
    useState<YoutubeUrlRow[]>(initialYoutubeRows);
  const [pendingYoutubeRemovals, setPendingYoutubeRemovals] = useState<
    PendingYoutubeRemoval[]
  >([]);
  const [removalRow, setRemovalRow] = useState<YoutubeUrlRow | null>(null);
  const removalAssociation = removalRow?.originalUrl
    ? (youtubeAssociations.find(
        (association) => association.url === removalRow.originalUrl
      ) ?? null)
    : null;

  const form = useForm({
    defaultValues: {
      name: flight.name ?? '',
      title: flight.title ?? flight.name ?? '',
      site_id: flight.site_id ?? '',
      flight_date: flight.flight_date,
      departure_time: flight.departure_time ?? '',
      duration_minutes: flight.duration_minutes ?? 0,
      distance_km: flight.distance_km ?? 0,
      max_altitude_m: flight.max_altitude_m ?? 0,
      elevation_gain_m: flight.elevation_gain_m ?? 0,
      max_speed_kmh: flight.max_speed_kmh ?? 0,
      notes: flight.notes ?? '',
    },
    onSubmit: async ({ value }) => {
      const removedUrls = new Set(
        pendingYoutubeRemovals.map((removal) => removal.url)
      );
      await onSubmit({
        values: {
          name: value.name,
          title: value.title,
          site_id: value.site_id || null,
          flight_date: value.flight_date,
          departure_time: value.departure_time || null,
          duration_minutes: value.duration_minutes,
          max_altitude_m: value.max_altitude_m,
          distance_km: value.distance_km,
          elevation_gain_m: value.elevation_gain_m,
          max_speed_kmh: value.max_speed_kmh,
          notes: value.notes,
          youtube_urls: youtubeRows
            .map((row) => row.value.trim())
            .filter((url) => Boolean(url) && !removedUrls.has(url)),
        },
        pendingYoutubeRemovals,
      });
    },
  });

  const handleCancel = () => {
    form.reset();
    setYoutubeRows(initialYoutubeRows);
    setPendingYoutubeRemovals([]);
    setRemovalRow(null);
    onCancel();
  };

  const removeYoutubeRow = (row: YoutubeUrlRow) => {
    if (!row.originalUrl) {
      setYoutubeRows((rows) =>
        rows.filter((candidate) => candidate.id !== row.id)
      );
      return;
    }

    const association = youtubeAssociations.find(
      (candidate) => candidate.url === row.originalUrl
    );
    if (association) setRemovalRow(row);
  };

  const queueYoutubeRemoval = (deleteFromYoutube: boolean) => {
    if (!removalRow?.originalUrl || !removalAssociation) return;

    setPendingYoutubeRemovals((removals) => [
      ...removals,
      {
        url: removalRow.originalUrl as string,
        videoId: removalAssociation.video_id,
        deleteFromYoutube,
      },
    ]);
    setYoutubeRows((rows) =>
      rows.filter((candidate) => candidate.id !== removalRow.id)
    );
    setRemovalRow(null);
  };

  const siteOptions = sites.map((site) => ({
    id: site.id,
    label: getSiteDisplayName(site),
  }));

  const s = styles();
  const md = styles({ size: 'md' });

  return (
    <Form
      aria-label={t('flights.editFlight')}
      onSubmit={(e) => {
        e.preventDefault();
        void form.handleSubmit();
      }}
    >
      <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-start mb-4 gap-3">
        <div className="flex-1 space-y-2">
          <form.Field name="name">
            {(field) => (
              <TextField
                value={field.state.value}
                onChange={field.handleChange}
              >
                <Label className={s.label()}>{t('flights.flightName')}</Label>
                <Input
                  className={md.input()}
                  placeholder={t('flights.flightNamePlaceholder')}
                />
              </TextField>
            )}
          </form.Field>
          <form.Field name="title">
            {(field) => (
              <TextField
                value={field.state.value}
                onChange={field.handleChange}
              >
                <Label className={s.label()}>{t('flights.flightTitle')}</Label>
                <Input
                  className={md.input()}
                  placeholder={t('flights.flightTitle')}
                />
              </TextField>
            )}
          </form.Field>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 sm:ml-4 justify-end">
          <form.Subscribe selector={(state) => state.isSubmitting}>
            {(isSubmitting) => (
              <Button
                type="submit"
                className={styles({ intent: 'primary' }).button()}
                isDisabled={isSubmitting}
              >
                {isSubmitting ? t('flights.saving') : t('flights.saveButton')}
              </Button>
            )}
          </form.Subscribe>
          <Button
            className={styles({ intent: 'secondary' }).button()}
            onPress={handleCancel}
          >
            {t('flights.cancel')}
          </Button>
        </div>
      </div>

      {/* Error display */}
      <form.Subscribe selector={(state) => state.errorMap.onSubmit}>
        {(errorMap) =>
          errorMap ? (
            <p className={s.error()}>{t('flights.updateError')}</p>
          ) : null
        }
      </form.Subscribe>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 mb-4">
        {/* Date */}
        <div>
          <span className={s.label()}>{t('flights.dateLabel')}</span>
          <form.Field name="flight_date">
            {(field) => (
              <TextField
                value={field.state.value}
                onChange={field.handleChange}
              >
                <Input type="date" className={s.input()} />
              </TextField>
            )}
          </form.Field>
        </div>

        {/* Heure de départ */}
        <div>
          <span className={s.label()}>{t('flights.departureTime')}</span>
          <form.Field name="departure_time">
            {(field) => (
              <TextField
                value={field.state.value ? field.state.value.slice(11, 16) : ''}
                onChange={(v) => {
                  if (v) {
                    const flightDate = form.getFieldValue('flight_date');
                    field.handleChange(`${flightDate}T${v}:00`);
                  } else {
                    field.handleChange('');
                  }
                }}
              >
                <Input type="time" className={s.input()} />
              </TextField>
            )}
          </form.Field>
        </div>

        {/* Site */}
        <div className="col-span-2 md:col-span-3">
          <span className={s.label()}>{t('flights.siteLabel')}</span>
          <form.Field name="site_id">
            {(field) => (
              <div className="flex flex-col sm:flex-row gap-2 mt-1">
                <div className="flex-1">
                  <Select
                    label=""
                    options={siteOptions}
                    value={field.state.value ?? null}
                    onChange={(key: Key | null) =>
                      field.handleChange(key ? String(key) : '')
                    }
                    placeholder={t('flights.notSpecified')}
                  />
                </div>
                <Button
                  onPress={onShowCreateSiteModal}
                  aria-label={t('flights.createNewSite')}
                  className={
                    styles({ intent: 'accent', size: 'sm' }).button() +
                    ' whitespace-nowrap self-end'
                  }
                >
                  {t('flights.newSiteButton')}
                </Button>
              </div>
            )}
          </form.Field>
        </div>

        {/* Durée */}
        <form.Field name="duration_minutes">
          {(field) => (
            <div>
              <span className={s.label()}>{t('flights.durationLabel')}</span>
              <NumberField
                value={field.state.value}
                onChange={field.handleChange}
                minValue={0}
              >
                <Input className={s.input()} />
              </NumberField>
            </div>
          )}
        </form.Field>

        {/* Distance */}
        <form.Field name="distance_km">
          {(field) => (
            <div>
              <span className={s.label()}>{t('flights.distanceLabel')}</span>
              <NumberField
                value={field.state.value}
                onChange={field.handleChange}
                minValue={0}
                step={0.1}
              >
                <Input className={s.input()} />
              </NumberField>
            </div>
          )}
        </form.Field>

        {/* Altitude max */}
        <form.Field name="max_altitude_m">
          {(field) => (
            <div>
              <span className={s.label()}>{t('flights.maxAltitudeLabel')}</span>
              <NumberField
                value={field.state.value}
                onChange={field.handleChange}
                minValue={0}
              >
                <Input className={s.input()} />
              </NumberField>
            </div>
          )}
        </form.Field>

        {/* Dénivelé */}
        <form.Field name="elevation_gain_m">
          {(field) => (
            <div>
              <span className={s.label()}>
                {t('flights.elevationGainLabel')}
              </span>
              <NumberField
                value={field.state.value}
                onChange={field.handleChange}
                minValue={0}
              >
                <Input className={s.input()} />
              </NumberField>
            </div>
          )}
        </form.Field>

        {/* Vitesse max */}
        <form.Field name="max_speed_kmh">
          {(field) => (
            <div>
              <span className={s.label()}>{t('flights.maxSpeedLabel')}</span>
              <NumberField
                value={field.state.value}
                onChange={field.handleChange}
                minValue={0}
                step={0.1}
              >
                <Input className={s.input()} />
              </NumberField>
            </div>
          )}
        </form.Field>
      </div>

      <div className="mb-4 border-t border-gray-200 pt-4 dark:border-gray-700">
        <div className="mb-2 flex items-center justify-between gap-3">
          <div>
            <h3 className={md.label()}>{t('flights.youtubeVideos')}</h3>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {t('flights.youtubeVideosHint')}
            </p>
          </div>
          <Button
            variant="ghost"
            className="min-h-10 rounded-lg px-3 py-2 text-sm"
            onPress={() => {
              const id = nextYoutubeRowId.current++;
              setYoutubeRows((rows) => [
                ...rows,
                { id: `new-${id}`, value: '' },
              ]);
            }}
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            {t('flights.addYoutubeVideo')}
          </Button>
        </div>
        <div className="space-y-2">
          {youtubeRows.map((row, index) => (
            <div key={row.id} className="flex items-end gap-2">
              <TextField
                className="min-w-0 flex-1"
                value={row.value}
                onChange={(nextUrl) =>
                  setYoutubeRows((rows) =>
                    rows.map((candidate) =>
                      candidate.id === row.id
                        ? { ...candidate, value: nextUrl }
                        : candidate
                    )
                  )
                }
              >
                <Label className={s.label()}>
                  {t('flights.youtubeVideoLabel', { count: index + 1 })}
                </Label>
                <Input
                  type="url"
                  className={md.input()}
                  placeholder="https://www.youtube.com/watch?v=..."
                  readOnly={Boolean(row.originalUrl)}
                />
              </TextField>
              <Button
                variant="ghost"
                className="min-h-10 rounded-lg px-3 py-2 text-sm text-red-600 dark:text-red-400"
                aria-label={t('flights.removeYoutubeVideo', {
                  count: index + 1,
                })}
                isDisabled={
                  Boolean(row.originalUrl) &&
                  !youtubeAssociations.some(
                    (association) => association.url === row.originalUrl
                  )
                }
                onPress={() => removeYoutubeRow(row)}
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
          ))}
        </div>
      </div>

      {/* Notes */}
      <div>
        <label htmlFor="flight-notes" className={md.label() + ' mb-2 block'}>
          {t('flights.notesLabel')}
        </label>
        <form.Field name="notes">
          {(field) => (
            <TextField value={field.state.value} onChange={field.handleChange}>
              <TextArea
                id="flight-notes"
                placeholder={t('flights.notesPlaceholder')}
                rows={4}
                className={s.textarea()}
              />
            </TextField>
          )}
        </form.Field>
      </div>

      <YoutubeAssociationRemovalModal
        association={removalAssociation}
        isPending={false}
        onCancel={() => setRemovalRow(null)}
        onRemove={queueYoutubeRemoval}
      />
    </Form>
  );
}
