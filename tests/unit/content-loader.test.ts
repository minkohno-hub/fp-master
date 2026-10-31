import { describe, expect, it, vi } from 'vitest';
import { importWithRetry } from '../../src/content/index';

describe('importWithRetry（動的 import の一時失敗へのリトライ）', () => {
  it('成功したらそのまま値を返す', async () => {
    const load = vi.fn().mockResolvedValue(42);
    await expect(importWithRetry(load)).resolves.toBe(42);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('一時的に失敗しても再試行して成功する', async () => {
    const load = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch dynamically imported module'))
      .mockRejectedValueOnce(new TypeError('Failed to fetch dynamically imported module'))
      .mockResolvedValue('ok');
    await expect(importWithRetry(load)).resolves.toBe('ok');
    expect(load).toHaveBeenCalledTimes(3);
  });

  it('試行回数を使い切ったら最後のエラーを投げる', async () => {
    const err = new TypeError('Failed to fetch dynamically imported module');
    const load = vi.fn().mockRejectedValue(err);
    await expect(importWithRetry(load, 2)).rejects.toBe(err);
    expect(load).toHaveBeenCalledTimes(2);
  });
});
