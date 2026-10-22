import type { FieldId } from './types';
import type { ItemStat } from './selection';
import { addDays } from './srs';

/** 履歴1件（DBの attempts と同じ形の必要部分） */
export interface AttemptLike {
  itemId: string;
  itemKind: 'question' | 'card' | 'calc';
  field: FieldId;
  correct: boolean;
  unsure?: boolean;
  timeMs: number;
  at: string; // ISO
}

export function buildItemStats(attempts: AttemptLike[], dueMap?: Map<string, string>): Map<string, ItemStat> {
  const m = new Map<string, ItemStat>();
  const sorted = [...attempts].sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));
  for (const a of sorted) {
    const s = m.get(a.itemId) ?? { attempts: 0, correct: 0, lastCorrect: null, lastUnsure: false, lastAt: null, due: null };
    s.attempts++;
    if (a.correct) s.correct++;
    s.lastCorrect = a.correct;
    s.lastUnsure = !!a.unsure;
    s.lastAt = a.at;
    m.set(a.itemId, s);
  }
  if (dueMap) {
    for (const [id, due] of dueMap) {
      const s = m.get(id);
      if (s) s.due = due;
    }
  }
  return m;
}

export interface Accuracy {
  attempts: number;
  correct: number;
  rate: number | null;
}

export function accuracy(attempts: { correct: boolean }[]): Accuracy {
  const correct = attempts.filter((a) => a.correct).length;
  return { attempts: attempts.length, correct, rate: attempts.length ? correct / attempts.length : null };
}

export function accuracyByField(attempts: AttemptLike[]): Record<FieldId, Accuracy> {
  const out = {} as Record<FieldId, Accuracy>;
  for (const f of ['A', 'B', 'C', 'D', 'E', 'F'] as FieldId[]) {
    out[f] = accuracy(attempts.filter((a) => a.field === f));
  }
  return out;
}

/** ローカル日付（YYYY-MM-DD）。ISO文字列をローカルタイムゾーンで日付化 */
export function localDayOf(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** 連続学習日数（今日または昨日まで連続していれば継続扱い） */
export function studyStreak(days: Set<string>, today: string): number {
  let cur = days.has(today) ? today : addDays(today, -1);
  let n = 0;
  while (days.has(cur)) {
    n++;
    cur = addDays(cur, -1);
  }
  return n;
}

/** 日別正答率の推移（直近 n 日、解答のない日は null） */
export function dailyTrend(attempts: AttemptLike[], today: string, n: number): { day: string; rate: number | null; count: number }[] {
  const byDay = new Map<string, { c: number; t: number }>();
  for (const a of attempts) {
    const d = localDayOf(a.at);
    const v = byDay.get(d) ?? { c: 0, t: 0 };
    v.t++;
    if (a.correct) v.c++;
    byDay.set(d, v);
  }
  const out = [];
  for (let i = n - 1; i >= 0; i--) {
    const day = addDays(today, -i);
    const v = byDay.get(day);
    out.push({ day, rate: v ? v.c / v.t : null, count: v?.t ?? 0 });
  }
  return out;
}

/** 解答速度（中央値, ms）。外れ値（5分超）は除外 */
export function medianTimeMs(attempts: { timeMs: number }[]): number | null {
  const xs = attempts.map((a) => a.timeMs).filter((t) => t > 0 && t <= 5 * 60 * 1000).sort((a, b) => a - b);
  if (!xs.length) return null;
  const mid = Math.floor(xs.length / 2);
  return xs.length % 2 ? xs[mid]! : (xs[mid - 1]! + xs[mid]!) / 2;
}
