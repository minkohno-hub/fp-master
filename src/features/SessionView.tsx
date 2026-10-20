import { useEffect, useRef, useState } from "react";
import type { MaterialQuestion } from "../domain/curriculum";
import { gradeAnswer } from "../domain/assessment";
import { subjects } from "../domain/learning";
import type { LearningState, SelfRating } from "../storage/types";
import { Button, Dialog } from "../components/ui";
import type { Term } from "./glossary/terms";
interface Props {
  question: MaterialQuestion;
  data: LearningState;
  saving: boolean;
  terms: Term[];
  onAnswer: (response: number | string, durationMs: number) => Promise<boolean>;
  onRating: (rating: SelfRating) => Promise<void>;
  onNext: () => Promise<void>;
  onPause: () => void;
  onBookmark: () => Promise<void>;
  onNote: (text: string) => Promise<void>;
}
export function SessionView({
  question: q,
  data,
  saving,
  terms,
  onAnswer,
  onRating,
  onNext,
  onPause,
  onBookmark,
  onNote,
}: Props) {
  const [numeric, setNumeric] = useState(""),
    [level, setLevel] = useState<"concise" | "standard" | "detailed">(
      "concise",
    ),
    [note, setNote] = useState(
      data.notes.find((n) => n.questionId === q.id)?.text ?? "",
    ),
    [term, setTerm] = useState<Term | null>(null);
  const [message, setMessage] = useState("");
  const started = useRef(Date.now());
  const heading = useRef<HTMLHeadingElement>(null);
  const pending = useRef(false);
  const session = data.session!;
  const response = session.answers[q.id];
  const answered = response !== undefined;
  const result = answered ? gradeAnswer(q, response) : null;
  const index = session.currentIndex;
  useEffect(() => {
    heading.current?.focus();
  }, []);
  async function answer(value: number | string) {
    if (pending.current || answered) return;
    const grade = gradeAnswer(q, value);
    if (!grade.valid) {
      setMessage(grade.message ?? "入力を確認してください");
      return;
    }
    pending.current = true;
    await onAnswer(value, Date.now() - started.current);
    pending.current = false;
  }
  async function next() {
    if (pending.current || !answered) return;
    pending.current = true;
    await onNext();
    pending.current = false;
  }
  function keyboard(e: React.KeyboardEvent) {
    const target = e.target as HTMLElement;
    if (["INPUT", "TEXTAREA", "SELECT", "BUTTON"].includes(target.tagName))
      return;
    if (!answered && q.grading.type === "choice" && /^[1-5]$/.test(e.key)) {
      const n = Number(e.key) - 1;
      if (q.choices[n] !== undefined) {
        e.preventDefault();
        void answer(n);
      }
    } else if (answered && e.key === "Enter") {
      e.preventDefault();
      void next();
    }
  }
  return (
    <section className="study-layout" onKeyDown={keyboard}>
      <div className="panel question-panel">
        <div className="section-row">
          <span className="eyebrow">
            {session.mode === "calculation"
              ? "CALCULATION"
              : session.mode === "review"
                ? "REVIEW"
                : "PRACTICE"}{" "}
            / FP{q.grade}級
          </span>
          <Button variant="quiet" onClick={onPause}>
            中断する
          </Button>
        </div>
        <div className="session-progress">
          <span>
            問題 {index + 1} / {session.questionIds.length}
          </span>
          <span>{subjects.find((s) => s.id === q.subject)?.short}</span>
        </div>
        <progress
          value={index + (answered ? 1 : 0)}
          max={session.questionIds.length}
          aria-label="演習の進捗"
        />
        <div className="question-meta">
          <span>
            {q.source.origin === "official"
              ? "公式過去問"
              : q.source.origin === "adapted"
                ? "加工問題"
                : "オリジナル問題"}
          </span>
          <span>法令基準日 {q.lawReferenceDate}</span>
        </div>
        <h1 ref={heading} tabIndex={-1}>
          {q.prompt}
        </h1>
        {q.grading.type === "choice" ? (
          <div className="choices" role="group" aria-label="回答の選択肢">
            {q.choices.map((choice, i) => (
              <button
                key={i}
                className={`choice ${answered && q.grading.type === "choice" && i === q.grading.correctIndex ? "correct-choice" : ""} ${answered && i === response && result?.correct === false ? "wrong-choice" : ""}`}
                disabled={saving || answered}
                onClick={() => void answer(i)}
              >
                <span className="choice-number">{i + 1}</span>
                <span>{choice}</span>
                {answered &&
                  q.grading.type === "choice" &&
                  i === q.grading.correctIndex && <strong>正解</strong>}
              </button>
            ))}
          </div>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void answer(numeric);
            }}
          >
            <label className="field">
              数値で回答（{q.grading.unit}）
              <input
                inputMode="decimal"
                value={numeric}
                onChange={(e) => setNumeric(e.target.value)}
                disabled={answered || saving}
                autoComplete="off"
              />
            </label>
            <p className="caption">
              カンマ・単位を付けず入力。小数{q.grading.decimalPlaces}桁に
              {q.grading.rounding === "floor"
                ? "切り捨て"
                : q.grading.rounding === "ceil"
                  ? "切り上げ"
                  : "四捨五入"}
              。
            </p>
            <Button disabled={answered || saving || !numeric}>回答する</Button>
          </form>
        )}
        {message && (
          <p role="alert" className="notice">
            {message}
          </p>
        )}
        <div className="study-actions">
          <Button
            variant="secondary"
            disabled={saving}
            onClick={() => void onBookmark()}
          >
            {data.bookmarks.includes(q.id)
              ? "★ ブックマーク済み"
              : "☆ ブックマーク"}
          </Button>
          {answered && (
            <Button disabled={saving} onClick={() => void next()}>
              {index + 1 < session.questionIds.length
                ? "次の問題へ →"
                : "結果を見る →"}
            </Button>
          )}
        </div>
        <p className="caption">
          選択肢を押すと回答を確定します。PC：1〜5で回答、Enterで次へ（入力欄・ボタン以外）。
        </p>
      </div>
      {answered ? (
        <aside className="panel explanation-panel">
          <div
            role="status"
            className={`answer-result ${result?.correct ? "is-correct" : "is-wrong"}`}
          >
            <h2>{result?.correct ? "正解です" : "理解を深めるチャンス"}</h2>
            <p>
              正答：
              {q.grading.type === "choice"
                ? q.choices[q.grading.correctIndex]
                : `${q.grading.expected} ${q.grading.unit}`}
            </p>
          </div>
          <div className="segmented" aria-label="解説の詳しさ">
            {(["concise", "standard", "detailed"] as const).map((id, i) => (
              <button
                key={id}
                aria-pressed={level === id}
                onClick={() => setLevel(id)}
              >
                {["簡潔", "標準", "詳細"][i]}
              </button>
            ))}
          </div>
          <p className="explanation-text">{q.explanation[level]}</p>
          {level === "detailed" && (
            <>
              <h3>選択肢ごとの解説</h3>
              {q.choiceExplanations.map((text, i) => (
                <p key={i}>
                  <strong>{i + 1}. </strong>
                  {text}
                </p>
              ))}
              {q.explanation.formula && (
                <p className="formula">{q.explanation.formula}</p>
              )}
              {q.explanation.conditions.length > 0 && (
                <>
                  <h3>適用条件</h3>
                  <ul>
                    {q.explanation.conditions.map((t) => (
                      <li key={t}>{t}</li>
                    ))}
                  </ul>
                </>
              )}
              {q.explanation.exceptions.length > 0 && (
                <>
                  <h3>例外・細則</h3>
                  <ul>
                    {q.explanation.exceptions.map((t) => (
                      <li key={t}>{t}</li>
                    ))}
                  </ul>
                </>
              )}
              {q.explanation.commonMistakes.length > 0 && (
                <>
                  <h3>間違いやすいポイント</h3>
                  <ul>
                    {q.explanation.commonMistakes.map((t) => (
                      <li key={t}>{t}</li>
                    ))}
                  </ul>
                </>
              )}
              {q.explanation.example && <p>具体例：{q.explanation.example}</p>}
            </>
          )}
          <fieldset className="self-rating">
            <legend>理解度を記録する</legend>
            <div className="button-row">
              {(["again", "hard", "good", "easy"] as const).map((r, i) => (
                <Button
                  key={r}
                  variant="secondary"
                  aria-pressed={session.selfRatings?.[q.id] === r}
                  disabled={saving}
                  onClick={() => void onRating(r)}
                >
                  {["覚えていない", "曖昧", "理解した", "余裕"][i]}
                </Button>
              ))}
            </div>
          </fieldset>
          {q.relatedTerms.length > 0 && (
            <div className="button-row">
              {terms
                .filter((t) => q.relatedTerms.includes(t.id))
                .map((t) => (
                  <Button key={t.id} variant="quiet" onClick={() => setTerm(t)}>
                    {t.name} ↗
                  </Button>
                ))}
            </div>
          )}
          <details>
            <summary>根拠資料・確認記録</summary>
            <ul>
              {q.source.references.map((r) => (
                <li key={r.url}>
                  <a href={r.url} target="_blank" rel="noreferrer">
                    {r.title} ↗
                  </a>
                </li>
              ))}
            </ul>
            <p className="caption">
              最終確認 {q.lastCheckedAt} / データ版 {q.dataVersion}
            </p>
          </details>
          <label className="field">
            間違いノート
            <textarea
              value={note}
              maxLength={10000}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
            />
          </label>
          <Button
            variant="secondary"
            disabled={saving}
            onClick={() => void onNote(note)}
          >
            ノートを保存
          </Button>
        </aside>
      ) : (
        <aside className="panel explanation-placeholder">
          <span aria-hidden="true">✧</span>
          <h2>一問ずつ、確かな理解へ。</h2>
          <p>回答すると、正答と根拠のある解説が表示されます。</p>
        </aside>
      )}
      {term && (
        <Dialog title={term.name} onClose={() => setTerm(null)}>
          <p>{term.summary}</p>
          <p>{term.detail}</p>
          <p>具体例：{term.example}</p>
        </Dialog>
      )}
    </section>
  );
}
