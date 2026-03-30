import { useTranslation } from 'react-i18next';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { enUS } from 'date-fns/locale';

interface CacheTimestampProps {
  cachedAt: string | null | undefined;
  className?: string;
}

export default function CacheTimestamp({
  cachedAt,
  className = '',
}: CacheTimestampProps) {
  const { t, i18n } = useTranslation();

  if (!cachedAt) {
    return (
      <span className={`text-xs text-gray-400 ${className}`}>
        {t('weather.notCached')}
      </span>
    );
  }

  const locale = i18n.language === 'fr' ? fr : enUS;
  const relativeTime = formatDistanceToNow(new Date(cachedAt), {
    addSuffix: true,
    locale,
  });

  return (
    <span
      className={`text-xs text-gray-400 ${className}`}
      title={new Date(cachedAt).toLocaleString(i18n.language)}
    >
      {t('weather.updatedAt')} {relativeTime}
    </span>
  );
}
