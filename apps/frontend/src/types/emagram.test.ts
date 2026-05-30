import { describe, expect, it } from 'vitest';
import { parseThermalValidation } from './emagram';

describe('parseThermalValidation', () => {
  it('parses backend thermal validation from the raw AI response', () => {
    const validation = parseThermalValidation(
      JSON.stringify({
        thermal_validation: {
          status: 'contradicted',
          message: 'CAPE tres faible.',
          metrics: { cape_jkg: 20, force_thermique_ms: 3.2 },
        },
      })
    );

    expect(validation).toMatchObject({
      status: 'contradicted',
      message: 'CAPE tres faible.',
    });
    expect(validation?.metrics?.cape_jkg).toBe(20);
  });

  it('ignores unknown validation statuses', () => {
    const validation = parseThermalValidation(
      JSON.stringify({ thermal_validation: { status: 'unknown' } })
    );

    expect(validation).toBeNull();
  });
});
