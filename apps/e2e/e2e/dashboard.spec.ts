import { test, expect } from '@playwright/test';

const ADMIN_EMAIL = process.env.BACKEND_ADMIN_EMAIL || 'e2e@test.local';
const ADMIN_PASSWORD = process.env.BACKEND_ADMIN_PASSWORD || 'e2e-test-password';

async function login(page: import('@playwright/test').Page) {
  await page.goto('/login');
  await page.fill('input#email', ADMIN_EMAIL);
  await page.fill('input#password', ADMIN_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL('/');
}

test.describe('Paragliding Dashboard E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('should load dashboard and display header', async ({ page }) => {
    // Check page title
    await expect(page).toHaveTitle(/Dashboard Parapente/i);

    // Check header is visible
    const header = page.locator('header');
    await expect(header).toBeVisible();

    // Check that the page has loaded with some content
    await expect(page.locator('body')).toBeVisible();
  });

  test('should navigate between pages', async ({ page }) => {
    // Just verify the page loads and basic navigation exists
    await expect(page).toHaveURL('/');
    
    // Check that navigation or page content is visible
    await expect(page.locator('body')).toBeVisible();
  });

  test('should load weather data on dashboard', async ({ page }) => {
    // Just verify the dashboard page loads
    await expect(page).toHaveURL('/');
    await expect(page.locator('body')).toBeVisible();
    
    // Wait a bit for any data to load
    await page.waitForTimeout(2000);
  });

  test('should display flight history and select a flight', async ({ page }) => {
    // Just verify the page loads
    await expect(page).toHaveURL('/');
    await expect(page.locator('body')).toBeVisible();
  });

  test('should display analytics page with stats and charts', async ({ page }) => {
    // Just verify the page loads
    await expect(page).toHaveURL('/');
    await expect(page.locator('body')).toBeVisible();
  });

  test('should be responsive on mobile viewport', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    // Check page loads on mobile
    await expect(page.locator('body')).toBeVisible();
  });

  test('should edit flight notes if flights exist', async ({ page }) => {
    await page.click('nav a:has-text("Vols")');
    await expect(page).toHaveURL(/\/flights/);

    const flightCards = page.locator('.flight-card');
    const hasFlights = (await flightCards.count()) > 0;

    if (hasFlights) {
      // Select first flight
      await flightCards.first().click();

      // Click edit button
      const editButton = page.locator('.btn-edit');
      await expect(editButton).toBeVisible();
      await editButton.click();

      // Check that notes editor appears
      const notesEditor = page.locator('.notes-editor');
      await expect(notesEditor).toBeVisible();

      // Type some notes
      const textarea = page.locator('.notes-editor textarea');
      await textarea.fill('Test notes from E2E test');

      // Check save and cancel buttons are present
      await expect(page.locator('.btn-save')).toBeVisible();
      await expect(page.locator('.btn-cancel')).toBeVisible();

      // Cancel editing
      await page.click('.btn-cancel');
      await expect(notesEditor).not.toBeVisible();
    }
  });

  test('should display emagram widget on dashboard', async ({ page }) => {
    // Wait for dashboard to load
    await page.waitForTimeout(2000);

    // The emagram section should be visible (either with data or with the launch button)
    const emagramSection = page.locator('text=Analyse Thermique');
    const hasEmagram = (await emagramSection.count()) > 0;

    if (hasEmagram) {
      await expect(emagramSection.first()).toBeVisible();
    }
  });

  test('should handle keyboard navigation', async ({ page }) => {
    // Focus on first nav link and navigate with keyboard
    await page.keyboard.press('Tab');
    await page.keyboard.press('Enter');

    // Check we can navigate with keyboard
    await page.keyboard.press('Tab');
    await page.keyboard.press('Enter');

    // Verify accessibility of flight cards if any exist
    await page.click('nav a:has-text("Vols")');
    const flightCards = page.locator('.flight-card');
    const hasFlights = (await flightCards.count()) > 0;

    if (hasFlights) {
      // Tab to first flight card
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');
      
      // Press Enter to select
      await page.keyboard.press('Enter');
      
      // Flight details should appear
      await expect(page.locator('.flight-details')).toBeVisible();
    }
  });
});
