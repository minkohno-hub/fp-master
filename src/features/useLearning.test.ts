import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useLearning } from './useLearning';
import { openLearningStore, type LearningStore } from '../storage/store';
import { createLearningState, LearningStorageError, type LearningState } from '../storage/types';

vi.mock('../storage/store', () => ({ openLearningStore: vi.fn() }));
const now = '2026-10-20T00:00:00.000Z';
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function makeStore(state = createLearningState(now)): LearningStore {
  return { load: vi.fn().mockResolvedValue(state), update: vi.fn(), exportBackup: vi.fn(), importBackup: vi.fn(), close: vi.fn() };
}
beforeEach(() => { vi.mocked(openLearningStore).mockReset(); });
async function setup(state = createLearningState(now)) {
  const store = makeStore(state);
  vi.mocked(openLearningStore).mockResolvedValue(store);
  const view = renderHook(useLearning);
  await waitFor(() => expect(view.result.current.loading).toBe(false));
  return { ...view, store };
}
describe('saved learning hook', () => {
  it('passes the last committed revision and advances it only after a successful transaction', async () => {
    const { result, store } = await setup();
    const first = deferred<LearningState>();
    vi.mocked(store.update).mockReturnValueOnce(first.promise);
    let update!: Promise<boolean>;
    act(() => { update = result.current.update(s => ({ ...s, bookmarks: ['q-1'] })); });
    expect(result.current.data.bookmarks).toEqual([]);
    expect(result.current.saving).toBe(true);
    expect(store.update).toHaveBeenLastCalledWith(expect.any(Function), 0);
    await act(async () => { first.resolve({ ...createLearningState(now), revision: 1, bookmarks: ['q-1'] }); await update; });
    expect(result.current.data.bookmarks).toEqual(['q-1']);
    vi.mocked(store.update).mockResolvedValueOnce({ ...result.current.data, revision: 2 });
    await act(async () => { await result.current.update(s => s); });
    expect(store.update).toHaveBeenLastCalledWith(expect.any(Function), 1);
  });
  it('rejects a second write synchronously and keeps saving true until the first completes', async () => {
    const { result, store } = await setup();
    const pending = deferred<LearningState>();
    vi.mocked(store.update).mockReturnValue(pending.promise);
    let first!: Promise<boolean>;
    let second!: Promise<boolean>;
    act(() => {
      first = result.current.update(s => s);
      second = result.current.update(s => s);
    });
    expect(await second).toBe(false);
    expect(store.update).toHaveBeenCalledTimes(1);
    expect(result.current.saving).toBe(true);
    await act(async () => { pending.resolve({ ...createLearningState(now), revision: 1 }); await first; });
    expect(result.current.saving).toBe(false);
    expect(result.current.error).toContain('その操作は実行していません');
  });
  it('refreshes after a stale-tab conflict without treating the rejected write as success', async () => {
    const { result, store } = await setup();
    const newer = { ...createLearningState(now), revision: 4, bookmarks: ['other-tab'] };
    vi.mocked(store.update).mockRejectedValueOnce(new LearningStorageError('conflict', 'stale revision'));
    vi.mocked(store.load).mockResolvedValueOnce(newer);
    let saved = true;
    await act(async () => { saved = await result.current.update(s => ({ ...s, bookmarks: ['stale-tab'] })); });
    expect(saved).toBe(false);
    expect(result.current.data).toEqual(newer);
    expect(result.current.error).toContain('最新の学習データを読み込みました');
    vi.mocked(store.update).mockResolvedValueOnce({ ...newer, revision: 5 });
    await act(async () => { await result.current.update(s => s); });
    expect(store.update).toHaveBeenLastCalledWith(expect.any(Function), 4);
  });
  it('retains the displayed saved data when a failed write cannot be recovered', async () => {
    const initial = { ...createLearningState(now), bookmarks: ['saved'] };
    const { result, store } = await setup(initial);
    vi.mocked(store.update).mockRejectedValueOnce(new LearningStorageError('write', 'quota full'));
    await act(async () => { expect(await result.current.update(s => ({ ...s, bookmarks: [] }))).toBe(false); });
    expect(result.current.data).toEqual(initial);
    expect(result.current.error).toBe('quota full');
  });
  it('prevents backup import while an answer is being committed', async () => {
    const { result, store } = await setup();
    const pending = deferred<LearningState>();
    vi.mocked(store.update).mockReturnValueOnce(pending.promise);
    let update!: Promise<boolean>;
    act(() => { update = result.current.update(s => s); });
    await act(async () => { await expect(result.current.importBackup('{}')).rejects.toThrow('保存中'); });
    expect(store.importBackup).not.toHaveBeenCalled();
    await act(async () => { pending.resolve({ ...createLearningState(now), revision: 1 }); await update; });
  });
  it('does not replace corrupted storage with a fallback save', async () => {
    vi.mocked(openLearningStore).mockRejectedValueOnce(new LearningStorageError('validation', 'corrupted saved data'));
    const { result } = renderHook(useLearning);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe('corrupted saved data');
    await act(async () => { expect(await result.current.update(s => s)).toBe(false); });
    expect(openLearningStore).toHaveBeenCalledTimes(1);
  });
});
