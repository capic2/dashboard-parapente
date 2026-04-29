import { describe, expect, it } from 'vitest';
import { getExportFrameTargetIndex } from './videoExportFrame';

describe('getExportFrameTargetIndex', () => {
  it('maps first, middle and last frames to stable position indexes', () => {
    expect(getExportFrameTargetIndex(0, 11, 101)).toBe(0);
    expect(getExportFrameTargetIndex(5, 11, 101)).toBe(50);
    expect(getExportFrameTargetIndex(10, 11, 101)).toBe(100);
  });

  it('clamps out-of-range frames', () => {
    expect(getExportFrameTargetIndex(-5, 11, 101)).toBe(0);
    expect(getExportFrameTargetIndex(20, 11, 101)).toBe(100);
  });

  it('handles empty or single-position tracks', () => {
    expect(getExportFrameTargetIndex(5, 11, 0)).toBe(0);
    expect(getExportFrameTargetIndex(5, 11, 1)).toBe(0);
  });
});
