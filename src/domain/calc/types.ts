import type { FieldId, Grade, SourceRef } from '../types';

export type Difficulty = 1 | 2 | 3;

export interface CalcStep {
  text: string;
  /** KaTeX 数式（任意） */
  tex?: string;
}

export interface CalcProblem {
  /** `${generatorId}:${difficulty}:${seed}` 再現可能 */
  id: string;
  generatorId: string;
  /** 計算パターン（苦手分析の単位） */
  pattern: string;
  prompt: string;
  /** 与えられる条件・資料 */
  given: { label: string; value: string }[];
  answer: number;
  unit: string;
  /** 解答の丸め方の説明（問題文に明示） */
  roundingNote?: string;
  steps: CalcStep[];
  formulas: { name: string; tex: string; explain: string }[];
  relatedTerms: string[];
}

export interface CalcGenerator {
  id: string;
  title: string;
  field: FieldId;
  grades: Grade[];
  /** 生成ロジックの根拠資料 */
  sources: SourceRef[];
  /** 法令・制度に依存する値の基準（例：平成27年分以後の速算表） */
  basis: string;
  generate(seed: number, difficulty: Difficulty): CalcProblem;
}
