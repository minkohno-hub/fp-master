import { useState } from 'react';
import { Link } from 'react-router';
import type { Question } from '../domain/types';
import { formatAnswer } from '../domain/scoring';
import type { ExplanationMode } from '../state/settings';
import { useContent } from '../content/store';
import { ReviewBadge, Tex } from './common';
import { TermText } from './TermText';
import { LawNotice, SourceLine } from './QuestionView';

/**
 * 解説。初期は簡潔表示、必要な人だけ展開できる。
 * 解説が未作成・未照合の問題は、その旨を明示する（推測で補わない）。
 */
export function Explanation({ q, initialMode }: { q: Question; initialMode: ExplanationMode }) {
  const [mode, setMode] = useState<ExplanationMode>(initialMode);
  const { questionById, terms } = useContent();
  const e = q.explanation;
  const relatedTerms = terms.filter((t) => q.terms?.includes(t.id));

  return (
    <section aria-label="解説" className="mt-4 space-y-3">
      <div className="card space-y-2">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-bold">正解：{q.parts.map((p) => formatAnswer(p)).join('／')}</h2>
          {e && <ReviewBadge status={e.status} />}
        </div>
        {q.source.kind === 'official' && <p className="text-xs text-slate-500">正答は日本FP協会の公表解答と照合済みです。</p>}
        {e ? (
          <>
            <p className="leading-relaxed">
              <TermText text={e.short} />
            </p>
            {mode !== 'short' && e.standard && <p className="leading-relaxed">{e.standard}</p>}
            {mode !== 'short' && e.whyCorrect && (
              <div>
                <h3 className="label">正解の理由</h3>
                <p className="leading-relaxed">{e.whyCorrect}</p>
              </div>
            )}
            {mode !== 'short' && e.wrongChoices && (
              <div>
                <h3 className="label">誤りの選択肢</h3>
                <ul className="space-y-1">
                  {Object.entries(e.wrongChoices).map(([k, v]) => (
                    <li key={k} className="leading-relaxed">
                      <b>{k})</b> {v}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {mode === 'detail' && (
              <>
                {e.detail && (
                  <div>
                    <h3 className="label">制度の仕組み</h3>
                    <p className="leading-relaxed">{e.detail}</p>
                  </div>
                )}
                {e.example && (
                  <div>
                    <h3 className="label">具体例</h3>
                    <p className="leading-relaxed">{e.example}</p>
                  </div>
                )}
                {e.formulas?.map((f) => (
                  <div key={f.name}>
                    <h3 className="label">{f.name}</h3>
                    <Tex tex={f.tex} block />
                  </div>
                ))}
                {e.pitfalls && (
                  <div>
                    <h3 className="label">間違えやすいポイント</h3>
                    <p className="leading-relaxed">{e.pitfalls}</p>
                  </div>
                )}
                {e.mnemonic && (
                  <div>
                    <h3 className="label">暗記のコツ</h3>
                    <p className="leading-relaxed">{e.mnemonic}</p>
                  </div>
                )}
                {e.relatedQuestions?.length ? (
                  <div>
                    <h3 className="label">関連する問題</h3>
                    <ul>
                      {e.relatedQuestions
                        .map((id) => questionById.get(id))
                        .filter(Boolean)
                        .map((rq) => (
                          <li key={rq!.id}>
                            <Link className="text-brand-700 underline dark:text-brand-200" to={`/q/${rq!.id}`}>
                              {rq!.stem.slice(0, 40)}…
                            </Link>
                          </li>
                        ))}
                    </ul>
                  </div>
                ) : null}
                <div>
                  <h3 className="label">根拠資料（法令基準日 {e.lawBaseDate}・確認日 {e.checkedAt}）</h3>
                  <ul className="text-sm">
                    {e.sources.map((s) => (
                      <li key={s.url}>
                        <a className="text-brand-700 underline dark:text-brand-200" href={s.url} target="_blank" rel="noreferrer">
                          {s.title}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              </>
            )}
            <div role="group" aria-label="解説の詳しさ" className="flex gap-2 pt-1">
              {(['short', 'standard', 'detail'] as const).map((m) => (
                <button key={m} className={`chip ${mode === m ? 'chip-on' : ''}`} onClick={() => setMode(m)} aria-pressed={mode === m}>
                  {{ short: '簡潔', standard: '標準', detail: '詳細' }[m]}
                </button>
              ))}
            </div>
          </>
        ) : (
          <p className="text-sm text-slate-500">この問題の解説は準備中です（根拠資料と照合した解説のみ掲載します）。</p>
        )}
        {relatedTerms.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-1">
            {relatedTerms.map((t) => (
              <Link key={t.id} to={`/glossary/${t.id}`} className="chip">
                {t.name}
              </Link>
            ))}
          </div>
        )}
      </div>
      <LawNotice q={q} />
      <SourceLine q={q} />
    </section>
  );
}
