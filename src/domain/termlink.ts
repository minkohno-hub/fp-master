import type { Term } from './types';

/**
 * 用語の自動リンク（純粋ロジック）。
 * 本文を走査し、用語集に登録された名称・別名・表記ゆれに一致する箇所を最長一致で切り出す。
 * 用語を登録するだけでリンクが有効になる（問題ごとの手作業は不要）。
 *
 * 誤リンク防止：
 * - 全角/半角・英大小を正規化して照合（文字数は変えない）
 * - 最長一致優先（「配偶者控除」が「控除」より優先）
 * - 英数字の語は前後が英数字でないこと／カタカナ語は前後がカタカナでないこと
 * - 漢字の語は、直前が漢字なら（複合語の後半部分だけを拾わないため）リンクしない。直後が漢字のときも、
 *   「額・等」などの接尾語以外はリンクしない（linkRule.partial で緩和可）
 * - 同じ表記が複数の用語に割り当たる場合は、文脈（requireAny）で絞り、それでも複数なら誤リンクを避けてリンクしない
 */

export interface TermSegment {
  text: string;
  termId?: string;
}

interface Node {
  next: Map<string, Node>;
  /** この位置で終わる表記に対応する用語（衝突時は複数） */
  ends?: Term[];
}

export interface TermIndex {
  root: Node;
  size: number;
  /** 表記 → 用語（衝突の検査・テスト用） */
  surfaces: Map<string, Term[]>;
  cache: Map<string, TermSegment[]>;
}

const KANJI = /[㐀-鿿々〇]/;
const KATAKANA = /[ァ-ヺー]/;
const ASCII_ALNUM = /[a-z0-9]/;
/** 漢字の語の直後に続いてもよい接尾語 */
const SUFFIX_OK = new Set(['額', '等', '分', '後', '前', '時', '中', '的', '上', '以', '外', '内', '率']);

/** 1文字ずつ正規化（文字数を保つ）：全角英数→半角、英大文字→小文字 */
export function fold(s: string): string {
  let out = '';
  for (const ch of s) {
    const n = ch.normalize('NFKC');
    out += n.length === 1 ? n.toLowerCase() : ch;
  }
  return out;
}

/** 用語から照合用の表記（正規化済み）を取り出す */
export function surfacesOf(t: Term): string[] {
  const names = [t.name, t.name.replace(/（.*?）/g, '').replace(/\(.*?\)/g, ''), ...(t.aliases ?? [])];
  const out = new Set<string>();
  for (const n of names) {
    const f = fold(n.trim());
    if (f.length >= 2) out.add(f);
  }
  return [...out];
}

export function buildTermIndex(terms: Term[]): TermIndex {
  const root: Node = { next: new Map() };
  const surfaces = new Map<string, Term[]>();
  for (const t of terms) {
    if (t.linkRule?.auto === false) continue;
    for (const s of surfacesOf(t)) {
      const list = surfaces.get(s) ?? [];
      if (!list.includes(t)) list.push(t);
      surfaces.set(s, list);
    }
  }
  for (const [s, list] of surfaces) {
    let n = root;
    for (const ch of s) {
      let m = n.next.get(ch);
      if (!m) n.next.set(ch, (m = { next: new Map() }));
      n = m;
    }
    n.ends = list;
  }
  return { root, size: surfaces.size, surfaces, cache: new Map() };
}

function boundaryOk(f: string, start: number, end: number, term: Term): boolean {
  if (term.linkRule?.partial) return true;
  const first = f[start]!;
  const last = f[end - 1]!;
  const prev = start > 0 ? f[start - 1]! : '';
  const next = end < f.length ? f[end]! : '';
  if (ASCII_ALNUM.test(first) && prev && ASCII_ALNUM.test(prev)) return false;
  if (ASCII_ALNUM.test(last) && next && ASCII_ALNUM.test(next)) return false;
  if (KATAKANA.test(first) && prev && KATAKANA.test(prev)) return false;
  if (KATAKANA.test(last) && next && KATAKANA.test(next)) return false;
  if (KANJI.test(first) && prev && KANJI.test(prev)) return false;
  if (KANJI.test(last) && next && KANJI.test(next) && !SUFFIX_OK.has(next)) return false;
  return true;
}

function pick(cands: Term[], f: string): Term | null {
  const ok = cands.filter((t) => !t.linkRule?.requireAny || t.linkRule.requireAny.some((w) => f.includes(fold(w))));
  if (ok.length === 1) return ok[0]!;
  if (ok.length > 1) {
    // 文脈で絞れた用語が複数ある表記は誤リンクを避ける（用語登録時のテストで検出される）
    const withCtx = ok.filter((t) => t.linkRule?.requireAny);
    return withCtx.length === 1 ? withCtx[0]! : null;
  }
  return null;
}

/** 文章を、用語リンク部分とそれ以外に分割する。各用語は1回目の出現のみリンクする（once=true） */
export function linkTerms(text: string, index: TermIndex, once = true): TermSegment[] {
  if (!text || index.size === 0) return [{ text }];
  const key = (once ? '1|' : '*|') + text;
  const hit = index.cache.get(key);
  if (hit) return hit;
  const f = fold(text);
  const out: TermSegment[] = [];
  const seen = new Set<string>();
  let last = 0;
  let i = 0;
  while (i < f.length) {
    let n: Node | undefined = index.root.next.get(f[i]!);
    let best: { end: number; term: Term } | null = null;
    let j = i;
    while (n) {
      j++;
      if (n.ends) {
        const t = pick(n.ends, f);
        if (t && boundaryOk(f, i, j, t)) best = { end: j, term: t };
      }
      if (j >= f.length) break;
      n = n.next.get(f[j]!);
    }
    if (best && (!once || !seen.has(best.term.id))) {
      seen.add(best.term.id);
      if (i > last) out.push({ text: text.slice(last, i) });
      out.push({ text: text.slice(i, best.end), termId: best.term.id });
      last = best.end;
      i = best.end;
    } else {
      i++;
    }
  }
  if (last < text.length) out.push({ text: text.slice(last) });
  if (out.length === 0) out.push({ text });
  if (index.cache.size > 4000) index.cache.clear();
  index.cache.set(key, out);
  return out;
}

/** 表記の衝突（同じ表記が複数の用語に割り当たる）を返す。文脈指定のない衝突は誤リンク回避のため無効になる */
export function surfaceCollisions(index: TermIndex): [string, string[]][] {
  return [...index.surfaces.entries()].filter(([, l]) => l.length > 1).map(([s, l]) => [s, l.map((t) => t.id)]);
}
