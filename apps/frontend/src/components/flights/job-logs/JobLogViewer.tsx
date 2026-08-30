import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { parseApiUtcDate } from '../../../lib/date';
import {
  AlertCircle,
  CheckCircle2,
  Info,
  Terminal,
  TriangleAlert,
} from 'lucide-react';

type LogTone = 'error' | 'info' | 'success' | 'warning';

type JobLogViewerProps = {
  logs?: string[] | null;
  emptyLabel: string;
  isLive?: boolean;
};

const LOG_LINE_PATTERN = /^\[([^\u005d]+)\]\s*(.*)$/u;

const toneStyles: Record<LogTone, string> = {
  error:
    'border-red-200 bg-red-50 text-red-900 dark:border-red-900/80 dark:bg-red-950/30 dark:text-red-100',
  warning:
    'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/80 dark:bg-amber-950/30 dark:text-amber-100',
  success:
    'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/80 dark:bg-emerald-950/30 dark:text-emerald-100',
  info: 'border-slate-200 bg-white text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100',
};

const toneFallbacks: Record<LogTone, string> = {
  error: 'Error',
  info: 'Information',
  success: 'Success',
  warning: 'Warning',
};

function getLogTone(message: string): LogTone {
  if (/\b(error|failed|failure|fatal|timeout|timed out)\b/iu.test(message)) {
    return 'error';
  }
  if (
    /\b(warn|warning|cancelled|retry|missing|still loading)\b/iu.test(message)
  ) {
    return 'warning';
  }
  if (
    /\b(completed|ready|encoded|created|configured|prepared|found)\b/iu.test(
      message
    )
  ) {
    return 'success';
  }
  return 'info';
}

function getLogIcon(tone: LogTone) {
  const className = 'mt-0.5 h-4 w-4 shrink-0';
  if (tone === 'error')
    return <AlertCircle className={className} aria-hidden="true" />;
  if (tone === 'warning')
    return <TriangleAlert className={className} aria-hidden="true" />;
  if (tone === 'success')
    return <CheckCircle2 className={className} aria-hidden="true" />;
  return <Info className={className} aria-hidden="true" />;
}

function parseLogLine(line: string) {
  const match = LOG_LINE_PATTERN.exec(line);
  if (!match) {
    return { message: line, timestamp: null };
  }
  return { message: match[2] || line, timestamp: match[1] || null };
}

function formatLogTimestamp(timestamp: string | null) {
  if (!timestamp) return null;
  const date = parseApiUtcDate(timestamp);
  if (Number.isNaN(date.getTime())) return timestamp;
  return date.toISOString().replace(/\.\d{3}Z$/u, 'Z');
}

export function JobLogViewer({
  logs,
  emptyLabel,
  isLive = false,
}: JobLogViewerProps) {
  const { t } = useTranslation();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const lines = logs?.filter(Boolean) ?? [];

  useEffect(() => {
    if (!isLive || !scrollContainerRef.current) return;
    scrollContainerRef.current.scrollTop =
      scrollContainerRef.current.scrollHeight;
  }, [isLive, lines.length]);

  if (lines.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-4 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-300">
        {emptyLabel}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div
        ref={scrollContainerRef}
        className="max-h-72 overflow-y-auto rounded-lg border border-slate-200 bg-slate-100/70 p-2 dark:border-slate-700 dark:bg-slate-950/50"
        aria-label={t('flights.generationLogs.activity', 'Activity log')}
        aria-live={isLive ? 'polite' : 'off'}
      >
        <ol className="space-y-1.5">
          {lines.map((line, index) => {
            const entry = parseLogLine(line);
            const tone = getLogTone(entry.message);
            const timestamp = formatLogTimestamp(entry.timestamp);
            return (
              <li
                key={`${index}-${line}`}
                className={`flex gap-2 rounded-md border px-2.5 py-2 text-xs leading-relaxed ${toneStyles[tone]}`}
              >
                {getLogIcon(tone)}
                <span className="sr-only">
                  {t(
                    `flights.generationLogs.level.${tone}`,
                    toneFallbacks[tone]
                  )}
                  :
                </span>
                {timestamp && (
                  <time
                    dateTime={timestamp}
                    className="shrink-0 font-mono text-[11px] opacity-70"
                  >
                    {timestamp}
                  </time>
                )}
                <span className="min-w-0 break-words">{entry.message}</span>
              </li>
            );
          })}
        </ol>
      </div>

      <details className="group rounded-lg border border-slate-200 bg-slate-950 dark:border-slate-700">
        <summary className="flex cursor-pointer list-none items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-slate-200 transition-colors hover:bg-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500">
          <Terminal className="h-4 w-4" aria-hidden="true" />
          {t('flights.generationLogs.technicalDetails', 'Technical details')}
          <span className="ml-auto font-normal text-slate-400">
            {t('flights.generationLogs.lineCount', '{{count}} lines', {
              count: lines.length,
            })}
          </span>
        </summary>
        <pre className="max-h-64 overflow-auto whitespace-pre-wrap border-t border-slate-800 p-3 font-mono text-xs leading-relaxed text-slate-100">
          {lines.join('\n')}
        </pre>
      </details>
    </div>
  );
}
