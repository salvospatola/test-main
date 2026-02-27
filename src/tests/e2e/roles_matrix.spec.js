import { test, expect } from '@playwright/test';

test.describe('Admin: Role Permissions Matrix (E2E)', () => {

  test.beforeEach(async ({ page }) => {
    // 1. Get token from mock-login API
    const response = await page.request.get('/api/dev/mock-login');
    const body = await response.json();
    const token = body.token;
    
    // 2. Set token in localStorage (must navigate to the page first)
    await page.goto('/');
    await page.evaluate((t) => localStorage.setItem('auth_token', t), token);
    
    // 3. Navigate to admin roles
    await page.goto('/admin/roles');
    await expect(page.getByText(/Rechte-Matrix/i)).toBeVisible({ timeout: 15000 });
  });

  test('Sollte Berechtigungen umschalten und speichern können', async ({ page }) => {
    // Finde die erste Zeile in der Tabelle der ersten Rolle
    const firstRoleCard = page.locator('.grid-cols-1 > div').first();
    const firstRow = firstRoleCard.locator('table tbody tr').first();
    
    const viewBtn = firstRow.locator('button').first();
    const editBtn = firstRow.locator('button').last();
    
    // Aktuellen Zustand merken (für Toggle-Test)
    const wasViewAllowed = await viewBtn.innerText();
    
    // Toggle View Permission
    await viewBtn.click();
    
    // Speichern Button in der Role Card finden
    const saveBtn = firstRoleCard.getByRole('button', { name: /Speichern/i });
    await saveBtn.click();
    
    // Warte kurz auf API Update
    await page.waitForTimeout(1000);
    
    // Seite neu laden um Persistenz zu prüfen
    await page.reload();
    await expect(page.getByText(/Rechte-Matrix/i)).toBeVisible();
    
    // Prüfen ob der Zustand sich geändert hat
    const newViewBtn = page.locator('.grid-cols-1 > div').first().locator('table tbody tr').first().locator('button').first();
    const isViewAllowedNow = await newViewBtn.innerText();
    
    expect(isViewAllowedNow).not.toBe(wasViewAllowed);
  });

});
