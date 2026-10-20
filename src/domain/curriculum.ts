import type { Grade, Subject } from './learning';

export type ExamCategory = 'academic' | 'practical';
export type Difficulty = 'basic' | 'standard' | 'advanced' | 'expert' | 'exception';
export type VerificationStatus = 'draft' | 'needs-review' | 'verified' | 'retired';
export type MaterialOrigin = 'official' | 'adapted' | 'original';
export interface SourceReference {
  title: string;
  url: string;
  /** Date on which the actual original document, not merely its URL, was checked. */
  checkedAt: string | null;
}
export interface Verification {
  status: VerificationStatus;
  checkedAt: string | null;
  reviewer: string | null;
  /** Evidence of source, answer-key, and explanation checks. A schema check is not editorial verification. */
  evidence: string[];
}
export interface DetailedExplanation {
  concise: string;
  standard: string;
  detailed: string;
  conditions: string[];
  exceptions: string[];
  commonMistakes: string[];
  example: string;
  formula: string | null;
}
export type GradingRule =
  | { type: 'choice'; correctIndex: number }
  | { type: 'numeric'; expected: string; unit: string; decimalPlaces: number; rounding: 'floor' | 'ceil' | 'half-up' };
export interface MaterialQuestion {
  id: string;
  grade: Grade;
  exam: ExamCategory;
  subject: Subject;
  topicId: string;
  middleCategory: string;
  subcategory: string;
  format: 'true-false' | 'multiple-choice' | 'numeric';
  difficulty: Difficulty;
  kind: 'knowledge' | 'calculation';
  prompt: string;
  choices: string[];
  grading: GradingRule;
  explanation: DetailedExplanation;
  /** One explanation per choice, in the same order as choices. */
  choiceExplanations: string[];
  relatedTerms: string[];
  relatedQuestions: string[];
  source: {
    origin: MaterialOrigin;
    references: SourceReference[];
    originalQuestion: string | null;
    modifications: string | null;
    publication: 'permitted' | 'not-permitted' | 'unknown';
    permissionEvidence: string | null;
  };
  year: number | null;
  questionNumber: string | null;
  lawReferenceDate: string | null;
  lastCheckedAt: string | null;
  verification: Verification;
  dataVersion: number;
}
export interface Topic {
  id: string;
  subject: Subject;
  middleCategory: string;
  subcategory: string;
  point: string;
  grades: Grade[];
  exams: ExamCategory[];
  officialScope: SourceReference | null;
  scopeVerified: boolean;
  termIds: string[];
  lawReferenceDate: string | null;
}
export const examNames: Record<ExamCategory, string> = {
  academic: '学科', practical: '実技（日本FP協会・資産設計提案業務）',
};
export const difficultyNames: Record<Difficulty, string> = {
  basic: '基礎', standard: '標準', advanced: '応用', expert: '高難度', exception: '例外・細則',
};
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
export function isCalendarDate(value: unknown): value is string {
  if (typeof value !== 'string' || !datePattern.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
function isHttpsUrl(value: string): boolean {
  try { const u = new URL(value); return u.protocol === 'https:' && !u.username && !u.password; } catch { return false; }
}
/** Structural/editorial consistency checks. This does not establish factual correctness. */
export function validateMaterial(question: MaterialQuestion, topics?: readonly Topic[]): string[] {
  const errors: string[] = [];
  if (!question.id.trim() || !question.prompt.trim() || !question.topicId.trim()) errors.push('問題ID・問題文・論点IDが必要です');
  if (!['2', '3'].includes(question.grade)) errors.push('対象級が不正です');
  if (!['academic', 'practical'].includes(question.exam)) errors.push('試験区分が不正です');
  if (!['life', 'risk', 'finance', 'tax', 'estate', 'inheritance'].includes(question.subject)) errors.push('分野が不正です');
  if (!['true-false','multiple-choice','numeric'].includes(question.format)) errors.push('問題形式が不正です');
  if (!['draft','needs-review','verified','retired'].includes(question.verification.status)) errors.push('検証状態が不正です');
  if (!['official','adapted','original'].includes(question.source.origin)) errors.push('出典種別が不正です');
  if (question.year !== null && (!Number.isInteger(question.year) || question.year < 1900 || question.year > 9999)) errors.push('出題年度が不正です');
  if (!question.middleCategory.trim() || !question.subcategory.trim()) errors.push('分類が必要です');
  if (!Object.keys(difficultyNames).includes(question.difficulty)) errors.push('難易度が不正です');
  if (!['knowledge', 'calculation'].includes(question.kind)) errors.push('計算分類が不正です');
  if (!Number.isSafeInteger(question.dataVersion) || question.dataVersion < 1) errors.push('データバージョンが不正です');
  if (!question.lawReferenceDate || !isCalendarDate(question.lawReferenceDate)) errors.push('法令基準日の確認が必要です');
  if (!question.explanation.concise.trim() || !question.explanation.standard.trim() || !question.explanation.detailed.trim()) errors.push('簡潔・標準・詳細解説が必要です');
  if (question.grading.type === 'choice') {
    const expected = question.format === 'true-false' ? 2 : null;
    if (question.format === 'numeric' || question.choices.length < 2 || question.choices.length > 5 || (expected && question.choices.length !== expected)) errors.push('選択肢数と形式が一致しません');
    if (question.choices.some(c => !c.trim()) || new Set(question.choices.map(c => c.trim())).size !== question.choices.length) errors.push('空または重複した選択肢があります');
    if (!Number.isSafeInteger(question.grading.correctIndex) || question.grading.correctIndex < 0 || question.grading.correctIndex >= question.choices.length) errors.push('正答が選択肢の範囲外です');
    if (question.choiceExplanations.length !== question.choices.length || question.choiceExplanations.some(e => !e.trim())) errors.push('全選択肢の解説が必要です');
  } else {
    if (question.format !== 'numeric' || question.kind !== 'calculation' || question.choices.length !== 0 || question.choiceExplanations.length !== 0) errors.push('数値入力問題の分類が一致しません');
    if (!/^-?\d+(?:\.\d+)?$/.test(question.grading.expected)) errors.push('数値正答が不正です');
    if (!Number.isInteger(question.grading.decimalPlaces) || question.grading.decimalPlaces < 0 || question.grading.decimalPlaces > 8) errors.push('数値の精度が不正です');
    if (!['floor','ceil','half-up'].includes(question.grading.rounding)) errors.push('端数処理が不正です');
  }
  if (question.kind === 'calculation' && !question.explanation.formula?.trim()) errors.push('計算式が必要です');
  if (!question.source.references.length || question.source.references.some(r => !r.title.trim() || !isHttpsUrl(r.url))) errors.push('HTTPSの根拠資料が必要です');
  if (question.source.origin === 'official' && (question.year === null || !question.questionNumber?.trim())) errors.push('公式過去問には出題年度と問題番号が必要です');
  if (question.source.origin === 'adapted' && (!question.source.originalQuestion || !question.source.modifications)) errors.push('加工問題には原問題と加工内容が必要です');
  if (topics) {
    const topic = topics.find(t => t.id === question.topicId);
    if (!topic || topic.subject !== question.subject || !topic.grades.includes(question.grade) || !topic.exams.includes(question.exam)) errors.push('公式範囲の論点分類と一致しません');
  }
  if (question.verification.status === 'verified') {
    if (!question.verification.reviewer?.trim() || !question.verification.evidence.length || !question.verification.evidence.every(e => e.trim())) errors.push('確認者と原典照合の記録が必要です');
    if (!isCalendarDate(question.verification.checkedAt) || !isCalendarDate(question.lastCheckedAt)) errors.push('最終確認日が必要です');
    if (question.source.references.some(r => !isCalendarDate(r.checkedAt))) errors.push('原典の実確認日が必要です');
  }
  return errors;
}
export function publicationProblems(question: MaterialQuestion, topics?: readonly Topic[]): string[] {
  const errors = validateMaterial(question, topics);
  if (question.verification.status !== 'verified') errors.push('原典照合が完了していません');
  if (question.source.publication !== 'permitted' || !question.source.permissionEvidence?.trim()) errors.push('Web公開の利用条件が確認できていません');
  return errors;
}
export function canPublish(question: MaterialQuestion, topics?: readonly Topic[]): boolean {
  return publicationProblems(question, topics).length === 0;
}
export function validateCatalog(questions: readonly MaterialQuestion[], topics: readonly Topic[]): string[] {
  const errors = questions.flatMap(q => validateMaterial(q, topics).map(e => `${q.id}: ${e}`));
  const ids = new Set<string>();
  const prompts = new Set<string>();
  for (const q of questions) {
    if (ids.has(q.id)) errors.push(`${q.id}: 問題IDが重複しています`);
    ids.add(q.id);
    const key = `${q.grade}/${q.exam}/${q.prompt.replace(/\s/g, '')}`;
    if (prompts.has(key)) errors.push(`${q.id}: 同一区分の問題文が重複しています`);
    prompts.add(key);
  }
  return errors;
}
