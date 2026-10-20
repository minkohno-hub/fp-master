import { describe, expect, it } from "vitest";
import { buildQuestionSet, gradeAnswer, targetScore } from "./assessment";
import { materialFixture } from "./fixtures.test-helper";
const knowledge = materialFixture();
const calculation = materialFixture({
  id: "fixture-calc",
  kind: "calculation",
  explanation: { ...knowledge.explanation, formula: "テスト式" },
});
describe("question selection and grading", () => {
  it("excludes calculations in normal practice regardless of the requested count but includes them in mocks", () => {
    expect(
      buildQuestionSet(
        [knowledge, calculation],
        { grade: "3", exam: "academic", mode: "practice", count: 2 },
        [],
        [],
        [],
        () => 0,
      ).questions.map((q) => q.id),
    ).toEqual([knowledge.id]);
    const mock = buildQuestionSet(
      [knowledge, calculation],
      { grade: "3", exam: "academic", mode: "mock", count: 2 },
      [],
      [],
      [],
      () => 0,
    );
    expect(mock.containsCalculation).toBe(true);
    expect(mock.complete).toBe(true);
    expect(
      buildQuestionSet(
        [calculation, knowledge],
        { grade: "3", exam: "academic", mode: "mock", count: 1 },
        [],
        [],
        [],
        () => 0,
      ).containsCalculation,
    ).toBe(true);
  });
  it("exposes shortages and never duplicates questions to fill a 100-question session", () => {
    const set = buildQuestionSet([knowledge, knowledge], {
      grade: "3",
      exam: "academic",
      mode: "practice",
      count: 100,
    });
    expect(set.questions).toHaveLength(1);
    expect(set.available).toBe(1);
    expect(set.shortage).toBe(99);
    expect(set.complete).toBe(false);
    expect(
      buildQuestionSet([knowledge], {
        grade: "3",
        exam: "academic",
        mode: "mock",
        count: 1,
      }).complete,
    ).toBe(false);
  });
  it("rejects unverified content and respects grade/exam/first-seen/bookmark filters", () => {
    const draft = materialFixture({
      id: "draft",
      verification: { ...knowledge.verification, status: "draft" },
    });
    const practical = materialFixture({ id: "practical", exam: "practical" });
    const set = buildQuestionSet(
      [draft, practical, knowledge],
      {
        grade: "3",
        exam: "academic",
        mode: "practice",
        count: 5,
        unansweredOnly: true,
      },
      [
        {
          id: "a",
          questionId: knowledge.id,
          selected: 1,
          correct: true,
          answeredAt: "2026-01-01T00:00:00Z",
        },
      ],
    );
    expect(set.questions).toEqual([]);
    expect(
      buildQuestionSet(
        [knowledge, calculation],
        {
          grade: "3",
          exam: "academic",
          mode: "calculation",
          count: 1,
          bookmarkedOnly: true,
        },
        [],
        [calculation.id],
      ).questions,
    ).toHaveLength(1);
  });

  it("uses chronological outcomes rather than imported array order for missed-question review", () => {
    const newer = {
      id: "new",
      questionId: knowledge.id,
      selected: 1,
      correct: true,
      answeredAt: "2026-02-01T00:00:00Z",
    };
    const older = {
      ...newer,
      id: "old",
      correct: false,
      answeredAt: "2026-01-01T00:00:00Z",
    };
    expect(
      buildQuestionSet(
        [knowledge],
        { grade: "3", exam: "academic", mode: "review", count: 1 },
        [newer, older],
      ).questions,
    ).toHaveLength(0);
  });
  it("filters by year, latest wrong answer and due status without repeating candidates", () => {
    const recent = materialFixture({ id: "recent", year: 2026 });
    const old = materialFixture({ id: "old", year: 2025 });
    const history = [
      {
        id: "h1",
        questionId: recent.id,
        selected: 0,
        correct: false,
        answeredAt: "2026-01-01T00:00:00Z",
      },
      {
        id: "h2",
        questionId: old.id,
        selected: 1,
        correct: true,
        answeredAt: "2026-01-02T00:00:00Z",
      },
    ];
    const base = {
      grade: "3" as const,
      exam: "academic" as const,
      mode: "practice" as const,
      count: 5,
    };
    expect(
      buildQuestionSet(
        [recent, old],
        { ...base, year: 2026, wrongOnly: true },
        history,
      ).questions.map((q) => q.id),
    ).toEqual(["recent"]);
    expect(
      buildQuestionSet(
        [recent, old],
        { ...base, dueOnly: true },
        history,
        [],
        ["old"],
      ).questions.map((q) => q.id),
    ).toEqual(["old"]);
    expect(
      buildQuestionSet(
        [recent, old],
        { ...base, wrongOnly: true, dueOnly: true },
        history,
        [],
        ["old"],
      ).questions,
    ).toHaveLength(0);
  });
  it("requires a valid choice and uses explicit precision for numeric answers", () => {
    expect(gradeAnswer(knowledge, null).valid).toBe(false);
    expect(gradeAnswer(knowledge, 1)).toMatchObject({
      valid: true,
      correct: true,
    });
    expect(gradeAnswer(knowledge, "1").valid).toBe(false);
    const numeric = materialFixture({
      format: "numeric",
      kind: "calculation",
      choices: [],
      choiceExplanations: [],
      grading: {
        type: "numeric",
        expected: "0.11",
        unit: "円",
        decimalPlaces: 2,
        rounding: "half-up",
      },
    });
    expect(gradeAnswer(numeric, "0.105").correct).toBe(true);
    expect(gradeAnswer(numeric, "0.104").correct).toBe(false);
    expect(gradeAnswer(numeric, "0.11円").valid).toBe(false);
  });
  it("keeps a 95% personal target distinct from official pass thresholds", () => {
    expect(targetScore(60)).toBe(57);
    expect(targetScore(100)).toBe(95);
    expect(() => targetScore(0)).toThrow();
  });
});
