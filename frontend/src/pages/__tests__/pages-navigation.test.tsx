/**
 * Simple navigation test for the 3 main pages
 */
import { describe, it, expect } from 'vitest';

describe('Pages Navigation', () => {
  it('should have FlightHistory page', () => {
    // Import test to ensure page exists
    const FlightHistory = require('../FlightHistory').default;
    expect(FlightHistory).toBeDefined();
  });

  it('should have Analytics page', () => {
    const Analytics = require('../Analytics').default;
    expect(Analytics).toBeDefined();
  });

  it('should have Settings page', () => {
    const Settings = require('../Settings').default;
    expect(Settings).toBeDefined();
  });
});
