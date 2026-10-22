import { db, type Attempt, type ItemKind, type StudySession } from './db';
import { localDate, review, type Rating } from '../domain/srs';
import { buildItemStats } from '../domain/stats';
import { weakFieldsFrom, type UserState } from '../domain/selection';
import type { FieldId } from '../domain/types';

export const srsKey = (kind: ItemKind, id: string) => `${kind === 'card' ? 'c' : kind === 'calc' ? 'k' : 'q'}:${id}`;

/** 解答を記録し、間隔反復のスケジュールを更新する */
export async function recordAttempt(a: Omit<Attempt, 'id' | 'at'> & { at?: string }, rating?: Rating): Promise<void> {
  const at = a.at ?? new Date().toISOString();
  const today = localDate(new Date(at));
  await db.transaction('rw', db.attempts, db.srs, async () => {
    await db.attempts.add({ ...a, at });
    if (rating && a.itemKind !== 'calc') {
      const key = srsKey(a.itemKind, a.itemId);
      const prev = await db.srs.get(key);
      await db.srs.put({ key, ...review(prev, rating, today) });
    }
  });
}

export async function toggleFlag(table: 'bookmarks' | 'later', key: string): Promise<boolean> {
  const t = db[table];
  const exists = await t.get(key);
  if (exists) {
    await t.delete(key);
    return false;
  }
  await t.put({ key, createdAt: new Date().toISOString() });
  return true;
}

export async function saveSession(s: StudySession): Promise<void> {
  await db.sessions.put({ ...s, updatedAt: new Date().toISOString() });
}

/** 中断中のセッション（最新） */
export async function latestUnfinished(kind?: StudySession['kind']): Promise<StudySession | undefined> {
  const all = await db.sessions.orderBy('updatedAt').reverse().toArray();
  return all.find((s) => !s.finishedAt && (!kind || s.kind === kind));
}

/** 出題選択のためのユーザー状態 */
export async function loadUserState(): Promise<UserState> {
  const [attempts, srs, bookmarks, later] = await Promise.all([
    db.attempts.where('itemKind').equals('question').toArray(),
    db.srs.toArray(),
    db.bookmarks.toArray(),
    db.later.toArray(),
  ]);
  const dueMap = new Map(srs.filter((s) => s.key.startsWith('q:')).map((s) => [s.key.slice(2), s.due]));
  const stats = buildItemStats(attempts, dueMap);
  const perField: Partial<Record<FieldId, { attempts: number; correct: number }>> = {};
  for (const a of attempts) {
    const v = (perField[a.field] ??= { attempts: 0, correct: 0 });
    v.attempts++;
    if (a.correct) v.correct++;
  }
  return {
    stats,
    bookmarks: new Set(bookmarks.map((b) => b.key)),
    later: new Set(later.map((b) => b.key)),
    today: localDate(),
    weakFields: weakFieldsFrom(perField),
  };
}
