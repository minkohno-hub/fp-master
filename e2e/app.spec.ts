import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFile } from 'node:fs/promises';
import { navigate } from './helpers';

test('core screens pass automated WCAG AA checks in desktop and mobile layouts', async ({ page }) => {
  await page.goto('./');
  async function check(screen: string) {
    const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
    expect(result.violations.map((violation) => ({ id: violation.id, targets: violation.nodes.map((node) => node.target) })), screen).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), `${screen}: horizontal overflow`).toBe(true);
  }
  await check('ホーム');
  for (const screen of ['問題演習', '計算トレーニング', '用語集', '設定・バックアップ']) {
    await navigate(page, screen);
    await check(screen);
  }
  await page.getByRole('combobox', { name: '表示モード' }).selectOption('dark');
  await check('設定・バックアップ（ダーク）');
  await navigate(page, 'ホーム');
  await check('ホーム（ダーク）');
  await page.setViewportSize({ width: 320, height: 700 });
  await navigate(page, '計算トレーニング');
  await check('計算トレーニング（幅320px）');
  await navigate(page, '用語集');
  await check('用語集（幅320px）');
});

test('Pages subpath renders without layout overflow or browser errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  const response = await page.goto('./');
  expect(response?.status()).toBe(200);
  await expect(page.getByRole('main')).toBeVisible();
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page).toHaveTitle(/FP Master/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  const manifestHref = await page.locator('link[rel="manifest"]').getAttribute('href');
  expect(manifestHref).toContain('/fp-master/');
  const manifest = await (await page.request.get(manifestHref!)).json();
  expect(manifest.start_url).toBe('/fp-master/');
  expect(manifest.scope).toBe('/fp-master/');
  expect(manifest.icons).toHaveLength(3);
  expect(errors).toEqual([]);
});

test('installed app shell reloads offline at the GitHub Pages path', async ({ page, context }) => {
  await page.goto('./');
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  // The first install intentionally does not claim existing clients. Reload while
  // online so the next navigation is controlled by the installed worker.
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  const heading = await page.getByRole('heading', { level: 1 }).innerText();
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(heading);
  await expect(page.getByRole('main')).toBeVisible();
  await context.setOffline(false);
});

test('unverified material is not served, theme persists and backup restores safely', async ({ page }) => {
  await page.goto('./');
  await expect(page.getByText('教材品質の確認を進めています', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'すぐに5問解く' }).click();
  await expect(page.getByRole('status').filter({ hasText: '条件に合う確認済み問題は0問' })).toBeVisible();
  await expect(page.getByRole('group', { name: '回答の選択肢' })).toHaveCount(0);
  await navigate(page, '設定・バックアップ');
  await page.getByRole('combobox', { name: '表示モード' }).selectOption('dark');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await navigate(page, '設定・バックアップ');
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'JSONをエクスポート', exact: true }).click();
  const download = await downloadPromise;
  const filePath = await download.path();
  const json = await readFile(filePath!, 'utf8');
  expect(JSON.parse(json).app).toBe('fp-master');
  expect(JSON.parse(json).state.attempts).toHaveLength(0);
  await page.getByRole('textbox', { name: 'またはJSONを貼り付け' }).fill('{invalid');
  await page.getByRole('button', { name: '復元内容を確認', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('textbox', { name: 'またはJSONを貼り付け' }).fill(json);
  await page.getByRole('button', { name: '復元内容を確認', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('回答 0件');
  await page.getByRole('button', { name: '統合して復元する', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: '復元しました。追加した回答 0件' })).toBeVisible();
  await expect(page.getByRole('combobox', { name: '表示モード' })).toHaveValue('dark');
  await navigate(page, '学習履歴');
  await expect(page.getByRole('heading', { name: 'まだ回答履歴はありません' })).toBeVisible();
});
