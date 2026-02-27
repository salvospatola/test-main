import { test, expect } from '@playwright/test';

test.describe('Admin Access Security', () => {

  test('Benutzerverwaltung für Gäste gesperrt', async ({ page }) => {
    await page.goto('/admin/users');
    await expect(page.getByText(/Administrator-Rechte/i).or(page.getByText(/verweigert/i)).first()).toBeVisible({ timeout: 15000 });
  });

  test('Rollenverwaltung für Gäste gesperrt', async ({ page }) => {
    await page.goto('/admin/roles');
    await expect(page.getByText(/Administrator-Rechte/i).or(page.getByText(/verweigert/i)).first()).toBeVisible({ timeout: 15000 });
  });

});
