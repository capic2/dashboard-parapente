import { Navigation2 } from 'lucide-react';

interface WindArrowProps {
  /** Wind direction in degrees, meteorological convention (where wind comes FROM). 0° = North */
  degrees: number;
  size?: number;
  className?: string;
}

export default function WindArrow({ degrees, size = 16, className = '' }: WindArrowProps) {
  // Navigation2 points up (North) by default.
  // To show where the wind GOES, rotate by degrees + 180°.
  // Example: wind from North (0°) → rotate 180° → arrow points down (South)
  const rotation = (degrees + 180) % 360;

  return (
    <Navigation2
      size={size}
      className={`inline-block ${className}`}
      style={{ transform: `rotate(${rotation}deg)`, transition: 'transform 0.2s' }}
      aria-label={`Vent ${degrees}°`}
    />
  );
}
