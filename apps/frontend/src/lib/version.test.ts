import { describe, expect, it } from 'vitest';

import { compareVersions, isVersionNewer } from './version';

describe('version utilities', () => {
  it('detects a newer build number on same day', () => {
    expect(isVersionNewer('2026.04.21.8', '2026.04.21.7')).toBe(true);
  });

  it('detects a newer date even if build number is lower', () => {
    expect(isVersionNewer('2026.04.22.1', '2026.04.21.99')).toBe(true);
  });

  it('returns false for same version', () => {
    expect(isVersionNewer('2026.04.21.7', '2026.04.21.7')).toBe(false);
  });

  it('returns false when candidate is older', () => {
    expect(isVersionNewer('2026.04.20.9', '2026.04.21.1')).toBe(false);
  });

  it('treats invalid versions as equal', () => {
    expect(compareVersions('invalid', '2026.04.21.1')).toBe(0);
    expect(compareVersions('2026.04.21.1', 'invalid')).toBe(0);
  });
});
