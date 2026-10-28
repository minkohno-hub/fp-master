import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { FactCard, LawChange, Question, QuestionSet, Term } from '../domain/types';
import { loadAllQuestionSets } from './index';
import { buildTermIndex, linkTerms, type TermIndex } from '../domain/termlink';
import glossaryJson from './glossary.json';
import cardsJson from './cards.json';
import lawJson from './law-changes.json';
import questionTermsJson from './question-terms.json';

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
  /** 用語の自動リンク用インデックス（用語を登録するだけで本文リンクが有効になる） */
  termIndex: TermIndex;
  cards: StudyCard[];
  lawChanges: LawChange[];
  /** 問題ID → 関連する改正情報（確認済みのみ） */
  lawByQuestion: Map<string, { change: LawChange; impact: LawChange['affectedQuestions'][number] }[]>;
}

export const TERMS = glossaryJson as unknown as Term[];
export const FACT_CARDS = cardsJson as unknown as FactCard[];
export const LAW_CHANGES = lawJson as unknown as LawChange[];
/** 問題ID → 関連用語 */
const QUESTION_TERMS = questionTermsJson as unknown as Record<string, string[]>;

export type ExplanationEntry = { terms: string[]; explanation: NonNullable<Question['explanation']> };
let explanationsPromise: Promise<Record<string, ExplanationEntry>> | null = null;
/** 解説本体（問題データとは別ファイル・サイズが大きい）は、解説を表示するときに初めて読み込む */
export function loadExplanations(): Promise<Record<string, ExplanationEntry>> {
  explanationsPromise ??= import('./explanations.json').then((m) => m.default as unknown as Record<string, ExplanationEntry>);
  return explanationsPromise;
}

/** 問題の解説を取得する（読み込み中は undefined、解説がなければ null） */
export function useExplanationEntry(id: string): ExplanationEntry | null | undefined {
  const [map, setMap] = useState<Record<string, ExplanationEntry> | null>(null);
  useEffect(() => {
    let alive = true;
    void loadExplanations().then((m) => alive && setMap(m));
    return () => {
      alive = false;
    };
  }, []);
  if (!map) return undefined;
  return map[id] ?? null;
}

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
  const termIndex = buildTermIndex(TERMS);
  const questions = sets.flatMap((s) =>
    s.questions.map((q) => {
      // 関連用語＝手で紐づけたもの＋問題文・選択肢の自動リンクで見つかった用語（用語を登録すると自動で増える）
      const text = [q.stem, ...q.parts.flatMap((p) => (p.kind === 'choice' ? p.choices.map((c) => c.text) : []))].join('\n');
      const auto = linkTerms(text, termIndex).flatMap((x) => (x.termId ? [x.termId] : []));
      const manual = [...(q.terms ?? []), ...(QUESTION_TERMS[q.id] ?? [])];
      const all = [...new Set([...manual, ...auto])].slice(0, Math.max(6, manual.length));
      return all.length ? { ...q, terms: all } : q;
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
    termIndex,
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
      <div className="flex min-h-dvh items-center justify-center text-slate-600 dark:text-slate-400" role="status">
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
