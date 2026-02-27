import { test, expect } from '@playwright/test';

async function loginAsAdmin(page) {
  const response = await page.request.get('/api/dev/mock-login');
  expect(response.ok()).toBeTruthy();
  const body = await response.json();
  await page.goto('/');
  await page.evaluate((t) => localStorage.setItem('auth_token', t), body.token);
  return body.token;
}

async function seedPlanEntry(page, token) {
  const future = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
  const yyyy = future.getFullYear();
  const mm = `${future.getMonth() + 1}`.padStart(2, '0');
  const dd = `${future.getDate()}`.padStart(2, '0');

  const payload = {
    Datum: `${yyyy}-${mm}-${dd}`,
    Uhrzeit: '10:30',
    Typ: 'Gottesdienst',
    Thema: 'UX Test Termin',
    Predigt: '',
    Leitung: '',
    TechnikPC: '',
    TechnikSound: '',
    Organisator: '',
    Anbetungsstunde: '',
    Klavier: '',
    Gitarre: '',
    Bass: '',
    Schlagzeug: '',
    Gesang1: '',
    Gesang2: ''
  };

  const createRes = await page.request.post('/api/plan', {
    headers: { Authorization: `Bearer ${token}` },
    data: { data: payload }
  });
  expect(createRes.ok()).toBeTruthy();
}

async function collectOverflowMetrics(page) {
  return page.evaluate(() => {
    const root = document.documentElement;
    const body = document.body;
    const overflowElements = Array.from(document.querySelectorAll('*'))
      .filter((el) => {
        const rect = el.getBoundingClientRect();
        return rect.width > 0 && rect.right - window.innerWidth > 1;
      })
      .slice(0, 20)
      .map((el) => {
        const rect = el.getBoundingClientRect();
        return {
          tag: el.tagName.toLowerCase(),
          className: (el.className || '').toString().slice(0, 120),
          right: Math.round(rect.right),
          width: Math.round(rect.width)
        };
      });

    return {
      innerWidth: window.innerWidth,
      rootScrollWidth: root.scrollWidth,
      bodyScrollWidth: body.scrollWidth,
      hasHorizontalOverflow: root.scrollWidth - window.innerWidth > 1 || body.scrollWidth - window.innerWidth > 1,
      overflowElements
    };
  });
}

async function collectHeaderCollisionMetrics(page) {
  return page.evaluate(() => {
    const cards = Array.from(document.querySelectorAll('.group.relative.mb-4'));

    const collisions = cards.map((card) => {
      const header = card.querySelector('[class*="CardHeader"], .p-4, .sm\\:p-6');
      const date = card.querySelector('h3, [class*="CardTitle"]');
      const actions = Array.from(card.querySelectorAll('button')).filter((btn) => {
        const svg = btn.querySelector('svg');
        return Boolean(svg);
      }).slice(0, 2);

      if (!header || !date || actions.length < 1) return null;

      const dateRect = date.getBoundingClientRect();
      const actionRects = actions.map((a) => a.getBoundingClientRect());
      const maxActionTop = Math.min(...actionRects.map((r) => r.top));
      const overlapsVertically = dateRect.bottom > maxActionTop + 2;

      return {
        dateBottom: Math.round(dateRect.bottom),
        actionTop: Math.round(maxActionTop),
        overlapsVertically
      };
    }).filter(Boolean);

    return {
      checkedCards: collisions.length,
      overlapCount: collisions.filter((c) => c.overlapsVertically).length,
      collisions: collisions.slice(0, 5)
    };
  });
}

test.describe('Dienstplan UX audit', () => {
  test('mobile: no horizontal overflow and no header overlaps', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const token = await loginAsAdmin(page);
    await seedPlanEntry(page, token);

    await page.goto('/dienstplaner', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Dienstplaner' }).first()).toBeVisible();

    const overflow = await collectOverflowMetrics(page);
    expect(overflow.hasHorizontalOverflow, `Overflow metrics: ${JSON.stringify(overflow)}`).toBeFalsy();

    const collisions = await collectHeaderCollisionMetrics(page);
    expect(collisions.overlapCount, `Header collision metrics: ${JSON.stringify(collisions)}`).toBe(0);
  });

  test('desktop: no horizontal overflow', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    const token = await loginAsAdmin(page);
    await seedPlanEntry(page, token);

    await page.goto('/dienstplaner', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Dienstplaner' }).first()).toBeVisible();

    const overflow = await collectOverflowMetrics(page);
    expect(overflow.hasHorizontalOverflow, `Overflow metrics: ${JSON.stringify(overflow)}`).toBeFalsy();
  });
});
