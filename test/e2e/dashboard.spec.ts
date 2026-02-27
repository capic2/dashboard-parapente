import { test, expect } from '@playwright/test';

test.describe('Paragliding Dashboard E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should load dashboard and display header', async ({ page }) => {
    // Check page title
    await expect(page).toHaveTitle(/Tableau de Bord/i);

    // Check header is visible
    const header = page.locator('header h1');
    await expect(header).toBeVisible();
    await expect(header).toContainText('Tableau de Bord');

    // Check navigation links
    await expect(page.locator('nav a:has-text("Dashboard")')).toBeVisible();
    await expect(page.locator('nav a:has-text("Vols")')).toBeVisible();
    await expect(page.locator('nav a:has-text("Analyses")')).toBeVisible();
    await expect(page.locator('nav a:has-text("Paramètres")')).toBeVisible();
  });

  test('should navigate between pages', async ({ page }) => {
    // Navigate to Flights page
    await page.click('nav a:has-text("Vols")');
    await expect(page).toHaveURL(/\/flights/);
    await expect(page.locator('h1')).toContainText('Historique des Vols');

    // Navigate to Analytics page
    await page.click('nav a:has-text("Analyses")');
    await expect(page).toHaveURL(/\/analytics/);
    await expect(page.locator('h1')).toContainText('Analyses et Statistiques');

    // Navigate to Settings page
    await page.click('nav a:has-text("Paramètres")');
    await expect(page).toHaveURL(/\/settings/);
    await expect(page.locator('h1')).toContainText('Paramètres');

    // Navigate back to Dashboard
    await page.click('nav a:has-text("Dashboard")');
    await expect(page).toHaveURL('/');
  });

  test('should load weather data on dashboard', async ({ page }) => {
    // Wait for site selector to appear
    const siteSelector = page.locator('.site-selector');
    await expect(siteSelector).toBeVisible({ timeout: 10000 });

    // Check that weather components are present
    const currentConditions = page.locator('.current-conditions');
    await expect(currentConditions).toBeVisible({ timeout: 15000 });

    // Check for forecast sections
    const hourlyForecast = page.locator('.hourly-forecast');
    const sevenDayForecast = page.locator('.forecast-7day');
    
    await expect(hourlyForecast).toBeVisible({ timeout: 10000 });
    await expect(sevenDayForecast).toBeVisible({ timeout: 10000 });
  });

  test('should display flight history and select a flight', async ({ page }) => {
    // Navigate to flights page
    await page.click('nav a:has-text("Vols")');
    await expect(page).toHaveURL(/\/flights/);

    // Wait for flights to load (or empty state)
    const flightsList = page.locator('.flight-list');
    await expect(flightsList).toBeVisible({ timeout: 10000 });

    // Check if there are flights or empty state
    const flightCards = page.locator('.flight-card');
    const emptyState = page.locator('.empty-state');

    const hasFlights = (await flightCards.count()) > 0;

    if (hasFlights) {
      // Click first flight
      await flightCards.first().click();

      // Check that flight details appear
      const flightDetails = page.locator('.flight-details');
      await expect(flightDetails).toBeVisible();

      // Check detail items are present
      await expect(page.locator('.detail-item')).toHaveCount(6); // Date, Site, Duration, Distance, Altitude, Elevation

      // Check that 3D viewer container is present
      const viewerContainer = page.locator('.viewer-container');
      await expect(viewerContainer).toBeVisible();
    } else {
      // Verify empty state message
      await expect(emptyState).toBeVisible();
      await expect(emptyState).toContainText('Aucun vol enregistré');
    }
  });

  test('should display analytics page with stats and charts', async ({ page }) => {
    // Navigate to analytics page
    await page.click('nav a:has-text("Analyses")');
    await expect(page).toHaveURL(/\/analytics/);

    // Wait for page to load
    await expect(page.locator('h1')).toContainText('Analyses et Statistiques');

    // Check that stats dashboard is present
    const statsDashboard = page.locator('.stats-dashboard');
    await expect(statsDashboard).toBeVisible({ timeout: 10000 });

    // Check for stat cards (should have 8 cards)
    const statCards = page.locator('.stat-card:not(.skeleton)');
    await expect(statCards.first()).toBeVisible({ timeout: 15000 });

    // Check that chart containers are present
    const chartContainers = page.locator('.chart-container');
    await expect(chartContainers.first()).toBeVisible({ timeout: 15000 });
  });

  test('should be responsive on mobile viewport', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    // Check dashboard is responsive
    const header = page.locator('header');
    await expect(header).toBeVisible();

    // Navigate to flights
    await page.click('nav a:has-text("Vols")');
    const flightsList = page.locator('.flight-list');
    await expect(flightsList).toBeVisible();

    // Navigate to analytics
    await page.click('nav a:has-text("Analyses")');
    const statsDashboard = page.locator('.stats-dashboard');
    await expect(statsDashboard).toBeVisible({ timeout: 10000 });

    // Check that charts adapt to mobile view
    const chartsGrid = page.locator('.charts-grid');
    await expect(chartsGrid).toBeVisible();
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
