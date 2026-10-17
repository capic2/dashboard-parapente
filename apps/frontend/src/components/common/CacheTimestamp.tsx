import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { enUS } from 'date-fns/locale';
import { AlertTriangle } from 'lucide-react';
import { parseApiUtcDate } from '../../lib/date';

interface CacheTimestampProps {
  cachedAt: string | null | undefined;
  className?: string;
}

export default function CacheTimestamp({
  cachedAt,
  className = '',
}: CacheTimestampProps) {
  const { t, i18n } = useTranslation();
  const [now, setNow] = useState(() => Date.now());
  const cachedDate = cachedAt ? parseApiUtcDate(cachedAt) : null;
  const cachedTimestamp = cachedDate?.getTime() ?? null;

  useEffect(() => {
    if (
      cachedTimestamp === null ||
      !Number.isFinite(cachedTimestamp) ||
      now - cachedTimestamp >= 60 * 60 * 1000
    ) {
      return;
    }

    const timeout = window.setTimeout(
      () => setNow(Date.now()),
      cachedTimestamp + 60 * 60 * 1000 - now
    );

    return () => window.clearTimeout(timeout);
  }, [cachedTimestamp, now]);

  if (!cachedAt) {
    return (
      <span className={`text-xs text-gray-400 dark:text-gray-400 ${className}`}>
        {t('weather.notCached')}
      </span>
    );
  }

  if (!cachedDate || !Number.isFinite(cachedTimestamp)) {
    return (
      <span className={`text-xs text-gray-400 dark:text-gray-400 ${className}`}>
        {t('weather.cacheTimestampUnavailable')}
      </span>
    );
  }

  const locale = i18n.language === 'fr' ? fr : enUS;
  const relativeTime = formatDistanceToNow(cachedDate, {
    addSuffix: true,
    locale,
  });
  const isStale = now - cachedDate.getTime() >= 60 * 60 * 1000;

  return (
    <span
      className={`${
        isStale
          ? 'inline-flex max-w-full items-center gap-1.5 rounded-full bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-900 dark:bg-amber-950/50 dark:text-amber-200'
          : 'text-xs text-gray-400 dark:text-gray-400'
      } ${className}`}
      title={cachedDate.toLocaleString(i18n.language)}
    >
      {isStale && (
        <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      )}
      {t('weather.updatedAt')} {relativeTime}
    </span>
  );
}
