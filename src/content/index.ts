import type { QuestionSet } from '../domain/types';

/**
 * 問題セットの遅延読み込み。各JSONは別チャンクとして分割され、PWAでプリキャッシュされる。
 */
const loaders = import.meta.glob<{ default: QuestionSet }>('./questions/*.json');

export const QUESTION_SET_IDS = Object.keys(loaders)
  .map((p) => p.replace('./questions/', '').replace('.json', ''))
  .sort();

export async function loadQuestionSet(id: string): Promise<QuestionSet> {
  const loader = loaders[`./questions/${id}.json`];
  if (!loader) throw new Error(`unknown question set: ${id}`);
  return (await loader()).default;
}

export async function loadAllQuestionSets(): Promise<QuestionSet[]> {
  return Promise.all(QUESTION_SET_IDS.map(loadQuestionSet));
}
