import { describe, expect, it } from 'vitest';
import glossary from '../../src/content/glossary.json';
import { TermSchema, type Term } from '../../src/domain/types';
import { buildMatcher, linkTerms, normalizeKey, termsIn } from '../../src/domain/termlink';

const mk = (id: string, name: string, aliases: string[] = []): Term => ({
  id,
  name,
  reading: 'てすと',
  aliases,
  short: 's',
  detail: 'd',
  related: [],
  importance: 2,
  grades: [2],
  field: 'D',
  reviewStatus: 'draft',
  sources: [],
  checkedAt: '2026-10-28',
});

const join = (parts: ReturnType<typeof linkTerms>) => parts.map((p) => (typeof p === 'string' ? p : p.text)).join('');
const linked = (parts: ReturnType<typeof linkTerms>) => parts.flatMap((p) => (typeof p === 'string' ? [] : [p.term.id]));

describe('用語の自動リンク', () => {
  const terms = [mk('haigusha', '配偶者控除'), mk('koujo', '控除'), mk('nisa', 'NISA', ['ニーサ']), mk('kiso', '基礎控除')];
  const m = buildMatcher(terms);

  it('分割結果を連結すると原文に戻る', () => {
    const text = 'ＮＩＳＡの口座で配偶者控除と基礎控除を比べる。';
    expect(join(linkTerms(text, m))).toBe(text);
  });
  it('長い語を優先し、複合語の内部の短い語を拾わない', () => {
    expect(linked(linkTerms('配偶者控除を受ける', m))).toEqual(['haigusha']);
  });
  it('全角・半角の表記ゆれを吸収し、原文の表記のまま返す', () => {
    const a = linkTerms('ＮＩＳＡを利用', m);
    const b = linkTerms('nisaを利用', m);
    expect(linked(a)).toEqual(['nisa']);
    expect(linked(b)).toEqual(['nisa']);
    expect(a.find((p) => typeof p !== 'string')).toMatchObject({ text: 'ＮＩＳＡ' });
  });
  it('別名・略語でもリンクし、同じ用語は最初の1回のみ', () => {
    expect(linked(linkTerms('ニーサとＮＩＳＡ', m))).toEqual(['nisa']);
  });
  it('複数の用語に登録された同一表記は曖昧としてリンクしない', () => {
    const mm = buildMatcher([mk('a', '年金', ['公的年金']), mk('b', '企業年金', ['年金'])]);
    expect(mm.ambiguous.has('年金')).toBe(true);
    expect(linked(linkTerms('年金を受給', mm))).toEqual([]);
    expect(linked(linkTerms('企業年金を受給', mm))).toEqual(['b']);
  });
  it('1文字の表記・空文字・用語なしでも壊れない', () => {
    expect(linkTerms('', m)).toEqual(['']);
    expect(linkTerms('税', buildMatcher([mk('x', '税')]))).toEqual(['税']);
    expect(linkTerms('abc', buildMatcher([]))).toEqual(['abc']);
  });
  it('termsIn は出現順に重複なく返す', () => {
    expect(termsIn('基礎控除と配偶者控除と基礎控除', m).map((t) => t.id)).toEqual(['kiso', 'haigusha']);
  });
  it('NFKC 正規化', () => {
    expect(normalizeKey('ＮＩＳＡ')).toBe('nisa');
  });
});

describe('実際の用語集', () => {
  const terms = (glossary as unknown[]).map((t) => TermSchema.parse(t));
  const m = buildMatcher(terms);
  it('曖昧な表記（複数用語に同一表記）が無い', () => {
    expect([...m.ambiguous.entries()].map(([k, v]) => `${k}: ${v.map((t) => t.id).join(',')}`)).toEqual([]);
  });
  it('全用語の名称が、その名称を含む文章からリンクされる', () => {
    for (const t of terms) {
      const name = t.name.replace(/（.*?）/g, '');
      if ([...name].length < 2) continue;
      const hit = termsIn(`これは${name}に関する記述です。`, m);
      expect(hit.map((h) => h.id), t.id).toContain(t.id);
    }
  });
});
