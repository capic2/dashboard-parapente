import {
  CircleHelp,
  Cloud,
  CloudDrizzle,
  CloudRain,
  CloudSun,
  Sun,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface WeatherConditionIconProps {
  precipitationMm?: number | null;
  cloudCoverPercent?: number | null;
  className?: string;
}

type WeatherCondition =
  | 'sunny'
  | 'partlyCloudy'
  | 'cloudy'
  | 'drizzle'
  | 'rain'
  | 'unknown';

const getWeatherCondition = (
  precipitationMm: number | null | undefined,
  cloudCoverPercent: number | null | undefined
): WeatherCondition => {
  if (precipitationMm != null && precipitationMm >= 1) return 'rain';
  if (precipitationMm != null && precipitationMm > 0) return 'drizzle';
  if (cloudCoverPercent == null) return 'unknown';
  if (cloudCoverPercent >= 80) return 'cloudy';
  if (cloudCoverPercent >= 35) return 'partlyCloudy';
  return 'sunny';
};

const CONDITION_VISUALS = {
  sunny: { Icon: Sun, color: 'text-amber-500' },
  partlyCloudy: { Icon: CloudSun, color: 'text-sky-500' },
  cloudy: { Icon: Cloud, color: 'text-slate-500 dark:text-slate-300' },
  drizzle: { Icon: CloudDrizzle, color: 'text-cyan-600 dark:text-cyan-300' },
  rain: { Icon: CloudRain, color: 'text-blue-600 dark:text-blue-300' },
  unknown: { Icon: CircleHelp, color: 'text-slate-400 dark:text-slate-500' },
} satisfies Record<WeatherCondition, { Icon: typeof Sun; color: string }>;

export default function WeatherConditionIcon({
  precipitationMm,
  cloudCoverPercent,
  className = 'h-5 w-5',
}: WeatherConditionIconProps) {
  const { t } = useTranslation();
  const condition = getWeatherCondition(precipitationMm, cloudCoverPercent);
  const { Icon, color } = CONDITION_VISUALS[condition];
  const label = t(`weather.conditions.${condition}`);

  return (
    <span title={label} className={`inline-flex shrink-0 ${color}`}>
      <Icon className={className} aria-hidden="true" />
      <span className="sr-only">{label}</span>
    </span>
  );
}
