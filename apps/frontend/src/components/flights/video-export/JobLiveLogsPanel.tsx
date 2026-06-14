import { Button } from '@dashboard-parapente/design-system';

type JobLiveLogsPanelProps = {
  title: string;
  emptyLabel: string;
  showLabel: string;
  hideLabel: string;
  isOpen: boolean;
  onToggle: () => void;
  logs?: string[] | null;
  className?: string;
};

export function JobLiveLogsPanel({
  title,
  emptyLabel,
  showLabel,
  hideLabel,
  isOpen,
  onToggle,
  logs,
  className = '',
}: JobLiveLogsPanelProps) {
  const lines = logs?.filter(Boolean) ?? [];

  return (
    <div
      className={`rounded-lg border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900/60 ${className}`}
    >
      <Button
        type="button"
        variant="ghost"
        className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
        onPress={onToggle}
        aria-expanded={isOpen}
      >
        <span>{title}</span>
        <span className="text-slate-500 dark:text-slate-400">
          {isOpen ? hideLabel : showLabel}
        </span>
      </Button>
      {isOpen && (
        <pre className="max-h-64 overflow-auto border-t border-slate-200 p-3 text-xs leading-relaxed text-slate-800 dark:border-slate-700 dark:text-slate-100">
          {lines.length > 0 ? lines.join('\n') : emptyLabel}
        </pre>
      )}
    </div>
  );
}
