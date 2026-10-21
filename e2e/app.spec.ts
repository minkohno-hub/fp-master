import { expect, test, type Page } from '@playwright/test';

async function answerCurrent(page: Page) {
  // 正誤式なら〇、択一式なら1番（解答欄の最初のボタン）を選ぶ。正誤は問わない
  await page.locator('fieldset button').first().click();
}

test('初回起動：架空の成績を表示せず、すぐに5問解ける', async ({ page }) => {
  await page.goto('./');
  await expect(page.getByText('はじめに')).toBeVisible();
  await expect(page.getByText('累計解答')).toHaveCount(0);
  await page.getByRole('link', { name: 'すぐに5問解く' }).click();
  await expect(page.getByText('1 / 5')).toBeVisible();
  for (let i = 0; i < 5; i++) {
    await answerCurrent(page);
    await expect(page.getByRole('status').filter({ hasText: /正解|不正解/ }).first()).toBeVisible();
    await page.getByRole('button', { name: /次の問題へ|結果を見る/ }).click();
  }
  await expect(page.getByText('正答率')).toBeVisible();
  await page.getByRole('link', { name: 'ホームに戻る' }).click();
  await expect(page.getByText('累計解答')).toBeVisible();
});

for (const grade of ['3級', '2級']) {
  test(`通常演習（100問ノック）に計算問題が混入しない：${grade}`, async ({ page }) => {
    test.setTimeout(240_000);
    await page.goto('./#/practice');
    await page.getByRole('radio', { name: grade }).click();
    await expect(page.getByText(/計算問題を除く/)).toBeVisible();
    await page.getByRole('button', { name: '100問ノック' }).click();
    await page.getByRole('button', { name: /この条件で開始/ }).click();
    for (let i = 0; i < 100; i++) {
      await expect(page.locator('fieldset').first()).toBeVisible();
      await expect(page.locator('.badge', { hasText: /^計算$/ })).toHaveCount(0);
      await answerCurrent(page);
      const next = page.getByRole('button', { name: /次の問題へ|結果を見る/ });
      const label = await next.textContent();
      await next.click();
      if (label?.includes('結果')) break;
    }
    await expect(page.getByText(/正答率/)).toBeVisible();
  });
}

test('2級／3級・学科／実技の切り替え', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('radio', { name: '2級' }).click();
  await expect(page.getByRole('heading', { name: '2級 学科' })).toBeVisible();
  await page.getByRole('radio', { name: '実技' }).click();
  await expect(page.getByRole('heading', { name: /2級 実技/ })).toBeVisible();
  await page.goto('./#/practice');
  await expect(page.getByText(/実技（資産設計提案業務）の問題は現在準備中/)).toBeVisible();
});

test('計算トレーニング：答え合わせと計算過程の表示', async ({ page }) => {
  await page.goto('./#/calc');
  await page.getByRole('link', { name: '単利・複利' }).click();
  await page.getByLabel('答えを入力').fill('1');
  await page.getByRole('button', { name: '答え合わせ' }).click();
  await expect(page.getByText(/不正解　正解は|正解！/)).toBeVisible();
  await expect(page.getByRole('heading', { name: '計算過程' })).toBeVisible();
  await page.getByRole('button', { name: '数値を変えて再挑戦' }).click();
  await expect(page.getByLabel('答えを入力')).toHaveValue('');
});

test('電卓は浮動小数点誤差を出さない', async ({ page }) => {
  await page.goto('./#/calc/run/interest?d=1');
  await page.getByRole('button', { name: '電卓' }).click();
  for (const k of ['0', '.', '1', '+', '0', '.', '2', '=']) await page.getByRole('button', { name: k, exact: true }).click();
  await expect(page.getByLabel('電卓')).toContainText('0.3');
  await expect(page.getByLabel('電卓')).not.toContainText('0.30000000000000004');
});

test('模擬試験：計算問題を含み、採点できる', async ({ page }) => {
  await page.goto('./#/mock');
  await page.getByRole('button', { name: /3級 学科 2026年5月公表/ }).click();
  await expect(page.getByText(/60問（うち計算問題 [1-9]\d*問）/)).toBeVisible();
  await page.getByRole('button', { name: '開始する' }).click();
  await expect(page.getByRole('timer')).toBeVisible();
  await answerCurrent(page);
  await page.getByRole('button', { name: '後で見直す' }).click();
  await page.getByRole('button', { name: '採点' }).click();
  await page.getByRole('button', { name: '採点する' }).click();
  await expect(page.getByText(/合格基準（36点）/)).toBeVisible();
  await expect(page.getByRole('heading', { name: '分野別の成績' })).toBeVisible();
});

test('用語検索と暗記カード', async ({ page }) => {
  await page.goto('./#/glossary');
  await page.getByLabel('用語を検索').fill('繰下げ');
  await page.getByRole('link', { name: /繰下げ受給/ }).click();
  await expect(page.getByRole('heading', { name: '繰下げ受給' })).toBeVisible();
  await expect(page.getByText('根拠照合済み')).toBeVisible();
  await page.getByRole('link', { name: '暗記カード' }).first().click();
  await page.getByRole('button', { name: /表面/ }).click();
  await expect(page.getByRole('button', { name: /裏面/ })).toBeVisible();
  await page.getByRole('button', { name: '覚えた' }).click();
});

test('バックアップ・復元（往復でデータが保持される）', async ({ page }) => {
  await page.goto('./#/practice?quick=5');
  await answerCurrent(page);
  await page.getByRole('button', { name: /次の問題へ/ }).click();
  await page.goto('./#/data');
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'JSONファイルに書き出す' }).click()]);
  const path = await download.path();
  await page.getByLabel('バックアップファイルを選択').setInputFiles(path!);
  await expect(page.getByText('解答履歴')).toBeVisible();
  await page.getByRole('button', { name: '復元する' }).click();
  await expect(page.getByText('復元しました。')).toBeVisible();
  // 壊れたファイルは復元しない
  await page.getByLabel('バックアップファイルを選択').setInputFiles({ name: 'x.json', mimeType: 'application/json', buffer: Buffer.from('{broken') });
  await expect(page.getByText(/JSONとして読み込めません/)).toBeVisible();
  await expect(page.getByRole('button', { name: '復元する' })).toHaveCount(0);
});

test('中断した演習を再開できる', async ({ page }) => {
  await page.goto('./#/practice?quick=5');
  await answerCurrent(page);
  await page.getByRole('button', { name: /次の問題へ/ }).click();
  await page.getByRole('button', { name: /中断/ }).click();
  await page.reload();
  await page.getByRole('link', { name: /続きから再開/ }).click();
  await expect(page.getByText('2 / 5')).toBeVisible();
});

test('オフラインでも起動・演習できる', async ({ page, context }) => {
  await page.goto('./');
  await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.ready;
    return !!reg.active;
  });
  await page.reload();
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  await context.setOffline(true);
  await page.reload();
  await page.getByRole('link', { name: 'すぐに5問解く' }).click();
  await expect(page.getByText('1 / 5')).toBeVisible();
  await context.setOffline(false);
});
