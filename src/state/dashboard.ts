import { db } from '../db/db';
import { localDate, daysBetween } from '../domain/srs';
import { accuracy, accuracyByField, localDayOf, studyStreak } from '../domain/stats';
import type { ExamKey, Question } from '../domain/types';
import { weakFieldsFrom } from '../domain/selection';

export interface Dashboard {
  todayCount: number;
  totalAttempts: number;
  accuracy: number | null;
  streak: number;
  dueQuestions: number;
  dueCards: number;
  unlearned: number;
  poolSize: number;
  byField: ReturnType<typeof accuracyByField>;
  weakFields: ReturnType<typeof weakFieldsFrom>;
  lastMock: { score: number; max: number; passed: boolean; finishedAt: string } | null;
  daysToExam: number | null;
  hasHistory: boolean;
}

/** ホームに表示する集計（初回利用時は架空の値を出さず hasHistory=false） */
export async function loadDashboard(exam: ExamKey, pool: Question[], examDate: string | null): Promise<Dashboard> {
  const today = localDate();
  const ids = new Set(pool.map((q) => q.id));
  const [attempts, srs, mocks] = await Promise.all([db.attempts.toArray(), db.srs.toArray(), db.mockResults.where('exam').equals(exam).toArray()]);
  const qAttempts = attempts.filter((a) => a.itemKind === 'question' && ids.has(a.itemId));
  const days = new Set(attempts.map((a) => localDayOf(a.at)));
  const attempted = new Set(qAttempts.map((a) => a.itemId));
  const byField = accuracyByField(qAttempts);
  const perField = Object.fromEntries(Object.entries(byField).map(([f, v]) => [f, { attempts: v.attempts, correct: v.correct }]));
  const lastMock = mocks.sort((a, b) => (a.finishedAt < b.finishedAt ? 1 : -1))[0];
  return {
    todayCount: attempts.filter((a) => localDayOf(a.at) === today && a.itemKind !== 'card').length,
    totalAttempts: qAttempts.length,
    accuracy: accuracy(qAttempts).rate,
    streak: studyStreak(days, today),
    dueQuestions: srs.filter((s) => s.key.startsWith('q:') && ids.has(s.key.slice(2)) && s.due <= today).length,
    dueCards: srs.filter((s) => s.key.startsWith('c:') && s.due <= today).length,
    unlearned: pool.filter((q) => !attempted.has(q.id)).length,
    poolSize: pool.length,
    byField,
    weakFields: weakFieldsFrom(perField),
    lastMock: lastMock ? { score: lastMock.score, max: lastMock.max, passed: lastMock.passed, finishedAt: lastMock.finishedAt } : null,
    daysToExam: examDate ? daysBetween(today, examDate) : null,
    hasHistory: attempts.length > 0,
  };
}
