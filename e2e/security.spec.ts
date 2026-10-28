import { expect, test } from '@playwright/test';

// CSP（meta）で違反が出ないこと＝外部通信・インラインスクリプトに依存していない
test('CSP違反なしで主要画面が動く', async ({ page }) => {
  const violations: string[] = [];
  page.on('console', (m) => {
    if (/Content Security Policy|Refused to/i.test(m.text())) violations.push(m.text());
  });
  for (const r of ['./', './#/practice', './#/calc', './#/glossary', './#/law', './#/stats', './#/q/j2-202409-24', './#/q/g3-202605-01']) {
    await page.goto(r);
    await page.waitForLoadState('networkidle');
    await expect(page.locator('main')).toBeVisible();
  }
  expect(violations).toEqual([]);
});

test('外部ホストへの通信を行わない', async ({ page }) => {
  const external: string[] = [];
  page.on('request', (rq) => {
    const u = new URL(rq.url());
    if (!['localhost', '127.0.0.1'].includes(u.hostname) && u.protocol.startsWith('http')) external.push(rq.url());
  });
  await page.goto('./');
  await page.goto('./#/practice');
  await page.goto('./#/law');
  await page.waitForLoadState('networkidle');
  expect(external).toEqual([]);
});
