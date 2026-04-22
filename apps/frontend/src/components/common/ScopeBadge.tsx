export type ScopeLabel = 'Backend + Frontend' | 'Frontend only';

interface ScopeBadgeProps {
  scope: ScopeLabel;
}

export default function ScopeBadge({ scope }: ScopeBadgeProps) {
  const scopeHint =
    scope === 'Frontend only'
      ? 'Impacte uniquement les libelles et raisons affiches dans l interface.'
      : 'Impacte le calcul backend et l affichage frontend.';

  return (
    <span className="inline-flex items-center gap-1">
      <span
        title={scopeHint}
        aria-label={`${scope}. ${scopeHint}`}
        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${
          scope === 'Frontend only'
            ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'
            : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300'
        }`}
      >
        {scope}
      </span>
      <span
        title={scopeHint}
        aria-label={scopeHint}
        className="hidden md:inline-flex h-4 w-4 items-center justify-center rounded-full border border-gray-300 text-[10px] font-semibold text-gray-500 dark:border-gray-600 dark:text-gray-300"
      >
        i
      </span>
    </span>
  );
}
