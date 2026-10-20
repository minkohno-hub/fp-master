import { expect, type Page } from '@playwright/test';
export const fixtureUrl = 'http://127.0.0.1:5174/fp-master/tests/fixture.html';
export async function navigate(page: Page, label: string): Promise<void> {
  const mobile = page.getByRole('navigation', { name: 'モバイルメニュー' });
  if (await mobile.isVisible()) {
    const direct = mobile.getByRole('button', { name: label, exact: true });
    if (await direct.count()) await direct.click();
    else {
      await mobile.getByRole('button', { name: 'その他', exact: true }).click();
      await page.locator('.more-menu').getByRole('button', { name: label, exact: false }).click();
    }
  } else {
    await page.getByRole('navigation', { name: 'メインメニュー' }).getByRole('button', { name: label, exact: true }).click();
  }
  await expect(page.getByRole('main')).toBeVisible();
}
export async function answerKnowledge(page: Page): Promise<void> {
  await page.getByRole('group', { name: '回答の選択肢' }).getByRole('button').nth(1).click();
  await expect(page.getByRole('heading', { name: '正解です', exact: true })).toBeVisible();
}
