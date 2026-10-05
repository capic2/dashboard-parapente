import { useState } from 'react';
import { TextArea, TextField } from 'react-aria-components';
import { Button } from '@dashboard-parapente/design-system';

const FLIGHT_TAGS = [
  'vol tranquille',
  'progression',
  'thermique',
  'cross',
  'école',
] as const;

type Props = {
  tags: string[];
  feedback: string | null | undefined;
  isSaving: boolean;
  onSave: (tags: string[], feedback: string) => Promise<void>;
};

export function FlightPilotContextSection({
  tags,
  feedback,
  isSaving,
  onSave,
}: Props) {
  const [selectedTags, setSelectedTags] = useState(tags);
  const [feedbackText, setFeedbackText] = useState(feedback ?? '');

  const toggleTag = (tag: string) =>
    setSelectedTags((current) =>
      current.includes(tag)
        ? current.filter((item) => item !== tag)
        : [...current, tag]
    );

  return (
    <section className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-900/50">
      <div>
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
          Contexte pilote
        </h3>
        <p className="text-xs text-slate-600 dark:text-slate-300">
          Classez le vol et notez l’écart éventuel entre la prévision et le
          réel.
        </p>
      </div>
      <div className="flex flex-wrap gap-2" aria-label="Tags du vol">
        {FLIGHT_TAGS.map((tag) => {
          const selected = selectedTags.includes(tag);
          return (
            <button
              key={tag}
              type="button"
              onClick={() => toggleTag(tag)}
              aria-pressed={selected}
              className={`cursor-pointer rounded-full border px-3 py-1 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 ${selected ? 'border-sky-600 bg-sky-600 text-white' : 'border-slate-300 bg-white text-slate-700 hover:border-sky-400 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200'}`}
            >
              {tag}
            </button>
          );
        })}
      </div>
      <TextField value={feedbackText} onChange={setFeedbackText}>
        <TextArea
          rows={3}
          aria-label="Retour sur les conditions"
          placeholder="Ex. vent réel plus fort que prévu, créneau confortable…"
          className="w-full resize-none rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/30 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
        />
      </TextField>
      <Button
        onPress={() => void onSave(selectedTags, feedbackText)}
        isDisabled={isSaving}
        className="min-h-10 rounded-lg bg-sky-600 px-3 py-2 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-50"
      >
        Enregistrer le contexte
      </Button>
    </section>
  );
}
