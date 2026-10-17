import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Switch } from 'react-aria-components';
import { Upload } from 'lucide-react';
import { Button } from '@dashboard-parapente/design-system';
import {
  useRemoveSportstrackliveSettings,
  useSaveSportstrackliveSettings,
  useSportstrackliveSettings,
} from '../../hooks/settings/useSportstrackliveSettings';
import { useToast } from '../../hooks/useToast';
import { getApiErrorMessage } from '../../lib/api';

export function SportstrackliveSettingsCard() {
  const { t } = useTranslation();
  const toast = useToast();
  const query = useSportstrackliveSettings();
  const save = useSaveSportstrackliveSettings();
  const remove = useRemoveSportstrackliveSettings();
  const [uploadKey, setUploadKey] = useState('');
  const [autoUpload, setAutoUpload] = useState(false);
  const [isConfirmingRemove, setIsConfirmingRemove] = useState(false);

  useEffect(() => {
    if (query.data) setAutoUpload(query.data.auto_upload);
  }, [query.data]);

  const handleSave = async () => {
    try {
      await save.mutateAsync({
        ...(uploadKey.trim() ? { upload_key: uploadKey.trim() } : {}),
        auto_upload: autoUpload,
      });
      setUploadKey('');
      toast.success(t('settings.sportstracklive.saved'));
    } catch (error) {
      toast.error(
        await getApiErrorMessage(error, t('settings.sportstracklive.saveError'))
      );
    }
  };

  const handleRemove = async () => {
    try {
      await remove.mutateAsync();
      setUploadKey('');
      setAutoUpload(false);
      setIsConfirmingRemove(false);
      toast.success(t('settings.sportstracklive.removed'));
    } catch (error) {
      toast.error(
        await getApiErrorMessage(
          error,
          t('settings.sportstracklive.removeError')
        )
      );
    }
  };

  return (
    <section className="rounded-2xl border border-sky-100 bg-white p-5 shadow-md shadow-sky-100/50 dark:border-gray-700 dark:bg-gray-800 dark:shadow-black/20 sm:p-6">
      <div className="mb-5 flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300">
          <Upload className="h-5 w-5" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <h2 className="text-lg font-bold text-gray-950 dark:text-white">
            {t('settings.sportstracklive.title')}
          </h2>
          <p className="mt-1 text-sm leading-5 text-gray-600 dark:text-gray-300">
            {t('settings.sportstracklive.description')}
          </p>
        </div>
      </div>

      {(() => {
        if (query.isLoading) {
          return (
            <output
              aria-live="polite"
              className="text-sm text-gray-600 dark:text-gray-300"
            >
              {t('settings.sportstracklive.loading')}
            </output>
          );
        }
        if (query.isError || !query.data) {
          return (
            <div
              role="alert"
              className="flex flex-wrap items-center gap-3 text-sm text-red-700 dark:text-red-300"
            >
              <span>{t('settings.sportstracklive.loadError')}</span>
              <Button
                variant="outline"
                onPress={() => void query.refetch()}
                isDisabled={query.isFetching}
              >
                {query.isFetching
                  ? t('settings.sportstracklive.loading')
                  : t('settings.sportstracklive.retry')}
              </Button>
            </div>
          );
        }
        return (
          <div className="space-y-5">
            <label className="block space-y-1.5">
              <span className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                {t('settings.sportstracklive.uploadKey')}
              </span>
              <input
                type="password"
                autoComplete="new-password"
                value={uploadKey}
                onChange={(event) => setUploadKey(event.target.value)}
                placeholder={
                  query.data?.upload_key_configured
                    ? t('settings.sportstracklive.keyAlreadySet')
                    : t('settings.sportstracklive.keyPlaceholder')
                }
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200 dark:border-gray-600 dark:bg-gray-900 dark:text-white dark:focus:ring-sky-900"
              />
              <span className="block text-xs text-gray-600 dark:text-gray-400">
                {t('settings.sportstracklive.uploadKeyHelp')}
              </span>
            </label>

            <output
              aria-live="polite"
              aria-atomic="true"
              className={`rounded-xl border p-3 text-sm ${
                query.data?.application_secret_configured
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200'
                  : 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200'
              }`}
            >
              {query.data?.application_secret_configured
                ? t('settings.sportstracklive.applicationSecretConfigured')
                : t('settings.sportstracklive.applicationSecretMissing')}
            </output>

            <Switch
              isSelected={autoUpload}
              onChange={setAutoUpload}
              isDisabled={
                !autoUpload &&
                (!query.data?.application_secret_configured ||
                  (!query.data?.upload_key_configured && !uploadKey.trim()))
              }
              className="group flex cursor-pointer items-center justify-between gap-4"
            >
              <span>
                <span className="block text-sm font-semibold text-gray-900 dark:text-white">
                  {t('settings.sportstracklive.autoUpload')}
                </span>
                <span className="mt-0.5 block text-xs text-gray-600 dark:text-gray-400">
                  {t('settings.sportstracklive.autoUploadHelp')}
                </span>
              </span>
              <span className="relative h-6 w-11 shrink-0 rounded-full bg-gray-300 transition-colors group-data-[selected]:bg-sky-600 dark:bg-gray-600">
                <span className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white transition-transform group-data-[selected]:translate-x-5" />
              </span>
            </Switch>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                onPress={() => void handleSave()}
                isDisabled={save.isPending}
              >
                {save.isPending
                  ? t('settings.sportstracklive.saving')
                  : t('settings.sportstracklive.saveSettings')}
              </Button>
              {query.data?.upload_key_configured && (
                <Button
                  variant="danger"
                  onPress={() => setIsConfirmingRemove(true)}
                  isDisabled={remove.isPending}
                >
                  {t('settings.sportstracklive.disconnect')}
                </Button>
              )}
              {remove.isPending && (
                <output
                  aria-live="polite"
                  aria-atomic="true"
                  className="text-sm text-gray-600 dark:text-gray-300"
                >
                  {t('settings.sportstracklive.removing')}
                </output>
              )}
            </div>
            {isConfirmingRemove && (
              <fieldset className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900 dark:border-red-900 dark:bg-red-950/30 dark:text-red-100">
                <legend className="sr-only">
                  {t('settings.sportstracklive.removeConfirmationTitle')}
                </legend>
                <p>{t('settings.sportstracklive.removeConfirmation')}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    onPress={() => void handleRemove()}
                    isDisabled={remove.isPending}
                  >
                    {t('settings.sportstracklive.confirmRemove')}
                  </Button>
                  <Button
                    variant="outline"
                    onPress={() => setIsConfirmingRemove(false)}
                    isDisabled={remove.isPending}
                  >
                    {t('common.cancel')}
                  </Button>
                </div>
              </fieldset>
            )}
            {save.isPending && (
              <output aria-live="polite" aria-atomic="true" className="sr-only">
                {t('settings.sportstracklive.saving')}
              </output>
            )}
          </div>
        );
      })()}
    </section>
  );
}
