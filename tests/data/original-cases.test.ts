import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { QuestionSetSchema, type Question, type QuestionSet } from '../../src/domain/types';
import { buildRandomMock } from '../../src/domain/mock';
import { numericEquals, scoreQuestion } from '../../src/domain/scoring';

/**
 * 四答択一以外の形式のオリジナル問題（ケース）の検証。
 *  - j2o_*.json：FP2級 実技（資産設計提案業務）形式。設例（資料）＋3〜5小問（numeric / choice / truefalse）
 *  - g2n_*.json：2級学科の四択以外（○×、語群補充、組合せ、三択）
 */
const dir = join(__dirname, '../../src/content/questions');
const files = readdirSync(dir).filter((f) => /^(j2o|g2n)_.*\.json$/.test(f));
const sets: QuestionSet[] = files.map((f) => JSON.parse(readFileSync(join(dir, f), 'utf-8')));
const qs: Question[] = sets.flatMap((s) => s.questions);
const jitsugi = qs.filter((q) => q.exam === 'j2');
const gakka = qs.filter((q) => q.exam === 'g2');
const expl = JSON.parse(readFileSync(join(__dirname, '../../src/content/explanations.json'), 'utf-8')) as Record<
  string,
  { explanation: { status: string; short: string; standard?: string; choiceExplanations?: Record<string, string>; evidence: unknown[] } }
>;

describe('四択以外のオリジナル問題（実技ケース・学科の四択以外）', () => {
  it('件数・形式・難易度の目標を満たす', () => {
    expect(qs.length).toBeGreaterThanOrEqual(25);
    expect(jitsugi.length).toBeGreaterThanOrEqual(15);
    expect(gakka.length).toBeGreaterThanOrEqual(6);
    // 難易度は敵対的レビューで正直に付け直した値（水増しを避けるため配分の下限は設けず、付与されていることだけ確認）
    expect(qs.every((q) => (q.level ?? 0) >= 1)).toBe(true);
    // 6分野すべてを実技ケースで扱う
    expect(new Set(jitsugi.map((q) => q.field)).size).toBe(6);
    // 学科の非四択に ○× / 語群補充 / 組合せ・三択 が含まれる
    const tags = new Set(gakka.flatMap((q) => q.tags ?? []));
    for (const t of ['○×', '語群補充', '組合せ', '三択']) expect(tags.has(t), t).toBe(true);
  });

  it('スキーマに適合し、公式問題ではなく「オリジナル」として出典（根拠）が明示されている', () => {
    for (const s of sets) {
      const r = QuestionSetSchema.safeParse(s);
      if (!r.success) throw new Error(`${s.id}: ${r.error.message}`);
      expect(s.officialSet).toBe(false);
      expect(s.id + '.json').toBe(files[sets.indexOf(s)]);
    }
    for (const q of qs) {
      expect(q.source.kind, q.id).toBe('original');
      if (q.source.kind === 'original') {
        expect(q.source.author).toContain('オリジナル');
        expect(q.source.basis.length).toBeGreaterThan(0);
      }
      expect(q.status).toBe('verified');
      expect(q.lawBaseDate).toBe('2026-04-01');
      expect(q.level, q.id).toBeGreaterThanOrEqual(1);
      expect(q.topic, q.id).toBeTruthy();
      expect(q.topic![0], q.id).toBe(q.field);
    }
  });

  it('実技ケースは設例（資料）と3〜5小問を持ち、すべての小問に問いの文がある', () => {
    for (const q of jitsugi) {
      expect(q.materials?.length ?? 0, `${q.id} の設例`).toBeGreaterThan(0);
      expect(q.parts.length, q.id).toBeGreaterThanOrEqual(3);
      expect(q.parts.length, q.id).toBeLessThanOrEqual(5);
      expect(new Set(q.parts.map((p) => p.id)).size, q.id).toBe(q.parts.length);
      for (const p of q.parts) {
        expect(p.prompt, `${q.id} ${p.id}`).toBeTruthy();
        expect(['numeric', 'choice', 'truefalse']).toContain(p.kind);
      }
      // 実技形式は数値・選択・○×のうち2種類以上の小問を含む
      expect(new Set(q.parts.map((p) => p.kind)).size, q.id).toBeGreaterThanOrEqual(2);
    }
  });

  it('計算を要する小問（numeric）を含む問題は requiresCalculation=true（通常演習から除外される）', () => {
    for (const q of qs) {
      const hasNum = q.parts.some((p) => p.kind === 'numeric');
      if (hasNum) {
        expect(q.requiresCalculation, q.id).toBe(true);
        expect(q.calcReason, q.id).toBeTruthy();
      } else {
        expect(q.requiresCalculation, q.id).toBe(false);
      }
    }
  });

  it('numeric の正答は有限値で、画面入力（カンマ区切り・小数）でも採点できる', () => {
    for (const q of qs) {
      for (const p of q.parts) {
        if (p.kind !== 'numeric') continue;
        expect(Number.isFinite(p.answer), q.id).toBe(true);
        expect(numericEquals(p.answer, p.answer)).toBe(true);
        expect(numericEquals(p.answer + 1, p.answer)).toBe(false);
        const r = scoreQuestion(q, Object.fromEntries(q.parts.map((x) => [x.id, x.kind === 'numeric' ? { kind: 'numeric' as const, value: x.answer } : x.kind === 'truefalse' ? { kind: 'truefalse' as const, value: x.answer } : { kind: 'choice' as const, value: x.answer }])));
        expect(r.correct, `${q.id} 全問正解の採点`).toBe(true);
      }
    }
  });

  it('choice の小問は正答が選択肢に1つだけ存在し、選択肢が重複しない', () => {
    for (const q of qs) {
      for (const p of q.parts) {
        if (p.kind !== 'choice') continue;
        expect(p.choices.filter((c) => c.id === p.answer), `${q.id} ${p.id}`).toHaveLength(1);
        expect(new Set(p.choices.map((c) => c.text)).size, `${q.id} ${p.id}`).toBe(p.choices.length);
        expect(p.choices.length, `${q.id} ${p.id}`).toBeGreaterThanOrEqual(3);
      }
    }
  });

  it('学科の非四択：四答択一ではなく（1小問の4択は組合せのみ）、2級学科の模擬試験に混入しない', () => {
    for (const q of gakka) {
      expect(q.tags, q.id).toContain('四択以外');
      expect(q.parts.length).toBeGreaterThanOrEqual(1);
    }
    for (const seed of [1, 2, 3]) {
      const m = buildRandomMock(qs, 'g2', seed);
      expect(m.questions.some((q) => q.tags?.includes('四択以外')), `seed ${seed}`).toBe(false);
    }
  });

  it('全問に解説（小問ごとの解説・計算過程・根拠引用）があり、根拠の引用が照合済み（verified）である', () => {
    for (const q of qs) {
      const e = expl[q.id]?.explanation;
      expect(e, `${q.id} の解説`).toBeTruthy();
      expect(e!.status, `${q.id} の根拠引用が出典ページと照合できていない`).toBe('verified');
      expect(e!.evidence.length, q.id).toBeGreaterThan(0);
      expect(e!.standard, q.id).toBeTruthy();
      if (q.parts.length > 1) for (let i = 1; i <= q.parts.length; i++) expect(e!.standard, `${q.id} 小問${i}`).toContain(`【小問${i}】`);
      if (q.parts.some((p) => p.kind === 'numeric')) expect(e!.standard, q.id).toContain('計算：');
      if (q.parts.length === 1 && q.parts[0]!.kind === 'choice') {
        expect(Object.keys(e!.choiceExplanations ?? {}).length, q.id).toBe(q.parts[0]!.choices.length);
      }
    }
  });

  it('解説の正解表記が正答と一致する（小問ごと）', () => {
    for (const q of qs) {
      const e = expl[q.id]!.explanation;
      q.parts.forEach((p, i) => {
        const label = q.parts.length === 1 ? '' : `小問${i + 1}：`;
        if (p.kind === 'truefalse') expect(e.short, q.id).toContain(`${label}${p.answer ? '適切（〇）' : '不適切（×）'}`);
        if (p.kind === 'choice') expect(e.short, q.id).toContain(`${label}正解は${p.answer})`);
        if (p.kind === 'numeric') expect(e.short, q.id).toContain(`${label}${p.answer.toLocaleString('en-US')}${p.unit ?? ''}`);
      });
    }
  });

  it('問題文・設例が重複していない', () => {
    const norm = (s: string) => s.replace(/\s|[、。]/g, '');
    const seen = new Set<string>();
    for (const q of qs) {
      const key = norm(q.stem);
      expect(seen.has(key), q.id).toBe(false);
      seen.add(key);
    }
  });

  it('○×の正答が偏りすぎていない（学科の○×・実技の○×小問）', () => {
    const tf = qs.flatMap((q) => q.parts.filter((p) => p.kind === 'truefalse'));
    const t = tf.filter((p) => p.kind === 'truefalse' && p.answer).length;
    expect(tf.length).toBeGreaterThan(20);
    expect(t / tf.length).toBeGreaterThan(0.3);
    expect(t / tf.length).toBeLessThan(0.7);
  });
});
