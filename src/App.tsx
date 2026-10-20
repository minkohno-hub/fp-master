import { useEffect, useRef, useState } from "react";
import { catalog as defaultCatalog, topicInventory } from "./data/catalog";
import {
  canPublish,
  difficultyNames,
  examNames,
  type MaterialQuestion,
  type Topic,
} from "./domain/curriculum";
import {
  buildQuestionSet,
  gradeAnswer,
  type QuestionFilter,
  type StudyMode,
} from "./domain/assessment";
import { analyzeLearning, getCoverage, type Rate } from "./domain/analytics";
import { dueReviews, scheduleReview } from "./domain/review";
import { mockReadiness } from "./domain/mockExam";
import { examSpecifications } from "./data/examSpecifications";
import { subjects, type Grade, type Subject } from "./domain/learning";
import {
  decimalToScaled,
  divideRounded,
  formatScaled,
} from "./domain/calculations";
import { useLearning } from "./features/useLearning";
import {
  terms as defaultTerms,
  searchTerms,
  type Term,
} from "./features/glossary/terms";
import { orderCards, scheduleCardReview } from "./features/glossary/cards";
import { SessionView } from "./features/SessionView";
import { SettingsPanel } from "./features/SettingsPanel";
import { PlannerPanel } from "./features/PlannerPanel";
import {
  Button,
  Dialog,
  Empty,
  Metric,
  Panel,
  Progress,
} from "./components/ui";
import {
  LearningStorageError,
  type LearningState,
  type SelfRating,
} from "./storage/types";
type Page =
  | "home"
  | "practice"
  | "calculation"
  | "review"
  | "glossary"
  | "cards"
  | "mock"
  | "analytics"
  | "coverage"
  | "plan"
  | "history"
  | "saved"
  | "settings"
  | "session";
const navigation: { id: Page; icon: string; label: string }[] = [
  { id: "home", icon: "⌂", label: "ホーム" },
  { id: "practice", icon: "▤", label: "問題演習" },
  { id: "calculation", icon: "＋", label: "計算トレーニング" },
  { id: "review", icon: "↻", label: "今日の復習" },
  { id: "glossary", icon: "Aa", label: "用語集" },
  { id: "cards", icon: "▣", label: "暗記カード" },
  { id: "mock", icon: "◷", label: "模擬試験" },
  { id: "analytics", icon: "↗", label: "成績・95%到達度" },
  { id: "coverage", icon: "◇", label: "教材の網羅性" },
  { id: "plan", icon: "▦", label: "学習計画" },
  { id: "saved", icon: "☆", label: "保存・間違いノート" },
  { id: "history", icon: "≡", label: "学習履歴" },
  { id: "settings", icon: "⚙", label: "設定・バックアップ" },
];
const titles: Record<Page, [string, string]> = {
  home: ["FP Master", "FP2級・3級の学習"],
  practice: [
    "問題演習",
    "計算を除いた知識問題を出題します。",
  ],
  calculation: [
    "計算トレーニング",
    "数値入力で回答し、計算式と端数処理を確認できます。",
  ],
  review: [
    "今日の復習",
    "間違えた問題と、正解しても曖昧だった問題を確認します。",
  ],
  glossary: [
    "用語集",
    "確認済みの用語を検索できます。",
  ],
  cards: [
    "暗記カード",
    "カードを裏返して意味を確認できます。",
  ],
  mock: [
    "模擬試験",
    "公式の試験仕様と教材の確認後に本試験形式を提供します。",
  ],
  analytics: [
    "成績・95%到達度",
    "累計・直近・初見・復習の成績を分けて表示します。",
  ],
  coverage: [
    "教材の網羅性",
    "問題数・論点の網羅性・習得状況を分けて表示します。",
  ],
  plan: [
    "学習計画",
    "6分野の演習・復習・計算を日別に配分します。",
  ],
  history: [
    "学習履歴",
    "端末内に保存した回答履歴です。初見と再回答も区別します。",
  ],
  saved: [
    "保存・間違いノート",
    "ブックマークと間違いノートを確認できます。",
  ],
  settings: [
    "設定・バックアップ",
    "表示設定と学習データのバックアップを管理します。",
  ],
  session: ["問題演習", ""],
};
const percent = (r: Rate) => (r.accuracy === null ? "—" : `${r.accuracy}%`);
const toggle = (ids: string[], id: string) =>
  ids.includes(id) ? ids.filter((v) => v !== id) : [...ids, id];
interface Props {
  catalog?: MaterialQuestion[];
  topics?: Topic[];
  termCatalog?: Term[];
}
export function App({
  catalog = defaultCatalog,
  topics = topicInventory,
  termCatalog = defaultTerms,
}: Props) {
  const { data, loading, saving, error, update, exportBackup, importBackup } =
    useLearning();
  const [page, setPage] = useState<Page>("home"),
    [message, setMessage] = useState(""),
    [more, setMore] = useState(false),
    [summary, setSummary] = useState<{ total: number; correct: number } | null>(
      null,
    );
  const [mode, setMode] = useState<StudyMode>("practice");
  const [query, setQuery] = useState(""),
    [term, setTerm] = useState<Term | null>(null),
    [cardIndex, setCardIndex] = useState(0),
    [flipped, setFlipped] = useState(false),
    [termSubject, setTermSubject] = useState<Subject | "">("");
  const [favoriteOnly, setFavoriteOnly] = useState(false),
    [weakOnly, setWeakOnly] = useState(false),
    [cardsDueOnly, setCardsDueOnly] = useState(false);
  const swipe = useRef<number | null>(null);
  const [calcA, setCalcA] = useState(""),
    [calcB, setCalcB] = useState(""),
    [calcOp, setCalcOp] = useState("+"),
    [calcResult, setCalcResult] = useState("");
  const mainHeading = useRef<HTMLHeadingElement>(null);
  const { grade, exam } = data.settings;
  const published = catalog.filter((q) => canPublish(q));
  const gradeCatalog = published.filter(
    (q) => q.grade === grade && q.exam === exam,
  );
  const stats = analyzeLearning(catalog, data.attempts, grade, exam);
  const coverage = getCoverage(topics, catalog, data.attempts, grade, exam);
  const due = dueReviews(data.reviews).map((r) => r.questionId);
  const missed = new Set(
    data.attempts.filter((a) => !a.correct).map((a) => a.questionId),
  );
  const filter: QuestionFilter = {
    grade,
    exam,
    mode:
      page === "calculation"
        ? "calculation"
        : page === "review"
          ? "review"
          : mode,
    count: data.settings.practiceCount,
    subject: data.settings.subject,
    difficulty: data.settings.difficulty,
    topicId: data.settings.topicId,
    unansweredOnly: data.settings.unansweredOnly,
    bookmarkedOnly: data.settings.bookmarkedOnly,
    origin: data.settings.origin,
    year: data.settings.year,
    wrongOnly: data.settings.wrongOnly,
    dueOnly: data.settings.dueOnly,
  };
  const selection = buildQuestionSet(
    catalog,
    filter,
    data.attempts,
    data.bookmarks,
    due,
    () => 0.5,
  );
  const currentSession = data.session;
  const currentQuestion = currentSession
    ? published.find(
        (q) => q.id === currentSession.questionIds[currentSession.currentIndex],
      )
    : undefined;
  const termList = searchTerms(
    termCatalog,
    query,
    grade,
    termSubject || undefined,
  ).filter((t) => !favoriteOnly || data.termFavorites.includes(t.id));
  const cardList = orderCards(termList, data.cards, new Date(), {
    dueOnly: cardsDueOnly,
    weakFirst: weakOnly,
  });
  const card = cardList.length ? cardList[cardIndex % cardList.length] : null;
  const cardProgress = card ? data.cards.find((progress) => progress.termId === card.id) : undefined;
  useEffect(() => {
    document.documentElement.dataset.theme = data.settings.theme;
  }, [data.settings.theme]);
  useEffect(() => {
    if (!loading) mainHeading.current?.focus();
  }, [page, loading]);
  function navigate(next: Page) {
    setPage(next);
    setMessage("");
    setMore(false);
    setSummary(null);
    if (next === "practice") setMode("practice");
  }
  async function setting(patch: Partial<LearningState["settings"]>) {
    await update((s) => ({ ...s, settings: { ...s.settings, ...patch } }));
  }
  async function begin(
    selectedMode: StudyMode,
    count = data.settings.practiceCount,
    subject?: Subject,
  ) {
    if (data.session) {
      setMessage(
        "中断中の演習があります。「続きを再開」から完了してください。設定は次の演習に適用します。",
      );
      return;
    }
    const next = buildQuestionSet(
      catalog,
      {
        ...filter,
        mode: selectedMode,
        count,
        subject: subject ?? filter.subject,
      },
      data.attempts,
      data.bookmarks,
      due,
    );
    if (!next.questions.length) {
      navigate(
        selectedMode === "calculation"
          ? "calculation"
          : selectedMode === "review"
            ? "review"
            : "practice",
      );
      setMessage(
        `条件に合う確認済み問題は0問です。未確認の教材は出題しません。`,
      );
      return;
    }
    const now = new Date().toISOString();
    if (
      await update((s) => {
        if (s.session)
          throw new LearningStorageError(
            "conflict",
            "別の画面で開始した演習があります。再読み込みして再開してください。",
          );
        return {
          ...s,
          session: {
            id: crypto.randomUUID(),
            grade,
            exam,
            mode: selectedMode,
            questionIds: next.questions.map((q) => q.id),
            currentIndex: 0,
            answers: {},
            selfRatings: {},
            startedAt: now,
            updatedAt: now,
          },
        };
      })
    ) {
      setPage("session");
      setSummary(null);
      setMessage(
        next.shortage
          ? `指定${count}問に対し出題可能${next.questions.length}問で開始しました。重複で補いません。`
          : "",
      );
    }
  }
  function rebuildReview(s: LearningState, questionId: string) {
    let review;
    for (const a of s.attempts
      .filter((a) => a.questionId === questionId)
      .sort((a, b) => Date.parse(a.answeredAt) - Date.parse(b.answeredAt)))
      review = scheduleReview(review, {
        questionId,
        correct: a.correct,
        rating: a.selfRating ?? (a.correct ? "good" : "again"),
        answeredAt: a.answeredAt,
      });
    return review;
  }
  async function answer(response: number | string, durationMs: number) {
    if (!currentQuestion || !currentSession) return false;
    const q = currentQuestion;
    const result = gradeAnswer(q, response);
    if (!result.valid) return false;
    const now = new Date().toISOString();
    return update((s) => {
      if (
        !s.session ||
        s.session.id !== currentSession.id ||
        s.session.currentIndex !== currentSession.currentIndex ||
        s.session.questionIds[s.session.currentIndex] !== q.id ||
        s.session.answers[q.id] !== undefined
      )
        throw new LearningStorageError(
          "conflict",
          "演習状態が更新されています。再読み込みして続けてください。",
        );
      const rating: SelfRating = result.correct ? "good" : "again";
      const attempts = [
        ...s.attempts,
        {
          id: `${s.session.id}/${q.id}`,
          questionId: q.id,
          selected: typeof response === "number" ? response : 0,
          response,
          correct: result.correct,
          answeredAt: now,
          grade: q.grade,
          exam: q.exam,
          subject: q.subject,
          difficulty: q.difficulty,
          mode: s.session.mode,
          durationMs,
          selfRating: rating,
        },
      ];
      const state = { ...s, attempts };
      const review = rebuildReview(state, q.id)!;
      return {
        ...state,
        reviews: [...s.reviews.filter((r) => r.questionId !== q.id), review],
        session: {
          ...s.session,
          answers: { ...s.session.answers, [q.id]: response },
          selfRatings: { ...s.session.selfRatings, [q.id]: rating },
          updatedAt: now,
        },
      };
    });
  }
  async function rate(rating: SelfRating) {
    if (!currentQuestion || !currentSession) return;
    const id = `${currentSession.id}/${currentQuestion.id}`;
    await update((s) => {
      if (
        !s.session ||
        s.session.id !== currentSession.id ||
        s.session.currentIndex !== currentSession.currentIndex ||
        s.session.answers[currentQuestion.id] === undefined
      )
        throw new LearningStorageError(
          "conflict",
          "演習状態が変わりました。再読み込みしてください。",
        );
      const attempts = s.attempts.map((a) =>
        a.id === id ? { ...a, selfRating: rating } : a,
      );
      const state = { ...s, attempts };
      const review = rebuildReview(state, currentQuestion.id);
      return {
        ...state,
        reviews: review
          ? [
              ...s.reviews.filter((r) => r.questionId !== currentQuestion.id),
              review,
            ]
          : s.reviews,
        session: s.session
          ? {
              ...s.session,
              selfRatings: {
                ...s.session.selfRatings,
                [currentQuestion.id]: rating,
              },
            }
          : null,
      };
    });
  }
  async function next() {
    if (!currentSession) return;
    const final =
      currentSession.currentIndex + 1 >= currentSession.questionIds.length;
    const sessionAttempts = data.attempts.filter((a) =>
      a.id.startsWith(`${currentSession.id}/`),
    );
    if (
      (await update((s) => {
        if (
          !s.session ||
          s.session.id !== currentSession.id ||
          s.session.currentIndex !== currentSession.currentIndex ||
          s.session.answers[
            currentSession.questionIds[currentSession.currentIndex]
          ] === undefined
        )
          throw new LearningStorageError(
            "conflict",
            "演習状態が変わりました。再読み込みしてください。",
          );
        return {
          ...s,
          session: final
            ? null
            : s.session
              ? {
                  ...s.session,
                  currentIndex: s.session.currentIndex + 1,
                  updatedAt: new Date().toISOString(),
                }
              : null,
        };
      })) &&
      final
    ) {
      setSummary({
        total: sessionAttempts.length,
        correct: sessionAttempts.filter((a) => a.correct).length,
      });
      setPage("home");
    }
  }
  async function bookmark(id: string) {
    await update((s) => ({ ...s, bookmarks: toggle(s.bookmarks, id) }));
  }
  async function note(text: string) {
    if (!currentQuestion) return;
    const id = currentQuestion.id;
    if (
      await update((s) => ({
        ...s,
        notes: [
          ...s.notes.filter((n) => n.questionId !== id),
          {
            id: `note/${id}`,
            questionId: id,
            text,
            updatedAt: new Date().toISOString(),
          },
        ],
      }))
    )
      setMessage("ノートを保存しました。");
  }
  async function rateCard(rating: SelfRating) {
    if (!card) return;
    const now = new Date().toISOString();
    if (
      await update((s) => ({
        ...s,
        cards: [
          ...s.cards.filter((c) => c.termId !== card.id),
          scheduleCardReview(s.cards.find((c) => c.termId === card.id), card.id, rating, now),
        ],
      }))
    ) {
      setCardIndex(0);
      setFlipped(false);
    }
  }
  function calculate() {
    try {
      const a = decimalToScaled(calcA, 8, "half-up"),
        b = decimalToScaled(calcB, 8, "half-up"),
        scale = 100000000n;
      let value;
      if (calcOp === "+") value = a + b;
      else if (calcOp === "−") value = a - b;
      else if (calcOp === "×") value = divideRounded(a * b, scale, "half-up");
      else {
        if (b === 0n) throw new Error("0では割れません。");
        value = divideRounded(
          a * scale * (b < 0n ? -1n : 1n),
          b < 0n ? -b : b,
          "half-up",
        );
      }
      setCalcResult(formatScaled(value, 8).replace(/\.?0+$/, "") || "0");
    } catch (e) {
      setCalcResult(
        e instanceof Error ? e.message : "数値を確認してください。",
      );
    }
  }
  const modeLabel =
    page === "calculation"
      ? "計算トレーニング"
      : page === "review"
        ? "復習"
        : "通常演習";
  if (loading)
    return (
      <div className="loading" role="status">
        <strong>FP Master</strong>
        <p>学習データを確認しています…</p>
      </div>
    );
  return (
    <div className="app">
      <a className="skip" href="#main">
        本文へ移動
      </a>
      <aside className="sidebar">
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            navigate("home");
          }}
        >
          <span className="brand-icon">F↗</span>
          <span>FP Master</span>
        </a>
        <p className="nav-caption">メニュー</p>
        <nav aria-label="メインメニュー">
          {navigation.map((n) => (
            <button
              key={n.id}
              aria-current={page === n.id ? "page" : undefined}
              onClick={() => navigate(n.id)}
            >
              <span aria-hidden="true">{n.icon}</span>
              {n.label}
              {n.id === "review" && due.length > 0 && (
                <small>{due.length}</small>
              )}
            </button>
          ))}
        </nav>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <span className="mobile-brand">FP Master</span>
          <div className="course-switch">
            <label>
              <span>級</span>
              <select
                aria-label="対象級"
                disabled={saving}
                value={grade}
                onChange={(e) =>
                  void setting({ grade: e.target.value as Grade })
                }
              >
                <option value="3">FP3級</option>
                <option value="2">FP2級</option>
              </select>
            </label>
            <label>
              <span>試験区分</span>
              <select
                aria-label="試験区分"
                disabled={saving}
                value={exam}
                onChange={(e) =>
                  void setting({
                    exam: e.target.value as "academic" | "practical",
                  })
                }
              >
                <option value="academic">学科</option>
                <option value="practical">実技（資産設計）</option>
              </select>
            </label>
          </div>
        </header>
        <main id="main">
          <div className="page-heading">
            <div>
              <h1 ref={mainHeading} tabIndex={-1}>
                {titles[page][0]}
              </h1>
              {titles[page][1] && <p>{titles[page][1]}</p>}
            </div>
            <span className="course-badge">
              FP{grade}級 ・ {exam === "academic" ? "学科" : "日本FP協会 実技"}
            </span>
          </div>
          {error && (
            <p role="alert" className="notice notice-error">
              {error} 保存できたと確認できるまで画面を閉じないでください。
            </p>
          )}
          {message && (
            <p role="status" className="notice">
              {message}
            </p>
          )}
          {saving && (
            <p className="saving" role="status">
              保存しています…
            </p>
          )}
          {currentSession && page !== "session" && (
            <div className="resume">
              <div>
                <strong>中断中の演習があります</strong>
                <p>
                  FP{currentSession.grade}級 ・{" "}
                  {currentSession.mode === "calculation"
                    ? "計算"
                    : currentSession.mode === "review"
                      ? "復習"
                      : "知識演習"}{" "}
                  ・ {currentSession.currentIndex + 1}/
                  {currentSession.questionIds.length}問
                </p>
              </div>
              <Button variant="secondary" onClick={() => navigate("session")}>
                続きを再開 →
              </Button>
            </div>
          )}
          {page === "session" ? (
            currentQuestion && currentSession ? (
              <SessionView
                key={`${currentSession.id}/${currentQuestion.id}`}
                question={currentQuestion}
                data={data}
                saving={saving}
                terms={termCatalog}
                onAnswer={answer}
                onRating={rate}
                onNext={next}
                onPause={() => navigate("home")}
                onBookmark={() => bookmark(currentQuestion.id)}
                onNote={note}
              />
            ) : (
              <Panel>
                <Empty title="出題対象の教材を確認できません">
                  <p>
                    教材が削除・隔離された可能性があります。履歴と中断データは保全しています。設定からバックアップしてください。
                  </p>
                  <Button onClick={() => navigate("settings")}>
                    バックアップへ
                  </Button>
                </Empty>
              </Panel>
            )
          ) : null}
          {page === "home" && (
            <>
              {summary && (
                <Panel>
                  <h2>演習結果</h2>
                  <p role="status">
                    {summary.total}問中{summary.correct}問正解。
                    {summary.total
                      ? Math.floor((summary.correct / summary.total) * 100)
                      : 0}
                    %でした。
                  </p>
                  <Button
                    variant="secondary"
                    onClick={() => navigate("history")}
                  >
                    回答を振り返る →
                  </Button>
                </Panel>
              )}
              <div className="home-intro">
                <div className="metrics">
                  <Metric
                    label="累計回答数"
                    value={
                      <>
                        {stats.cumulative.total}
                        <small>問</small>
                      </>
                    }
                    note="確認済み教材の回答のみ"
                  />
                  <Metric
                    label="初見正答率"
                    value={percent(stats.firstSeen)}
                    note={`${stats.firstSeen.total}問 / 個人目標95%以上`}
                  />
                  <Metric
                    label="今日の復習"
                    value={
                      <>
                        {
                          due.filter((id) =>
                            gradeCatalog.some((q) => q.id === id),
                          ).length
                        }
                        <small>問</small>
                      </>
                    }
                    note="正解でも曖昧なら復習へ"
                  />
                </div>
                <section className="hero">
                  <div>
                    <h2>5問演習</h2>
                    <p>計算を除く知識問題を5問出題します。</p>
                    <Button
                      disabled={saving}
                      onClick={() => void begin("practice", 5)}
                    >
                      すぐに5問解く <span>→</span>
                    </Button>
                    <small>
                      計算問題は含みません ・ 出題可能
                      {
                        gradeCatalog.filter((q) => q.kind === "knowledge")
                          .length
                      }
                      問
                    </small>
                  </div>
                </section>
              </div>
              <div className="section-row">
                <h2>6分野の収録状況</h2>
                <Button variant="quiet" onClick={() => navigate("coverage")}>
                  収録状況を見る ↗
                </Button>
              </div>
              <div className="subject-grid">
                {subjects.map((s, i) => (
                  <button
                    className="subject-card"
                    key={s.id}
                    onClick={() => void begin("practice", 5, s.id)}
                    disabled={saving}
                  >
                    <span
                      className={`subject-icon subject-${i}`}
                      aria-hidden="true"
                    >
                      {s.icon}
                    </span>
                    <small>分野 {i + 1}</small>
                    <h3>{s.name}</h3>
                    <span>
                      {gradeCatalog.filter((q) => q.subject === s.id).length}問
                      収録 <span aria-hidden="true">↗</span>
                    </span>
                  </button>
                ))}
              </div>
              <div className="feature-grid">
                <Panel>
                  <h2>計算トレーニング</h2>
                  <p>数値入力で解答し、計算式と手順を確認できます。</p>
                  <Button
                    variant="secondary"
                    onClick={() => navigate("calculation")}
                  >
                    計算トレーニングへ →
                  </Button>
                </Panel>
                <Panel>
                  <h2>成績・95%到達度</h2>
                  <p>初見・復習・未学習範囲を別々に確認できます。</p>
                  <Button
                    variant="secondary"
                    onClick={() => navigate("analytics")}
                  >
                    到達度を見る →
                  </Button>
                </Panel>
              </div>
              <div className="editorial-note">
                <strong>教材品質の確認を進めています</strong>
                <p>
                  確認済み・公開可能な教材は現在0問です。既存サンプル12問は出典未確認のため隔離しています。原典と利用条件を確認するまで出題しません。
                </p>
                <Button variant="quiet" onClick={() => navigate("coverage")}>
                  不足範囲と確認状況 →
                </Button>
              </div>
            </>
          )}
          {(["practice", "calculation", "review"] as Page[]).includes(page) && (
            <>
              <Panel>
                <div className="section-row">
                  <h2>{modeLabel}の条件</h2>
                  <span className="pill">出題可能 {selection.available}問</span>
                </div>
                <div className="form-grid">
                  <label className="field">
                    問題数
                    <select
                      value={
                        [5, 10, 20, 50, 100].includes(
                          data.settings.practiceCount,
                        )
                          ? String(data.settings.practiceCount)
                          : "custom"
                      }
                      onChange={(e) => {
                        if (e.target.value !== "custom")
                          void setting({
                            practiceCount: Number(e.target.value),
                          });
                        else void setting({ practiceCount: 7 });
                      }}
                      disabled={saving}
                    >
                      {[5, 10, 20, 50, 100].map((n) => (
                        <option key={n} value={n}>
                          {n}問
                        </option>
                      ))}
                      <option value="custom">任意の問題数</option>
                    </select>
                  </label>
                  <label className="field">
                    出題数（1〜1000問）
                    <input
                      type="number"
                      min={1}
                      max={1000}
                      value={data.settings.practiceCount}
                      disabled={saving}
                      onChange={(e) => {
                        const n = Number(e.target.value);
                        if (Number.isInteger(n) && n >= 1 && n <= 1000)
                          void setting({ practiceCount: n });
                      }}
                    />
                  </label>
                  <label className="field">
                    分野
                    <select
                      value={data.settings.subject ?? ""}
                      disabled={saving}
                      onChange={(e) =>
                        void setting({
                          subject: (e.target.value || undefined) as
                            Subject | undefined,
                          topicId: undefined,
                        })
                      }
                    >
                      <option value="">すべての分野</option>
                      {subjects.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.short}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field">
                    論点
                    <select
                      value={data.settings.topicId ?? ""}
                      disabled={saving}
                      onChange={(e) =>
                        void setting({ topicId: e.target.value || undefined })
                      }
                    >
                      <option value="">すべての論点</option>
                      {topics
                        .filter(
                          (t) =>
                            !data.settings.subject ||
                            t.subject === data.settings.subject,
                        )
                        .map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.point}
                          </option>
                        ))}
                    </select>
                  </label>
                  <label className="field">
                    難易度
                    <select
                      value={data.settings.difficulty ?? ""}
                      disabled={saving}
                      onChange={(e) =>
                        void setting({
                          difficulty: (e.target.value ||
                            undefined) as LearningState["settings"]["difficulty"],
                        })
                      }
                    >
                      <option value="">すべての難易度</option>
                      {Object.entries(difficultyNames).map(([id, name]) => (
                        <option key={id} value={id}>
                          {name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field">
                    出題年度
                    <select
                      value={data.settings.year ?? ""}
                      disabled={saving}
                      onChange={(e) =>
                        void setting({
                          year: e.currentTarget.value
                            ? Number(e.currentTarget.value)
                            : undefined,
                        })
                      }
                    >
                      <option value="">すべての年度</option>
                      {[
                        ...new Set(
                          gradeCatalog
                            .map((q) => q.year)
                            .filter((year): year is number => year !== null),
                        ),
                      ]
                        .sort((a, b) => b - a)
                        .map((year) => (
                          <option key={year} value={year}>
                            {year}年
                          </option>
                        ))}
                    </select>
                  </label>
                  <label className="field">
                    教材の種類
                    <select
                      value={data.settings.origin ?? ""}
                      disabled={saving}
                      onChange={(e) =>
                        void setting({
                          origin: (e.target.value ||
                            undefined) as LearningState["settings"]["origin"],
                        })
                      }
                    >
                      <option value="">すべての教材</option>
                      <option value="official">公式過去問</option>
                      <option value="adapted">加工問題</option>
                      <option value="original">オリジナル問題</option>
                    </select>
                  </label>
                </div>
                <div className="button-row">
                  <label className="check">
                    <input
                      type="checkbox"
                      checked={data.settings.unansweredOnly ?? false}
                      disabled={saving}
                      onChange={(e) =>
                        void setting({ unansweredOnly: e.target.checked })
                      }
                    />
                    初見問題のみ
                  </label>
                  <label className="check">
                    <input
                      type="checkbox"
                      checked={data.settings.bookmarkedOnly ?? false}
                      disabled={saving}
                      onChange={(e) =>
                        void setting({ bookmarkedOnly: e.target.checked })
                      }
                    />
                    ブックマークのみ
                  </label>
                  <label className="check">
                    <input
                      type="checkbox"
                      checked={data.settings.wrongOnly ?? false}
                      disabled={saving}
                      onChange={(e) =>
                        void setting({ wrongOnly: e.currentTarget.checked })
                      }
                    />
                    直近で間違えた問題
                  </label>
                  <label className="check">
                    <input
                      type="checkbox"
                      checked={data.settings.dueOnly ?? false}
                      disabled={saving}
                      onChange={(e) =>
                        void setting({ dueOnly: e.currentTarget.checked })
                      }
                    />
                    今日の復習対象
                  </label>
                </div>
                <p className="notice">
                  指定{filter.count}問 / 出題可能{selection.available}問。
                  {selection.shortage > 0
                    ? `${selection.shortage}問不足しています。問題を重複させず、最大${selection.questions.length}問を出題します。`
                    : "条件を満たしています。"}
                  {filter.mode === "practice"
                    ? " 通常演習に計算問題は入りません。"
                    : ""}
                </p>
                <Button
                  disabled={
                    saving ||
                    selection.questions.length === 0 ||
                    Boolean(data.session)
                  }
                  onClick={() => void begin(filter.mode)}
                >
                  {selection.questions.length}問の{modeLabel}を開始 →
                </Button>
                {selection.questions.length === 0 && (
                  <Empty title="確認済みの出題候補がありません">
                    <p>
                      原典確認とWeb利用条件の確認が完了した教材だけを出題します。絞り込み条件や教材の収録状況を確認してください。
                    </p>
                    <Button
                      variant="secondary"
                      onClick={() => navigate("coverage")}
                    >
                      教材の収録状況へ
                    </Button>
                  </Empty>
                )}
              </Panel>
              {page === "review" && (
                <Panel>
                  <h2>復習の仕組み</h2>
                  <p>
                    SM-2を参考に、正誤と自己評価から次回日を計算します。間違い・「覚えていない」は翌日、初回の「理解した」は翌日、次は6日後です。「曖昧」は最大2日で再確認します。
                  </p>
                  <p>
                    記録済みの復習予定 {data.reviews.length}件 /
                    過去に間違えた問題 {missed.size}
                    問。隔離された問題は復習にも出題しません。
                  </p>
                  <ul className="plain-list">
                    {data.reviews
                      .filter((r) =>
                        gradeCatalog.some((q) => q.id === r.questionId),
                      )
                      .slice(0, 30)
                      .map((r) => (
                        <li key={r.questionId}>
                          <span>
                            {
                              gradeCatalog.find((q) => q.id === r.questionId)
                                ?.prompt
                            }
                          </span>
                          <time>
                            {new Date(r.nextReviewAt).toLocaleDateString(
                              "ja-JP",
                            )}
                          </time>
                        </li>
                      ))}
                  </ul>
                </Panel>
              )}
              {page === "calculation" && (
                <Panel>
                  <h2>学習用電卓</h2>
                  <p className="caption">
                    各入力は小数8桁に四捨五入し、結果も小数8桁まで。実際の問題では指定された単位と端数処理に従ってください。
                  </p>
                  <form
                    className="calculator"
                    onSubmit={(e) => {
                      e.preventDefault();
                      calculate();
                    }}
                  >
                    <label className="field">
                      数値A
                      <input
                        inputMode="decimal"
                        value={calcA}
                        onChange={(e) => setCalcA(e.target.value)}
                      />
                    </label>
                    <label className="field">
                      演算
                      <select
                        value={calcOp}
                        onChange={(e) => setCalcOp(e.target.value)}
                      >
                        {["+", "−", "×", "÷"].map((o) => (
                          <option key={o}>{o}</option>
                        ))}
                      </select>
                    </label>
                    <label className="field">
                      数値B
                      <input
                        inputMode="decimal"
                        value={calcB}
                        onChange={(e) => setCalcB(e.target.value)}
                      />
                    </label>
                    <Button>計算する</Button>
                  </form>
                  <output aria-live="polite" className="calculator-result">
                    {calcResult}
                  </output>
                </Panel>
              )}
            </>
          )}
          {page === "analytics" && (
            <>
              <div className="metrics metrics-four">
                <Metric
                  label="累計正答率"
                  value={percent(stats.cumulative)}
                  note={`${stats.cumulative.total}回答`}
                />
                <Metric
                  label="直近20回答"
                  value={percent(stats.recent)}
                  note={`${stats.recent.total}回答`}
                />
                <Metric
                  label="初見正答率"
                  value={percent(stats.firstSeen)}
                  note={`${stats.firstSeen.total}問題`}
                />
                <Metric
                  label="再回答・復習正答率"
                  value={percent(stats.review)}
                  note={`${stats.review.total}回答`}
                />
              </div>
              <Panel>
                <h2>95%目標の現在地</h2>
                <Progress
                  value={stats.firstSeen.accuracy}
                  label="初見問題の正答率"
                />
                <p className="notice">{stats.confidenceMessage}</p>
                <p>
                  95%は個人の学習目標です。60点満点では57点、100点満点では95点に相当します。公式合格基準は別の指標であり、現行の公式資料の確認待ちです。
                </p>
                <dl className="info-list">
                  <div>
                    <dt>通常演習</dt>
                    <dd>{percent(stats.practice)}</dd>
                  </div>
                  <div>
                    <dt>計算演習</dt>
                    <dd>{percent(stats.calculation)}</dd>
                  </div>
                  <div>
                    <dt>模擬試験</dt>
                    <dd>{percent(stats.mock)}</dd>
                  </div>
                  <div>
                    <dt>未学習問題</dt>
                    <dd>{stats.unlearnedQuestionCount}問</dd>
                  </div>
                  <div>
                    <dt>解答時間の合計</dt>
                    <dd>{Math.round(stats.durationMs / 60000)}分</dd>
                  </div>
                  <div>
                    <dt>平均解答時間</dt>
                    <dd>
                      {stats.meanDurationMs === null
                        ? "—"
                        : `${Math.round(stats.meanDurationMs / 1000)}秒`}
                    </dd>
                  </div>
                </dl>
              </Panel>
              <div className="two-column">
                <Panel>
                  <h2>分野別の正答率</h2>
                  {subjects.map((s) => (
                    <Progress
                      key={s.id}
                      label={`${s.short}（${stats.bySubject[s.id].total}回答）`}
                      value={stats.bySubject[s.id].accuracy}
                    />
                  ))}
                </Panel>
                <Panel>
                  <h2>難易度別の正答率</h2>
                  {(
                    Object.keys(
                      difficultyNames,
                    ) as (keyof typeof difficultyNames)[]
                  ).map((d) => (
                    <Progress
                      key={d}
                      label={`${difficultyNames[d]}（${stats.byDifficulty[d].total}回答）`}
                      value={stats.byDifficulty[d].accuracy}
                    />
                  ))}
                  <p className="caption">
                    回答が少ない分野の数字だけで理解度を断定しません。未学習論点を優先して確認してください。
                  </p>
                  <Button
                    variant="secondary"
                    onClick={() => navigate("coverage")}
                  >
                    未収録・未習得の論点へ
                  </Button>
                </Panel>
              </div>
            </>
          )}
          {page === "coverage" && (
            <>
              <div className="metrics">
                <Metric
                  label="確認済み・公開可能問題"
                  value={`${coverage.verifiedQuestions}問`}
                  note={`収録候補 ${coverage.totalQuestions}問`}
                />
                <Metric
                  label="公式論点の教材網羅率"
                  value={
                    coverage.topicCoverage === null
                      ? "算定不能"
                      : `${Math.floor(coverage.topicCoverage * 100)}%`
                  }
                  note="公式範囲の分母を確認中"
                />
                <Metric
                  label="個人の論点習得率"
                  value={
                    coverage.masteryRate === null
                      ? "算定不能"
                      : `${Math.floor(coverage.masteryRate * 100)}%`
                  }
                  note="同じ問題の反復だけでは判定しません"
                />
              </div>
              <Panel>
                <h2>公式試験範囲との照合</h2>
                <p className="notice">
                  公式サイトへの接続が403で拒否され、最新の試験範囲・仕様・教材利用条件を確認できていません。以下は要件から作成した暫定論点表です。完全網羅と判断できる分母は未確定です。
                </p>
                <p>
                  問題の確認率：
                  {coverage.questionVerificationRate === null
                    ? "対象問題なし"
                    : `${Math.floor(coverage.questionVerificationRate * 100)}%`}{" "}
                  / 未学習論点の割合：
                  {coverage.unlearnedTopicRatio === null
                    ? "算定不能"
                    : `${Math.floor(coverage.unlearnedTopicRatio * 100)}%`}
                </p>
                <div
                  className="table-scroll"
                  tabIndex={0}
                  role="region"
                  aria-label="網羅性管理表"
                >
                  <table>
                    <thead>
                      <tr>
                        <th>分野・論点</th>
                        <th>対象</th>
                        <th>問題 / 確認済</th>
                        <th>用語</th>
                        <th>初見成績</th>
                        <th>状態・法令基準日</th>
                      </tr>
                    </thead>
                    <tbody>
                      {coverage.topics.map((row) => {
                        const t = topics.find((t) => t.id === row.topicId)!;
                        return (
                          <tr key={t.id}>
                            <th scope="row">
                              <small>
                                {
                                  subjects.find((s) => s.id === t.subject)
                                    ?.short
                                }{" "}
                                / {t.middleCategory}
                              </small>
                              {t.subcategory}：{t.point}
                            </th>
                            <td>{t.grades.map((g) => `${g}級`).join("・")}</td>
                            <td>
                              {row.totalQuestions} / {row.verifiedQuestions}
                            </td>
                            <td>{row.relatedTerms}</td>
                            <td>
                              {percent(row.firstSeen)}
                              <small>
                                {row.learned ? "学習済み" : "未学習"}
                              </small>
                            </td>
                            <td>
                              <span className="pill">
                                {row.missingMaterial ? "教材不足" : "教材あり"}
                              </span>
                              <small>
                                {t.scopeVerified
                                  ? "原典照合済み"
                                  : "公式範囲未照合"}{" "}
                                / {row.lawReferenceDate ?? "基準日未確認"}
                              </small>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </Panel>
              <Panel>
                <h2>原典と利用条件</h2>
                <ul className="source-list">
                  {[
                    ["試験総合案内", "https://www.jafp.or.jp/exam/"],
                    ["試験要綱", "https://www.jafp.or.jp/exam/outline/"],
                    [
                      "公開問題・模範解答",
                      "https://www.jafp.or.jp/exam/mohan/",
                    ],
                    ["試験日程", "https://www.jafp.or.jp/exam/schedule/"],
                  ].map(([name, url]) => (
                    <li key={url}>
                      <a href={url} target="_blank" rel="noreferrer">
                        日本FP協会：{name} ↗
                      </a>
                      <span>本文未取得・未確認</span>
                    </li>
                  ))}
                </ul>
                <p className="caption">
                  リンクが存在することだけでは出典確認済みと扱いません。正答・解説・法令基準日と公開の可否を個別に照合します。
                </p>
              </Panel>
            </>
          )}
          {page === "mock" && (
            <Panel>
              <h2>4つの試験区分</h2>
              <p>
                学科は日本FP協会・きんざい共通問題、実技は日本FP協会の「資産設計提案業務」が対象です。きんざい独自実技は含みません。
              </p>
              <div className="exam-grid">
                {(["3", "2"] as const).flatMap((g) =>
                  (["academic", "practical"] as const).map((e) => {
                    const spec = examSpecifications.find(
                      (item) => item.grade === g && item.exam === e,
                    )!;
                    const readiness = mockReadiness(spec, catalog);
                    return (
                      <article className="exam-card" key={`${g}/${e}`}>
                        <span className="pill">公式仕様の確認待ち</span>
                        <h3>
                          FP{g}級 {e === "academic" ? "学科" : "実技"}
                        </h3>
                        <p>
                          {e === "practical" ? "資産設計提案業務" : "学科試験"}
                        </p>
                        <p>
                          確認済み教材：
                          {
                            published.filter(
                              (q) => q.grade === g && q.exam === e,
                            ).length
                          }
                          問
                        </p>
                        <p className="caption">
                          {readiness.reasons.join("。")}
                        </p>
                      </article>
                    );
                  }),
                )}
              </div>
              <p className="notice">
                本試験形式の開始条件を満たしていません。未確認の仕様や不足教材を用いた「完全再現」は提供しません。出題ロジックでは模試に計算問題を含め、通常演習とは区別します。
              </p>
            </Panel>
          )}
          {(["glossary", "cards"] as Page[]).includes(page) && (
            <>
              <Panel>
                <div className="form-grid">
                  <label className="field">
                    用語を検索
                    <input
                      type="search"
                      value={query}
                      onChange={(e) => {
                        setQuery(e.target.value);
                        setCardIndex(0);
                        setFlipped(false);
                      }}
                      placeholder="名称・読み方・説明"
                    />
                  </label>
                  <label className="field">
                    分野
                    <select
                      value={termSubject}
                      onChange={(e) => {
                        setTermSubject(e.target.value as Subject | "");
                        setCardIndex(0);
                      }}
                    >
                      <option value="">すべての分野</option>
                      {subjects.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.short}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="button-row">
                  <label className="check">
                    <input
                      type="checkbox"
                      checked={favoriteOnly}
                      onChange={(e) => { setFavoriteOnly(e.target.checked); setCardIndex(0); }}
                    />
                    お気に入りのみ
                  </label>
                  {page === "cards" && (
                    <>
                      <label className="check">
                        <input
                          type="checkbox"
                          checked={weakOnly}
                          onChange={(e) => { setWeakOnly(e.target.checked); setCardIndex(0); }}
                        />
                        苦手カード優先
                      </label>
                      <label className="check">
                        <input
                          type="checkbox"
                          checked={cardsDueOnly}
                          onChange={(e) => { setCardsDueOnly(e.target.checked); setCardIndex(0); }}
                        />
                        期限が来たカードのみ
                      </label>
                    </>
                  )}
                </div>
              </Panel>
              {!termList.length ? (
                <Panel>
                  <Empty title="確認済みの用語がありません">
                    <p>
                      原典の確認が完了した用語を収録します。未確認の説明を暗記教材には使用しません。
                    </p>
                  </Empty>
                </Panel>
              ) : page === "glossary" ? (
                <div className="term-grid">
                  {termList.map((t) => (
                    <Panel key={t.id}>
                      <small>
                        {t.reading} /{" "}
                        {subjects.find((s) => s.id === t.subject)?.short}
                      </small>
                      <h2>
                        <button
                          className="term-title"
                          onClick={() => setTerm(t)}
                        >
                          {t.name}
                        </button>
                      </h2>
                      <p>{t.summary}</p>
                      <div className="button-row">
                        <Button
                          variant="secondary"
                          onClick={() =>
                            void update((s) => ({
                              ...s,
                              termFavorites: toggle(s.termFavorites, t.id),
                            }))
                          }
                        >
                          {data.termFavorites.includes(t.id)
                            ? "★ お気に入り"
                            : "☆ お気に入り"}
                        </Button>
                        <Button
                          variant="quiet"
                          onClick={() =>
                            void update((s) => ({
                              ...s,
                              learnedTerms: toggle(s.learnedTerms, t.id),
                            }))
                          }
                        >
                          {data.learnedTerms.includes(t.id)
                            ? "✓ 学習済み"
                            : "学習済みにする"}
                        </Button>
                      </div>
                    </Panel>
                  ))}
                </div>
              ) : card ? (
                <Panel className="flashcard-panel">
                  <p className="eyebrow">
                    カード {(cardIndex % cardList.length) + 1} / {cardList.length}
                  </p>
                  <button
                    className="flashcard"
                    onClick={() => setFlipped(!flipped)}
                    onTouchStart={(e) => {
                      swipe.current = e.touches[0].clientX;
                    }}
                    onTouchEnd={(e) => {
                      if (
                        swipe.current !== null &&
                        Math.abs(e.changedTouches[0].clientX - swipe.current) >
                          60
                      )
                        setFlipped((v) => !v);
                      swipe.current = null;
                    }}
                  >
                    <small>{flipped ? "意味" : "用語"} ・ タップで裏返す</small>
                    <strong>{flipped ? card.summary : card.name}</strong>
                    {flipped && <span>{card.detail}</span>}
                  </button>
                  {flipped && (
                    <div className="button-row">
                      {(["again", "hard", "good", "easy"] as const).map(
                        (r, i) => (
                          <Button
                            key={r}
                            variant="secondary"
                            disabled={saving}
                            onClick={() => void rateCard(r)}
                          >
                            {["覚えていない", "曖昧", "覚えた", "余裕"][i]}
                          </Button>
                        ),
                      )}
                    </div>
                  )}
                  <p className="caption">
                    {cardProgress ? `次回復習予定：${new Date(cardProgress.nextReviewAt).toLocaleDateString("ja-JP")}。` : "未学習のカードです。"}
                    スワイプでも表裏を切り替えられます。評価後に復習予定を保存します。
                  </p>
                </Panel>
              ) : (
                <Panel>
                  <Empty title="条件に合うカードはありません">
                    <p>復習期限・お気に入りの絞り込みを変更してください。</p>
                  </Empty>
                </Panel>
              )}
            </>
          )}
          {page === "history" && (
            <Panel>
              <h2>回答履歴（全コース）</h2>
              {data.attempts.length ? (
                <ol className="history-list">
                  {[...data.attempts].reverse().map((a) => {
                    const q = catalog.find((q) => q.id === a.questionId);
                    const trusted = q && canPublish(q);
                    return (
                      <li key={a.id}>
                        <span
                          className={`result-label ${a.correct ? "is-correct" : "is-wrong"}`}
                        >
                          {a.correct ? "正解" : "不正解"}
                        </span>
                        <div>
                          <p>
                            {q?.prompt ??
                              `現在の教材にない問題：${a.questionId}`}
                          </p>
                          <small>
                            {new Date(a.answeredAt).toLocaleString("ja-JP")} /{" "}
                            {a.mode ?? "旧履歴"} /{" "}
                            {!trusted
                              ? "未確認教材・到達度から除外"
                              : `FP${q.grade}級 ${examNames[q.exam]}`}
                          </small>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              ) : (
                <Empty title="まだ回答履歴はありません">
                  <p>
                    確認済み教材を解くと、ここに正誤と解答日時が記録されます。
                  </p>
                </Empty>
              )}
            </Panel>
          )}
          {page === "saved" && (
            <div className="two-column">
              <Panel>
                <h2>ブックマーク {data.bookmarks.length}件</h2>
                {data.bookmarks.length ? (
                  <ul className="plain-list">
                    {data.bookmarks.map((id) => (
                      <li key={id}>
                        <span>
                          {catalog.find((q) => q.id === id)?.prompt ?? id}
                        </span>
                        <Button
                          variant="quiet"
                          disabled={saving}
                          onClick={() => void bookmark(id)}
                        >
                          解除
                        </Button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <Empty title="気になる問題を手元に">
                    <p>演習画面の☆ボタンで保存できます。</p>
                  </Empty>
                )}
              </Panel>
              <Panel>
                <h2>間違いノート {data.notes.length}件</h2>
                {data.notes.length ? (
                  data.notes.map((n) => (
                    <article className="note-card" key={n.id}>
                      <h3>
                        {catalog.find((q) => q.id === n.questionId)?.prompt ??
                          n.questionId}
                      </h3>
                      <p>{n.text || "メモは空です。"}</p>
                      <small>
                        {new Date(n.updatedAt).toLocaleString("ja-JP")}
                      </small>
                    </article>
                  ))
                ) : (
                  <Empty title="理解を、自分の言葉で">
                    <p>解説画面でメモを残すと、ここで振り返れます。</p>
                  </Empty>
                )}
              </Panel>
            </div>
          )}
          {page === "plan" && (
            <PlannerPanel data={data} saving={saving} update={update} />
          )}
          {page === "settings" && (
            <SettingsPanel
              data={data}
              saving={saving}
              update={update}
              exportBackup={exportBackup}
              importBackup={importBackup}
            />
          )}
          <footer>
            <strong>FP Master</strong>
            <p>
              個人の目標：正答率95%以上。公式合格基準と区別して表示します。
              <br />
              教材確認中 /
              完全網羅・合格・目標達成を保証するものではありません。
            </p>
            <button onClick={() => navigate("settings")}>バックアップ ↗</button>
          </footer>
        </main>
      </div>
      <nav className="mobile-nav" aria-label="モバイルメニュー">
        {navigation
          .filter((n) =>
            ["home", "practice", "review", "analytics"].includes(n.id),
          )
          .map((n) => (
            <button
              key={n.id}
              aria-current={page === n.id ? "page" : undefined}
              onClick={() => navigate(n.id)}
            >
              <span aria-hidden="true">{n.icon}</span>
              {n.id === "analytics" ? "成績" : n.label}
            </button>
          ))}
        <button aria-expanded={more} onClick={() => setMore(!more)}>
          <span aria-hidden="true">•••</span>その他
        </button>
      </nav>
      {more && (
        <div className="more-menu">
          <div className="section-row">
            <strong>学習メニュー</strong>
            <Button variant="quiet" onClick={() => setMore(false)}>
              閉じる ×
            </Button>
          </div>
          {navigation
            .filter(
              (n) =>
                !["home", "practice", "review", "analytics"].includes(n.id),
            )
            .map((n) => (
              <button key={n.id} onClick={() => navigate(n.id)}>
                {n.icon} {n.label}
              </button>
            ))}
        </div>
      )}
      {term && (
        <Dialog title={term.name} onClose={() => setTerm(null)}>
          <p className="caption">{term.reading}</p>
          <p>
            <strong>{term.summary}</strong>
          </p>
          <p>{term.detail}</p>
          <h3>具体例</h3>
          <p>{term.example}</p>
          <h3>適用条件</h3>
          <p>{term.conditions}</p>
          <ul>
            {term.figures.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
          <p className="caption">
            法令基準日：{term.legalDate} / 確認日：{term.verifiedAt}
          </p>
          {term.sources.map((s) => (
            <p key={s.url}>
              <a href={s.url} target="_blank" rel="noreferrer">
                {s.title} ↗
              </a>
            </p>
          ))}
          <Button
            variant="secondary"
            onClick={() => {
              setTerm(null);
              navigate("practice");
              setMessage(
                `関連問題ID：${term.relatedQuestions.join("、") || "未収録"}。問題一覧は確認済み教材に限定されます。`,
              );
            }}
          >
            関連問題を確認
          </Button>
        </Dialog>
      )}
    </div>
  );
}
