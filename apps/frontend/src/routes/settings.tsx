import { createFileRoute } from '@tanstack/react-router';
import { requireAuth } from '../lib/authGuard';

export const settingsTabs = [
  'general',
  'sites',
  'sportstracklive',
  'data',
] as const;

export type SettingsTabKey = (typeof settingsTabs)[number];
type SettingsSearchTabKey = SettingsTabKey | 'weather';
const settingsSearchTabs: readonly SettingsSearchTabKey[] = [
  ...settingsTabs,
  'weather',
];

export function validateSettingsSearch(search: Record<string, unknown>) {
  return {
    tab: settingsSearchTabs.includes(search.tab as SettingsSearchTabKey)
      ? (search.tab as SettingsSearchTabKey)
      : undefined,
  };
}

export const Route = createFileRoute('/settings')({
  validateSearch: validateSettingsSearch,
  beforeLoad: requireAuth,
});
