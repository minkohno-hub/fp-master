import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import type { Term } from '../domain/types';
import { useContent } from '../content/store';
import { ReviewBadge, Sheet } from './common';

/** 半角英数字を全角に（問題文は全角英字で書かれていることが多い：ＮＩＳＡ等） */
export function toFullWidth(s: string): string {
  return s.replace(/[A-Za-z0-9]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 0xfee0));
}

interface Matcher {
  re: RegExp | null;
  byName: Map<string, Term>;
}

export function buildMatcher(terms: Term[]): Matcher {
  const byName = new Map<string, Term>();
  for (const t of terms) {
    const names = [t.name.replace(/（.*?）/g, ''), t.name, ...(t.aliases ?? [])];
    for (const n of names) {
      if (n.length < 2) continue;
      byName.set(n, t);
      const fw = toFullWidth(n);
      if (fw !== n) byName.set(fw, t);
    }
  }
  const keys = [...byName.keys()].sort((a, b) => b.length - a.length).map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  return { re: keys.length ? new RegExp(keys.join('|'), 'g') : null, byName };
}

const OpenTermCtx = createContext<(t: Term) => void>(() => {});

/** 用語のポップアップを提供する（画面ごとに1つ） */
export function TermPopupProvider({ children }: { children: ReactNode }) {
  const [term, setTerm] = useState<Term | null>(null);
  return (
    <OpenTermCtx.Provider value={setTerm}>
      {children}
      <Sheet open={!!term} onClose={() => setTerm(null)} title={term?.name ?? ''}>
        {term && (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2 text-xs text-slate-600 dark:text-slate-400">
              <span>{term.reading}</span>
              <ReviewBadge status={term.reviewStatus} />
            </div>
            <p className="leading-relaxed">{term.short}</p>
            <Link to={`/glossary/${term.id}`} className="btn-secondary w-full" onClick={() => setTerm(null)}>
              詳しく見る
            </Link>
          </div>
        )}
      </Sheet>
    </OpenTermCtx.Provider>
  );
}

/** 文章中の用語をタップ可能にする（各用語は最初の1回のみリンク） */
export function TermText({ text, className }: { text: string; className?: string }) {
  const { terms } = useContent();
  const matcher = useMemo(() => buildMatcher(terms), [terms]);
  const open = useContext(OpenTermCtx);
  const parts = useMemo(() => {
    const out: (string | { s: string; t: Term })[] = [];
    if (!matcher.re) return [text];
    const seen = new Set<string>();
    let last = 0;
    for (const m of text.matchAll(matcher.re)) {
      const t = matcher.byName.get(m[0]);
      if (!t || seen.has(t.id)) continue;
      seen.add(t.id);
      out.push(text.slice(last, m.index), { s: m[0], t });
      last = m.index! + m[0].length;
    }
    out.push(text.slice(last));
    return out;
  }, [text, matcher]);
  return (
    <span className={className}>
      {parts.map((p, i) =>
        typeof p === 'string' ? (
          p
        ) : (
          <button
            key={i}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              open(p.t);
            }}
            className="inline text-left underline decoration-brand-500 decoration-dotted underline-offset-4"
          >
            {p.s}
          </button>
        ),
      )}
    </span>
  );
}
