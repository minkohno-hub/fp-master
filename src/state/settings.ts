import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import type { Grade, Subject } from '../domain/types';
import type { PracticeConfig } from '../domain/selection';

export type ExplanationMode = 'short' | 'standard' | 'detail';

export interface Settings {
  grade: Grade;
  subject: Subject;
  /** 通常演習にも計算問題を含める（初期値 OFF） */
  includeCalcInPractice: boolean;
  /** 解説の表示モード（初期値 簡潔） */
  explanationMode: ExplanationMode;
  theme: 'system' | 'light' | 'dark';
  /** 1日の目標問題数 */
  dailyGoal: number;
  /** 受験予定日 YYYY-MM-DD */
  examDate: string | null;
  /** 前回の演習条件 */
  lastPractice: Partial<PracticeConfig> | null;
  /** お気に入りの出題設定 */
  presets: { name: string; config: Partial<PracticeConfig> }[];
  /** 学習計画の入力 */
  plan: { minutesPerDay: number; daysPerWeek: number; understanding: number; createdAt: string } | null;
}

export const DEFAULT_SETTINGS: Settings = {
  grade: 3,
  subject: 'gakka',
  includeCalcInPractice: false,
  explanationMode: 'short',
  theme: 'system',
  dailyGoal: 20,
  examDate: null,
  lastPractice: null,
  presets: [],
  plan: null,
};

export async function getSettings(): Promise<Settings> {
  const rows = await db.settings.toArray();
  const out: Record<string, unknown> = { ...DEFAULT_SETTINGS };
  for (const r of rows) if (r.key in DEFAULT_SETTINGS) out[r.key] = r.value;
  return out as unknown as Settings;
}

export async function setSetting<K extends keyof Settings>(key: K, value: Settings[K]): Promise<void> {
  await db.settings.put({ key, value });
}

export function useSettings(): Settings | undefined {
  return useLiveQuery(getSettings, []);
}
