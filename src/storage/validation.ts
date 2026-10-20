import {
  LearningStorageError,
  type BackupDocument,
  type CardProgress,
  type LearningNote,
  type LearningSettings,
  type LearningState,
  type ReviewRecord,
  type SavedSession,
  type StoredAttempt,
} from "./types";

export const MAX_BACKUP_BYTES = 5 * 1024 * 1024;
const grades = ["2", "3"] as const;
const exams = ["academic", "practical"] as const;
const modes = ["practice", "calculation", "review", "mock"] as const;
const difficulties = [
  "basic",
  "standard",
  "advanced",
  "expert",
  "exception",
] as const;
const ratings = ["again", "hard", "good", "easy"] as const;
const subjects = [
  "life",
  "risk",
  "finance",
  "tax",
  "estate",
  "inheritance",
] as const;
function fail(path: string): never {
  throw new LearningStorageError(
    "validation",
    `保存データの形式が不正です（${path}）。既存データは変更していません。`,
  );
}
function object(value: unknown, path: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    return fail(path);
  return value as Record<string, unknown>;
}
function onlyKeys(
  value: Record<string, unknown>,
  allowed: readonly string[],
  path: string,
): void {
  if (Object.keys(value).some((key) => !allowed.includes(key)))
    return fail(`${path}: 未対応の項目`);
}
function text(value: unknown, path: string, max = 200): string {
  if (typeof value !== "string" || !value.length || value.length > max)
    return fail(path);
  return value;
}
function id(value: unknown, path: string): string {
  const result = text(value, path);
  if (!/^[A-Za-z0-9][A-Za-z0-9._:/-]*$/.test(result)) return fail(path);
  return result;
}
function date(value: unknown, path: string): string {
  const result = text(value, path, 40);
  if (
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(
      result,
    ) ||
    !Number.isFinite(Date.parse(result)) ||
    new Date(`${result.slice(0, 10)}T00:00:00Z`).toISOString().slice(0, 10) !==
      result.slice(0, 10)
  )
    return fail(path);
  return result;
}
function number(
  value: unknown,
  path: string,
  max = Number.MAX_SAFE_INTEGER,
  min = 0,
  integer = true,
): number {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < min ||
    value > max ||
    (integer && !Number.isSafeInteger(value))
  )
    return fail(path);
  return value;
}
function response(value: unknown, path: string): number | string {
  if (typeof value === "number")
    return number(
      value,
      path,
      Number.MAX_SAFE_INTEGER,
      -Number.MAX_SAFE_INTEGER,
      false,
    );
  return text(value, path, 2000);
}
function boolean(value: unknown, path: string): boolean {
  if (typeof value !== "boolean") return fail(path);
  return value;
}
function enumeration<T extends string>(
  value: unknown,
  choices: readonly T[],
  path: string,
): T {
  if (typeof value !== "string" || !choices.includes(value as T))
    return fail(path);
  return value as T;
}
function array<T>(
  value: unknown,
  parse: (value: unknown, path: string) => T,
  path: string,
  max = 100000,
): T[] {
  if (!Array.isArray(value) || value.length > max) return fail(path);
  return value.map((item, i) => parse(item, `${path}[${i}]`));
}
function unique<T>(items: T[], key: (value: T) => string, path: string): T[] {
  const seen = new Set<string>();
  for (const item of items) {
    const k = key(item);
    if (seen.has(k)) return fail(`${path}: 重複ID ${k}`);
    seen.add(k);
  }
  return items;
}
function ids(value: unknown, path: string): string[] {
  return unique(array(value, id, path), (v) => v, path);
}
export function parseAttempt(value: unknown, path = "attempt"): StoredAttempt {
  const a = object(value, path);
  onlyKeys(
    a,
    [
      "id",
      "questionId",
      "selected",
      "correct",
      "answeredAt",
      "grade",
      "exam",
      "mode",
      "subject",
      "durationMs",
      "selfRating",
      "difficulty",
      "response",
    ],
    path,
  );
  const result: StoredAttempt = {
    id: id(a.id, `${path}.id`),
    questionId: id(a.questionId, `${path}.questionId`),
    selected: number(a.selected, `${path}.selected`, 1000),
    correct: boolean(a.correct, `${path}.correct`),
    answeredAt: date(a.answeredAt, `${path}.answeredAt`),
  };
  if (a.grade !== undefined)
    result.grade = enumeration(a.grade, grades, `${path}.grade`);
  if (a.exam !== undefined)
    result.exam = enumeration(a.exam, exams, `${path}.exam`);
  if (a.mode !== undefined)
    result.mode = enumeration(a.mode, modes, `${path}.mode`);
  if (a.subject !== undefined)
    result.subject = enumeration(a.subject, subjects, `${path}.subject`);
  if (a.durationMs !== undefined)
    result.durationMs = number(
      a.durationMs,
      `${path}.durationMs`,
      7 * 86400000,
    );
  if (a.selfRating !== undefined)
    result.selfRating = enumeration(
      a.selfRating,
      ratings,
      `${path}.selfRating`,
    );
  if (a.difficulty !== undefined)
    result.difficulty = enumeration(
      a.difficulty,
      difficulties,
      `${path}.difficulty`,
    );
  if (a.response !== undefined)
    result.response = response(a.response, `${path}.response`);
  return result;
}
export function parseLegacyAttempts(value: unknown): StoredAttempt[] {
  return unique(
    array(value, parseAttempt, "legacy.attempts"),
    (a) => a.id,
    "legacy.attempts",
  );
}
function settings(value: unknown, path: string): LearningSettings {
  const s = object(value, path);
  onlyKeys(
    s,
    [
      "grade",
      "exam",
      "theme",
      "practiceCount",
      "subject",
      "difficulty",
      "unansweredOnly",
      "bookmarkedOnly",
      "wrongOnly",
      "dueOnly",
      "year",
      "topicId",
      "origin",
      "plan",
    ],
    path,
  );
  const result: LearningSettings = {
    grade: enumeration(s.grade, grades, `${path}.grade`),
    exam: enumeration(s.exam, exams, `${path}.exam`),
    theme: enumeration(s.theme, ["light", "dark", "system"], `${path}.theme`),
    practiceCount: number(s.practiceCount, `${path}.practiceCount`, 1000, 1),
  };
  if (s.subject !== undefined)
    result.subject = enumeration(s.subject, subjects, `${path}.subject`);
  if (s.difficulty !== undefined)
    result.difficulty = enumeration(
      s.difficulty,
      difficulties,
      `${path}.difficulty`,
    );
  if (s.unansweredOnly !== undefined)
    result.unansweredOnly = boolean(s.unansweredOnly, `${path}.unansweredOnly`);
  if (s.bookmarkedOnly !== undefined)
    result.bookmarkedOnly = boolean(s.bookmarkedOnly, `${path}.bookmarkedOnly`);
  if (s.wrongOnly !== undefined)
    result.wrongOnly = boolean(s.wrongOnly, `${path}.wrongOnly`);
  if (s.dueOnly !== undefined)
    result.dueOnly = boolean(s.dueOnly, `${path}.dueOnly`);
  if (s.year !== undefined)
    result.year = number(s.year, `${path}.year`, 2100, 1900);
  if (s.topicId !== undefined)
    result.topicId = id(s.topicId, `${path}.topicId`);
  if (s.origin !== undefined)
    result.origin = enumeration(
      s.origin,
      ["official", "adapted", "original"] as const,
      `${path}.origin`,
    );
  if (s.plan !== undefined) {
    const p = object(s.plan, `${path}.plan`);
    onlyKeys(
      p,
      ["examDate", "minutesPerDay", "daysPerWeek", "weakSubjects"],
      `${path}.plan`,
    );
    const examDate = text(p.examDate, `${path}.plan.examDate`, 10);
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(examDate) ||
      !Number.isFinite(Date.parse(examDate)) ||
      new Date(examDate).toISOString().slice(0, 10) !== examDate
    )
      return fail(`${path}.plan.examDate`);
    result.plan = {
      examDate,
      minutesPerDay: number(
        p.minutesPerDay,
        `${path}.plan.minutesPerDay`,
        1440,
        1,
      ),
      daysPerWeek: number(p.daysPerWeek, `${path}.plan.daysPerWeek`, 7, 1),
      weakSubjects: unique(
        array(
          p.weakSubjects,
          (v, key) => enumeration(v, subjects, key),
          `${path}.plan.weakSubjects`,
          6,
        ),
        (v) => v,
        `${path}.plan.weakSubjects`,
      ),
    };
  }
  return result;
}
function note(value: unknown, path: string): LearningNote {
  const n = object(value, path);
  onlyKeys(n, ["id", "questionId", "text", "updatedAt"], path);
  if (typeof n.text !== "string" || n.text.length > 20000)
    return fail(`${path}.text`);
  return {
    id: id(n.id, `${path}.id`),
    questionId: id(n.questionId, `${path}.questionId`),
    text: n.text,
    updatedAt: date(n.updatedAt, `${path}.updatedAt`),
  };
}
function review(value: unknown, path: string): ReviewRecord {
  const r = object(value, path);
  onlyKeys(
    r,
    [
      "questionId",
      "ease",
      "intervalDays",
      "repetitions",
      "consecutiveCorrect",
      "lastAnsweredAt",
      "nextReviewAt",
      "reviewCount",
    ],
    path,
  );
  return {
    questionId: id(r.questionId, `${path}.questionId`),
    ease: number(r.ease, `${path}.ease`, 10, 1.3, false),
    intervalDays: number(r.intervalDays, `${path}.intervalDays`, 36500),
    repetitions: number(r.repetitions, `${path}.repetitions`),
    consecutiveCorrect: number(
      r.consecutiveCorrect,
      `${path}.consecutiveCorrect`,
    ),
    lastAnsweredAt: date(r.lastAnsweredAt, `${path}.lastAnsweredAt`),
    nextReviewAt: date(r.nextReviewAt, `${path}.nextReviewAt`),
    reviewCount: number(r.reviewCount, `${path}.reviewCount`),
  };
}
function card(value: unknown, path: string): CardProgress {
  const c = object(value, path);
  onlyKeys(
    c,
    ["termId", "rating", "reviewedAt", "nextReviewAt", "repetitions", "ease", "intervalDays", "streak"],
    path,
  );
  const metadataCount = ["ease", "intervalDays", "streak"].filter((key) => Object.hasOwn(c, key)).length;
  if (metadataCount !== 0 && metadataCount !== 3) return fail(`${path}.scheduler`);
  const repetitions = number(c.repetitions, `${path}.repetitions`);
  const scheduler = metadataCount === 3 ? {
    ease: number(c.ease, `${path}.ease`, 3, 1.3, false),
    intervalDays: number(c.intervalDays, `${path}.intervalDays`, 365, 1),
    streak: number(c.streak, `${path}.streak`, repetitions),
  } : {};
  return {
    termId: id(c.termId, `${path}.termId`),
    rating: enumeration(c.rating, ratings, `${path}.rating`),
    reviewedAt: date(c.reviewedAt, `${path}.reviewedAt`),
    nextReviewAt: date(c.nextReviewAt, `${path}.nextReviewAt`),
    repetitions,
    ...scheduler,
  };
}
function session(value: unknown, path: string): SavedSession {
  const s = object(value, path);
  onlyKeys(
    s,
    [
      "id",
      "grade",
      "exam",
      "mode",
      "questionIds",
      "currentIndex",
      "answers",
      "selfRatings",
      "startedAt",
      "updatedAt",
    ],
    path,
  );
  const questionIds = ids(s.questionIds, `${path}.questionIds`);
  if (!questionIds.length || questionIds.length > 1000)
    return fail(`${path}.questionIds`);
  const answersInput = object(s.answers, `${path}.answers`);
  const answers: Record<string, number | string> = Object.create(
    null,
  ) as Record<string, number | string>;
  for (const [key, value] of Object.entries(answersInput).sort(([a], [b]) =>
    a.localeCompare(b),
  )) {
    if (!questionIds.includes(key)) return fail(`${path}.answers.${key}`);
    answers[key] = response(value, `${path}.answers.${key}`);
  }
  let selfRatings: SavedSession["selfRatings"];
  if (s.selfRatings !== undefined) {
    selfRatings = Object.create(null) as NonNullable<
      SavedSession["selfRatings"]
    >;
    for (const [key, value] of Object.entries(
      object(s.selfRatings, `${path}.selfRatings`),
    ).sort(([a], [b]) => a.localeCompare(b))) {
      if (!questionIds.includes(key)) return fail(`${path}.selfRatings.${key}`);
      selfRatings[key] = enumeration(
        value,
        ratings,
        `${path}.selfRatings.${key}`,
      );
    }
  }
  return {
    ...(selfRatings ? { selfRatings } : {}),
    id: id(s.id, `${path}.id`),
    grade: enumeration(s.grade, grades, `${path}.grade`),
    exam: enumeration(s.exam, exams, `${path}.exam`),
    mode: enumeration(s.mode, modes, `${path}.mode`),
    questionIds,
    currentIndex: number(
      s.currentIndex,
      `${path}.currentIndex`,
      questionIds.length - 1,
    ),
    answers,
    startedAt: date(s.startedAt, `${path}.startedAt`),
    updatedAt: date(s.updatedAt, `${path}.updatedAt`),
  };
}
export function parseLearningState(value: unknown): LearningState {
  const s = object(value, "state");
  if (s.schemaVersion !== 1)
    throw new LearningStorageError(
      "version",
      "未対応の学習データ形式です。対応するアプリで開いてください。既存データは変更していません。",
    );
  onlyKeys(
    s,
    [
      "schemaVersion",
      "revision",
      "createdAt",
      "updatedAt",
      "attempts",
      "settings",
      "bookmarks",
      "termFavorites",
      "learnedTerms",
      "notes",
      "reviews",
      "cards",
      "session",
      "migration",
    ],
    "state",
  );
  let migration: LearningState["migration"] = null;
  if (s.migration !== null) {
    const m = object(s.migration, "state.migration");
    onlyKeys(m, ["legacyImportedAt", "legacyAttemptCount"], "state.migration");
    migration = {
      legacyImportedAt: date(
        m.legacyImportedAt,
        "state.migration.legacyImportedAt",
      ),
      legacyAttemptCount: number(
        m.legacyAttemptCount,
        "state.migration.legacyAttemptCount",
        100000,
      ),
    };
  }
  return {
    schemaVersion: 1,
    revision: number(s.revision, "state.revision"),
    createdAt: date(s.createdAt, "state.createdAt"),
    updatedAt: date(s.updatedAt, "state.updatedAt"),
    attempts: unique(
      array(s.attempts, parseAttempt, "state.attempts"),
      (a) => a.id,
      "state.attempts",
    ),
    settings: settings(s.settings, "state.settings"),
    bookmarks: ids(s.bookmarks, "state.bookmarks"),
    termFavorites: ids(s.termFavorites, "state.termFavorites"),
    learnedTerms: ids(s.learnedTerms, "state.learnedTerms"),
    notes: unique(
      array(s.notes, note, "state.notes", 10000),
      (n) => n.id,
      "state.notes",
    ),
    reviews: unique(
      array(s.reviews, review, "state.reviews"),
      (r) => r.questionId,
      "state.reviews",
    ),
    cards: unique(
      array(s.cards, card, "state.cards"),
      (c) => c.termId,
      "state.cards",
    ),
    session: s.session === null ? null : session(s.session, "state.session"),
    migration,
  };
}
export function byteLength(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}
export function parseBackup(json: string): BackupDocument {
  if (byteLength(json) > MAX_BACKUP_BYTES)
    throw new LearningStorageError(
      "validation",
      "バックアップが大きすぎます。上限は5MiBです。既存データは変更していません。",
    );
  let value: unknown;
  try {
    value = JSON.parse(json);
  } catch (cause) {
    throw new LearningStorageError(
      "validation",
      "JSON形式を読み取れません。既存データは変更していません。",
      { cause },
    );
  }
  const b = object(value, "backup");
  if (b.app !== "fp-master") return fail("backup.app");
  if (b.formatVersion !== 1)
    throw new LearningStorageError(
      "version",
      "未対応のバックアップバージョンです。既存データは変更していません。",
    );
  onlyKeys(b, ["app", "formatVersion", "exportedAt", "state"], "backup");
  return {
    app: "fp-master",
    formatVersion: 1,
    exportedAt: date(b.exportedAt, "backup.exportedAt"),
    state: parseLearningState(b.state),
  };
}
