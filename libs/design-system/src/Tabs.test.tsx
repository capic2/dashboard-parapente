import { describe, expect, it } from 'vitest';
import { TAB_BASE_CLASS, TAB_LIST_BASE_CLASS } from './Tabs';

describe('Tabs', () => {
  it('keeps tab labels on one line and scrollable on mobile', () => {
    expect(TAB_LIST_BASE_CLASS).toContain('overflow-x-auto');
    expect(TAB_LIST_BASE_CLASS).not.toContain('sm:grid');
    expect(TAB_BASE_CLASS).toContain('whitespace-nowrap');
    expect(TAB_BASE_CLASS).toContain('min-w-max');
  });

  it('uses a quiet segmented surface with an elevated selected tab', () => {
    expect(TAB_LIST_BASE_CLASS).toContain('bg-gray-100/80');
    expect(TAB_LIST_BASE_CLASS).toContain('border-gray-200/80');
    expect(TAB_BASE_CLASS).toContain('data-[selected]:bg-white');
    expect(TAB_BASE_CLASS).toContain('data-[selected]:text-sky-700');
    expect(TAB_BASE_CLASS).toContain('data-[selected]:shadow-sm');
  });
});
