import type { Attempt } from '../domain/learning';
const KEY = 'fp-master.history.v1';
export interface HistoryState { attempts: Attempt[]; warning: string | null }
export function loadHistory(): HistoryState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {attempts: [], warning: null};
    const data: unknown = JSON.parse(raw);
    if (!Array.isArray(data) || !data.every(isAttempt)) throw new Error('Invalid history');
    return {attempts: data, warning: null};
  } catch { return {attempts: [], warning: '学習履歴を読み込めませんでした。この画面では新しい履歴で学習できますが、保存は行いません。'}; }
}
function isAttempt(value: unknown): value is Attempt {
  if (!value || typeof value !== 'object') return false;
  const a = value as Record<string, unknown>;
  return typeof a.id === 'string' && typeof a.questionId === 'string' && typeof a.selected === 'number' && Number.isInteger(a.selected) && a.selected >= 0 && typeof a.correct === 'boolean' && typeof a.answeredAt === 'string' && Number.isFinite(Date.parse(a.answeredAt));
}
export function saveHistory(attempts: Attempt[]): boolean {
  try { localStorage.setItem(KEY, JSON.stringify(attempts)); return true; } catch { return false; }
}
