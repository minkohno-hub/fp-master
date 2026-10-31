import { expect, test } from '@playwright/test';

test('用語集：カタカナの読み検索でひらがな読みの用語が見つかる', async ({ page }) => {
  await page.goto('./#/glossary');
  await page.getByLabel('用語を検索').fill('キソコウジョ');
  await expect(page.getByRole('link', { name: /基礎控除/ }).first()).toBeVisible();
});

test('用語集：重要度フィルタで件数が絞り込まれる', async ({ page }) => {
  await page.goto('./#/glossary');
  const sub = page.locator('h1 + *, [class*="sub"]').first();
  const before = await page.locator('main').innerText();
  const m1 = before.match(/(\d+)語（/);
  await page.getByLabel('重要度で絞り込み').selectOption('3');
  const after = await page.locator('main').innerText();
  const m2 = after.match(/(\d+)語（/);
  expect(m1 && m2).toBeTruthy();
  expect(Number(m2![1])).toBeLessThan(Number(m1![1]));
  expect(sub).toBeDefined();
});

test('用語ポップアップ内でお気に入りを付けると、用語集のお気に入り絞り込みに残る', async ({ page }) => {
  await page.goto('./#/q/g2-202405-02');
  const group = page.getByRole('group', { name: 'この選択肢の用語' }).first();
  await group.getByRole('button', { name: '可処分所得' }).click();
  const dialog = page.getByRole('dialog', { name: '可処分所得' });
  await expect(dialog).toBeVisible();
  const fav = dialog.getByRole('button', { name: /お気に入り/ });
  await expect(fav).toHaveAttribute('aria-pressed', 'false');
  await fav.click();
  await expect(fav).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('Escape');
  await page.goto('./#/glossary');
  await page.getByRole('button', { name: '★お気に入り' }).click();
  await expect(page.getByRole('link', { name: /可処分所得/ }).first()).toBeVisible();
});

test('説明書（ガイド）の本文中の用語からポップアップが開く', async ({ page }) => {
  await page.goto('./#/guide');
  const link = page.getByRole('button', { name: '法定相続分', exact: true }).first();
  await link.scrollIntoViewIfNeeded();
  await link.click();
  const dialog = page.getByRole('dialog', { name: /法定相続分/ });
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
});

test('用語詳細から「元の問題に戻る」で問題へ戻り、解答の下書きが保持される', async ({ page }) => {
  await page.goto('./#/q/g2-202405-02');
  // 選択肢を1つ選ぶ（下書きとして保持される）
  await page.locator('fieldset button[aria-pressed]').nth(1).click();
  const group = page.getByRole('group', { name: 'この選択肢の用語' }).first();
  await group.getByRole('button', { name: '可処分所得' }).click();
  const dialog = page.getByRole('dialog', { name: '可処分所得' });
  await dialog.getByRole('link', { name: '詳しく見る' }).click();
  await expect(page).toHaveURL(/glossary\/kashobun-shotoku/);
  await page.getByRole('link', { name: /元の問題に戻る/ }).click();
  await expect(page).toHaveURL(/q\/g2-202405-02/);
  await expect(page.locator('fieldset button[aria-pressed="true"]')).toHaveCount(1);
});
