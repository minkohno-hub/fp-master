import { expect, test } from '@playwright/test';
import { answerKnowledge, fixtureUrl, navigate } from './helpers';

test.beforeEach(async ({ page }) => {
  await page.goto(fixtureUrl);
  await expect(page.getByTestId('fixture-warning')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'FP Master' })).toBeVisible();
});

test('five-question practice, explanation, bookmark, note and durable resume', async ({ page }) => {
  await page.getByRole('button', { name: 'すぐに5問解く' }).click();
  await expect(page.getByText('問題 1 / 5', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: '正解です', exact: true })).toHaveCount(0);
  await expect(page.getByText('出題されてはいけない未確認のテスト問題')).toHaveCount(0);
  const prompt = await page.locator('.question-panel h1').innerText();
  await page.getByRole('button', { name: '☆ ブックマーク', exact: true }).click();
  await expect(page.getByRole('button', { name: '★ ブックマーク済み', exact: true })).toBeVisible();
  await answerKnowledge(page);
  await page.getByRole('button', { name: '詳細', exact: true }).click();
  await expect(page.getByRole('heading', { name: '選択肢ごとの解説' })).toBeVisible();
  await page.getByRole('textbox', { name: '間違いノート' }).fill('自動テスト専用のノート');
  await page.getByRole('button', { name: 'ノートを保存', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'ノートを保存しました' })).toBeVisible();
  await page.getByRole('button', { name: '中断する', exact: true }).click();
  await page.reload();
  await page.getByRole('button', { name: '続きを再開 →', exact: true }).click();
  await expect(page.locator('.question-panel h1')).toHaveText(prompt);
  await expect(page.getByRole('heading', { name: '正解です', exact: true })).toBeVisible();
  for (let index = 1; index <= 5; index++) {
    if (index > 1) {
      await expect(page.getByText(`問題 ${index} / 5`, { exact: true })).toBeVisible();
      await answerKnowledge(page);
    }
    await page.getByRole('button', { name: index === 5 ? '結果を見る →' : '次の問題へ →', exact: true }).click();
  }
  await expect(page.getByRole('status').filter({ hasText: '5問中5問正解' })).toBeVisible();
  await navigate(page, '保存・間違いノート');
  await expect(page.getByRole('heading', { name: 'ブックマーク 1件' })).toBeVisible();
  await expect(page.getByText('自動テスト専用のノート', { exact: true })).toBeVisible();
  await navigate(page, '学習履歴');
  await expect(page.locator('.history-list li')).toHaveCount(5);
});

test('one hundred questions finish once each without calculation mixing', async ({ page }) => {
  test.setTimeout(120_000);
  await navigate(page, '問題演習');
  await page.getByRole('combobox', { name: '問題数' }).selectOption('100');
  await expect(page.getByRole('spinbutton', { name: '出題数（1〜1000問）' })).toHaveValue('100');
  await page.getByRole('button', { name: '100問の通常演習を開始 →', exact: true }).click();
  const prompts = new Set<string>();
  for (let index = 1; index <= 100; index++) {
    await expect(page.getByText(`問題 ${index} / 100`, { exact: true })).toBeVisible();
    const prompt = await page.locator('.question-panel h1').innerText();
    expect(prompt).toContain('知識問題');
    expect(prompts.has(prompt)).toBe(false);
    prompts.add(prompt);
    await answerKnowledge(page);
    await page.getByRole('button', { name: index === 100 ? '結果を見る →' : '次の問題へ →', exact: true }).click();
  }
  expect(prompts.size).toBe(100);
  await expect(page.getByRole('status').filter({ hasText: '100問中100問正解' })).toBeVisible();
  await navigate(page, '学習履歴');
  await expect(page.locator('.history-list li')).toHaveCount(100);
});

test('calculation accepts numeric input and keeps its own mode', async ({ page }) => {
  await navigate(page, '計算トレーニング');
  await page.getByRole('button', { name: '1問の計算トレーニングを開始 →', exact: true }).click();
  await expect(page.getByText('計算 / FP3級', { exact: true })).toBeVisible();
  await expect(page.getByRole('status').filter({ hasText: '出題可能1問' })).toBeVisible();
  await page.getByRole('textbox', { name: '数値で回答（テスト単位）' }).fill('120');
  await page.getByRole('button', { name: '回答する', exact: true }).click();
  await expect(page.getByRole('heading', { name: '正解です', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '詳細', exact: true }).click();
  await expect(page.getByText('10 × 12 = 120', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '結果を見る →', exact: true }).click();
  await navigate(page, '学習履歴');
  await expect(page.locator('.history-list')).toContainText('calculation');
});

test('glossary search, detail, favorites and flashcard self-rating', async ({ page }) => {
  await navigate(page, '用語集');
  await page.getByRole('searchbox', { name: '用語を検索', exact: true }).fill('テスト');
  await page.getByRole('button', { name: 'テスト用語', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('検索と問題連携を確認するための合成データです。');
  await page.getByRole('dialog').getByRole('button', { name: /閉じる/ }).click();
  await page.getByRole('button', { name: '☆ お気に入り', exact: true }).click();
  await expect(page.getByRole('button', { name: '★ お気に入り', exact: true })).toBeVisible();
  await navigate(page, '暗記カード');
  await page.getByRole('button', { name: /用語 ・ タップで裏返す/ }).click();
  await expect(page.getByText('自動テスト専用の用語説明です。', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '覚えた', exact: true }).click();
  await expect(page.getByRole('button', { name: /用語 ・ タップで裏返す/ })).toBeVisible();
});

test('keyboard shortcuts answer and advance from the question heading', async ({ page }) => {
  await page.getByRole('button', { name: 'すぐに5問解く' }).click();
  await page.locator('.question-panel h1').focus();
  await page.keyboard.press('2');
  await expect(page.getByRole('heading', { name: '正解です', exact: true })).toBeVisible();
  await page.locator('.question-panel h1').focus();
  await page.keyboard.press('Enter');
  await expect(page.getByText('問題 2 / 5', { exact: true })).toBeVisible();
});
