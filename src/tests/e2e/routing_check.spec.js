import { test, expect } from '@playwright/test';

test.describe('Routing & Access Control', () => {

  test('Öffentliche Seiten sollten erreichbar sein', async ({ page }) => {
    await page.goto('/impressum');
    await expect(page.getByText(/Impressum/i).first()).toBeVisible({ timeout: 15000 });
    
    await page.goto('/datenschutz');
    await expect(page.getByText(/Datenschutz/i).first()).toBeVisible({ timeout: 15000 });
  });

  test('Registrierungsseite sollte Zugriff verweigert zeigen', async ({ page }) => {
    await page.goto('/register');
    await expect(page.getByText(/verweigert/i).first()).toBeVisible({ timeout: 15000 });
  });

  test('Dienstplaner sollte für Gäste gesperrt sein', async ({ page }) => {
    await page.goto('/dienstplaner');
    await expect(page.getByText(/exklusiv/i).first()).toBeVisible({ timeout: 15000 });
  });

  test('Admin-Bereich sollte für Gäste gesperrt sein', async ({ page }) => {
    await page.goto('/admin');
    // Wir nutzen den Selektor, der in user_roles.spec.js funktioniert
    await expect(page.getByText(/Administrator-Rechte/i).or(page.getByText(/verweigert/i)).first()).toBeVisible({ timeout: 15000 });
  });

});
