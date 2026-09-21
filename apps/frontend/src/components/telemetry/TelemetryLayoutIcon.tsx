import {
  Compass,
  Flame,
  Gauge,
  Heart,
  MapPin,
  Mountain,
  Wind,
} from 'lucide-react';
import type { TelemetryIconName } from '../flights/details/flightTelemetryLayout';

const ICONS = {
  mountain: Mountain,
  wind: Wind,
  heart: Heart,
  compass: Compass,
  'map-pin': MapPin,
  flame: Flame,
  gauge: Gauge,
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
