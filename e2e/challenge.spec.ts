import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

async function open2kyu(page: import('@playwright/test').Page) {
  await page.goto('./#/practice');
  await page.getByRole('radio', { name: '2級' }).click();
  await page.goto('./#/challenge');
  await expect(page.getByRole('heading', { name: '95%チャレンジ' })).toBeVisible();
}

test('95%チャレンジ：目標であり保証ではない旨と、モード選択から出題できる', async ({ page }) => {
  await open2kyu(page);
  await expect(page.getByText(/本試験での得点や合格を保証するものではありません/)).toBeVisible();
  await expect(page.getByText('まだ記録がありません')).toBeVisible();
  await page.getByRole('button', { name: /高難度を優先/ }).click();
  await expect(page).toHaveURL(/#\/session\//);
  await expect(page.locator('fieldset').first()).toBeVisible();
  // 高難度モードはオリジナル問題（Lv4以上）のみで、公式問題と誤認させない
  await expect(page.getByText('オリジナル', { exact: true }).first()).toBeVisible();
});

test('95%チャレンジ：解くと初見の正答率が記録・表示される', async ({ page }) => {
  await open2kyu(page);
  await page.getByRole('button', { name: /初見の問題を優先/ }).click();
  const sets = page.locator('fieldset');
  await expect(sets.first()).toBeVisible();
  const n = await sets.count();
  for (let i = 0; i < n; i++) await sets.nth(i).locator('button').first().click();
  const submit = page.getByRole('button', { name: '解答する' });
  if (n > 1 && (await submit.count()) > 0) await submit.click();
  await expect(page.getByRole('status').filter({ hasText: /正解|不正解/ }).first()).toBeVisible();
  // 解答は「次の問題へ」で確定・記録される
  await page.getByRole('button', { name: /次の問題へ|結果を見る/ }).click();
  await page.goto('./#/challenge');
  await expect(page.getByText('初見の正答率')).toBeVisible();
});

for (const scheme of ['light', 'dark'] as const) {
  test(`a11y：95%チャレンジ（${scheme}）`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await open2kyu(page);
    await page.waitForLoadState('networkidle');
    const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
    const bad = r.violations.map((v) => `${v.id}（${v.impact}）: ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`);
    expect(bad, bad.join('\n')).toEqual([]);
  });
}
