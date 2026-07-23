import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Form,
  Input,
  Label,
  NumberField,
  TextArea,
  TextField,
  type Key,
} from 'react-aria-components';
import {
  CheckCircle2,
  CircleAlert,
  FileCheck2,
  FilePenLine,
  Info,
  LoaderCircle,
  Upload,
} from 'lucide-react';
import {
  Button,
  Modal,
  Select,
  Tab,
  TabList,
  TabPanel,
  Tabs,
} from '@dashboard-parapente/design-system';
import {
  useCreateFlight,
  useCreateFlightFromGPX,
} from '../../../hooks/flights/useFlights';
import { useToast } from '../../../hooks/useToast';
import type { Flight, FlightFormData, Site } from '../../../types';
import { formatFlightSiteLabel } from '../siteDisplay';

interface CreateFlightModalProps {
  isOpen: boolean;
  sites: Site[];
  onClose: () => void;
  onCreateComplete: () => void;
}

type CreationMode = 'manual' | 'file';

const inputClassName =
  'mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition-shadow focus-visible:border-transparent focus-visible:ring-2 focus-visible:ring-sky-600 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100';

function todayAsInputDate() {
  const today = new Date();
  const offset = today.getTimezoneOffset() * 60_000;
  return new Date(today.getTime() - offset).toISOString().slice(0, 10);
}

const initialManualValues = (): FlightFormData => ({
  title: '',
  site_id: null,
  flight_date: todayAsInputDate(),
  departure_time: null,
  duration_minutes: null,
  max_altitude_m: null,
  max_speed_kmh: null,
  distance_km: null,
  elevation_gain_m: null,
  notes: '',
});

export function CreateFlightModal({
  isOpen,
  sites,
  onClose,
  onCreateComplete,
}: CreateFlightModalProps) {
  const { t } = useTranslation();
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<CreationMode>('manual');
  const [manualValues, setManualValues] = useState(initialManualValues);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [createdFlight, setCreatedFlight] = useState<Flight | null>(null);
  const [error, setError] = useState<string | null>(null);
  const manualMutation = useCreateFlight();
  const fileMutation = useCreateFlightFromGPX();
  const isPending = manualMutation.isPending || fileMutation.isPending;

  const siteOptions = sites.map((site) => ({
    id: site.id,
    label: formatFlightSiteLabel({
      siteId: site.id,
      siteName: site.name,
      sites,
    }),
  }));
  const createdFlightSiteLabel = createdFlight
    ? formatFlightSiteLabel({
        siteId: createdFlight.site_id,
        siteName: createdFlight.site_name,
        sites,
      })
    : '';

  const reset = () => {
    setMode('manual');
    setManualValues(initialManualValues());
    setSelectedFile(null);
    setCreatedFlight(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSuccess = (flight: Flight) => {
    setCreatedFlight(flight);
    setError(null);
    toast.success(
      `${t('flights.createdSuccess')} ${flight.name || t('flights.unnamed')}`
    );
    onCreateComplete();
  };

  const handleError = (mutationError: Error) => {
    const message = mutationError.message || t('flights.createGenericError');
    setError(message);
    toast.error(`${t('flights.createFailure')} ${message}`);
  };

  const handleManualSubmit = () => {
    const departureTime = manualValues.departure_time
      ? `${manualValues.flight_date}T${manualValues.departure_time}:00`
      : null;
    manualMutation.mutate(
      { ...manualValues, departure_time: departureTime },
      { onSuccess: handleSuccess, onError: handleError }
    );
  };

  const handleFileSubmit = () => {
    if (!selectedFile) return;
    const formData = new FormData();
    formData.append('gpx_file', selectedFile);
    fileMutation.mutate(formData, {
      onSuccess: (result) => handleSuccess(result.flight),
      onError: handleError,
    });
  };

  const handleClose = () => {
    if (isPending) return;
    reset();
    onClose();
  };

  const setNumericValue = (
    field: keyof Pick<
      FlightFormData,
      | 'duration_minutes'
      | 'distance_km'
      | 'max_altitude_m'
      | 'max_speed_kmh'
      | 'elevation_gain_m'
    >,
    value: number
  ) => {
    setManualValues((current) => ({
      ...current,
      [field]: Number.isNaN(value) ? null : value,
    }));
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={t('flights.createFlight')}
      size="lg"
    >
      <Tabs
        selectedKey={mode}
        onSelectionChange={(key) => {
          if (isPending) return;
          setMode(String(key) as CreationMode);
          setError(null);
          setCreatedFlight(null);
        }}
      >
        <TabList aria-label={t('flights.creationMethod')}>
          <Tab id="manual">
            <span className="inline-flex items-center gap-2">
              <FilePenLine className="h-4 w-4" aria-hidden="true" />
              {t('flights.manualEntry')}
            </span>
          </Tab>
          <Tab id="file">
            <span className="inline-flex items-center gap-2">
              <Upload className="h-4 w-4" aria-hidden="true" />
              {t('flights.importFile')}
            </span>
          </Tab>
        </TabList>

        <TabPanel id="manual">
          <Form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              handleManualSubmit();
            }}
          >
            <p className="text-sm text-gray-600 dark:text-gray-300">
              {t('flights.manualCreateDescription')}
            </p>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <TextField
                className="sm:col-span-2"
                value={manualValues.title}
                onChange={(title) =>
                  setManualValues((current) => ({ ...current, title }))
                }
              >
                <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {t('flights.flightTitle')}
                </Label>
                <Input
                  className={inputClassName}
                  placeholder={t('flights.manualTitlePlaceholder')}
                />
              </TextField>

              <TextField
                isRequired
                value={manualValues.flight_date}
                onChange={(flightDate) =>
                  setManualValues((current) => ({
                    ...current,
                    flight_date: flightDate,
                  }))
                }
              >
                <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {t('flights.dateLabel')}
                </Label>
                <Input
                  type="date"
                  max={todayAsInputDate()}
                  className={inputClassName}
                />
              </TextField>

              <TextField
                value={manualValues.departure_time ?? ''}
                onChange={(departureTime) =>
                  setManualValues((current) => ({
                    ...current,
                    departure_time: departureTime || null,
                  }))
                }
              >
                <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {t('flights.departureTime')}
                </Label>
                <Input type="time" className={inputClassName} />
              </TextField>

              <div className="sm:col-span-2">
                <Select
                  label={t('flights.siteLabel')}
                  options={siteOptions}
                  value={manualValues.site_id}
                  onChange={(siteId: Key | null) =>
                    setManualValues((current) => ({
                      ...current,
                      site_id: siteId ? String(siteId) : null,
                    }))
                  }
                  placeholder={t('flights.notSpecified')}
                />
              </div>
            </div>

            <fieldset className="rounded-xl border border-gray-200 p-4 dark:border-gray-700">
              <legend className="px-1 text-sm font-semibold text-gray-800 dark:text-gray-200">
                {t('flights.optionalStats')}
              </legend>
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
                {(
                  [
                    ['duration_minutes', 'durationLabel', 1],
                    ['distance_km', 'distanceLabel', 0.1],
                    ['max_altitude_m', 'maxAltitudeLabel', 1],
                    ['max_speed_kmh', 'maxSpeedLabel', 0.1],
                    ['elevation_gain_m', 'elevationGainLabel', 1],
                  ] as const
                ).map(([field, label, step]) => (
                  <NumberField
                    key={field}
                    value={manualValues[field] ?? undefined}
                    minValue={0}
                    step={step}
                    onChange={(value) => setNumericValue(field, value)}
                  >
                    <Label className="text-xs font-medium text-gray-600 dark:text-gray-300">
                      {t(`flights.${label}`)}
                    </Label>
                    <Input className={inputClassName} />
                  </NumberField>
                ))}
              </div>
            </fieldset>

            <TextField
              value={manualValues.notes ?? ''}
              onChange={(notes) =>
                setManualValues((current) => ({ ...current, notes }))
              }
            >
              <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {t('flights.notesLabel')}
              </Label>
              <TextArea
                rows={3}
                className={inputClassName}
                placeholder={t('flights.notesPlaceholder')}
              />
            </TextField>

            <ModalFeedback
              flight={createdFlight}
              siteLabel={createdFlightSiteLabel}
              error={error}
            />

            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Button
                onClick={handleClose}
                variant="secondary"
                isDisabled={isPending}
              >
                {t('common.cancel')}
              </Button>
              <Button
                type="submit"
                isDisabled={isPending || !manualValues.flight_date}
              >
                {isPending ? (
                  <LoaderCircle
                    className="mr-2 inline h-4 w-4 animate-spin"
                    aria-hidden="true"
                  />
                ) : null}
                {isPending ? t('flights.creating') : t('flights.createButton')}
              </Button>
            </div>
          </Form>
        </TabPanel>

        <TabPanel id="file">
          <div className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-300">
              {t('flights.createDescription')}
            </p>
            <div>
              <label
                htmlFor="gpx-file-input"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                {t('flights.gpxFile')}
              </label>
              <input
                id="gpx-file-input"
                ref={fileInputRef}
                type="file"
                accept=".gpx,.igc"
                aria-label={t('flights.gpxFile')}
                disabled={isPending}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (!file) return;
                  const fileName = file.name.toLowerCase();
                  if (
                    !fileName.endsWith('.gpx') &&
                    !fileName.endsWith('.igc')
                  ) {
                    toast.error(t('flights.selectValidFile'));
                    return;
                  }
                  setSelectedFile(file);
                  setError(null);
                }}
                className="mt-1 block w-full cursor-pointer text-sm text-gray-500 file:mr-4 file:cursor-pointer file:rounded-lg file:border-0 file:bg-sky-50 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-sky-700 hover:file:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-50 dark:text-gray-400 dark:file:bg-sky-900/30 dark:file:text-sky-300"
              />
            </div>
            {selectedFile ? (
              <p className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                <FileCheck2
                  className="h-4 w-4 text-green-600"
                  aria-hidden="true"
                />
                {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
              </p>
            ) : null}
            <div className="flex gap-2 rounded-lg border border-sky-200 bg-sky-50 p-3 text-sm text-sky-900 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-200">
              <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <p>{t('flights.autoDetectionText')}</p>
            </div>

            <ModalFeedback
              flight={createdFlight}
              siteLabel={createdFlightSiteLabel}
              error={error}
            />

            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Button
                onClick={handleClose}
                variant="secondary"
                isDisabled={isPending}
              >
                {t('common.cancel')}
              </Button>
              <Button
                onClick={handleFileSubmit}
                isDisabled={isPending || !selectedFile}
              >
                {isPending ? (
                  <LoaderCircle
                    className="mr-2 inline h-4 w-4 animate-spin"
                    aria-hidden="true"
                  />
                ) : (
                  <Upload className="mr-2 inline h-4 w-4" aria-hidden="true" />
                )}
                {isPending ? t('flights.creating') : t('flights.createButton')}
              </Button>
            </div>
          </div>
        </TabPanel>
      </Tabs>
    </Modal>
  );
}

function ModalFeedback({
  flight,
  siteLabel,
  error,
}: {
  flight: Flight | null;
  siteLabel: string;
  error: string | null;
}) {
  const { t } = useTranslation();

  if (error) {
    return (
      <div className="flex gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-red-800 dark:border-red-800 dark:bg-red-950/30 dark:text-red-200">
        <CircleAlert className="h-5 w-5 shrink-0" aria-hidden="true" />
        <div>
          <p className="font-semibold">{t('flights.createError')}</p>
          <p className="text-sm">{error}</p>
        </div>
      </div>
    );
  }

  if (!flight) return null;
  return (
    <div className="flex gap-3 rounded-lg border border-green-200 bg-green-50 p-4 text-green-800 dark:border-green-800 dark:bg-green-950/30 dark:text-green-200">
      <CheckCircle2 className="h-5 w-5 shrink-0" aria-hidden="true" />
      <div>
        <p className="font-semibold">{t('flights.createSuccess')}</p>
        <p className="text-sm">
          {flight.name || t('flights.unnamed')}
          {siteLabel ? ` · ${siteLabel}` : ''}
        </p>
      </div>
    </div>
  );
}
