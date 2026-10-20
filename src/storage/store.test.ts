import { afterEach, describe, expect, it } from 'vitest';
import { IDBFactory, IDBObjectStore } from 'fake-indexeddb';
import { openLearningStore, LEGACY_HISTORY_KEY, type LearningStore } from './store';
import { createLearningState, type LearningState, type StoredAttempt } from './types';
import { MAX_BACKUP_BYTES, parseBackup, parseLearningState } from './validation';

const now = '2026-10-20T10:00:00.000Z';
const attempt = (id = 'attempt-1'): StoredAttempt => ({ id, questionId: 'q-1', selected: 1, correct: true, answeredAt: now, grade: '3', exam: 'academic', mode: 'practice', durationMs: 1200 });
const stores: LearningStore[] = [];
async function open(options: Parameters<typeof openLearningStore>[0] = {}) {
  const store = await openLearningStore({ indexedDB: new IDBFactory(), legacyStorage: null, ...options });
  stores.push(store);
  return store;
}
function backup(state: LearningState) { return JSON.stringify({ app: 'fp-master', formatVersion: 1, exportedAt: now, state }); }
afterEach(() => { stores.forEach(store => store.close()); stores.length = 0; });
describe('IndexedDB persistence', () => {
  it('commits an answer and its resumed session together and restores them after reopening', async () => {
    const indexedDB = new IDBFactory();
    const store = await open({ indexedDB });
    const result = await store.update(state => ({ ...state, attempts: [attempt()], session: { id: 'session-1', grade: '3', exam: 'academic', mode: 'practice', questionIds: ['q-1', 'q-2'], currentIndex: 1, answers: { 'q-1': 1 }, selfRatings: { 'q-1': 'hard' }, startedAt: now, updatedAt: now } }));
    expect(result.revision).toBe(1);
    store.close();
    const reopened = await open({ indexedDB });
    expect(await reopened.load()).toEqual(result);
  });
  it('migrates valid old history once and retains the original localStorage key', async () => {
    const indexedDB = new IDBFactory();
    const original = JSON.stringify([attempt()]);
    localStorage.setItem(LEGACY_HISTORY_KEY, original);
    const store = await open({ indexedDB, legacyStorage: localStorage });
    expect((await store.load()).attempts).toHaveLength(1);
    expect((await store.load()).migration?.legacyAttemptCount).toBe(1);
    expect(localStorage.getItem(LEGACY_HISTORY_KEY)).toBe(original);
    store.close();
    const reopened = await open({ indexedDB, legacyStorage: localStorage });
    expect((await reopened.load()).attempts).toHaveLength(1);
  });
  it('does not overwrite corrupted legacy history or initialize a competing empty document', async () => {
    const indexedDB = new IDBFactory();
    localStorage.setItem(LEGACY_HISTORY_KEY, '{broken');
    await expect(open({ indexedDB, legacyStorage: localStorage })).rejects.toMatchObject({ code: 'legacy-corrupt' });
    expect(localStorage.getItem(LEGACY_HISTORY_KEY)).toBe('{broken');
    localStorage.setItem(LEGACY_HISTORY_KEY, JSON.stringify([attempt()]));
    const store = await open({ indexedDB, legacyStorage: localStorage });
    expect((await store.load()).attempts).toHaveLength(1);
  });
  it('serializes concurrent tab updates without losing prior writes', async () => {
    const indexedDB = new IDBFactory();
    const first = await open({ indexedDB });
    const second = await open({ indexedDB });
    await Promise.all([first.update(s => ({ ...s, attempts: [...s.attempts, attempt('a')] })), second.update(s => ({ ...s, attempts: [...s.attempts, attempt('b')] }))]);
    expect((await first.load()).attempts.map(a => a.id)).toEqual(['a', 'b']);
    expect((await first.load()).revision).toBe(2);
  });
  it('rejects a stale expected revision instead of replacing newer data', async () => {
    const store = await open();
    await store.update(s => ({ ...s, bookmarks: ['q-1'] }), 0);
    await expect(store.update(s => ({ ...s, bookmarks: ['q-2'] }), 0)).rejects.toMatchObject({ code: 'conflict' });
    expect((await store.load()).bookmarks).toEqual(['q-1']);
  });
  it('rolls back an invalid update', async () => {
    const store = await open();
    const initial = await store.load();
    await expect(store.update(s => ({ ...s, attempts: [attempt(), attempt()] }))).rejects.toMatchObject({ code: 'validation' });
    expect(await store.load()).toEqual(initial);
  });
  it('rolls back a rejected IndexedDB write and reports failure', async () => {
    const store = await open();
    const initial = await store.load();
    const original = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function () { throw new DOMException('quota exhausted', 'QuotaExceededError'); };
    try { await expect(store.update(s => ({ ...s, attempts: [attempt()] }))).rejects.toMatchObject({ code: 'write' }); }
    finally { IDBObjectStore.prototype.put = original; }
    expect(await store.load()).toEqual(initial);
  });
  it('rejects writes after closing instead of reporting success', async () => {
    const store = await open(); store.close();
    await expect(store.update(s => s)).rejects.toMatchObject({ code: 'closed' });
  });
});
describe('backup and validation', () => {
  it('round-trips answers, bookmarks, notes, session and review state', async () => {
    const source = await open();
    await source.update(s => ({ ...s, attempts: [attempt()], bookmarks: ['q-1'], notes: [{ id: 'note-1', questionId: 'q-1', text: '計算式を確認', updatedAt: now }], reviews: [{ questionId: 'q-1', ease: 2.5, intervalDays: 1, repetitions: 1, consecutiveCorrect: 1, lastAnsweredAt: now, nextReviewAt: '2026-10-21T10:00:00.000Z', reviewCount: 1 }], cards: [{ termId: 'term-1', rating: 'hard', reviewedAt: now, nextReviewAt: '2026-10-21T10:00:00.000Z', repetitions: 1 }], session: { id: 's-1', grade: '2', exam: 'practical', mode: 'calculation', questionIds: ['q-1'], currentIndex: 0, answers: { 'q-1': '12.5' }, startedAt: now, updatedAt: now } }));
    const json = await source.exportBackup();
    const target = await open();
    const imported = await target.importBackup(json);
    expect(imported.attemptsAdded).toBe(1); expect(imported.notesAdded).toBe(1); expect(imported.reviewsAdded).toBe(1); expect(imported.cardsAdded).toBe(1);
    expect(imported.state.session?.answers['q-1']).toBe('12.5');
    expect(imported.state.notes[0].text).toBe('計算式を確認');
    expect((await target.importBackup(json)).attemptsAdded).toBe(0);
    expect((await target.load()).attempts).toHaveLength(1);
  });
  it('rejects a conflicting record and rolls back other nonconflicting import items', async () => {
    const store = await open();
    await store.update(s => ({ ...s, attempts: [attempt()] }));
    const initial = await store.load();
    const incoming = { ...createLearningState(now), attempts: [attempt('new-attempt'), { ...attempt(), correct: false }], bookmarks: ['q-new'] };
    await expect(store.importBackup(backup(incoming))).rejects.toMatchObject({ code: 'conflict' });
    expect(await store.load()).toEqual(initial);
  });
  it('rejects invalid and newer version backups without changing saved data', async () => {
    const store = await open();
    const initial = await store.load();
    await expect(store.importBackup('{bad')).rejects.toMatchObject({ code: 'validation' });
    await expect(store.importBackup(JSON.stringify({ app: 'fp-master', formatVersion: 2 }))).rejects.toMatchObject({ code: 'version' });
    await expect(store.importBackup(backup({ ...initial, attempts: [attempt(), attempt()] }))).rejects.toMatchObject({ code: 'validation' });
    expect(await store.load()).toEqual(initial);
  });
  it('enforces a byte-size limit before parsing a backup', () => {
    expect(() => parseBackup('あ'.repeat(Math.ceil(MAX_BACKUP_BYTES / 3) + 1))).toThrow('5MiB');
  });
  it('rejects bad calendar dates, nonfinite inputs, unexpected session answers and inconsistent settings', () => {
    const base = createLearningState(now);
    expect(() => parseLearningState({ ...base, attempts: [{ ...attempt(), durationMs: Infinity }] })).toThrow();
    expect(() => parseLearningState({ ...base, attempts: [{ ...attempt(), answeredAt: '2026-02-30T00:00:00.000Z' }] })).toThrow();
    expect(() => parseLearningState({ ...base, futureField: 'must not be silently discarded' })).toThrow();
    expect(() => parseLearningState({ ...base, settings: { ...base.settings, plan: { examDate: '2026-02-30', minutesPerDay: 30, daysPerWeek: 5, weakSubjects: [] } } })).toThrow();
    expect(() => parseLearningState({ ...base, session: { id: 's', grade: '3', exam: 'academic', mode: 'practice', questionIds: ['q-1'], answers: { 'q-other': 1 }, currentIndex: 0, startedAt: now, updatedAt: now } })).toThrow();
  });
  it('keeps local settings during non-destructive merge', async () => {
    const store = await open();
    await store.update(s => ({ ...s, settings: { ...s.settings, grade: '2', theme: 'dark' } }));
    const incoming = createLearningState(now);
    const result = await store.importBackup(backup(incoming));
    expect(result.state.settings.grade).toBe('2'); expect(result.state.settings.theme).toBe('dark');
  });
});
