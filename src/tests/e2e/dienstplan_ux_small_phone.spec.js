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
  const future = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const yyyy = future.getFullYear();
  const mm = `${future.getMonth() + 1}`.padStart(2, '0');
  const dd = `${future.getDate()}`.padStart(2, '0');

  const payload = {
    Datum: `${yyyy}-${mm}-${dd}`,
    Uhrzeit: '10:30',
    Typ: 'Gottesdienst',
    Thema: 'Kleines Smartphone UX Audit',
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
    return {
      innerWidth: window.innerWidth,
      rootScrollWidth: root.scrollWidth,
      bodyScrollWidth: body.scrollWidth,
      hasHorizontalOverflow: root.scrollWidth - window.innerWidth > 1 || body.scrollWidth - window.innerWidth > 1
    };
  });
}

async function collectCardCollisionMetrics(page) {
  return page.evaluate(() => {
    const cards = Array.from(document.querySelectorAll('.group.relative.mb-4'));
    const collisions = [];

    cards.forEach((card) => {
      const title = card.querySelector('h3, [class*="CardTitle"]');
      const iconButtons = Array.from(card.querySelectorAll('button')).filter((btn) => btn.querySelector('svg')).slice(0, 2);
      if (!title || iconButtons.length < 2) return;

      const titleRect = title.getBoundingClientRect();
      const actionTop = Math.min(...iconButtons.map((btn) => btn.getBoundingClientRect().top));
      if (titleRect.bottom > actionTop + 2) {
        collisions.push({ titleBottom: Math.round(titleRect.bottom), actionTop: Math.round(actionTop) });
      }
    });

    return { checkedCards: cards.length, overlapCount: collisions.length, sample: collisions.slice(0, 3) };
  });
}

async function collectTouchTargetMetrics(page) {
  return page.evaluate(() => {
    const targets = Array.from(document.querySelectorAll('button'))
      .filter((btn) => {
        const text = (btn.textContent || '').trim();
        return ['Meine', 'Neu', 'Jetzt eintragen', 'Vertretung anfordern'].some((label) => text.includes(label));
      })
      .map((btn) => {
        const rect = btn.getBoundingClientRect();
        return {
          label: (btn.textContent || '').trim().slice(0, 40),
          width: Math.round(rect.width),
          height: Math.round(rect.height)
        };
      });

    const tooSmall = targets.filter((t) => t.height < 36);
    return { targets, tooSmall };
  });
}

const SMALL_VIEWPORTS = [
  { name: 'iphone-se-1st', width: 320, height: 568 },
  { name: 'small-android', width: 360, height: 640 },
  { name: 'iphone-8', width: 375, height: 667 }
];

test.describe('Dienstplan UX audit (small smartphones)', () => {
  for (const vp of SMALL_VIEWPORTS) {
    test(`${vp.name}: no overflow, no collisions, adequate touch targets`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      const token = await loginAsAdmin(page);
      await seedPlanEntry(page, token);

      await page.goto('/dienstplaner', { waitUntil: 'domcontentloaded' });
      await expect(page.getByRole('heading', { name: 'Dienstplaner' }).first()).toBeVisible();

      const overflow = await collectOverflowMetrics(page);
      expect(overflow.hasHorizontalOverflow, `${vp.name} overflow: ${JSON.stringify(overflow)}`).toBeFalsy();

      const collisions = await collectCardCollisionMetrics(page);
      expect(collisions.overlapCount, `${vp.name} collisions: ${JSON.stringify(collisions)}`).toBe(0);

      const touchTargets = await collectTouchTargetMetrics(page);
      expect(touchTargets.tooSmall, `${vp.name} touch targets: ${JSON.stringify(touchTargets)}`).toEqual([]);
    });
  }
});
