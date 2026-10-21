import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { QuestionSetSchema, type QuestionSet } from '../../src/domain/types';

const dir = join(__dirname, '../../src/content/questions');
const sets: QuestionSet[] = readdirSync(dir)
  .filter((f) => f.endsWith('.json'))
  .map((f) => JSON.parse(readFileSync(join(dir, f), 'utf-8')));
const all = sets.flatMap((s) => s.questions);

describe('問題データの検証', () => {
  it('全セットがスキーマに適合する', () => {
    for (const s of sets) {
      const r = QuestionSetSchema.safeParse(s);
      if (!r.success) throw new Error(`${s.id}: ${r.error.message}`);
    }
  });

  it('問題IDが一意', () => {
    const ids = all.map((q) => q.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('公式問題には出典（引用表記・URL・番号）がある', () => {
    for (const q of all) {
      if (q.source.kind !== 'official') continue;
      expect(q.source.citation).toMatch(/^日本FP協会 [23]級ファイナンシャル・プランニング技能検定/);
      expect(q.source.url).toMatch(/^https:\/\/www\.jafp\.or\.jp\//);
    }
  });

  it('公表セットは問1〜問60が欠落・重複なく揃っている', () => {
    for (const s of sets.filter((x) => x.officialSet)) {
      const nums = s.questions.map((q) => (q.source.kind === 'official' ? q.source.number : 0)).sort((a, b) => a - b);
      expect(nums).toEqual(Array.from({ length: 60 }, (_, i) => i + 1));
    }
  });

  it('3級学科は問1〜30が正誤式・問31〜60が三答択一、2級学科は四答択一', () => {
    for (const q of all) {
      if (q.source.kind !== 'official') continue;
      const p = q.parts[0]!;
      if (q.exam === 'g3') {
        if (q.source.number <= 30) expect(p.kind).toBe('truefalse');
        else expect(p.kind === 'choice' && p.choices.length).toBe(3);
      }
      if (q.exam === 'g2') expect(p.kind === 'choice' && p.choices.length).toBe(4);
    }
  });

  it('検証済み問題の本文・選択肢にPDF由来のノイズ（ページ番号・フッター・文字化け）が残っていない', () => {
    const noise = /学科試験\(|－\d+－|[�-]|（抽出失敗）/;
    for (const q of all.filter((x) => x.status === 'verified')) {
      const text = q.stem + q.parts.map((p) => (p.kind === 'choice' ? p.choices.map((c) => c.text).join('') : '')).join('');
      expect(text, q.id).not.toMatch(noise);
    }
  });

  it('画像資料のファイルが存在する', () => {
    for (const q of all) {
      for (const m of q.materials ?? []) {
        if (m.kind === 'image') expect(existsSync(join(__dirname, '../../public', m.src)), m.src).toBe(true);
      }
    }
  });

  it('計算問題の判定には理由がある（数値を含むだけの問題は対象外）', () => {
    const calc = all.filter((q) => q.requiresCalculation);
    expect(calc.length).toBeGreaterThan(0);
    for (const q of calc) expect(q.calcReason).toBeTruthy();
  });

  it('隔離問題には理由がある', () => {
    for (const q of all.filter((x) => x.status === 'quarantined')) expect(q.quarantineReason).toBeTruthy();
  });

  it('重複問題の検出（同一問題文は報告のみ。正答が食い違う場合は失敗）', () => {
    const byStem = new Map<string, typeof all>();
    for (const q of all) {
      const choices = q.parts.map((p) => (p.kind === 'choice' ? p.choices.map((c) => c.text).join('|') : '')).join('/');
      const key = `${q.exam}|${q.stem}|${choices}`;
      byStem.set(key, [...(byStem.get(key) ?? []), q]);
    }
    for (const group of byStem.values()) {
      if (group.length < 2) continue;
      const answers = new Set(group.map((q) => JSON.stringify(q.parts.map((p) => [p.kind, 'answer' in p ? p.answer : null]))));
      const lawDates = new Set(group.map((q) => q.lawBaseDate));
      // 同一問題文で正答が異なるのは法令基準日が異なる場合のみ許容
      if (answers.size > 1) expect(lawDates.size, group.map((q) => q.id).join(',')).toBeGreaterThan(1);
    }
  });
});
