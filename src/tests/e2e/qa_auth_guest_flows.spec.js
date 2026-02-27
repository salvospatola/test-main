import { test, expect } from '@playwright/test';

const GUEST_PROTECTED_ROUTES = ['/', '/messenger', '/channels', '/dienstplaner'];

const isSignificantBrowserError = (message = '') => {
  const text = String(message || '');
  if (!text) return false;
  if (/favicon/i.test(text)) return false;
  if (/transparenttextures\.com/i.test(text) && /Content Security Policy directive/i.test(text)) return false;
  if (/Failed to load resource/i.test(text) && /manifest|chrome-extension/i.test(text)) return false;
  return true;
};

test.describe('QA Auth & Guest Flows', () => {
  test.describe.configure({ timeout: 120000 });

  test('guest is consistently blocked from protected pages without blank/crash', async ({ page }) => {
    const runtimeErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') runtimeErrors.push(msg.text());
    });
    page.on('pageerror', (err) => runtimeErrors.push(String(err?.message || err)));

    for (const route of GUEST_PROTECTED_ROUTES) {
      runtimeErrors.length = 0;
      await page.goto(route, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(300);

      const rootHtml = await page.innerHTML('#root');
      expect(rootHtml.length, `Blank page for guest on ${route}`).toBeGreaterThan(120);

      const needsLoginVisible = await page
        .getByText(/Anmeldung erforderlich|JETZT ANMELDEN|exklusiv|Zugriff verweigert/i)
        .first()
        .isVisible()
        .catch(() => false);
      expect(needsLoginVisible, `Guest should see block/login gate on ${route}`).toBe(true);

      const significant = runtimeErrors.filter((m) => isSignificantBrowserError(m));
      expect(significant, `JS errors for guest on ${route}: ${significant.join(' | ')}`).toHaveLength(0);
    }
  });

  test('login UI opens from gate and registration page renders without crash', async ({ page }) => {
    const runtimeErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') runtimeErrors.push(msg.text());
    });
    page.on('pageerror', (err) => runtimeErrors.push(String(err?.message || err)));

    await page.goto('/login-required');
    await page.getByRole('button', { name: /JETZT ANMELDEN/i }).click();
    await expect(page.getByText(/Anmelden|Code anfordern|Sicherheitshinweis/i).first()).toBeVisible({ timeout: 10000 });

    await page.goto('/register', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#root')).toBeVisible();

    const rootHtml = await page.innerHTML('#root');
    expect(rootHtml.length).toBeGreaterThan(120);

    const significant = runtimeErrors.filter((m) => isSignificantBrowserError(m));
    expect(significant, `Auth/Guest flow JS errors: ${significant.join(' | ')}`).toHaveLength(0);
  });
});

