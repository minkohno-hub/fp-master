import { createLearningState, LearningStorageError, type BackupDocument, type ImportSummary, type LearningState } from './types';
import { byteLength, MAX_BACKUP_BYTES, parseBackup, parseLearningState, parseLegacyAttempts } from './validation';

const DB_NAME = 'fp-master';
const DB_VERSION = 1;
const STORE = 'documents';
const STATE_KEY = 'learning-state';
export const LEGACY_HISTORY_KEY = 'fp-master.history.v1';
export interface StoreOptions { databaseName?: string; indexedDB?: IDBFactory; legacyStorage?: Pick<Storage, 'getItem'> | null }
export interface LearningStore {
  load(): Promise<LearningState>;
  /** Mutator must be synchronous. The promise resolves only after the IndexedDB transaction commits. */
  update(mutator: (current: LearningState) => LearningState, expectedRevision?: number): Promise<LearningState>;
  exportBackup(): Promise<string>;
  /** Merge is non-destructive. Existing settings are kept; conflicting records reject the entire import. */
  importBackup(json: string): Promise<ImportSummary>;
  close(): void;
}
function failure(code: 'read' | 'write', cause: unknown): LearningStorageError {
  return cause instanceof LearningStorageError ? cause : new LearningStorageError(code, code === 'read' ? '学習データを読み込めませんでした。ブラウザの保存設定を確認してください。' : '学習データを保存できませんでした。空き容量やブラウザの保存設定を確認し、再試行してください。', { cause });
}
function checkSize(state: LearningState): void {
  if (byteLength(JSON.stringify({ app: 'fp-master', formatVersion: 1, exportedAt: new Date().toISOString(), state })) > MAX_BACKUP_BYTES) throw new LearningStorageError('validation', '学習データが保存上限5MiBを超えました。既存データは保持されています。バックアップを保存してください。');
}
function mergeRecords<T>(current: T[], incoming: T[], key: (record: T) => string, label: string): { items: T[]; added: number } {
  const records = new Map(current.map(record => [key(record), record]));
  let added = 0;
  for (const record of incoming) {
    const previous = records.get(key(record));
    if (previous !== undefined && JSON.stringify(previous) !== JSON.stringify(record)) {
      throw new LearningStorageError('conflict', `${label}のID「${key(record)}」が既存データと競合します。復元を取り消しました。既存データは変更していません。`);
    }
    if (previous === undefined) { records.set(key(record), record); added++; }
  }
  return { items: [...records.values()], added };
}
export async function openLearningStore(options: StoreOptions = {}): Promise<LearningStore> {
  const factory = options.indexedDB ?? globalThis.indexedDB;
  if (!factory) throw new LearningStorageError('unavailable', 'このブラウザではIndexedDBを利用できません。保存を有効にして再読み込みしてください。');
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    let settled = false;
    let request: IDBOpenDBRequest;
    try { request = factory.open(options.databaseName ?? DB_NAME, DB_VERSION); }
    catch (cause) { reject(new LearningStorageError('unavailable', '学習データベースの利用が拒否されました。ブラウザの保存設定を確認してください。', { cause })); return; }
    request.onupgradeneeded = () => { if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE); };
    request.onerror = () => { settled = true; reject(new LearningStorageError('unavailable', '学習データベースを開けませんでした。既存データは削除していません。', { cause: request.error })); };
    request.onblocked = () => { settled = true; reject(new LearningStorageError('blocked', '別のタブがデータベースの更新を妨げています。他のFP Masterタブを閉じて再試行してください。')); };
    request.onsuccess = () => { if (settled) request.result.close(); else { settled = true; resolve(request.result); } };
  });
  let closed = false;
  db.onversionchange = () => { closed = true; db.close(); };
  function transact<T>(mode: IDBTransactionMode, operation: (store: IDBObjectStore, setResult: (value: T) => void) => void): Promise<T> {
    if (closed) return Promise.reject(new LearningStorageError('closed', 'データベース接続が更新されました。ページを再読み込みしてください。'));
    return new Promise<T>((resolve, reject) => {
      let transaction: IDBTransaction;
      try { transaction = db.transaction(STORE, mode); } catch (cause) { reject(failure(mode === 'readonly' ? 'read' : 'write', cause)); return; }
      let result: T;
      let error: unknown;
      transaction.oncomplete = () => resolve(result);
      transaction.onabort = () => reject(failure(mode === 'readonly' ? 'read' : 'write', error ?? throwInTransaction.get(transaction) ?? transaction.error));
      transaction.onerror = () => { error ??= transaction.error; };
      try { operation(transaction.objectStore(STORE), value => { result = value; }); }
      catch (cause) { error = cause; transaction.abort(); }
      // All request callbacks run before the transaction completes. Their exceptions must abort atomically.
      function guard(event: Event) {
        const request = event.target as IDBRequest;
        if (request.error) error ??= request.error;
      }
      transaction.addEventListener('error', guard);
    });
  }
  // Initial document and legacy migration are committed together; the legacy key is never removed.
  try {
    await transact<void>('readwrite', (store, done) => {
      const request = store.get(STATE_KEY);
      request.onsuccess = () => {
        try {
          if (request.result !== undefined) { parseLearningState(request.result); done(); return; }
          const state = createLearningState();
          const legacyStorage = options.legacyStorage === null ? null : options.legacyStorage ?? globalThis.localStorage;
          const legacy = legacyStorage?.getItem(LEGACY_HISTORY_KEY);
          if (legacy !== undefined && legacy !== null) {
            try {
              state.attempts = parseLegacyAttempts(JSON.parse(legacy) as unknown);
              state.migration = { legacyImportedAt: state.createdAt, legacyAttemptCount: state.attempts.length };
            } catch (cause) { throw new LearningStorageError('legacy-corrupt', '以前の学習履歴を安全に移行できませんでした。元の履歴は保持しています。バックアップを確認してください。', { cause }); }
          }
          checkSize(state);
          store.put(state, STATE_KEY);
          done();
        } catch (cause) { throwInTransaction.set(request.transaction!, cause); request.transaction?.abort(); }
      };
    });
  } catch (cause) { db.close(); closed = true; throw cause; }
  function load(): Promise<LearningState> {
    return transact<LearningState>('readonly', (store, done) => {
        const request = store.get(STATE_KEY);
        request.onsuccess = () => {
          try { done(parseLearningState(request.result)); }
          catch (cause) { throwInTransaction.set(request.transaction!, cause); request.transaction?.abort(); }
        };
      });
  }
  function update(mutator: (current: LearningState) => LearningState, expectedRevision?: number): Promise<LearningState> {
    return transact<LearningState>('readwrite', (store, done) => {
        const request = store.get(STATE_KEY);
        request.onsuccess = () => {
          try {
            const current = parseLearningState(request.result);
            if (expectedRevision !== undefined && current.revision !== expectedRevision) throw new LearningStorageError('conflict', '別のタブで学習データが更新されました。読み直して再試行してください。');
            const next = parseLearningState(mutator(current));
            next.revision = current.revision + 1;
            next.createdAt = current.createdAt;
            next.updatedAt = new Date().toISOString();
            checkSize(next);
            store.put(next, STATE_KEY);
            done(next);
          } catch (cause) { throwInTransaction.set(request.transaction!, cause); request.transaction?.abort(); }
        };
      });
  }
  async function exportBackup(): Promise<string> {
    const state = await load();
    const document: BackupDocument = { app: 'fp-master', formatVersion: 1, exportedAt: new Date().toISOString(), state };
    const json = JSON.stringify(document);
    // Export remains importable at the exact same format and size limits.
    parseBackup(json);
    return json;
  }
  async function importBackup(json: string): Promise<ImportSummary> {
    const incoming = parseBackup(json).state;
    let summary: Omit<ImportSummary, 'state'> = { attemptsAdded: 0, bookmarksAdded: 0, notesAdded: 0, reviewsAdded: 0, cardsAdded: 0 };
    const state = await update(current => {
      const attempts = mergeRecords(current.attempts, incoming.attempts, a => a.id, '回答履歴');
      const notes = mergeRecords(current.notes, incoming.notes, a => a.id, 'ノート');
      const reviews = mergeRecords(current.reviews, incoming.reviews, a => a.questionId, '復習予定');
      const cards = mergeRecords(current.cards, incoming.cards, a => a.termId, '暗記カード');
      if (current.session && incoming.session && JSON.stringify(current.session) !== JSON.stringify(incoming.session)) throw new LearningStorageError('conflict', '中断中の演習が競合します。両方の演習内容を確認してください。既存データは変更していません。');
      const bookmarks = [...new Set([...current.bookmarks, ...incoming.bookmarks])];
      summary = { attemptsAdded: attempts.added, bookmarksAdded: bookmarks.length - current.bookmarks.length, notesAdded: notes.added, reviewsAdded: reviews.added, cardsAdded: cards.added };
      return { ...current, attempts: attempts.items, notes: notes.items, reviews: reviews.items, cards: cards.items, bookmarks, termFavorites: [...new Set([...current.termFavorites, ...incoming.termFavorites])], learnedTerms: [...new Set([...current.learnedTerms, ...incoming.learnedTerms])], session: current.session ?? incoming.session };
    });
    return { ...summary, state };
  }
  return { load, update, exportBackup, importBackup, close() { closed = true; db.close(); } };
}
// IndexedDB abort errors do not preserve the original validation error; retain it per transaction.
const throwInTransaction = new WeakMap<IDBTransaction, unknown>();
