import { describe, expect, it } from 'vitest';
import { getForceRoseAccessibleLabel } from './TelemetrySpeedometer';

describe('getForceRoseAccessibleLabel', () => {
  it('includes all acceleration axes and handles missing values', () => {
    expect(getForceRoseAccessibleLabel(0.25, -1, null, 1.25)).toBe(
      'Rose des forces. Force totale : 1.25 G. Axe X : 0.25 G, axe Y : -1.00 G, axe Z : —.'
    );
  });
});
