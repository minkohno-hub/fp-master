import {
  scheduleReview,
  type SelfRating,
  type QuestionReview,
} from "../../domain/review";
import type { CardProgress } from "../../storage/types";

const DAY_MS = 86_400_000;

/** Keeps v1 card records readable while new ratings retain the SM-2 scheduling state. */
export function scheduleCardReview(
  previous: CardProgress | undefined,
  termId: string,
  rating: SelfRating,
  reviewedAt: string,
): CardProgress {
  if (previous && previous.termId !== termId)
    throw new Error("別の用語の復習状態は更新できません");
  const prior: QuestionReview | undefined = previous && {
    questionId: termId,
    ease: previous.ease ?? 2.5,
    intervalDays:
      previous.intervalDays ??
      Math.max(
        1,
        Math.min(
          365,
          Math.ceil(
            (Date.parse(previous.nextReviewAt) -
              Date.parse(previous.reviewedAt)) /
              DAY_MS,
          ),
        ),
      ),
    // Legacy records stored total ratings, not a success streak. Start conservatively.
    repetitions: previous.streak ?? (previous.rating === "again" ? 0 : 1),
    consecutiveCorrect:
      previous.streak ?? (previous.rating === "again" ? 0 : 1),
    lastAnsweredAt: previous.reviewedAt,
    nextReviewAt: previous.nextReviewAt,
    reviewCount: previous.repetitions,
  };
  const next = scheduleReview(prior, {
    questionId: termId,
    correct: rating !== "again",
    rating,
    answeredAt: reviewedAt,
  });
  return {
    termId,
    rating,
    reviewedAt,
    nextReviewAt: next.nextReviewAt,
    repetitions: next.reviewCount,
    ease: next.ease,
    intervalDays: next.intervalDays,
    streak: next.repetitions,
  };
}

export function orderCards<T extends { id: string; reading: string }>(
  terms: readonly T[],
  progress: readonly CardProgress[],
  now = new Date(),
  options: { dueOnly?: boolean; weakFirst?: boolean } = {},
): T[] {
  if (!Number.isFinite(now.getTime()))
    throw new RangeError("基準日時が不正です");
  const byId = new Map(progress.map((record) => [record.termId, record]));
  const due = (record: CardProgress | undefined) =>
    !!record && Date.parse(record.nextReviewAt) <= now.getTime();
  const weak = (record: CardProgress | undefined) =>
    record?.rating === "again" || record?.rating === "hard";
  const rank = (record: CardProgress | undefined) =>
    due(record) && options.weakFirst && weak(record)
      ? 0
      : due(record)
        ? 1
        : !record
          ? 2
          : options.weakFirst && weak(record)
            ? 3
            : 4;
  return terms
    .filter((term) => !options.dueOnly || due(byId.get(term.id)))
    .sort((a, b) => {
      const pa = byId.get(a.id),
        pb = byId.get(b.id);
      return (
        rank(pa) - rank(pb) ||
        (pa?.nextReviewAt ?? "").localeCompare(pb?.nextReviewAt ?? "") ||
        a.reading.localeCompare(b.reading, "ja")
      );
    });
}
