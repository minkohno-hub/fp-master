import type { Attempt, Grade, Subject } from "./learning";
import {
  canPublish,
  type Difficulty,
  type ExamCategory,
  type MaterialOrigin,
  type MaterialQuestion,
} from "./curriculum";
import { decimalToScaled } from "./calculations";
export type StudyMode = "practice" | "calculation" | "review" | "mock";
export interface QuestionFilter {
  grade: Grade;
  exam: ExamCategory;
  mode: StudyMode;
  count: number;
  subject?: Subject;
  topicId?: string;
  difficulty?: Difficulty;
  year?: number;
  origin?: MaterialOrigin;
  unansweredOnly?: boolean;
  bookmarkedOnly?: boolean;
  wrongOnly?: boolean;
  dueOnly?: boolean;
}
export interface QuestionSet {
  questions: MaterialQuestion[];
  requested: number;
  available: number;
  shortage: number;
  containsCalculation: boolean;
  /** A mock set with too few questions or no calculation must not be described as full exam reproduction. */
  complete: boolean;
}
/** Choose each question at most once. Only verified, publishable content enters a real learning session. */
export function buildQuestionSet(
  catalog: readonly MaterialQuestion[],
  filter: QuestionFilter,
  attempts: readonly Attempt[] = [],
  bookmarks: readonly string[] = [],
  dueIds: readonly string[] = [],
  random: () => number = Math.random,
): QuestionSet {
  if (
    !Number.isSafeInteger(filter.count) ||
    filter.count < 1 ||
    filter.count > 1000
  )
    throw new RangeError("出題数は1〜1000問です");
  const answered = new Set(attempts.map((a) => a.questionId));
  const bookmarked = new Set(bookmarks);
  const due = new Set(dueIds);
  const latest = new Map<string, boolean>();
  for (const a of [...attempts].sort(
    (a, b) => Date.parse(a.answeredAt) - Date.parse(b.answeredAt),
  ))
    latest.set(a.questionId, a.correct);
  const seen = new Set<string>();
  const candidates = catalog.filter((q) => {
    if (seen.has(q.id) || !canPublish(q)) return false;
    seen.add(q.id);
    return (
      q.grade === filter.grade &&
      q.exam === filter.exam &&
      (!filter.subject || q.subject === filter.subject) &&
      (!filter.topicId || q.topicId === filter.topicId) &&
      (!filter.difficulty || q.difficulty === filter.difficulty) &&
      (!filter.year || q.year === filter.year) &&
      (!filter.origin || q.source.origin === filter.origin) &&
      (!filter.unansweredOnly || !answered.has(q.id)) &&
      (!filter.bookmarkedOnly || bookmarked.has(q.id)) &&
      (!filter.wrongOnly || latest.get(q.id) === false) &&
      (!filter.dueOnly || due.has(q.id)) &&
      (filter.mode === "calculation"
        ? q.kind === "calculation"
        : filter.mode === "practice"
          ? q.kind === "knowledge"
          : filter.mode === "review"
            ? due.has(q.id) || latest.get(q.id) === false
            : true)
    );
  });
  // Balanced ordering: shuffle within each field, then interleave fields. No repeated filler questions.
  const shuffled = [...candidates];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const value = random();
    if (!Number.isFinite(value) || value < 0 || value >= 1)
      throw new RangeError("乱数は0以上1未満です");
    const j = Math.floor(value * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  const buckets = new Map<Subject, { items: MaterialQuestion[]; offset: number }>();
  for (const q of shuffled) {
    let bucket = buckets.get(q.subject);
    if (!bucket) {
      bucket = { items: [], offset: 0 };
      buckets.set(q.subject, bucket);
    }
    bucket.items.push(q);
  }
  // Keep each field interleaved without copying or shifting growing arrays.
  // A five-question session should not build an ordering for the entire catalog.
  const selected: MaterialQuestion[] = [];
  const limit = Math.min(filter.count, shuffled.length);
  while (selected.length < limit) {
    for (const bucket of buckets.values()) {
      if (selected.length === limit) break;
      if (bucket.offset < bucket.items.length)
        selected.push(bucket.items[bucket.offset++]);
    }
  }
  // A mock exam must exercise calculations even when the first N balanced questions happen to be knowledge-only.
  if (
    filter.mode === "mock" &&
    selected.length &&
    !selected.some((q) => q.kind === "calculation")
  ) {
    const calculation = shuffled.find((q) => q.kind === "calculation");
    if (calculation) selected[selected.length - 1] = calculation;
  }
  const shortage = Math.max(0, filter.count - selected.length);
  const containsCalculation = selected.some((q) => q.kind === "calculation");
  return {
    questions: selected,
    requested: filter.count,
    available: candidates.length,
    shortage,
    containsCalculation,
    complete: shortage === 0 && (filter.mode !== "mock" || containsCalculation),
  };
}
export interface GradeResult {
  correct: boolean;
  valid: boolean;
  message: string | null;
}
export function gradeAnswer(
  question: MaterialQuestion,
  response: number | string | null,
): GradeResult {
  if (question.grading.type === "choice") {
    if (
      typeof response !== "number" ||
      !Number.isInteger(response) ||
      response < 0 ||
      response >= question.choices.length
    )
      return {
        correct: false,
        valid: false,
        message: "選択肢を1つ選んでください",
      };
    return {
      correct: response === question.grading.correctIndex,
      valid: true,
      message: null,
    };
  }
  if (typeof response !== "string")
    return { correct: false, valid: false, message: "数値を入力してください" };
  try {
    const rule = question.grading;
    const expected = decimalToScaled(
      rule.expected,
      rule.decimalPlaces,
      rule.rounding,
    );
    const actual = decimalToScaled(response, rule.decimalPlaces, rule.rounding);
    return { correct: actual === expected, valid: true, message: null };
  } catch {
    return {
      correct: false,
      valid: false,
      message: "単位やカンマを付けずに数値を入力してください",
    };
  }
}
export function targetScore(fullScore: number): number {
  if (!Number.isSafeInteger(fullScore) || fullScore < 1)
    throw new RangeError("満点は正の整数です");
  return Math.ceil((fullScore * 95) / 100);
}
