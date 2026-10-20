import type { Attempt, Grade, Subject } from "../domain/learning";

export type Exam = "academic" | "practical";
export type StudyMode = "practice" | "calculation" | "review" | "mock";
export type Difficulty =
  "basic" | "standard" | "advanced" | "expert" | "exception";
export type SelfRating = "again" | "hard" | "good" | "easy";
export interface StoredAttempt extends Attempt {
  grade?: Grade;
  exam?: Exam;
  mode?: StudyMode;
  subject?: Subject;
  durationMs?: number;
  selfRating?: SelfRating;
  difficulty?: Difficulty;
  response?: number | string;
}
export interface ReviewRecord {
  questionId: string;
  ease: number;
  intervalDays: number;
  repetitions: number;
  consecutiveCorrect: number;
  lastAnsweredAt: string;
  nextReviewAt: string;
  reviewCount: number;
}
export interface CardProgress {
  termId: string;
  rating: SelfRating;
  reviewedAt: string;
  nextReviewAt: string;
  /** Total number of ratings. Legacy v1 records only contain these first five fields. */
  repetitions: number;
  /** Optional scheduler state so existing v1 backups remain readable. */
  ease?: number;
  intervalDays?: number;
  streak?: number;
}
export interface LearningNote {
  id: string;
  questionId: string;
  text: string;
  updatedAt: string;
}
export interface SavedSession {
  id: string;
  grade: Grade;
  exam: Exam;
  mode: StudyMode;
  questionIds: string[];
  currentIndex: number;
  answers: Record<string, number | string>;
  selfRatings?: Record<string, SelfRating>;
  startedAt: string;
  updatedAt: string;
}
export interface LearningPlan {
  examDate: string;
  minutesPerDay: number;
  daysPerWeek: number;
  weakSubjects: Subject[];
}
export interface LearningSettings {
  grade: Grade;
  exam: Exam;
  theme: "light" | "dark" | "system";
  practiceCount: number;
  subject?: Subject;
  difficulty?: Difficulty;
  unansweredOnly?: boolean;
  bookmarkedOnly?: boolean;
  wrongOnly?: boolean;
  dueOnly?: boolean;
  year?: number;
  topicId?: string;
  origin?: "official" | "adapted" | "original";
  plan?: LearningPlan;
}
export interface LearningState {
  schemaVersion: 1;
  revision: number;
  createdAt: string;
  updatedAt: string;
  attempts: StoredAttempt[];
  settings: LearningSettings;
  bookmarks: string[];
  termFavorites: string[];
  learnedTerms: string[];
  notes: LearningNote[];
  reviews: ReviewRecord[];
  cards: CardProgress[];
  session: SavedSession | null;
  migration: { legacyImportedAt: string; legacyAttemptCount: number } | null;
}
export interface BackupDocument {
  app: "fp-master";
  formatVersion: 1;
  exportedAt: string;
  state: LearningState;
}
export interface ImportSummary {
  attemptsAdded: number;
  bookmarksAdded: number;
  notesAdded: number;
  reviewsAdded: number;
  cardsAdded: number;
  state: LearningState;
}
export type StorageErrorCode =
  | "unavailable"
  | "blocked"
  | "closed"
  | "read"
  | "write"
  | "validation"
  | "version"
  | "conflict"
  | "legacy-corrupt";
export class LearningStorageError extends Error {
  readonly code: StorageErrorCode;
  constructor(code: StorageErrorCode, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "LearningStorageError";
    this.code = code;
  }
}
export function createLearningState(
  now = new Date().toISOString(),
): LearningState {
  return {
    schemaVersion: 1,
    revision: 0,
    createdAt: now,
    updatedAt: now,
    attempts: [],
    settings: {
      grade: "3",
      exam: "academic",
      theme: "system",
      practiceCount: 5,
    },
    bookmarks: [],
    termFavorites: [],
    learnedTerms: [],
    notes: [],
    reviews: [],
    cards: [],
    session: null,
    migration: null,
  };
}
