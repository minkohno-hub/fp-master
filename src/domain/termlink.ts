import type { Term } from './types';

/**
 * 文章中の専門用語の自動認識（UI非依存）。
 * - 照合は NFKC 正規化（全角/半角・互換文字）と小文字化を通して行い、表記ゆれを吸収する
 * - 同じ位置で複数の語が一致しうる場合は長い語を優先する（「配偶者控除」の中の「控除」を拾わない）
 * - 同一の用語は1つの文章につき最初の1回だけリンクする
 * - 同じ表記が複数の用語に登録されている場合は曖昧なためリンクしない（detectAmbiguous で検出）
 */

export function normalizeKey(s: string): string {
  return s.normalize('NFKC').toLowerCase();
}

export interface TermMatcher {
  re: RegExp | null;
  /** 正規化済み表記 → 用語（曖昧な表記は含まない） */
  byKey: Map<string, Term>;
  /** 複数の用語に登録されている正規化済み表記 */
  ambiguous: Map<string, Term[]>;
}

/** 用語が持つ照合用の表記（正式名称・括弧を除いた名称・略語/別名）。1文字は誤リンクが多いため除外 */
export function termSurfaces(t: Term): string[] {
  const names = [t.name.replace(/（.*?）/g, ''), t.name, ...(t.aliases ?? [])];
  return [...new Set(names.map(normalizeKey).filter((n) => [...n].length >= 2))];
}

export function buildMatcher(terms: Term[]): TermMatcher {
  const candidates = new Map<string, Map<string, Term>>();
  for (const t of terms) {
    for (const key of termSurfaces(t)) {
      let m = candidates.get(key);
      if (!m) candidates.set(key, (m = new Map()));
      m.set(t.id, t);
    }
  }
  const byKey = new Map<string, Term>();
  const ambiguous = new Map<string, Term[]>();
  for (const [key, m] of candidates) {
    if (m.size === 1) byKey.set(key, [...m.values()][0]!);
    else ambiguous.set(key, [...m.values()]);
  }
  const keys = [...byKey.keys()].sort((a, b) => b.length - a.length).map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  return { re: keys.length ? new RegExp(keys.join('|'), 'g') : null, byKey, ambiguous };
}

export type LinkPart = string | { text: string; term: Term };

/** 原文の各文字（コードポイント）を正規化した結果と、正規化後の位置から原文位置への対応表 */
function normalizeWithMap(text: string): { norm: string; start: number[]; end: number[] } {
  let norm = '';
  const start: number[] = [];
  const end: number[] = [];
  let pos = 0;
  for (const ch of text) {
    const n = normalizeKey(ch);
    for (let i = 0; i < n.length; i++) {
      start.push(pos);
      end.push(pos + ch.length);
    }
    norm += n;
    pos += ch.length;
  }
  return { norm, start, end };
}

/** 文章を、リンク対象の用語とそれ以外の文字列に分割する。分割結果を連結すると原文に戻る */
export function linkTerms(text: string, matcher: TermMatcher): LinkPart[] {
  if (!matcher.re || !text) return [text];
  const { norm, start, end } = normalizeWithMap(text);
  const out: LinkPart[] = [];
  const seen = new Set<string>();
  let last = 0;
  for (const m of norm.matchAll(matcher.re)) {
    const term = matcher.byKey.get(m[0]);
    if (!term || seen.has(term.id)) continue;
    const from = start[m.index!]!;
    const to = end[m.index! + m[0].length - 1]!;
    if (from < last) continue;
    seen.add(term.id);
    out.push(text.slice(last, from), { text: text.slice(from, to), term });
    last = to;
  }
  out.push(text.slice(last));
  return out.filter((p) => p !== '');
}

/** 文章に登場する用語（出現順・重複なし） */
export function termsIn(text: string, matcher: TermMatcher): Term[] {
  return linkTerms(text, matcher).flatMap((p) => (typeof p === 'string' ? [] : [p.term]));
}
