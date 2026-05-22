import preview from '../../../.storybook/preview';
import { Card } from './Card';

const meta = preview.meta({
  title: 'Components/UI/Card',
  component: Card,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Reusable surface card with neutral, selected, and interactive states for compact dashboard content.',
      },
    },
  },
  tags: ['autodocs'],
});

export const Default = meta.story({
  name: 'Default',
  render: () => (
    <Card className="w-80">
      <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
        Vol thermique
      </h3>
      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
        Surface neutre pour contenu compact.
      </p>
    </Card>
  ),
});

export const Interactive = meta.story({
  name: 'Interactive',
  render: () => (
    <Card interactive className="w-80" tabIndex={0}>
      <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
        Carte cliquable
      </h3>
      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
        Hover, focus clavier et curseur sont visibles.
      </p>
    </Card>
  ),
});

export const Selected = meta.story({
  name: 'Selected',
  render: () => (
    <Card selected interactive className="w-80" tabIndex={0}>
      <span className="inline-flex rounded-full bg-sky-700 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-white dark:bg-sky-300 dark:text-sky-950">
        Actif
      </span>
      <h3 className="mt-2 text-sm font-semibold text-sky-950 dark:text-white">
        Vol selectionne
      </h3>
      <p className="mt-1 text-xs text-sky-800 dark:text-sky-100">
        Etat selectionne fort pour les listes de dashboard.
      </p>
    </Card>
  ),
});
