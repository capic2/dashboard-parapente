import { describe, expect, it } from 'vitest';
import { TAB_BASE_CLASS, TAB_LIST_BASE_CLASS } from './Tabs';

describe('Tabs', () => {
  it('keeps tab labels on one line and scrollable on mobile', () => {
    expect(TAB_LIST_BASE_CLASS).toContain('overflow-x-auto');
    expect(TAB_LIST_BASE_CLASS).toContain('sm:grid');
    expect(TAB_BASE_CLASS).toContain('whitespace-nowrap');
    expect(TAB_BASE_CLASS).toContain('min-w-max');
  });
});
