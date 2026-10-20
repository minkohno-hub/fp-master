import type { Grade, Subject } from "../../domain/learning";
export interface Term {
  id: string;
  name: string;
  reading: string;
  summary: string;
  detail: string;
  example: string;
  conditions: string;
  figures: string[];
  relatedTerms: string[];
  relatedQuestions: string[];
  grades: Grade[];
  subject: Subject;
  importance: "basic" | "important" | "advanced";
  sources: { title: string; url: string }[];
  legalDate: string;
  verifiedAt: string;
}
// No unverified entries are shipped. Terms are admitted after original-source review.
export const terms: Term[] = [];
export function searchTerms(
  data: Term[],
  query: string,
  grade: Grade,
  subject?: Subject,
) {
  const normalized = query.trim().normalize("NFKC").toLocaleLowerCase("ja");
  return data
    .filter(
      (t) =>
        t.grades.includes(grade) &&
        (!subject || t.subject === subject) &&
        (!normalized ||
          [t.name, t.reading, t.summary].some((s) =>
            s.normalize("NFKC").toLocaleLowerCase("ja").includes(normalized),
          )),
    )
    .sort((a, b) => a.reading.localeCompare(b.reading, "ja"));
}
