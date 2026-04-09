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
  Button,
} from 'react-aria-components';
import { Select } from '@dashboard-parapente/design-system';
import type { Key } from 'react-aria-components';
import type { Flight, FlightFormData, Site } from '../../types';

interface FlightEditFormProps {
  flight: Flight;
  sites: Site[];
  onSubmit: (values: FlightFormData) => Promise<void>;
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
        button: 'px-3 py-1 text-xs',
      },
      md: {
        input: 'px-3 py-2',
        label: 'text-sm font-semibold',
        button: 'px-3 py-1.5',
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
  onSubmit,
  onCancel,
  onShowCreateSiteModal,
}: FlightEditFormProps) {
  const { t } = useTranslation();

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
      await onSubmit({
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
      });
    },
  });

  const handleCancel = () => {
    form.reset();
    onCancel();
  };

  const siteOptions = sites.map((site) => ({
    id: site.id,
    label: site.name,
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
      <div className="flex justify-between items-start mb-4">
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

        <div className="flex gap-2 ml-4">
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

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
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
                value={
                  field.state.value
                    ? new Date(field.state.value).toLocaleTimeString('en-GB', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : ''
                }
                onChange={(v) => {
                  if (v) {
                    const [hours, minutes] = v.split(':');
                    const flightDate = form.getFieldValue('flight_date');
                    const newDateTime = new Date(flightDate);
                    newDateTime.setHours(
                      parseInt(hours),
                      parseInt(minutes),
                      0,
                      0
                    );
                    field.handleChange(newDateTime.toISOString());
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
              <div className="flex gap-2 mt-1">
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
    </Form>
  );
}
