import {
  Compass,
  Flame,
  Gauge,
  Heart,
  HeartPulse,
  MapPin,
  Mountain,
  Triangle,
  TrendingUp,
  Wind,
} from 'lucide-react';
import type { TelemetryIconName } from '../flights/details/flightTelemetryLayout';

const ICONS = {
  mountain: Mountain,
  wind: Wind,
  heart: Heart,
  heartbeat: HeartPulse,
  compass: Compass,
  'map-pin': MapPin,
  flame: Flame,
  gauge: Gauge,
  slope: TrendingUp,
  'slope-triangle': Triangle,
} as const;

export function TelemetryLayoutIcon({
  name,
  className,
}: {
  name: TelemetryIconName;
  className?: string;
}) {
  const Icon = ICONS[name];
  return <Icon className={className} aria-hidden="true" />;
}
