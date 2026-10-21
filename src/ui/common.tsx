import { useEffect, useRef, type ReactNode } from 'react';
import { Link } from 'react-router';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import { FIELDS } from '../domain/exam';
import type { FieldId } from '../domain/types';

export function Tex({ tex, block = false }: { tex: string; block?: boolean }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (ref.current) {
      katex.render(tex, ref.current, { throwOnError: false, displayMode: block, strict: 'ignore' });
    }
  }, [tex, block]);
  return <span ref={ref} className={block ? 'block overflow-x-auto py-1' : ''} />;
}

export function FieldBadge({ field }: { field: FieldId }) {
  const colors: Record<FieldId, string> = {
    A: 'bg-sky-100 text-sky-800 dark:bg-sky-900/50 dark:text-sky-200',
    B: 'bg-rose-100 text-rose-800 dark:bg-rose-900/50 dark:text-rose-200',
    C: 'bg-amber-100 text-amber-900 dark:bg-amber-900/50 dark:text-amber-200',
    D: 'bg-violet-100 text-violet-800 dark:bg-violet-900/50 dark:text-violet-200',
    E: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200',
    F: 'bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-100',
  };
  return <span className={`badge ${colors[field]}`}>{FIELDS[field].short}</span>;
}

export function ReviewBadge({ status }: { status: 'verified' | 'draft' }) {
  return status === 'verified' ? (
    <span className="badge bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200" title="根拠資料の引用を公式ページで照合済み">
      根拠照合済み
    </span>
  ) : (
    <span className="badge bg-amber-100 text-amber-900 dark:bg-amber-900/50 dark:text-amber-200" title="AIが作成し、根拠資料との照合が完了していません">
      要確認
    </span>
  );
}

export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 sm:items-center" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[80dvh] w-full overflow-y-auto rounded-t-2xl bg-white p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] text-slate-900 shadow-xl sm:max-w-lg sm:rounded-2xl dark:bg-slate-900 dark:text-slate-100"
      >
        <div className="mb-2 flex items-start justify-between gap-2">
          <h2 className="text-lg font-bold">{title}</h2>
          <button onClick={onClose} className="min-h-10 min-w-10 rounded-lg text-xl text-slate-500" aria-label="閉じる">
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Stat({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <div className="rounded-xl bg-slate-100 p-3 dark:bg-slate-800">
      <div className="text-xs text-slate-500 dark:text-slate-400">{label}</div>
      <div className="mt-0.5 text-xl font-bold tabular-nums">{value}</div>
      {sub && <div className="text-xs text-slate-500 dark:text-slate-400">{sub}</div>}
    </div>
  );
}

export function ProgressBar({ value, max, label }: { value: number; max: number; label?: string }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={max} aria-label={label}>
      <div className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
        <div className="h-full rounded-full bg-brand-600" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function LinkRow({ to, title, sub, right }: { to: string; title: ReactNode; sub?: ReactNode; right?: ReactNode }) {
  return (
    <Link to={to} className="flex min-h-14 items-center justify-between gap-3 border-b border-slate-100 py-2 last:border-0 dark:border-slate-800">
      <div className="min-w-0">
        <div className="font-medium">{title}</div>
        {sub && <div className="text-sm text-slate-500 dark:text-slate-400">{sub}</div>}
      </div>
      <div className="flex shrink-0 items-center gap-2 text-slate-400">
        {right}
        <span aria-hidden>›</span>
      </div>
    </Link>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500 dark:border-slate-700">{children}</p>;
}

export function pct(rate: number | null | undefined): string {
  return rate === null || rate === undefined ? '—' : `${Math.round(rate * 100)}%`;
}

export function formatMs(ms: number | null): string {
  if (ms === null) return '—';
  const s = Math.round(ms / 1000);
  return s < 60 ? `${s}秒` : `${Math.floor(s / 60)}分${s % 60}秒`;
}
