import type { QuestionSet } from '../domain/types';

/**
 * 問題セットの遅延読み込み。各JSONは別チャンクとして分割され、PWAでプリキャッシュされる。
 */
const loaders = import.meta.glob<{ default: QuestionSet }>('./questions/*.json');

export const QUESTION_SET_IDS = Object.keys(loaders)
  .map((p) => p.replace('./questions/', '').replace('.json', ''))
  .sort();

/**
 * 動的 import の一時的な失敗（SW のプリキャッシュ競合や低速回線でのフェッチ失敗）に対する
 * リトライ付き読み込み。指数バックオフで最大3回まで試行する。
 */
export async function importWithRetry<T>(load: () => Promise<T>, attempts = 3): Promise<T> {
  let lastError: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await load();
    } catch (e) {
      lastError = e;
      if (i + 1 < attempts) {
        await new Promise((resolve) => setTimeout(resolve, 300 * 2 ** i));
      }
    }
  }
  throw lastError;
}

export async function loadQuestionSet(id: string): Promise<QuestionSet> {
  const loader = loaders[`./questions/${id}.json`];
  if (!loader) throw new Error(`unknown question set: ${id}`);
  return (await importWithRetry(loader)).default;
}

export async function loadAllQuestionSets(): Promise<QuestionSet[]> {
  return Promise.all(QUESTION_SET_IDS.map(loadQuestionSet));
}
