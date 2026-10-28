import { useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { useContent } from '../content/store';
import { db } from '../db/db';
import { FIELD_IDS, FIELDS } from '../domain/exam';
import type { FieldId, Term } from '../domain/types';
import { useSettings } from '../state/settings';
import { setTermState } from '../state/terms';
import { PageTitle } from '../ui/Layout';
import { Empty, FieldBadge, ReviewBadge, Tex } from '../ui/common';
import { TermText } from '../ui/TermText';
import { fold, linkTerms } from '../domain/termlink';

const KANA_ROWS = ['あ', 'か', 'さ', 'た', 'な', 'は', 'ま', 'や', 'ら', 'わ'];
const ROW_RANGES: [string, string][] = [
  ['ぁ', 'お'],
  ['か', 'ご'],
  ['さ', 'ぞ'],
  ['た', 'ど'],
  ['な', 'の'],
  ['は', 'ぽ'],
  ['ま', 'も'],
  ['ゃ', 'よ'],
  ['ら', 'ろ'],
  ['ゎ', 'ん'],
];
function kanaRow(reading: string): string {
  const c = reading[0] ?? '';
  const i = ROW_RANGES.findIndex(([a, b]) => c >= a && c <= b);
  return i >= 0 ? KANA_ROWS[i]! : '英数';
}

type Sort = 'kana' | 'field' | 'importance';

/** 検索用の正規化：全角/半角・英大小・カタカナ→ひらがなをそろえる */
export function normSearch(s: string): string {
  return fold(s).replace(/[\u30a1-\u30f6]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));
}

export function GlossaryPage() {
  const { terms } = useContent();
  const settings = useSettings();
  const states = useLiveQuery(() => db.termState.toArray(), []);
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<Sort>('kana');
  const [field, setField] = useState<FieldId | ''>('');
  const [grade, setGrade] = useState<'' | '2' | '3'>('');
  const [imp, setImp] = useState<0 | 1 | 2 | 3>(0);
  const [only, setOnly] = useState<'' | 'fav' | 'unlearned'>('');
  const st = useMemo(() => new Map(states?.map((s) => [s.termId, s])), [states]);
  const gradeFilter = grade ? Number(grade) : settings?.grade;
  const index = useMemo(() => terms.map((t) => ({ t, key: normSearch([t.name, t.reading, ...(t.aliases ?? []), t.short].join('\u0000')) })), [terms]);
  const list = useMemo(() => {
    const norm = normSearch(q.trim());
    return index
      .filter(({ t }) => !gradeFilter || t.grades.includes(gradeFilter as 2 | 3))
      .filter(({ t }) => !field || t.field === field)
      .filter(({ t }) => !imp || t.importance === imp)
      .filter(({ t }) => (only === 'fav' ? st.get(t.id)?.favorite : only === 'unlearned' ? !st.get(t.id)?.learned : true))
      .filter(({ key }) => !norm || key.includes(norm))
      .map(({ t }) => t)
      .sort((a, b) =>
        sort === 'kana'
          ? a.reading.localeCompare(b.reading, 'ja')
          : sort === 'field'
            ? a.field.localeCompare(b.field) || a.reading.localeCompare(b.reading, 'ja')
            : b.importance - a.importance || a.reading.localeCompare(b.reading, 'ja'),
      );
  }, [index, gradeFilter, field, imp, only, q, sort, st]);

  const groups = useMemo(() => {
    const m = new Map<string, Term[]>();
    for (const t of list) {
      const k = sort === 'kana' ? kanaRow(t.reading) : sort === 'field' ? FIELDS[t.field].name : `重要度 ${'★'.repeat(t.importance)}`;
      m.set(k, [...(m.get(k) ?? []), t]);
    }
    return [...m.entries()];
  }, [list, sort]);

  return (
    <div className="space-y-4">
      <PageTitle sub={`${list.length}語（${gradeFilter ? `${gradeFilter}級` : '2級・3級'}の範囲）`}>用語集</PageTitle>
      <input className="input" type="search" placeholder="用語・読み仮名・略語・別名・説明で検索" value={q} onChange={(e) => setQ(e.target.value)} aria-label="用語を検索" />
      <div className="flex flex-wrap gap-2">
        {(['kana', 'field', 'importance'] as const).map((s) => (
          <button key={s} className={`chip ${sort === s ? 'chip-on' : ''}`} onClick={() => setSort(s)} aria-pressed={sort === s}>
            {{ kana: '五十音順', field: '分野別', importance: '重要度順' }[s]}
          </button>
        ))}
        <select className="chip bg-transparent" value={field} onChange={(e) => setField(e.target.value as FieldId | '')} aria-label="分野で絞り込み">
          <option value="">全分野</option>
          {FIELD_IDS.map((f) => (
            <option key={f} value={f}>
              {FIELDS[f].short}
            </option>
          ))}
        </select>
        <select className="chip bg-transparent" value={grade} onChange={(e) => setGrade(e.target.value as '' | '2' | '3')} aria-label="級で絞り込み">
          <option value="">設定の級（{settings?.grade ?? ''}級）</option>
          <option value="2">2級の用語</option>
          <option value="3">3級の用語</option>
        </select>
        <select className="chip bg-transparent" value={imp} onChange={(e) => setImp(Number(e.target.value) as 0 | 1 | 2 | 3)} aria-label="重要度で絞り込み">
          <option value={0}>全重要度</option>
          <option value={3}>重要度 ★★★</option>
          <option value={2}>重要度 ★★</option>
          <option value={1}>重要度 ★</option>
        </select>
        <button className={`chip ${only === 'fav' ? 'chip-on' : ''}`} onClick={() => setOnly(only === 'fav' ? '' : 'fav')} aria-pressed={only === 'fav'}>
          ★お気に入り
        </button>
        <button className={`chip ${only === 'unlearned' ? 'chip-on' : ''}`} onClick={() => setOnly(only === 'unlearned' ? '' : 'unlearned')} aria-pressed={only === 'unlearned'}>
          未学習
        </button>
      </div>
      {sort === 'kana' && groups.length > 1 && (
        <nav aria-label="五十音ジャンプ" className="flex flex-wrap gap-1">
          {groups.map(([g]) => (
            <a key={g} href={`#kana-${g}`} className="chip min-w-9 justify-center" onClick={(e) => { e.preventDefault(); document.getElementById(`kana-${g}`)?.scrollIntoView({ block: 'start' }); }}>
              {g}
            </a>
          ))}
        </nav>
      )}
      {list.length === 0 && <Empty>該当する用語がありません。</Empty>}
      {groups.map(([g, ts]) => (
        <section key={g} id={`kana-${g}`} className="scroll-mt-20">
          <h2 className="label mb-1">{g}</h2>
          <ul className="card divide-y divide-slate-100 p-0 dark:divide-slate-800">
            {ts.map((t) => (
              <li key={t.id}>
                <Link to={`/glossary/${t.id}`} className="block min-h-14 px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{t.name}</span>
                    {st.get(t.id)?.favorite && <span aria-label="お気に入り">★</span>}
                    {st.get(t.id)?.learned && <span className="badge bg-emerald-100 text-emerald-800">学習済み</span>}
                  </div>
                  <p className="line-clamp-1 text-sm text-slate-600 dark:text-slate-400">{t.short}</p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

export function TermPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const loc = useLocation();
  const from = (loc.state as { from?: string } | null)?.from;
  const { termById, questions, termIndex } = useContent();
  const t = termById.get(id ?? '');
  const state = useLiveQuery(() => db.termState.get(id ?? ''), [id]);
  const related = useMemo(() => {
    if (!t) return [];
    const out: typeof questions = [];
    for (const q of questions) {
      if (q.status !== 'verified') continue;
      const text = [q.stem, ...q.parts.flatMap((p) => (p.kind === 'choice' ? p.choices.map((c) => c.text) : []))].join('\n');
      if (q.terms?.includes(t.id) || linkTerms(text, termIndex).some((s) => s.termId === t.id)) out.push(q);
      if (out.length >= 10) break;
    }
    return out;
  }, [t, questions, termIndex]);
  if (!t) return <Empty>用語が見つかりません。</Empty>;
  return (
    <>
      {from && (
        <button className="btn-secondary mb-3 w-full" onClick={() => nav(-1)}>
          ← 元の画面に戻る
        </button>
      )}
      <article className="space-y-4">
        <div>
          <div className="mb-1 flex flex-wrap items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
            <FieldBadge field={t.field} />
            <span>{t.grades.map((g) => `${g}級`).join('・')}</span>
            <span>重要度 {'★'.repeat(t.importance)}</span>
            <ReviewBadge status={t.reviewStatus} />
          </div>
          <h1 className="text-2xl font-bold">{t.name}</h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            {t.reading}
            {t.aliases && t.aliases.length > 0 && <span>　別名・略称：{t.aliases.join('、')}</span>}
          </p>
        </div>
        <p className="card text-lg leading-relaxed">{t.short}</p>
        <section className="space-y-2">
          <h2 className="label">詳しく</h2>
          <p className="leading-relaxed">
            <TermText text={t.detail} />
          </p>
          {t.example && (
            <p className="rounded-xl bg-slate-100 p-3 text-sm dark:bg-slate-800">
              <b>例：</b>
              {t.example}
            </p>
          )}
          {t.system && <p className="text-sm">関連する制度・法律：{t.system}</p>}
          {t.numbers && t.numbers.length > 0 && (
            <div>
              <h3 className="label">重要な数字・適用条件</h3>
              <ul className="list-disc space-y-0.5 pl-5 text-sm">
                {t.numbers.map((n, i) => (
                  <li key={i}>{n}</li>
                ))}
              </ul>
            </div>
          )}
          {t.exceptions && t.exceptions.length > 0 && (
            <div>
              <h3 className="label">例外規定・注意点</h3>
              <ul className="list-disc space-y-0.5 pl-5 text-sm">
                {t.exceptions.map((n, i) => (
                  <li key={i}>{n}</li>
                ))}
              </ul>
            </div>
          )}
          {t.compare && t.compare.length > 0 && (
            <div>
              <h3 className="label">類似用語との違い</h3>
              <ul className="space-y-1 text-sm">
                {t.compare.map((c, i) => (
                  <li key={i}>
                    <b>{c.termId && termById.has(c.termId) ? <Link className="underline" to={`/glossary/${c.termId}`}>{c.label}</Link> : c.label}</b>：{c.diff}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {t.formula && (
            <div>
              <h3 className="label">{t.formula.name}</h3>
              <Tex tex={t.formula.tex} block />
            </div>
          )}
        </section>
        <div className="flex flex-wrap gap-2">
          <button className={`chip ${state?.favorite ? 'chip-on' : ''}`} onClick={() => setTermState(t.id, { favorite: !state?.favorite })} aria-pressed={!!state?.favorite}>
            ★ お気に入り
          </button>
          <button className={`chip ${state?.learned ? 'chip-on' : ''}`} onClick={() => setTermState(t.id, { learned: !state?.learned })} aria-pressed={!!state?.learned}>
            ✓ 学習済み
          </button>
          <Link className="chip" to={`/cards/run?term=${t.id}`}>
            暗記カード
          </Link>
        </div>
        {t.related.length > 0 && (
          <section>
            <h2 className="label mb-2">関連用語</h2>
            <div className="flex flex-wrap gap-2">
              {t.related.map((r) => (
                <Link key={r} className="chip" to={`/glossary/${r}`}>
                  {termById.get(r)?.name ?? r}
                </Link>
              ))}
            </div>
          </section>
        )}
        {related.length > 0 && (
          <section>
            <h2 className="label mb-2">関連する問題</h2>
            <ul className="card divide-y divide-slate-100 p-0 dark:divide-slate-800">
              {related.map((q) => (
                <li key={q.id}>
                  <Link to={`/q/${q.id}`} className="block px-4 py-3 text-sm">
                    {q.stem.slice(0, 60)}…
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
        <section className="text-xs text-slate-600 dark:text-slate-400">
          <h2 className="font-semibold">根拠資料（確認日 {t.checkedAt}{t.lawBaseDate ? `・法令基準日 ${t.lawBaseDate}` : ''}）</h2>
          <ul>
            {t.sources.map((s) => (
              <li key={s.url}>
                <a href={s.url} target="_blank" rel="noreferrer" className="underline">
                  {s.title}
                </a>
              </li>
            ))}
          </ul>
          {t.reviewStatus === 'draft' && <p className="mt-1">この用語の説明は、根拠資料の引用照合が完了していません。学習の参考にとどめ、出典で確認してください。</p>}
        </section>
      </article>
    </>
  );
}
