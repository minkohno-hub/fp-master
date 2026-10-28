import { describe, expect, it } from 'vitest';
import { buildTermIndex, linkTerms, surfaceCollisions } from '../../src/domain/termlink';
import type { Term } from '../../src/domain/types';

const T = (id: string, name: string, extra: Partial<Term> = {}): Term =>
  ({ id, name, reading: 'てすと', short: 's', detail: 'd', related: [], importance: 2, grades: [2, 3], field: 'D', reviewStatus: 'draft', sources: [], checkedAt: '2026-01-01', ...extra }) as Term;

const link = (text: string, terms: Term[], once = true) => {
  const idx = buildTermIndex(terms);
  return linkTerms(text, idx, once).filter((s) => s.termId).map((s) => `${s.text}:${s.termId}`);
};

describe('用語の自動リンク', () => {
  const kiso = T('kiso', '基礎控除');
  const sozoku = T('sozoku-kiso', '相続税の基礎控除', { aliases: ['遺産に係る基礎控除額'] });
  const haigusha = T('haigusha', '配偶者控除');
  const nisa = T('nisa', 'NISA', { aliases: ['少額投資非課税制度'] });
  const kazei = T('kazei', '課税所得');

  it('名称・別名・全角半角の表記ゆれに一致する', () => {
    expect(link('ＮＩＳＡの成長投資枠', [nisa])).toEqual(['ＮＩＳＡ:nisa']);
    expect(link('nisaを利用', [nisa])).toEqual(['nisa:nisa']);
    expect(link('少額投資非課税制度について', [nisa])).toEqual(['少額投資非課税制度:nisa']);
  });

  it('複合語は最も長い用語を優先し、短い用語に分割しない', () => {
    expect(link('相続税の基礎控除は3,000万円＋600万円×法定相続人の数', [kiso, sozoku])).toEqual(['相続税の基礎控除:sozoku-kiso']);
    expect(link('遺産に係る基礎控除額を求める', [kiso, sozoku])).toEqual(['遺産に係る基礎控除額:sozoku-kiso']);
    expect(link('所得税の基礎控除は58万円', [kiso, sozoku])).toEqual(['基礎控除:kiso']);
  });

  it('複合語の後半だけを誤ってリンクしない（配偶者特別控除 ≠ 特別控除）', () => {
    const tokubetsu = T('tokubetsu', '特別控除');
    expect(link('配偶者特別控除の適用', [tokubetsu])).toEqual([]);
    expect(link('特別控除の適用', [tokubetsu])).toEqual(['特別控除:tokubetsu']);
  });

  it('語の途中にある短い語はリンクしない（非課税 ≠ 課税）', () => {
    expect(link('非課税の範囲', [T('kazei2', '課税')])).toEqual([]);
    expect(link('課税の範囲', [T('kazei2', '課税')])).toEqual(['課税:kazei2']);
  });

  it('英数字・カタカナの語は前後が同種の文字なら一致しない', () => {
    expect(link('MANISAは別物', [nisa])).toEqual([]);
    expect(link('リスクアセスメント', [T('risk', 'リスク')])).toEqual([]);
    expect(link('リスクの管理', [T('risk', 'リスク')])).toEqual(['リスク:risk']);
  });

  it('接尾語（額・等など）は許容し、無関係な漢字連続は許容しない', () => {
    expect(link('基礎控除額は', [kiso])).toEqual(['基礎控除:kiso']);
    expect(link('基礎控除等', [kiso])).toEqual(['基礎控除:kiso']);
    expect(link('基礎控除法', [kiso])).toEqual([]);
  });

  it('同じ用語は1文章中で最初の1回だけリンクする（once=false で全件）', () => {
    expect(link('基礎控除と基礎控除', [kiso])).toEqual(['基礎控除:kiso']);
    expect(link('基礎控除と基礎控除', [kiso], false)).toEqual(['基礎控除:kiso', '基礎控除:kiso']);
  });

  it('linkRule.auto=false の用語はリンクしない／requireAny は文脈語があるときだけリンクする', () => {
    expect(link('配偶者控除を受ける', [T('x', '配偶者控除', { linkRule: { auto: false } })])).toEqual([]);
    const amb = T('amb', '贈与', { linkRule: { requireAny: ['贈与税', '受贈者'] } });
    expect(link('贈与を受けた受贈者', [amb])).toEqual(['贈与:amb']);
    expect(link('贈与の意思表示', [amb])).toEqual([]);
  });

  it('同じ表記が複数の用語にある場合、文脈で絞れなければリンクしない（誤リンク回避）', () => {
    const a = T('a', '年金控除');
    const b = T('b', '年金控除', {});
    expect(link('年金控除の額', [a, b])).toEqual([]);
    expect(surfaceCollisions(buildTermIndex([a, b]))).toHaveLength(1);
    const c = T('c', '年金控除', { linkRule: { requireAny: ['国民年金'] } });
    expect(link('国民年金の年金控除', [a, c])).toEqual(['年金控除:c']);
  });

  it('一文字の語は登録しても無視され、空文字・リンクなし文でも壊れない', () => {
    expect(link('税の話', [T('z', '税')])).toEqual([]);
    expect(linkTerms('', buildTermIndex([kiso]))).toEqual([{ text: '' }]);
    expect(linkTerms('用語なし', buildTermIndex([kiso]))).toEqual([{ text: '用語なし' }]);
    expect(link('課税所得を求める', [kazei])).toEqual(['課税所得:kazei']);
    expect(link('配偶者控除', [haigusha]).length).toBe(1);
  });

  it('分割したセグメントを連結すると元の文章に戻る', () => {
    const text = 'ＮＩＳＡと基礎控除、相続税の基礎控除を比べる。';
    const idx = buildTermIndex([nisa, kiso, sozoku]);
    expect(linkTerms(text, idx).map((s) => s.text).join('')).toBe(text);
  });

  it('大量の用語でも高速に処理できる（2,000語×長文200件）', () => {
    const terms = Array.from({ length: 2000 }, (_, i) => T(`t${i}`, `用語${String.fromCharCode(0x4e00 + (i % 500))}${String.fromCharCode(0x4e00 + Math.floor(i / 500) + 600)}制度`));
    const idx = buildTermIndex(terms);
    const text = '次の記述のうち、基礎控除や相続税に関する説明として最も適切なものはどれか。'.repeat(5);
    const t0 = performance.now();
    for (let i = 0; i < 200; i++) linkTerms(text + i, idx);
    expect(performance.now() - t0).toBeLessThan(500);
  });
});
