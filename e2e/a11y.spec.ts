import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

// 主要画面のアクセシビリティ自動検査（axe-core・WCAG 2.x A/AA）。自動検査で拾える範囲のみで、手動確認の代わりにはならない
const ROUTES = [
  ['ホーム', './'],
  ['演習', './#/practice'],
  ['計算トレーニング', './#/calc'],
  ['用語集', './#/glossary'],
  ['カード', './#/cards'],
  ['復習', './#/review'],
  ['模擬試験', './#/mock'],
  ['統計', './#/stats'],
  ['学習計画', './#/plan'],
  ['設定', './#/settings'],
  ['データ管理', './#/data'],
  ['法改正', './#/law'],
  ['メニュー', './#/menu'],
  ['詳しい説明書', './#/guide'],
  ['問題（学科）', './#/q/g3-202605-01'],
  ['問題（2級実技・画像）', './#/q/j2-202409-24'],
] as const;

for (const scheme of ['light', 'dark'] as const) {
  for (const [name, url] of ROUTES) {
    test(`a11y：${name}（${scheme}）`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto(url);
      await page.waitForLoadState('networkidle');
      await expect(page.locator('main')).toBeVisible();
      const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
      const bad = r.violations.map((v) => `${v.id}（${v.impact}）: ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`);
      expect(bad, bad.join('\n')).toEqual([]);
    });
  }
}
