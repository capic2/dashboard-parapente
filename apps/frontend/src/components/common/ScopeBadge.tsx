import { useTranslation } from 'react-i18next';

export type ScopeLabel = 'backendFrontend' | 'frontendOnly';

interface ScopeBadgeProps {
  scope: ScopeLabel;
}

export default function ScopeBadge({ scope }: ScopeBadgeProps) {
  const { t } = useTranslation();
  const scopeLabel =
    scope === 'frontendOnly'
      ? t('settings.scope.frontendOnly')
      : t('settings.scope.backendFrontend');
  const scopeHint =
    scope === 'frontendOnly'
      ? t('settings.scope.frontendOnlyHint')
      : t('settings.scope.backendFrontendHint');

  return (
    <span className="inline-flex items-center gap-1">
      <span
        title={scopeHint}
        aria-label={`${scopeLabel}. ${scopeHint}`}
        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${
          scope === 'frontendOnly'
            ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'
            : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300'
        }`}
      >
        {scopeLabel}
      </span>
      <span
        title={scopeHint}
        aria-hidden="true"
        className="hidden md:inline-flex h-4 w-4 items-center justify-center rounded-full border border-gray-300 text-[10px] font-semibold text-gray-500 dark:border-gray-600 dark:text-gray-300"
      >
        i
      </span>
    </span>
  );
}
