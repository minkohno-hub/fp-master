import { expect, test } from '@playwright/test';

const QID = 'g2-202405-02';

test('選択肢の用語チップから定義を開き、解答状態を保ったまま閉じられる', async ({ page }) => {
  await page.goto(`./#/q/${QID}`);
  const group = page.getByRole('group', { name: 'この選択肢の用語' }).first();
  await expect(group).toBeVisible();
  const chip = group.getByRole('button', { name: '可処分所得' });
  await chip.click();
  const dialog = page.getByRole('dialog', { name: '可処分所得' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('link', { name: '詳しく見る' })).toBeVisible();
  // 用語を開いただけでは解答は確定しない
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^1\s/ })).toHaveAttribute('aria-pressed', 'false');
});

test('解説の本文（標準・詳細）の用語からも定義を開ける', async ({ page }) => {
  await page.goto(`./#/q/${QID}`);
  await page.locator('fieldset button[aria-pressed]').first().click();
  await page.getByRole('button', { name: '標準', exact: true }).click();
  const section = page.getByRole('region', { name: '解説' });
  const links = section.locator('button[aria-haspopup="dialog"]');
  await expect(links.first()).toBeVisible();
  const name = (await links.first().textContent())!;
  await links.first().click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('dialog').getByRole('heading').first()).toBeVisible();
  await page.getByRole('button', { name: '閉じる' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  // 閉じたあとも解説と解答結果が残っている
  await expect(section).toContainText('正解');
  expect(name.length).toBeGreaterThan(0);
});
