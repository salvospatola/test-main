import { test, expect } from '@playwright/test';

const ROLE_CASES = ['ADMIN', 'USER', 'MEMBER'];
const COMMON_ROUTES = ['/', '/messenger', '/channels', '/hauskreise', '/dienstplaner'];
const ADMIN_ROUTES = ['/admin', '/admin/users', '/admin/roles', '/admin/monitor', '/admin/stats', '/admin/security', '/admin/activity', '/admin/bot'];
const BLOCKED_LABEL_PATTERNS = [/löschen/i, /remove/i, /entfernen/i, /abmelden/i, /logout/i, /zurückgehen/i, /ablehnen/i, /reject/i];

const isSignificantBrowserError = (message = '') => {
  const text = String(message || '');
  if (!text) return false;
  if (/favicon/i.test(text)) return false;
  if (/transparenttextures\.com/i.test(text) && /Content Security Policy directive/i.test(text)) return false;
  if (/Failed to load resource/i.test(text) && /manifest|chrome-extension/i.test(text)) return false;
  return true;
};

async function loginAsRole(page, roleName) {
  const role = String(roleName || 'USER').toUpperCase();
  const mockRes = await page.request.get(`/api/dev/mock-login?role=${encodeURIComponent(role)}`);
  expect(mockRes.ok()).toBeTruthy();
  const mockBody = await mockRes.json();
  expect(Boolean(mockBody?.token)).toBeTruthy();
  await page.goto('/');
  await page.evaluate((token) => localStorage.setItem('auth_token', token), mockBody.token);
}

async function assertPageHealthy(page, route, runtimeErrors) {
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(500);
  const rootHtml = await page.innerHTML('#root');
  expect(rootHtml.length, `Blank/leer auf ${route}`).toBeGreaterThan(180);

  const criticalErrors = runtimeErrors.filter((msg) => isSignificantBrowserError(msg));
  expect(criticalErrors, `JS-Fehler auf ${route}: ${criticalErrors.join(' | ')}`).toHaveLength(0);
}

async function clickAudit(page, route, runtimeErrors) {
  const buttons = page.locator('button:visible');
  const count = await buttons.count();
  const maxClicks = Math.min(count, 8);

  for (let i = 0; i < maxClicks; i += 1) {
    const button = buttons.nth(i);
    const disabled = await button.isDisabled().catch(() => true);
    if (disabled) continue;

    const label = (await button.innerText().catch(() => '')).trim();
    if (BLOCKED_LABEL_PATTERNS.some((rx) => rx.test(label))) continue;

    const errorsBefore = runtimeErrors.length;
    await button.click({ timeout: 2000 }).catch(() => {});
    await page.waitForTimeout(150);

    const rootHtml = await page.innerHTML('#root');
    expect(rootHtml.length, `UI kollabiert nach Button-Klick "${label || '(icon)'}" auf ${route}`).toBeGreaterThan(120);

    const newErrors = runtimeErrors.slice(errorsBefore).filter((msg) => isSignificantBrowserError(msg));
    expect(newErrors, `Fehler nach Button-Klick "${label || '(icon)'}" auf ${route}: ${newErrors.join(' | ')}`).toHaveLength(0);
  }
}

test.describe('QA Roles Audit', () => {
  test.describe.configure({ timeout: 180000 });
  for (const role of ROLE_CASES) {
    test(`${role}: routes, crashes, button smoke`, async ({ page }) => {
      const runtimeErrors = [];
      page.on('console', (msg) => {
        if (msg.type() === 'error') runtimeErrors.push(msg.text());
      });
      page.on('pageerror', (err) => runtimeErrors.push(String(err?.message || err)));

      await loginAsRole(page, role);

      for (const route of COMMON_ROUTES) {
        runtimeErrors.length = 0;
        await page.goto(route, { waitUntil: 'domcontentloaded' });
        await assertPageHealthy(page, route, runtimeErrors);
        await clickAudit(page, route, runtimeErrors);
      }

      const roleAdminRoutes = role === 'ADMIN' ? ADMIN_ROUTES : ['/admin', '/admin/users'];
      for (const route of roleAdminRoutes) {
        runtimeErrors.length = 0;
        await page.goto(route, { waitUntil: 'domcontentloaded' });
        await assertPageHealthy(page, route, runtimeErrors);

        const deniedVisible = await page
          .getByText(/Zugriff verweigert|Administrator-Rechte erforderlich|Admin-Bereich/i)
          .first()
          .isVisible()
          .catch(() => false);

        if (role === 'ADMIN') {
          expect(deniedVisible, `Admin sollte Zugriff auf ${route} haben`).toBe(false);
          await clickAudit(page, route, runtimeErrors);
        } else {
          expect(deniedVisible, `${role} sollte auf ${route} blockiert sein`).toBe(true);
        }
      }
    });
  }
});
