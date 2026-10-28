import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import type { Term } from '../domain/types';
import { linkTerms } from '../domain/termlink';
import { useContent } from '../content/store';
import { setTermState } from '../state/terms';
import { ReviewBadge, Tex } from './common';

/** 半角英数字を全角に（問題文は全角英字で書かれていることが多い：ＮＩＳＡ等） */
export function toFullWidth(s: string): string {
  return s.replace(/[A-Za-z0-9]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 0xfee0));
}

/**
 * 用語リンクの表示方針。
 * - full: 詳しい説明まで表示
 * - brief: 概念の簡潔な説明のみ（解答前など、正答のヒントになりうる数値・例外を出さない）
 * - off: リンクにしない
 */
export type TermPolicy = 'full' | 'brief' | 'off';
const PolicyCtx = createContext<TermPolicy>('full');
export function TermPolicyProvider({ value, children }: { value: TermPolicy; children: ReactNode }) {
  return <PolicyCtx.Provider value={value}>{children}</PolicyCtx.Provider>;
}

type OpenFn = (t: Term, policy: TermPolicy) => void;
const OpenCtx = createContext<OpenFn | null>(null);

function useWide(): boolean {
  const q = '(min-width: 768px)';
  const [wide, setWide] = useState(() => (typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(q).matches : false));
  useEffect(() => {
    if (!window.matchMedia) return;
    const mq = window.matchMedia(q);
    const on = () => setWide(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return wide;
}

interface PopupState {
  stack: Term[];
  policy: TermPolicy;
}

/**
 * 用語のポップアップを提供する。アプリ全体（Layout）に1つ置く。
 * 画面ごとに置かれた場合は外側のものを使う（入れ子にしない）。
 */
export function TermPopupProvider({ children }: { children: ReactNode }) {
  const outer = useContext(OpenCtx);
  const [state, setState] = useState<PopupState | null>(null);
  const opener = useRef<HTMLElement | null>(null);
  const open = useCallback<OpenFn>((t, policy) => {
    setState((s) => {
      if (!s) opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      return s ? { stack: [...s.stack, t], policy: s.policy === 'full' ? policy : s.policy } : { stack: [t], policy };
    });
  }, []);
  const close = useCallback(() => {
    setState(null);
    const el = opener.current;
    opener.current = null;
    // 閉じたあとは、タップした用語（なければ元の位置）にフォーカスを戻す
    if (el && document.contains(el)) setTimeout(() => el.focus({ preventScroll: true }), 0);
  }, []);
  const back = useCallback(() => setState((s) => (s && s.stack.length > 1 ? { ...s, stack: s.stack.slice(0, -1) } : s)), []);
  if (outer) return <>{children}</>;
  return (
    <OpenCtx.Provider value={open}>
      {children}
      {state && <TermPopup term={state.stack[state.stack.length - 1]!} policy={state.policy} canBack={state.stack.length > 1} onBack={back} onClose={close} />}
    </OpenCtx.Provider>
  );
}

function TermPopup({ term, policy, canBack, onBack, onClose }: { term: Term; policy: TermPolicy; canBack: boolean; onBack: () => void; onClose: () => void }) {
  const wide = useWide();
  const { termById } = useContent();
  const loc = useLocation();
  const panel = useRef<HTMLDivElement>(null);
  const fav = useLiveQuery(() => db.termState.get(term.id), [term.id]);
  const full = policy === 'full';

  // 開いたときに見出しへフォーカス（スクリーンリーダーが内容を読み上げる）。モバイルでは Tab をシート内に閉じ込める
  useEffect(() => {
    panel.current?.focus({ preventScroll: true });
  }, [term.id]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key === 'Tab' && !wide && panel.current) {
        const f = [...panel.current.querySelectorAll<HTMLElement>('a[href],button:not([disabled])')];
        if (f.length === 0) return;
        const first = f[0]!;
        const last = f[f.length - 1]!;
        if (e.shiftKey && (document.activeElement === first || document.activeElement === panel.current)) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, wide]);

  const body = (
    <div
      ref={panel}
      tabIndex={-1}
      role="dialog"
      aria-modal={!wide}
      aria-labelledby="term-popup-title"
      data-testid="term-popup"
      onClick={(e) => e.stopPropagation()}
      className={
        wide
          ? 'fixed bottom-4 right-4 top-20 z-40 w-[26rem] max-w-[calc(100vw-2rem)] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-4 text-slate-900 shadow-2xl outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100'
          : 'max-h-[80dvh] w-full overflow-y-auto rounded-t-2xl bg-white p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] text-slate-900 shadow-xl outline-none dark:bg-slate-900 dark:text-slate-100'
      }
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 id="term-popup-title" className="text-lg font-bold">
            {term.name}
          </h2>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
            <span>{term.reading}</span>
            <span>{term.grades.map((g) => `${g}級`).join('・')}</span>
            <ReviewBadge status={term.reviewStatus} />
          </div>
        </div>
        <button onClick={onClose} className="min-h-10 min-w-10 shrink-0 rounded-lg text-xl text-slate-600 dark:text-slate-400" aria-label="閉じる">
          ×
        </button>
      </div>
      <div className="space-y-3">
        <p className="leading-relaxed">{term.short}</p>
        {!full && <p className="rounded-lg bg-slate-100 p-2 text-xs text-slate-700 dark:bg-slate-800 dark:text-slate-300">詳しい説明（数字・例外・比較）は、解答を確定したあとに表示されます。</p>}
        {full && (
          <>
            <p className="leading-relaxed">
              <TermText text={term.detail} />
            </p>
            {term.example && (
              <p className="rounded-xl bg-slate-100 p-3 text-sm dark:bg-slate-800">
                <b>例：</b>
                {term.example}
              </p>
            )}
            {term.system && <p className="text-sm">関連する制度：{term.system}</p>}
            {term.numbers && term.numbers.length > 0 && (
              <section>
                <h3 className="label">重要な数字・条件</h3>
                <ul className="list-disc space-y-0.5 pl-5 text-sm">
                  {term.numbers.map((n, i) => (
                    <li key={i}>{n}</li>
                  ))}
                </ul>
              </section>
            )}
            {term.exceptions && term.exceptions.length > 0 && (
              <section>
                <h3 className="label">例外・注意点</h3>
                <ul className="list-disc space-y-0.5 pl-5 text-sm">
                  {term.exceptions.map((n, i) => (
                    <li key={i}>{n}</li>
                  ))}
                </ul>
              </section>
            )}
            {term.compare && term.compare.length > 0 && (
              <section>
                <h3 className="label">類似用語との違い</h3>
                <ul className="space-y-1 text-sm">
                  {term.compare.map((c, i) => (
                    <li key={i}>
                      <b>{c.label}</b>：{c.diff}
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {term.formula && (
              <div>
                <h3 className="label">{term.formula.name}</h3>
                <Tex tex={term.formula.tex} block />
              </div>
            )}
            {term.related.length > 0 && (
              <section>
                <h3 className="label mb-1">関連用語</h3>
                <div className="flex flex-wrap gap-2">
                  {term.related.map((r) => {
                    const rt = termById.get(r);
                    return rt ? (
                      <RelatedChip key={r} term={rt} />
                    ) : null;
                  })}
                </div>
              </section>
            )}
          </>
        )}
        <div className="flex flex-wrap gap-2">
          <button className={`chip ${fav?.favorite ? 'chip-on' : ''}`} aria-pressed={!!fav?.favorite} onClick={() => setTermState(term.id, { favorite: !fav?.favorite })}>
            ★ お気に入り
          </button>
          {canBack && (
            <button className="chip" onClick={onBack}>
              ← 前の用語
            </button>
          )}
        </div>
        {full && (
          <Link to={`/glossary/${term.id}`} state={{ from: loc.pathname + loc.search }} className="btn-secondary w-full" onClick={onClose}>
            用語集で詳しく見る
          </Link>
        )}
        <button className="btn-secondary w-full" onClick={onClose}>
          閉じて問題に戻る
        </button>
      </div>
    </div>
  );
  if (wide) return body;
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40" onClick={onClose}>
      {body}
    </div>
  );
}

/** 関連用語チップ：ポップアップ内では、その用語に切り替える */
function RelatedChip({ term }: { term: Term }) {
  const open = useContext(OpenCtx);
  return (
    <button className="chip" onClick={() => open?.(term, 'full')}>
      {term.name}
    </button>
  );
}

/**
 * 文章中の用語をタップ可能にする（各用語はこの文章内で最初の1回のみリンク）。
 * 用語集に登録された名称・別名・表記ゆれに自動で一致する。
 */
export function TermText({ text, className }: { text: string; className?: string }) {
  const { termIndex, termById } = useContent();
  const open = useContext(OpenCtx);
  const policy = useContext(PolicyCtx);
  const parts = useMemo(() => (policy === 'off' ? [{ text }] : linkTerms(text, termIndex)), [text, termIndex, policy]);
  return (
    <span className={className}>
      {parts.map((p, i) => {
        const t = p.termId ? termById.get(p.termId) : undefined;
        if (!t || !open) return p.text;
        return (
          <button
            key={i}
            type="button"
            data-term={t.id}
            aria-haspopup="dialog"
            onClick={(e) => {
              e.stopPropagation();
              open(t, policy);
            }}
            className="term-link pointer-events-auto relative z-10 inline text-left underline decoration-brand-500 decoration-dotted underline-offset-4"
          >
            {p.text}
          </button>
        );
      })}
    </span>
  );
}
