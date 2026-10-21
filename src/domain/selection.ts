import type { ExamKey, FieldId, Question } from './types';
import { createRng, shuffle } from './random';

/** 1問ごとの学習状況（履歴から集計） */
export interface ItemStat {
  attempts: number;
  correct: number;
  lastCorrect: boolean | null;
  lastUnsure: boolean;
  lastAt: string | null;
  due: string | null;
}

export type PracticeFilter =
  | 'all'
  | 'unanswered'
  | 'wrong'
  | 'bookmarked'
  | 'later'
  | 'weak'
  | 'due'
  | 'unsure'
  | 'stale';

export interface PracticeConfig {
  exams: ExamKey[];
  count: number;
  filter: PracticeFilter;
  fields?: FieldId[];
  themes?: string[];
  /** 出典年月（YYYY-MM） */
  yearMonths?: string[];
  /** 通常演習に計算問題を含めるか（初期値 false） */
  includeCalc: boolean;
  /** 出題順：random=ランダム / ordered=問題番号順 */
  order: 'random' | 'ordered';
}

export interface UserState {
  stats: Map<string, ItemStat>;
  bookmarks: Set<string>;
  later: Set<string>;
  today: string;
  /** 苦手分野（正答率の低い順） */
  weakFields: FieldId[];
}

export const STALE_DAYS = 30;

/**
 * 出題可能な母集団。
 * 通常演習では status=verified のみ・計算問題は includeCalc=false なら除外する。
 */
export function eligibleForPractice(pool: Question[], cfg: Pick<PracticeConfig, 'exams' | 'includeCalc'>): Question[] {
  return pool.filter(
    (q) => q.status === 'verified' && cfg.exams.includes(q.exam) && (cfg.includeCalc || !q.requiresCalculation),
  );
}

/** 計算トレーニング用：計算が必要な検証済み問題のみ */
export function eligibleForCalc(pool: Question[], exams: ExamKey[]): Question[] {
  return pool.filter((q) => q.status === 'verified' && exams.includes(q.exam) && q.requiresCalculation);
}

export function applyFilter(qs: Question[], filter: PracticeFilter, u: UserState): Question[] {
  const st = (q: Question) => u.stats.get(q.id);
  switch (filter) {
    case 'all':
    case 'weak':
      return qs;
    case 'unanswered':
      return qs.filter((q) => !st(q) || st(q)!.attempts === 0);
    case 'wrong':
      return qs.filter((q) => st(q)?.lastCorrect === false);
    case 'bookmarked':
      return qs.filter((q) => u.bookmarks.has(q.id));
    case 'later':
      return qs.filter((q) => u.later.has(q.id));
    case 'due':
      return qs.filter((q) => {
        const d = st(q)?.due;
        return !!d && d <= u.today;
      });
    case 'unsure':
      return qs.filter((q) => st(q)?.lastCorrect === true && st(q)!.lastUnsure);
    case 'stale': {
      const limit = addDaysIso(u.today, -STALE_DAYS);
      return qs.filter((q) => {
        const last = st(q)?.lastAt;
        return !!last && last.slice(0, 10) <= limit;
      });
    }
  }
}

function addDaysIso(date: string, days: number): string {
  const t = new Date(`${date}T00:00:00Z`);
  t.setUTCDate(t.getUTCDate() + days);
  return t.toISOString().slice(0, 10);
}

export function selectQuestions(pool: Question[], cfg: PracticeConfig, u: UserState, seed: number): Question[] {
  let qs = eligibleForPractice(pool, cfg);
  if (cfg.fields?.length) qs = qs.filter((q) => cfg.fields!.includes(q.field));
  if (cfg.themes?.length) qs = qs.filter((q) => cfg.themes!.includes(q.theme));
  if (cfg.yearMonths?.length) {
    qs = qs.filter((q) => q.source.kind === 'official' && cfg.yearMonths!.includes(q.source.yearMonth));
  }
  qs = applyFilter(qs, cfg.filter, u);

  const rng = createRng(seed);
  if (cfg.order === 'ordered') {
    qs = [...qs].sort(compareQuestionOrder);
  } else if (cfg.filter === 'weak' || cfg.filter === 'due') {
    qs = prioritize(qs, cfg.filter, u, rng);
  } else {
    qs = shuffle(qs, rng);
  }
  return qs.slice(0, Math.max(0, cfg.count));
}

/** 苦手分野優先・復習予定は優先度順（同順位はランダム） */
function prioritize(qs: Question[], filter: PracticeFilter, u: UserState, rng: () => number): Question[] {
  const shuffled = shuffle(qs, rng);
  const score = (q: Question): number => {
    const s = u.stats.get(q.id);
    if (filter === 'due') return s?.due ? -Number(s.due.replaceAll('-', '')) : 0; // 期限が古い順
    const fieldRank = u.weakFields.indexOf(q.field);
    const fieldScore = fieldRank < 0 ? 0 : (u.weakFields.length - fieldRank) * 10;
    const acc = s && s.attempts > 0 ? s.correct / s.attempts : 0.5;
    const wrongBonus = s?.lastCorrect === false ? 20 : 0;
    return fieldScore + wrongBonus + (1 - acc) * 10;
  };
  return shuffled
    .map((q, i) => ({ q, i, s: score(q) }))
    .sort((a, b) => b.s - a.s || a.i - b.i)
    .map((x) => x.q);
}

export function compareQuestionOrder(a: Question, b: Question): number {
  const ka = orderKey(a);
  const kb = orderKey(b);
  return ka < kb ? -1 : ka > kb ? 1 : 0;
}

function orderKey(q: Question): string {
  if (q.source.kind === 'official') {
    return `${q.exam}|${q.source.yearMonth}|${String(q.source.number).padStart(3, '0')}`;
  }
  return `${q.exam}|zzzz|${q.id}`;
}

/** 分野別正答率から苦手分野を決める（最低解答数を満たす分野のみ） */
export function weakFieldsFrom(
  perField: Partial<Record<FieldId, { attempts: number; correct: number }>>,
  minAttempts = 5,
): FieldId[] {
  return (Object.entries(perField) as [FieldId, { attempts: number; correct: number }][])
    .filter(([, v]) => v.attempts >= minAttempts)
    .map(([f, v]) => ({ f, acc: v.correct / v.attempts }))
    .filter((x) => x.acc < 0.7)
    .sort((a, b) => a.acc - b.acc)
    .map((x) => x.f);
}
