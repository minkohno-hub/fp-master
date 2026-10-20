import { useState } from "react";
import { Button, Panel } from "../components/ui";
import { makePlan, type PlanInput, type DayPlan } from "./planning/plan";
import { subjects } from "../domain/learning";
import type { LearningState } from "../storage/types";
function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
export function PlannerPanel({
  data,
  saving,
  update,
}: {
  data: LearningState;
  saving: boolean;
  update: (f: (s: LearningState) => LearningState) => Promise<boolean>;
}) {
  const [input, setInput] = useState<PlanInput>(
    data.settings.plan ?? {
      examDate: "",
      minutesPerDay: 30,
      daysPerWeek: 5,
      weakSubjects: [],
    },
  );
  const [error, setError] = useState("");
  let existing: DayPlan[] = [];
  try {
    if (data.settings.plan) existing = makePlan(data.settings.plan, today());
  } catch {
    /* An expired plan is shown as needing adjustment. */
  }
  const [plans, setPlans] = useState(existing);
  async function submit() {
    try {
      const next = makePlan(input, today());
      if (
        await update((s) => ({
          ...s,
          settings: { ...s.settings, plan: input },
        }))
      ) {
        setPlans(next);
        setError("");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "入力を確認してください。");
    }
  }
  return (
    <div className="two-column">
      <Panel>
        <h2>生活に合わせた学習計画</h2>
        <p>
          6分野に復習と計算を組み込みます。合格や95%の達成を保証する計画ではありません。毎回の作成で今日から再配分します。
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <label className="field">
            受験予定日
            <input
              type="date"
              value={input.examDate}
              required
              onChange={(e) => setInput({ ...input, examDate: e.target.value })}
            />
          </label>
          <label className="field">
            1日の学習時間（分）
            <input
              type="number"
              min={5}
              max={480}
              value={input.minutesPerDay}
              onChange={(e) =>
                setInput({ ...input, minutesPerDay: Number(e.target.value) })
              }
            />
          </label>
          <label className="field">
            週の学習日数
            <input
              type="number"
              min={1}
              max={7}
              value={input.daysPerWeek}
              onChange={(e) =>
                setInput({ ...input, daysPerWeek: Number(e.target.value) })
              }
            />
          </label>
          <fieldset>
            <legend>重点的に学ぶ分野</legend>
            {subjects.map((s) => (
              <label className="check" key={s.id}>
                <input
                  type="checkbox"
                  checked={input.weakSubjects.includes(s.id)}
                  onChange={(e) =>
                    setInput({
                      ...input,
                      weakSubjects: e.target.checked
                        ? [...input.weakSubjects, s.id]
                        : input.weakSubjects.filter((id) => id !== s.id),
                    })
                  }
                />
                {s.short}
              </label>
            ))}
          </fieldset>
          <Button disabled={saving}>計画を保存・再調整</Button>
        </form>
        {error && (
          <p role="alert" className="notice">
            {error}
          </p>
        )}
      </Panel>
      <Panel>
        <h2>これからの学習予定</h2>
        <p className="notice">
          教材が未収録の論点は計画だけで習得済みになりません。模擬試験枠は教材と公式仕様の確認後に実行できます。
        </p>
        {plans.length ? (
          <>
            <p>
              全{plans.length}日 / {plans.reduce((n, p) => n + p.minutes, 0)}
              分の配分案
            </p>
            <ol className="plan-list">
              {plans.slice(0, 21).map((p) => (
                <li key={p.date}>
                  <time>{p.date}</time>
                  <div>
                    <strong>
                      {
                        {
                          knowledge: "知識演習",
                          review: "間隔反復",
                          calculation: "計算トレーニング",
                          assessment: "模擬試験・成績確認",
                        }[p.kind]
                      }
                    </strong>
                    <small>
                      {subjects.find((s) => s.id === p.subject)?.short ??
                        "全分野"}{" "}
                      ・ {p.minutes}分
                    </small>
                  </div>
                </li>
              ))}
            </ol>
            {plans.length > 21 && (
              <p className="caption">直近21学習日を表示しています。</p>
            )}
          </>
        ) : (
          <p>
            予定日と学習時間を入力すると日別の配分を作成します。期限が過ぎた計画は再調整してください。
          </p>
        )}
      </Panel>
    </div>
  );
}
