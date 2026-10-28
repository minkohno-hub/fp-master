import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import type { Term } from '../domain/types';
import { buildMatcher, linkTerms, termsIn } from '../domain/termlink';
import { useContent } from '../content/store';
import { ReviewBadge, Sheet } from './common';

/** 半角英数字を全角に（問題文は全角英字で書かれていることが多い：ＮＩＳＡ等） */
export function toFullWidth(s: string): string {
  return s.replace(/[A-Za-z0-9]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 0xfee0));
}

const OpenTermCtx = createContext<(t: Term) => void>(() => {});

/** 用語のポップアップを提供する（画面ごとに1つ） */
export function TermPopupProvider({ children }: { children: ReactNode }) {
  const [term, setTerm] = useState<Term | null>(null);
  const { terms } = useContent();
  const related = useMemo(() => (term ? terms.filter((t) => term.related.includes(t.id)) : []), [term, terms]);
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
            {related.length > 0 && (
              <div>
                <h3 className="label">関連用語</h3>
                <div className="flex flex-wrap gap-2">
                  {related.map((r) => (
                    <button key={r.id} type="button" className="chip" onClick={() => setTerm(r)}>
                      {r.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
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
  const parts = useMemo(() => linkTerms(text, matcher), [text, matcher]);
  return (
    <span className={className}>
      {parts.map((p, i) =>
        typeof p === 'string' ? (
          p
        ) : (
          <button
            key={i}
            type="button"
            aria-haspopup="dialog"
            onClick={(e) => {
              e.stopPropagation();
              open(p.term);
            }}
            className="inline text-left underline decoration-brand-500 decoration-dotted underline-offset-4"
          >
            {p.text}
          </button>
        ),
      )}
    </span>
  );
}

/**
 * 選択肢に含まれる用語のチップ。選択肢自体がボタンのため、リンクを入れ子にせず直下に並べる。
 * 解答前でも定義（用語集と同じ内容）だけを開く。
 */
export function TermChips({ text }: { text: string }) {
  const { terms } = useContent();
  const matcher = useMemo(() => buildMatcher(terms), [terms]);
  const open = useContext(OpenTermCtx);
  const found = useMemo(() => termsIn(text, matcher), [text, matcher]);
  if (!found.length) return null;
  return (
    <div className="mt-1 flex flex-wrap items-center gap-1.5 pl-10" role="group" aria-label="この選択肢の用語">
      <span className="text-xs text-slate-600 dark:text-slate-400">用語</span>
      {found.map((t) => (
        <button key={t.id} type="button" onClick={() => open(t)} className="min-h-8 rounded-full border border-slate-300 px-2.5 text-xs dark:border-slate-600">
          {t.name.replace(/（.*?）/g, '')}
        </button>
      ))}
    </div>
  );
}
