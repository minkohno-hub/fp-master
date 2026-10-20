import { expect, it } from "vitest";
import { makePlan } from "./plan";
it("allocates available days and includes review, calculations and assessment", () => {
  const plans = makePlan(
    {
      examDate: "2026-12-01",
      minutesPerDay: 30,
      daysPerWeek: 5,
      weakSubjects: ["tax"],
    },
    "2026-10-21",
  );
  expect(plans).toHaveLength(30);
  expect(plans[0].subject).toBe("tax");
  expect(new Set(plans.map((p) => p.kind)).size).toBe(4);
  expect(plans.every((p) => p.date < "2026-12-01")).toBe(true);
});
it("rejects impossible dates and invalid time budgets", () => {
  expect(() =>
    makePlan(
      {
        examDate: "2020-01-01",
        minutesPerDay: 30,
        daysPerWeek: 5,
        weakSubjects: [],
      },
      "2026-10-21",
    ),
  ).toThrow();
  expect(() =>
    makePlan(
      {
        examDate: "2026-12-01",
        minutesPerDay: 0,
        daysPerWeek: 5,
        weakSubjects: [],
      },
      "2026-10-21",
    ),
  ).toThrow();
});
