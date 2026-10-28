import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildTermIndex, linkTerms, surfaceCollisions } from '../../src/domain/termlink';
import { TermSchema, type Question, type QuestionSet, type Term } from '../../src/domain/types';

const root = join(__dirname, '../..');
const terms: Term[] = JSON.parse(readFileSync(join(root, 'src/content/glossary.json'), 'utf-8'));
const qdir = join(root, 'src/content/questions');
const questions: Question[] = readdirSync(qdir)
  .filter((f) => f.endsWith('.json'))
  .flatMap((f) => (JSON.parse(readFileSync(join(qdir, f), 'utf-8')) as QuestionSet).questions);
const expl = JSON.parse(readFileSync(join(root, 'src/content/explanations.json'), 'utf-8')) as Record<string, { explanation: Record<string, unknown> }>;
const cards = JSON.parse(readFileSync(join(root, 'src/content/cards.json'), 'utf-8')) as { id: string; termId?: string }[];
const syl = JSON.parse(readFileSync(join(root, 'scripts/original/syllabus_fp2.json'), 'utf-8')) as { items: { key: string }[] };
const keys = new Set(syl.items.map((i) => i.key));
const index = buildTermIndex(terms);
const byId = new Map(terms.map((t) => [t.id, t]));

const FIG = /[0-9０-９]+(?:[.,．][0-9]+)?\s*(?:％|%|万円|円|年|か月|ヶ月|月|歳|日|倍|割|分の|回|人|㎡|億)/;

describe('用語集データの検証', () => {
  it('すべての用語がスキーマに適合し、IDが一意で、参照先が存在する', () => {
    const seen = new Set<string>();
    for (const t of terms) {
      const r = TermSchema.safeParse(t);
      if (!r.success) throw new Error(`${t.id}: ${r.error.message}`);
      expect(seen.has(t.id), `ID重複 ${t.id}`).toBe(false);
      seen.add(t.id);
      for (const r2 of t.related) expect(byId.has(r2), `${t.id}.related ${r2}`).toBe(true);
      for (const c of t.compare ?? []) if (c.termId) expect(byId.has(c.termId), `${t.id}.compare ${c.termId}`).toBe(true);
      for (const k of t.topics ?? []) expect(keys.has(k), `${t.id}.topics ${k}`).toBe(true);
    }
    for (const c of cards) if (c.termId) expect(byId.has(c.termId), `card ${c.id}`).toBe(true);
  });

  it('根拠照合済み(verified)の用語には必ず引用がある。未照合は draft と表示される', () => {
    for (const t of terms) {
      if (t.reviewStatus === 'verified') expect((t.evidence ?? []).length, t.id).toBeGreaterThan(0);
    }
  });

  it('拡充用語（法令基準日つき）：shortに具体的な数値がなく、detailが十分な長さを持つ', () => {
    const ext = terms.filter((t) => t.lawBaseDate && t.id !== 'kiso-kojo' && t.id !== 'kyuyo-shotoku-kojo');
    for (const t of ext) {
      expect(FIG.test(t.short), `${t.id}: short に数値`).toBe(false);
      expect(t.detail.length, t.id).toBeGreaterThanOrEqual(60);
    }
  });

  it('表記の衝突がない（あれば文脈指定 requireAny で区別されている）', () => {
    const bad = surfaceCollisions(index).filter(([, ids]) => !ids.every((id) => byId.get(id)?.linkRule?.requireAny));
    expect(bad).toEqual([]);
  });

  it('基礎控除：年分別の表と整合した内容になっている（固定額の誤表現がない）', () => {
    const t = byId.get('kiso-kojo')!;
    expect(t.reviewStatus).toBe('verified');
    expect(t.detail).not.toMatch(/一律58万円/);
    expect((t.numbers ?? []).join('')).toContain('2,500万円超は0円');
    const e = expl['g3-202605-20']!.explanation;
    expect(String(e.short)).toContain('一律58万円ではない');
    expect(e.status).toBe('verified');
  });

  it('問題文・選択肢の用語リンクは存在する用語だけを指し、本文を欠落させない', () => {
    let linked = 0;
    for (const q of questions) {
      const texts = [q.stem, ...q.parts.flatMap((p) => (p.kind === 'choice' ? p.choices.map((c) => c.text) : []))];
      for (const text of texts) {
        const segs = linkTerms(text, index);
        expect(segs.map((s) => s.text).join('')).toBe(text);
        for (const s of segs) if (s.termId) { expect(byId.has(s.termId)).toBe(true); linked++; }
      }
    }
    expect(linked).toBeGreaterThan(0);
  });

  it('リンク対応率・未対応用語を集計する（TERM_REPORT=1 で docs/TERM_LINK_REPORT.md に出力）', () => {
    let withLink = 0;
    const used = new Set<string>();
    const verifiedTerms = terms.filter((t) => t.reviewStatus === 'verified').length;
    const t0 = performance.now();
    for (const q of questions) {
      const text = [q.stem, ...q.parts.flatMap((p) => (p.kind === 'choice' ? p.choices.map((c) => c.text) : []))].join('\n');
      const ids = linkTerms(text, index, false).filter((s) => s.termId).map((s) => s.termId!);
      if (ids.length) withLink++;
      ids.forEach((i) => used.add(i));
    }
    for (const v of Object.values(expl)) {
      const e = v.explanation as { short?: string; standard?: string; detail?: string; whyCorrect?: string };
      for (const s of [e.short, e.standard, e.detail, e.whyCorrect]) if (s) linkTerms(s, index, false).forEach((x) => x.termId && used.add(x.termId));
    }
    const ms = performance.now() - t0;
    const unused = terms.filter((t) => !used.has(t.id) && t.linkRule?.auto !== false);
    const noAuto = terms.filter((t) => t.linkRule?.auto === false);
    const total = questions.length;
    // 基礎控除など主要用語が問題文中でリンクされていること
    expect(used.has('kiso-kojo')).toBe(true);
    expect(ms).toBeLessThan(15000);
    if (process.env.TERM_REPORT) {
      const md = [
        '# 用語リンク レポート',
        '',
        '> `TERM_REPORT=1 npx vitest run tests/data/terms.test.ts` が生成（手で編集しない）。',
        '',
        `- 用語の総数：${terms.length}（根拠照合済み ${verifiedTerms}／要確認 ${terms.length - verifiedTerms}）`,
        `- 自動リンクの対象外（用語集のみ）：${noAuto.length}`,
        `- 自動リンクの表記数（名称・別名・表記ゆれ）：${index.size}`,
        `- 問題数：${total}。問題文・選択肢に1つ以上の用語リンクがある問題：${withLink}（${((withLink / total) * 100).toFixed(1)}%）`,
        `- 問題文・選択肢・解説のいずれにも現れない用語（未対応）：${unused.length}`,
        `- 全問題＋全解説のリンク解析時間：${ms.toFixed(0)}ms`,
        '',
        '## 未対応用語（本文に現れていない用語。別名の追加や、問題追加の候補）',
        '',
        ...unused.map((t) => `- ${t.id} ${t.name}（${t.field}）`),
      ].join('\n');
      writeFileSync(join(root, 'docs/TERM_LINK_REPORT.md'), md + '\n');
    }
  });
});
