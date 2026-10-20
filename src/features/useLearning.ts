import { useCallback, useEffect, useRef, useState } from 'react';
import { openLearningStore, type LearningStore } from '../storage/store';
import { createLearningState, LearningStorageError, type LearningState } from '../storage/types';

const BUSY_MESSAGE = '保存中のため、その操作は実行していません。保存完了後にもう一度操作してください。';
const messageOf = (error: unknown, fallback: string) => error instanceof Error ? error.message : fallback;

export function useLearning() {
  const [data, setData] = useState<LearningState>(createLearningState);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const store = useRef<LearningStore | null>(null);
  const currentData = useRef(data);
  // React state is asynchronous. Lock before awaiting so two events in one render cannot both write.
  const writeLocked = useRef(false);
  const rejectedDuringWrite = useRef(false);
  const applyData = useCallback((next: LearningState) => {
    currentData.current = next;
    setData(next);
  }, []);

  useEffect(() => {
    let cancelled = false;
    let opened: LearningStore | null = null;
    void openLearningStore().then(async connection => {
      opened = connection;
      if (cancelled) { connection.close(); return; }
      const loaded = await connection.load();
      if (cancelled) { connection.close(); return; }
      store.current = connection;
      applyData(loaded);
    }).catch((cause: unknown) => {
      opened?.close();
      if (!cancelled) setError(messageOf(cause, '学習データを開けませんでした。'));
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
      opened?.close();
      if (store.current === opened) store.current = null;
    };
  }, [applyData]);

  const acquireWrite = useCallback(() => {
    if (writeLocked.current) {
      rejectedDuringWrite.current = true;
      setError(BUSY_MESSAGE);
      return false;
    }
    writeLocked.current = true;
    rejectedDuringWrite.current = false;
    setSaving(true);
    return true;
  }, []);
  const finishWrite = useCallback(() => {
    writeLocked.current = false;
    setSaving(false);
  }, []);
  const acknowledgeWrite = useCallback(() => {
    setError(rejectedDuringWrite.current ? BUSY_MESSAGE : null);
  }, []);

  const update = useCallback(async (change: (state: LearningState) => LearningState) => {
    const active = store.current;
    if (!active) { setError('保存領域を利用できません。ブラウザ設定を確認してください。'); return false; }
    if (!acquireWrite()) return false;
    try {
      // Detect writes made by other tabs after this tab's last read. Never apply stale UI intent silently.
      const next = await active.update(change, currentData.current.revision);
      if (store.current === active) { applyData(next); acknowledgeWrite(); }
      return true;
    } catch (cause) {
      if (store.current === active) {
        if (cause instanceof LearningStorageError && cause.code === 'conflict') {
          try {
            applyData(await active.load());
            setError('別のタブで更新されたため、この操作は実行していません。最新の学習データを読み込みました。内容を確認して再試行してください。');
          } catch (reloadError) {
            setError(`競合後の再読み込みに失敗しました。既存データは上書きしていません。${messageOf(reloadError, 'ブラウザの保存設定を確認してください。')}`);
          }
        } else setError(messageOf(cause, '保存できませんでした。操作を再試行してください。'));
      }
      return false;
    } finally { finishWrite(); }
  }, [acknowledgeWrite, acquireWrite, applyData, finishWrite]);

  const exportBackup = useCallback(async () => {
    const active = store.current;
    if (!active) throw new Error('保存領域を利用できません');
    return active.exportBackup();
  }, []);
  const importBackup = useCallback(async (json: string) => {
    const active = store.current;
    if (!active) throw new Error('保存領域を利用できません');
    if (!acquireWrite()) throw new Error(BUSY_MESSAGE);
    try {
      const result = await active.importBackup(json);
      if (store.current === active) { applyData(result.state); acknowledgeWrite(); }
      return result;
    } finally { finishWrite(); }
  }, [acknowledgeWrite, acquireWrite, applyData, finishWrite]);
  return { data, loading, saving, error, update, exportBackup, importBackup };
}
