import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { useContent } from '../content/store';
import { db } from '../db/db';
import { toggleFlag } from '../db/repo';
import { scoreQuestion, type Responses } from '../domain/scoring';
import { compareQuestionOrder } from '../domain/selection';
import { EXAM_SPECS, FIELD_IDS, FIELDS } from '../domain/exam';
import type { FieldId } from '../domain/types';
import { useSettings } from '../state/settings';
import { useExamKey, useUserState } from '../ui/hooks';
import { PageTitle } from '../ui/Layout';
import { AnswerArea, QuestionHeader, Stem } from '../ui/QuestionView';
import { Explanation } from '../ui/Explanation';
import { TermPolicyProvider } from '../ui/TermText';
import { NoteAndReport } from '../ui/NoteAndReport';
import { Empty, FieldBadge } from '../ui/common';

/** 過去問一覧（公表回・分野・学習状況で絞り込み） */
export function QuestionListPage() {
  const exam = useExamKey();
  const { questions, sets } = useContent();
  const u = useUserState();
  const [set, setSet] = useState<string>('');
  const [field, setField] = useState<FieldId | ''>('');
  const [q, setQ] = useState('');
  const list = useMemo(() => {
    if (!exam) return [];
    return questions
      .filter((x) => x.exam === exam)
      .filter((x) => !set || x.id.startsWith(set.replace('_', '-')))
      .filter((x) => !field || x.field === field)
      .filter((x) => !q || x.stem.includes(q) || x.theme.includes(q))
      .sort(compareQuestionOrder);
  }, [questions, exam, set, field, q]);
  if (!exam) return null;
  const examSets = sets.filter((s) => s.exam === exam);
  return (
    <div className="space-y-4">
      <PageTitle sub={`${EXAM_SPECS[exam].label}：${list.length}問`}>過去問一覧</PageTitle>
      <div className="grid gap-2 sm:grid-cols-3">
        <select className="input" value={set} onChange={(e) => setSet(e.target.value)} aria-label="公表回">
          <option value="">すべての回</option>
          {examSets.map((s) => (
            <option key={s.id} value={s.id}>
              {s.title}
            </option>
          ))}
        </select>
        <select className="input" value={field} onChange={(e) => setField(e.target.value as FieldId | '')} aria-label="分野">
          <option value="">すべての分野</option>
          {FIELD_IDS.map((f) => (
            <option key={f} value={f}>
              {FIELDS[f].name}
            </option>
          ))}
        </select>
        <input className="input" placeholder="キーワード" value={q} onChange={(e) => setQ(e.target.value)} aria-label="キーワード検索" />
      </div>
      {list.length === 0 ? (
        <Empty>{EXAM_SPECS[exam].subject === 'jitsugi' ? '実技問題は準備中です。' : '該当する問題がありません。'}</Empty>
      ) : (
        <ul className="card divide-y divide-slate-100 p-0 dark:divide-slate-800">
          {list.map((x) => {
            const st = u?.stats.get(x.id);
            return (
              <li key={x.id}>
                <Link to={`/q/${x.id}`} className="block min-h-14 px-4 py-3">
                  <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
                    <span>{x.source.kind === 'official' ? `${x.source.yearMonth} 問${x.source.number}` : 'オリジナル'}</span>
                    <FieldBadge field={x.field} />
                    {x.requiresCalculation && <span className="badge bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-100">計算</span>}
                    {x.status !== 'verified' && <span className="badge bg-rose-100 text-rose-800">隔離中</span>}
                    {st && <span className={st.lastCorrect ? 'text-emerald-700' : 'text-rose-700'}>{st.lastCorrect ? '○' : '×'} {st.correct}/{st.attempts}</span>}
                  </div>
                  <p className="line-clamp-2 text-sm">{x.stem}</p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/** 1問の表示（一覧・履歴・ブックマークから）。解いてから解説を見る */
export function QuestionDetailPage() {
  const { id } = useParams();
  const { questionById } = useContent();
  const settings = useSettings();
  const q = questionById.get(id ?? '');
  const [responses, setResponses] = useState<Responses>({});
  const [done, setDone] = useState(false);
  const bookmarked = useLiveQuery(() => db.bookmarks.get(id ?? ''), [id]);
  if (!q || !settings) return <Empty>問題が見つかりません。</Empty>;
  const result = done ? scoreQuestion(q, responses) : undefined;
  return (
    <TermPolicyProvider value={result ? 'full' : 'brief'}>
      <div className="space-y-2 pb-8">
        <QuestionHeader q={q} />
        {q.status !== 'verified' && (
          <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-900 dark:bg-rose-950/40 dark:text-rose-100">
            この問題は検証が完了していないため出題対象外です（理由：{q.quarantineReason}）。表示は確認用です。
          </p>
        )}
        <Stem q={q} />
        <AnswerArea q={q} responses={responses} onChange={setResponses} onSubmit={(r) => { setResponses(r); setDone(true); }} result={result} mode="practice" />
        {!done && (
          <button className="btn-ghost w-full" onClick={() => setDone(true)}>
            解かずに正解と解説を見る
          </button>
        )}
        {done && (
          <>
            <div className="flex gap-2">
              <button className={`chip ${bookmarked ? 'chip-on' : ''}`} onClick={() => toggleFlag('bookmarks', q.id)} aria-pressed={!!bookmarked}>
                ★ ブックマーク
              </button>
            </div>
            <Explanation q={q} initialMode={settings.explanationMode} />
            <NoteAndReport itemKey={q.id} />
          </>
        )}
      </div>
    </TermPolicyProvider>
  );
}
