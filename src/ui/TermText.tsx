import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import type { Term } from '../domain/types';
import { linkTerms, termsIn } from '../domain/termlink';
import { useContent } from '../content/store';
import { db } from '../db/db';
import { ReviewBadge, Sheet } from './common';

/** 半角英数字を全角に（問題文は全角英字で書かれていることが多い：ＮＩＳＡ等） */
export function toFullWidth(s: string): string {
  return s.replace(/[A-Za-z0-9]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 0xfee0));
}

interface TermPopupApi {
  open: (t: Term) => void;
  /** false の間はリンク化しない（模擬試験の実施中など、正答に直結しうる確認を止める場面用） */
  enabled: boolean;
}

const OpenTermCtx = createContext<TermPopupApi>({ open: () => {}, enabled: true });

async function toggleTermFavorite(termId: string, favorite: boolean) {
  const cur = await db.termState.get(termId);
  await db.termState.put({ termId, favorite, learned: cur?.learned ?? false, updatedAt: new Date().toISOString() });
}

/** 用語のポップアップを提供する（画面ごとに1つ）。enabled=false では用語リンク自体を無効化する */
export function TermPopupProvider({ children, enabled = true }: { children: ReactNode; enabled?: boolean }) {
  const [term, setTerm] = useState<Term | null>(null);
  const { terms } = useContent();
  const loc = useLocation();
  const related = useMemo(() => (term ? terms.filter((t) => term.related.includes(t.id)) : []), [term, terms]);
  const state = useLiveQuery(() => (term ? db.termState.get(term.id) : undefined), [term?.id]);
  const api = useMemo<TermPopupApi>(() => ({ open: (t) => enabled && setTerm(t), enabled }), [enabled]);
  return (
    <OpenTermCtx.Provider value={api}>
      {children}
      <Sheet open={!!term} onClose={() => setTerm(null)} title={term?.name ?? ''} variant="side">
        {term && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
              <span>{term.reading}</span>
              <ReviewBadge status={term.reviewStatus} />
              <button
                type="button"
                className={`chip ml-auto ${state?.favorite ? 'chip-on' : ''}`}
                aria-pressed={!!state?.favorite}
                onClick={() => toggleTermFavorite(term.id, !state?.favorite)}
              >
                ★ お気に入り
              </button>
            </div>
            <p className="leading-relaxed">{term.short}</p>
            {term.facts && term.facts.length > 0 && (
              <div>
                <h3 className="label">数字・条件</h3>
                <ul className="list-disc space-y-1 pl-5 text-sm leading-relaxed">
                  {term.facts.slice(0, 3).map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                </ul>
              </div>
            )}
            {term.example && (
              <p className="rounded-xl bg-slate-100 p-3 text-sm dark:bg-slate-800">
                <b>例：</b>
                {term.example}
              </p>
            )}
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
            <Link
              to={`/glossary/${term.id}`}
              state={{ from: loc.pathname + loc.search }}
              className="btn-secondary w-full"
              onClick={() => setTerm(null)}
            >
              詳しく見る
            </Link>
          </div>
        )}
      </Sheet>
    </OpenTermCtx.Provider>
  );
}

/** 文章中の用語をタップ可能にする（各用語は最初の1回のみリンク）。照合器は Content の共有インスタンスを使う */
export function TermText({ text, className, children }: { text?: string; className?: string; children?: string }) {
  const { termMatcher } = useContent();
  const { open, enabled } = useContext(OpenTermCtx);
  const body = text ?? children ?? '';
  const parts = useMemo(() => (enabled ? linkTerms(body, termMatcher) : [body]), [body, termMatcher, enabled]);
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
 * 解答前でも定義（用語集と同じ内容）だけを開く。Provider が enabled=false の場面（模試実施中）では表示しない。
 */
export function TermChips({ text }: { text: string }) {
  const { termMatcher } = useContent();
  const { open, enabled } = useContext(OpenTermCtx);
  const found = useMemo(() => (enabled ? termsIn(text, termMatcher) : []), [text, termMatcher, enabled]);
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
