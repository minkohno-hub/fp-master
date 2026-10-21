import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { FactCard, LawChange, Question, QuestionSet, Term } from '../domain/types';
import { loadAllQuestionSets } from './index';
import glossaryJson from './glossary.json';
import cardsJson from './cards.json';
import lawJson from './law-changes.json';
import explanationsJson from './explanations.json';

export interface StudyCard {
  id: string;
  front: string;
  back: string;
  field: Term['field'];
  grades: Term['grades'];
  kind: 'term' | 'fact';
  termId?: string;
  reviewStatus: 'verified' | 'draft';
}

export interface Content {
  sets: QuestionSet[];
  questions: Question[];
  questionById: Map<string, Question>;
  terms: Term[];
  termById: Map<string, Term>;
  cards: StudyCard[];
  lawChanges: LawChange[];
  /** 問題ID → 関連する改正情報（確認済みのみ） */
  lawByQuestion: Map<string, { change: LawChange; impact: LawChange['affectedQuestions'][number] }[]>;
}

export const TERMS = glossaryJson as unknown as Term[];
export const FACT_CARDS = cardsJson as unknown as FactCard[];
export const LAW_CHANGES = lawJson as unknown as LawChange[];
/** 問題ID → 解説（問題データとは別ファイルで管理し、取り込みの再実行で消えないようにする） */
export const EXPLANATIONS = explanationsJson as unknown as Record<string, { terms: string[]; explanation: NonNullable<Question['explanation']> }>;

export function buildCards(terms: Term[], facts: FactCard[]): StudyCard[] {
  return [
    ...terms.map((t) => ({
      id: `t-${t.id}`,
      front: t.name,
      back: t.short,
      field: t.field,
      grades: t.grades,
      kind: 'term' as const,
      termId: t.id,
      reviewStatus: t.reviewStatus,
    })),
    ...facts.map((f) => ({
      id: f.id,
      front: f.front,
      back: f.back,
      field: f.field,
      grades: f.grades,
      kind: 'fact' as const,
      termId: f.termId,
      reviewStatus: f.reviewStatus,
    })),
  ];
}

export function buildContent(sets: QuestionSet[]): Content {
  const questions = sets.flatMap((s) =>
    s.questions.map((q) => {
      const e = EXPLANATIONS[q.id];
      return e ? { ...q, explanation: e.explanation, terms: [...new Set([...(q.terms ?? []), ...e.terms])] } : q;
    }),
  );
  const lawByQuestion: Content['lawByQuestion'] = new Map();
  for (const change of LAW_CHANGES.filter((c) => c.status === 'confirmed')) {
    for (const impact of change.affectedQuestions) {
      lawByQuestion.set(impact.id, [...(lawByQuestion.get(impact.id) ?? []), { change, impact }]);
    }
  }
  // 「正答が変わる」改正の影響を受ける問題は出題しない（隔離扱い）
  const adjusted = questions.map((q) =>
    lawByQuestion.get(q.id)?.some((x) => x.impact.impact === 'changed')
      ? { ...q, status: 'quarantined' as const, quarantineReason: '制度改正により正答が変わるため出題停止' }
      : q,
  );
  return {
    sets,
    questions: adjusted,
    questionById: new Map(adjusted.map((q) => [q.id, q])),
    terms: TERMS,
    termById: new Map(TERMS.map((t) => [t.id, t])),
    cards: buildCards(TERMS, FACT_CARDS),
    lawChanges: LAW_CHANGES,
    lawByQuestion,
  };
}

const Ctx = createContext<Content | null>(null);

export function ContentProvider({ children }: { children: ReactNode }) {
  const [content, setContent] = useState<Content | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    loadAllQuestionSets()
      .then((sets) => setContent(buildContent(sets)))
      .catch((e: unknown) => setError(String(e)));
  }, []);
  if (error) {
    return <div className="p-6 text-red-700">問題データの読み込みに失敗しました：{error}</div>;
  }
  if (!content) {
    return (
      <div className="flex min-h-dvh items-center justify-center text-slate-500" role="status">
        読み込み中…
      </div>
    );
  }
  return <Ctx.Provider value={content}>{children}</Ctx.Provider>;
}

export function useContent(): Content {
  const c = useContext(Ctx);
  if (!c) throw new Error('ContentProvider がありません');
  return c;
}

/** 現在の級・科目の問題 */
export function useExamQuestions(exam: string): Question[] {
  const { questions } = useContent();
  return useMemo(() => questions.filter((q) => q.exam === exam), [questions, exam]);
}
