import { expect, it } from "vitest";
import { searchTerms, type Term } from "./terms";
const term: Term = {
  id: "t",
  name: "複利",
  reading: "ふくり",
  summary: "利息を元本に加える",
  detail: "test",
  example: "test",
  conditions: "test",
  figures: [],
  relatedTerms: [],
  relatedQuestions: [],
  grades: ["3"],
  subject: "finance",
  importance: "basic",
  sources: [{ title: "fixture", url: "https://example.org" }],
  legalDate: "2026-01-01",
  verifiedAt: "2026-01-01",
};
it("searches names, readings and explanations within grade and subject", () => {
  expect(searchTerms([term], "ふくり", "3")).toEqual([term]);
  expect(searchTerms([term], "利息", "3", "finance")).toEqual([term]);
  expect(searchTerms([term], "", "2")).toEqual([]);
  expect(searchTerms([term], "", "3", "life")).toEqual([]);
});
