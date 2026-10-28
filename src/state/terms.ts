import { db } from '../db/db';

/** 用語のお気に入り・学習済みを更新する（既存の termState テーブルを使う。スキーマ変更なし） */
export async function setTermState(termId: string, patch: { favorite?: boolean; learned?: boolean }) {
  const cur = await db.termState.get(termId);
  await db.termState.put({ termId, favorite: false, learned: false, ...cur, ...patch, updatedAt: new Date().toISOString() });
}
