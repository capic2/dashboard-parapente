import { useTranslation } from 'react-i18next';
import { TextArea, TextField } from 'react-aria-components';
import { Button } from '@dashboard-parapente/design-system';

interface FlightNotesSectionProps {
  notes: string | null | undefined;
  editingNotes: boolean;
  notesText: string;
  isSaving: boolean;
  onNotesTextChange: (value: string) => void;
  onStartEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
}

export function FlightNotesSection({
  notes,
  editingNotes,
  notesText,
  isSaving,
  onNotesTextChange,
  onStartEdit,
  onSave,
  onCancel,
}: FlightNotesSectionProps) {
  const { t } = useTranslation();

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <label
          htmlFor="flight-notes"
          className="block text-sm font-semibold text-gray-700 dark:text-gray-300"
        >
          {t('flights.notesLabel')}
        </label>
        {!editingNotes && (
          <Button
            variant="ghost"
            className="min-h-8 cursor-pointer rounded-md px-2 py-1 text-xs"
            onPress={onStartEdit}
          >
            {t('flights.editButton')}
          </Button>
        )}
      </div>
      {editingNotes ? (
        <div className="space-y-2">
          <TextField value={notesText} onChange={onNotesTextChange}>
            <TextArea
              id="flight-notes"
              placeholder={t('flights.notesPlaceholder')}
              rows={4}
              className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
            />
          </TextField>
          <div className="flex gap-2">
            <Button
              className="rounded-md bg-green-600 px-4 py-2 text-sm text-white transition-all hover:bg-green-700 disabled:opacity-50"
              onPress={onSave}
              isDisabled={isSaving}
            >
              {isSaving ? t('flights.saving') : t('flights.saveButton')}
            </Button>
            <Button
              className="rounded-md bg-gray-200 px-4 py-2 text-sm text-gray-700 transition-all hover:bg-gray-300 dark:bg-gray-600 dark:text-gray-300 dark:hover:bg-gray-500"
              onPress={onCancel}
            >
              {t('flights.cancel')}
            </Button>
          </div>
        </div>
      ) : (
        <p className="rounded-lg bg-gray-50 p-3 text-sm text-gray-600 dark:bg-gray-900 dark:text-gray-300">
          {notes ?? t('flights.noNotes')}
        </p>
      )}
    </div>
  );
}
