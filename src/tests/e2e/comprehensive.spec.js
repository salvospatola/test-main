import { test, expect } from '@playwright/test';

test.describe('EFG NSU Portal - Core UI Tests', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Länger warten bis die App stabil ist
    await page.waitForLoadState('networkidle');
  });

  test('Branding und Login-Button vorhanden', async ({ page }) => {
    await expect(page.getByText('EFG NSU').first()).toBeVisible({ timeout: 10000 });
    // Button wurde zu "Login" umbenannt
    await expect(page.getByRole('button', { name: /Login/i }).first()).toBeVisible({ timeout: 10000 });
  });

  test('Login-Modal lässt sich öffnen', async ({ page }) => {
    const loginBtn = page.getByRole('button', { name: /Login/i }).first();
    await loginBtn.click();
    
    // Einfach nach dem Text "Anmelden" suchen (ist im Dialog-Header und in der LoginView Card)
    await expect(page.getByText(/Anmelden/i).first()).toBeVisible({ timeout: 15000 });
  });

  test('Dunkelmodus lässt sich umschalten', async ({ page }) => {
    const darkBtn = page.getByTitle('Dunkel');
    if (await darkBtn.isVisible()) {
        await darkBtn.click();
        // Warte kurz auf Klassenänderung
        await page.waitForTimeout(500);
        const htmlClass = await page.evaluate(() => document.documentElement.className);
        expect(htmlClass).toContain('dark');
    }
  });

  test('Hellmodus lässt sich umschalten', async ({ page }) => {
    // Erst in Dark Mode wechseln falls nötig
    const darkBtn = page.getByTitle('Dunkel');
    if (await darkBtn.isVisible()) {
        await darkBtn.click();
        await page.waitForTimeout(200);
    }

    const lightBtn = page.getByTitle('Hell');
    await lightBtn.click();
    await page.waitForTimeout(500);
    const htmlClass = await page.evaluate(() => document.documentElement.className);
    expect(htmlClass).toContain('light');
  });

  test('Footer zeigt Versionsnummer an', async ({ page }) => {
    await expect(page.locator('footer')).toContainText(/v\d+\.\d+\.\d+/, { timeout: 10000 });
  });

});
