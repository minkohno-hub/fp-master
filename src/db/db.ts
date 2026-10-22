import Dexie, { type EntityTable } from 'dexie';
import type { ExamKey, FieldId } from '../domain/types';
import type { SrsState } from '../domain/srs';
import type { PartResponse } from '../domain/scoring';

/**
 * 学習データ（IndexedDB）。
 * スキーマ変更時は version を上げ、既存データを保持する upgrade を必ず書くこと。
 * データベースの削除・作り直しは禁止（AGENTS.md 参照）。
 */

export type ItemKind = 'question' | 'card' | 'calc';

export interface Attempt {
  id?: number;
  /** 問題ID / カードID / 計算問題ID（生成器:難易度:シード） */
  itemId: string;
  itemKind: ItemKind;
  exam?: ExamKey;
  field: FieldId;
  /** 計算パターン（計算トレーニングのみ） */
  pattern?: string;
  correct: boolean;
  /** 正解したが自信がない／暗記カードの「曖昧」 */
  unsure?: boolean;
  timeMs: number;
  at: string;
  sessionId?: string;
  mode?: string;
  /** 誤答時の入力値（計算ミスの記録用） */
  given?: string;
}

export interface SrsRecord extends SrsState {
  /** `q:<id>` / `c:<id>` */
  key: string;
}

export interface FlagRecord {
  key: string;
  createdAt: string;
}

export interface NoteRecord {
  key: string;
  text: string;
  updatedAt: string;
}

export interface TermState {
  termId: string;
  favorite: boolean;
  learned: boolean;
  updatedAt: string;
}

export type SessionKind = 'practice' | 'mock' | 'calc' | 'cards';

export interface SessionAnswer {
  responses: Record<string, PartResponse | undefined>;
  correct?: boolean;
  unsure?: boolean;
  timeMs?: number;
  /** 履歴・復習間隔に反映済みか */
  committed?: boolean;
}

export interface StudySession {
  id: string;
  kind: SessionKind;
  title: string;
  /** 出題条件（再現・統計用） */
  config: unknown;
  itemIds: string[];
  /** 問題IDごとの解答 */
  answers: Record<string, SessionAnswer>;
  /** 見直しフラグ（模擬試験） */
  flagged: string[];
  index: number;
  startedAt: string;
  updatedAt: string;
  finishedAt?: string;
  /** 模擬試験の制限時間（秒） */
  timeLimitSec?: number;
  exam?: ExamKey;
}

export interface MockResult {
  id?: number;
  sessionId: string;
  exam: ExamKey;
  title: string;
  startedAt: string;
  finishedAt: string;
  score: number;
  max: number;
  pass: number;
  passed: boolean;
  correctCount: number;
  total: number;
  complete: boolean;
  byField: Record<FieldId, { correct: number; total: number }>;
  elapsedSec: number;
}

export interface ErrorReport {
  id?: number;
  itemKey: string;
  text: string;
  createdAt: string;
  status: 'open' | 'resolved';
}

export interface SettingRecord {
  key: string;
  value: unknown;
}

export class FpDb extends Dexie {
  attempts!: EntityTable<Attempt, 'id'>;
  srs!: EntityTable<SrsRecord, 'key'>;
  bookmarks!: EntityTable<FlagRecord, 'key'>;
  later!: EntityTable<FlagRecord, 'key'>;
  notes!: EntityTable<NoteRecord, 'key'>;
  termState!: EntityTable<TermState, 'termId'>;
  sessions!: EntityTable<StudySession, 'id'>;
  mockResults!: EntityTable<MockResult, 'id'>;
  reports!: EntityTable<ErrorReport, 'id'>;
  settings!: EntityTable<SettingRecord, 'key'>;

  constructor(name = 'fp-master') {
    super(name);
    this.version(1).stores({
      attempts: '++id, itemId, itemKind, at, sessionId, field, [itemKind+at]',
      srs: 'key, due',
      bookmarks: 'key, createdAt',
      later: 'key, createdAt',
      notes: 'key, updatedAt',
      termState: 'termId',
      sessions: 'id, kind, updatedAt, finishedAt',
      mockResults: '++id, exam, finishedAt',
      reports: '++id, itemKey, createdAt',
      settings: 'key',
    });
  }
}

export const DB_SCHEMA_VERSION = 1;
export const TABLE_NAMES = [
  'attempts',
  'srs',
  'bookmarks',
  'later',
  'notes',
  'termState',
  'sessions',
  'mockResults',
  'reports',
  'settings',
] as const;
export type TableName = (typeof TABLE_NAMES)[number];

export const db = new FpDb();

/** iOS Safari 等でのストレージ自動削除を避けるため永続化を要求する */
export async function requestPersistence(): Promise<boolean | null> {
  try {
    if (navigator.storage?.persist) return await navigator.storage.persist();
  } catch {
    /* 非対応 */
  }
  return null;
}
