import { describe, expect, it } from 'vitest';
import {
  getExportFrameTarget,
  getExportFrameTargetIndex,
} from './videoExportFrame';

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

describe('getExportFrameTarget', () => {
  it('returns interpolation data between GPS indexes', () => {
    expect(getExportFrameTarget(1, 5, 3)).toEqual({
      progress: 0.25,
      previousIndex: 0,
      nextIndex: 1,
      ratio: 0.5,
    });
  });

  it('clamps progress while keeping interpolation bounds valid', () => {
    expect(getExportFrameTarget(-1, 5, 3)).toEqual({
      progress: 0,
      previousIndex: 0,
      nextIndex: 0,
      ratio: 0,
    });
    expect(getExportFrameTarget(8, 5, 3)).toEqual({
      progress: 1,
      previousIndex: 2,
      nextIndex: 2,
      ratio: 0,
    });
  });
});
