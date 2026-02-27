import { test, expect } from '@playwright/test';

const SECURED_ROUTES = [
  { path: '/channels', permission: 'CHANNELS' },
  { path: '/messenger', permission: 'MESSENGER' },
  { path: '/hauskreise', permission: 'HAUSKREISE' },
  { path: '/dienstplaner', permission: 'MUSIC_PLANER' },
  { path: '/admin/users', permission: 'USER_MGMT' },
  { path: '/admin/roles', permission: 'ROLES' },
  { path: '/admin/teams', permission: 'USER_MGMT' },
  { path: '/admin/tags', permission: 'USER_MGMT' },
  { path: '/admin/plan-slots', permission: 'USER_MGMT' },
  { path: '/admin/monitor', permission: 'ACTIVITY_LOGS' },
  { path: '/admin/stats', permission: 'ACTIVITY_LOGS' },
  { path: '/admin/security', permission: 'USER_MGMT' },
  { path: '/admin/activity', permission: 'ACTIVITY_LOGS' },
  { path: '/admin/bot', permission: 'BOT_CONTROL' },
  { path: '/admin/jobs', permission: 'BOT_CONTROL' }
];

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

async function fetchAuthUser(page) {
  const token = await page.evaluate(() => localStorage.getItem('auth_token'));
  expect(Boolean(token)).toBeTruthy();
  const res = await page.request.get('/api/auth/me', {
    headers: { Authorization: `Bearer ${token}` }
  });
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  return body?.user;
}

function canView(user, key) {
  if (!user) return false;
  if (user.role === 'ADMIN') return true;
  return Boolean((user.permissions || []).some((p) => p.key === key && p.canView));
}

test.describe('QA Role Route Matrix', () => {
  test.describe.configure({ timeout: 180000 });

  for (const role of ['ADMIN', 'USER', 'MEMBER']) {
    test(`${role}: secured routes match permission matrix`, async ({ page }) => {
      const runtimeErrors = [];
      page.on('console', (msg) => {
        if (msg.type() === 'error') runtimeErrors.push(msg.text());
      });
      page.on('pageerror', (err) => runtimeErrors.push(String(err?.message || err)));

      await loginAsRole(page, role);
      const authUser = await fetchAuthUser(page);

      for (const routeDef of SECURED_ROUTES) {
        runtimeErrors.length = 0;
        await page.goto(routeDef.path, { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(350);

        const rootHtml = await page.innerHTML('#root');
        expect(rootHtml.length, `Blank page on ${routeDef.path}`).toBeGreaterThan(180);

        const significant = runtimeErrors.filter((m) => isSignificantBrowserError(m));
        expect(significant, `JS errors on ${routeDef.path}: ${significant.join(' | ')}`).toHaveLength(0);

        const deniedVisible = await page.getByText(/Zugriff verweigert|Administrator-Rechte erforderlich|Keine Leseberechtigung/i)
          .first()
          .isVisible()
          .catch(() => false);

        const shouldAllow = routeDef.path === '/admin' ? authUser?.role === 'ADMIN' : canView(authUser, routeDef.permission);
        if (shouldAllow) {
          expect(deniedVisible, `Unexpected denied page on ${routeDef.path}`).toBe(false);
        } else {
          expect(deniedVisible, `Expected denied page on ${routeDef.path}`).toBe(true);
        }
      }
    });
  }
});

