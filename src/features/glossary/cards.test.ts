import { expect, it } from "vitest";
import { orderCards, scheduleCardReview } from "./cards";
import type { CardProgress } from "../../storage/types";

const start = "2026-10-20T10:00:00.000Z";
it("schedules cards from self-ratings, including an uncertain answer and a reset", () => {
  const first = scheduleCardReview(undefined, "term-1", "good", start);
  expect(first).toMatchObject({ repetitions: 1, intervalDays: 1, streak: 1 });
  const second = scheduleCardReview(
    first,
    "term-1",
    "good",
    first.nextReviewAt,
  );
  expect(second).toMatchObject({ repetitions: 2, intervalDays: 6, streak: 2 });
  const reset = scheduleCardReview(
    second,
    "term-1",
    "again",
    second.nextReviewAt,
  );
  expect(reset).toMatchObject({ repetitions: 3, intervalDays: 1, streak: 0 });
  expect(() =>
    scheduleCardReview(reset, "term-2", "good", reset.nextReviewAt),
  ).toThrow("別の用語");
  expect(() => scheduleCardReview(reset, "term-1", "good", start)).toThrow(
    "過去の回答",
  );
});

it("upgrades a legacy card without discarding its review count", () => {
  const legacy: CardProgress = {
    termId: "term-1",
    rating: "hard",
    reviewedAt: start,
    nextReviewAt: "2026-10-22T10:00:00.000Z",
    repetitions: 8,
  };
  const updated = scheduleCardReview(
    legacy,
    "term-1",
    "good",
    legacy.nextReviewAt,
  );
  expect(updated.repetitions).toBe(9);
  expect(updated.streak).toBe(2);
  expect(updated.ease).toBeGreaterThanOrEqual(1.3);
});

it("orders due cards before new and future cards, and can focus on weak or due cards", () => {
  const terms = [
    { id: "future", reading: "あ" },
    { id: "new", reading: "い" },
    { id: "due", reading: "う" },
    { id: "weak", reading: "え" },
  ];
  const progress: CardProgress[] = [
    {
      termId: "future",
      rating: "good",
      reviewedAt: start,
      nextReviewAt: "2026-11-01T10:00:00.000Z",
      repetitions: 1,
    },
    {
      termId: "due",
      rating: "good",
      reviewedAt: start,
      nextReviewAt: "2026-10-20T11:00:00.000Z",
      repetitions: 1,
    },
    {
      termId: "weak",
      rating: "again",
      reviewedAt: start,
      nextReviewAt: "2026-10-21T10:00:00.000Z",
      repetitions: 1,
    },
  ];
  const now = new Date("2026-10-22T10:00:00.000Z");
  expect(orderCards(terms, progress, now).map((term) => term.id)).toEqual([
    "due",
    "weak",
    "new",
    "future",
  ]);
  expect(
    orderCards(terms, progress, now, { dueOnly: true }).map((term) => term.id),
  ).toEqual(["due", "weak"]);
  expect(orderCards(terms, progress, now, { weakFirst: true })[0].id).toBe(
    "weak",
  );
});
