import type { Subject } from "../../domain/learning";
export interface PlanInput {
  examDate: string;
  minutesPerDay: number;
  daysPerWeek: number;
  weakSubjects: Subject[];
}
export interface DayPlan {
  date: string;
  minutes: number;
  kind: "knowledge" | "review" | "calculation" | "assessment";
  subject: Subject | null;
}
export function makePlan(input: PlanInput, today: string): DayPlan[] {
  const start = Date.parse(`${today}T00:00:00Z`),
    end = Date.parse(`${input.examDate}T00:00:00Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start)
    throw new Error("受験予定日は明日以降を指定してください。");
  if (
    !Number.isInteger(input.minutesPerDay) ||
    input.minutesPerDay < 5 ||
    input.minutesPerDay > 480
  )
    throw new Error("学習時間は5〜480分の整数で指定してください。");
  if (
    !Number.isInteger(input.daysPerWeek) ||
    input.daysPerWeek < 1 ||
    input.daysPerWeek > 7
  )
    throw new Error("週の学習日数は1〜7日で指定してください。");
  const days = Math.ceil((end - start) / 86400000);
  if (days > 730) throw new Error("受験予定日は2年以内で指定してください。");
  const subjects: Subject[] = [
    "life",
    "risk",
    "finance",
    "tax",
    "estate",
    "inheritance",
  ];
  const cycle = [...input.weakSubjects, ...subjects];
  const plans: DayPlan[] = [];
  for (let d = 0; d < days; d++) {
    if (d % 7 >= input.daysPerWeek) continue;
    const n = plans.length;
    const kind =
      n > 0 && n % 14 === 13
        ? "assessment"
        : n % 5 === 4
          ? "calculation"
          : n % 3 === 2
            ? "review"
            : "knowledge";
    plans.push({
      date: new Date(start + d * 86400000).toISOString().slice(0, 10),
      minutes: input.minutesPerDay,
      kind,
      subject: kind === "assessment" ? null : cycle[n % cycle.length],
    });
  }
  return plans;
}
