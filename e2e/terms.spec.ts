import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

// 用語リンク：問題文／選択肢／解説から開け、解答操作や元の画面の状態を妨げない
const Q = './#/q/g2-202405-34'; // 選択肢に「基礎控除」「配偶者控除」を含む

const popup = (page: Page) => page.getByTestId('term-popup');

test('選択肢の用語をタップすると説明が出て、選択状態や解答操作を妨げない', async ({ page }) => {
  await page.goto(Q);
  const choice1 = page.getByRole('button', { name: '選択肢1', exact: true });
  await expect(choice1).toBeVisible();
  // 選択肢1の「基礎控除」をタップ → ポップアップ（解答前は概念の説明のみ）
  await page.locator('[data-term="kiso-kojo"]').first().click();
  await expect(popup(page)).toBeVisible();
  await expect(popup(page).getByRole('heading', { name: '基礎控除' })).toBeVisible();
  await expect(popup(page).getByText('解答を確定したあとに表示されます')).toBeVisible();
  await expect(popup(page).getByText('重要な数字・条件')).toHaveCount(0);
  // 閉じて問題に戻る：まだ解答されていない
  await popup(page).getByRole('button', { name: '閉じて問題に戻る' }).click();
  await expect(popup(page)).toHaveCount(0);
  await expect(page.getByRole('region', { name: '解説' })).toHaveCount(0);
  // 選択肢の行（用語以外の部分）をタップすると通常どおり解答できる
  await choice1.click({ position: { x: 5, y: 5 } });
  await expect(page.getByRole('region', { name: '解説' })).toBeVisible();
});

test('解答後は詳しい説明（数字・例外・比較）まで読め、Escで閉じてフォーカスが戻る', async ({ page }) => {
  await page.goto(Q);
  await page.getByRole('button', { name: '選択肢1', exact: true }).click({ position: { x: 5, y: 5 } });
  await expect(page.getByRole('region', { name: '解説' })).toBeVisible();
  const link = page.locator('[data-term="kiso-kojo"]').first();
  await link.click();
  await expect(popup(page)).toBeVisible();
  await expect(popup(page).getByText('重要な数字・条件')).toBeVisible();
  await expect(popup(page).getByText(/2,500万円超は0円/)).toBeVisible();
  await expect(popup(page).getByText('例外・注意点')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(popup(page)).toHaveCount(0);
  // 解答状況は保持される
  await expect(page.getByRole('region', { name: '解説' })).toBeVisible();
});

test('お気に入り登録と、用語集の詳細ページ・元の画面へ戻る', async ({ page }) => {
  await page.goto(Q);
  await page.getByRole('button', { name: '選択肢1', exact: true }).click({ position: { x: 5, y: 5 } });
  await page.locator('[data-term="kiso-kojo"]').first().click();
  await popup(page).getByRole('button', { name: /お気に入り/ }).click();
  await expect(popup(page).getByRole('button', { name: /お気に入り/ })).toHaveAttribute('aria-pressed', 'true');
  await popup(page).getByRole('link', { name: '用語集で詳しく見る' }).click();
  await expect(page.getByRole('heading', { name: '基礎控除', level: 1 })).toBeVisible();
  await expect(page.getByText('重要な数字・適用条件')).toBeVisible();
  await page.getByRole('button', { name: '← 元の画面に戻る' }).click();
  await expect(page.getByRole('button', { name: '選択肢1', exact: true })).toBeVisible();
});

test('用語集：読み仮名・カナ・別名で検索できる', async ({ page }) => {
  await page.goto('./#/glossary');
  const box = page.getByRole('searchbox', { name: '用語を検索' });
  await box.fill('きそこうじょ');
  await expect(page.getByRole('link', { name: /^基礎控除/ })).toBeVisible();
  await box.fill('キソコウジョ');
  await expect(page.getByRole('link', { name: /^基礎控除/ })).toBeVisible();
  await box.fill('ｎｉｓａ');
  await expect(page.getByRole('link', { name: /NISA/ }).first()).toBeVisible();
});

test('使い方（日本語説明書）の用語もタップできる', async ({ page }) => {
  await page.goto('./#/help');
  await expect(page.getByRole('heading', { name: '使い方（日本語説明書）' })).toBeVisible();
  const terms = page.locator('main [data-term]');
  expect(await terms.count()).toBeGreaterThan(0);
  await terms.first().click();
  await expect(popup(page)).toBeVisible();
});

for (const scheme of ['light', 'dark'] as const) {
  test(`a11y：用語ポップアップ（${scheme}）`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await page.goto(Q);
    await page.getByRole('button', { name: '選択肢1', exact: true }).click({ position: { x: 5, y: 5 } });
    await page.locator('[data-term="kiso-kojo"]').first().click();
    await expect(popup(page)).toBeVisible();
    const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
    const bad = r.violations.map((v) => `${v.id}（${v.impact}）: ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`);
    expect(bad, bad.join('\n')).toEqual([]);
  });
}

test('スマホ幅ではボトムシート（モーダル）、PC幅ではサイドパネル（非モーダル）', async ({ page, viewport }) => {
  await page.goto(Q);
  await page.locator('[data-term="kiso-kojo"]').first().click();
  const modal = await popup(page).getAttribute('aria-modal');
  expect(modal).toBe((viewport?.width ?? 0) >= 1100 ? 'false' : 'true');
});
