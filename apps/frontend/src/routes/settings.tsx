import { createFileRoute } from '@tanstack/react-router';
import { requireAuth } from '../lib/authGuard';

export const settingsTabs = [
  'general',
  'sites',
  'weather',
  'sportstracklive',
  'data',
] as const;

export type SettingsTabKey = (typeof settingsTabs)[number];

export function validateSettingsSearch(search: Record<string, unknown>) {
  return {
    tab: settingsTabs.includes(search.tab as SettingsTabKey)
      ? (search.tab as SettingsTabKey)
      : undefined,
  };
}

export const Route = createFileRoute('/settings')({
  validateSearch: validateSettingsSearch,
  beforeLoad: requireAuth,
});
