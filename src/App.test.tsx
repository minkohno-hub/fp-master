import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it } from "vitest";
import { App } from "./App";
import { materialFixture, topicFixture } from "./domain/fixtures.test-helper";
import { openLearningStore } from "./storage/store";
const fixture = materialFixture();
async function ready() {
  await screen.findByRole("heading", { name: "今日の一問から、確かな力へ。" });
}
it("does not ship unverified sample exercises and does not fabricate coverage", async () => {
  const user = userEvent.setup();
  render(<App />);
  await ready();
  await user.click(screen.getByRole("button", { name: "すぐに5問解く →" }));
  expect(
    screen.getByRole("heading", { name: "確認済みの出題候補がありません" }),
  ).toBeVisible();
  expect(
    screen.getByRole("button", { name: "0問の通常演習を開始 →" }),
  ).toBeDisabled();
  await user.click(screen.getByRole("button", { name: "教材の収録状況へ" }));
  expect(screen.getAllByText("算定不能").length).toBeGreaterThan(0);
});
it("persists an answer, explanation, bookmark, rating, pause and resume", async () => {
  const user = userEvent.setup();
  let view = render(<App catalog={[fixture]} topics={[topicFixture()]} />);
  await ready();
  await user.click(screen.getByRole("button", { name: "すぐに5問解く →" }));
  expect(
    screen.queryByText(fixture.explanation.concise),
  ).not.toBeInTheDocument();
  await user.click(await screen.findByRole("button", { name: "1 A" }));
  expect(
    await screen.findByRole("heading", { name: "理解を深めるチャンス" }),
  ).toBeVisible();
  await user.click(screen.getByRole("button", { name: "☆ ブックマーク" }));
  expect(
    await screen.findByRole("button", { name: "★ ブックマーク済み" }),
  ).toBeVisible();
  await user.click(screen.getByRole("button", { name: "詳細" }));
  expect(screen.getByText(fixture.choiceExplanations[0])).toBeVisible();
  await user.click(screen.getByRole("button", { name: "曖昧" }));
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "曖昧" })).toHaveAttribute(
      "aria-pressed",
      "true",
    ),
  );
  await user.type(screen.getByLabelText("間違いノート"), "復習したい論点");
  await user.click(screen.getByRole("button", { name: "ノートを保存" }));
  await screen.findByText("ノートを保存しました。");
  view.unmount();
  view = render(<App catalog={[fixture]} topics={[topicFixture()]} />);
  await ready();
  await user.click(screen.getByRole("button", { name: "続きを再開 →" }));
  expect(
    await screen.findByRole("heading", { name: "理解を深めるチャンス" }),
  ).toBeVisible();
  await user.click(screen.getByRole("button", { name: "結果を見る →" }));
  await screen.findByText("1問中0問正解。0%でした。");
  const store = await openLearningStore();
  const state = await store.load();
  store.close();
  expect(state.attempts).toHaveLength(1);
  expect(state.bookmarks).toEqual([fixture.id]);
  expect(state.notes[0].text).toBe("復習したい論点");
  expect(state.reviews[0].reviewCount).toBe(1);
  expect(state.session).toBeNull();
});
it("separates ordinary and numeric calculation practice and records numeric responses", async () => {
  const q = materialFixture({
    id: "calc-test",
    kind: "calculation",
    format: "numeric",
    choices: [],
    choiceExplanations: [],
    grading: {
      type: "numeric",
      expected: "0.3",
      decimalPlaces: 1,
      rounding: "half-up",
      unit: "円",
    },
    explanation: { ...fixture.explanation, formula: "0.1+0.2" },
  });
  const user = userEvent.setup();
  render(<App catalog={[q]} topics={[topicFixture()]} />);
  await ready();
  await user.click(
    within(
      screen.getByRole("navigation", { name: "メインメニュー" }),
    ).getByRole("button", { name: "計算トレーニング" }),
  );
  await user.click(
    screen.getByRole("button", { name: "1問の計算トレーニングを開始 →" }),
  );
  await user.type(screen.getByLabelText("数値で回答（円）"), "0.3");
  await user.click(screen.getByRole("button", { name: "回答する" }));
  expect(
    await screen.findByRole("heading", { name: "正解です" }),
  ).toBeVisible();
  const store = await openLearningStore();
  const state = await store.load();
  store.close();
  expect(state.attempts[0].response).toBe("0.3");
  expect(state.attempts[0].mode).toBe("calculation");
});
it("calculates exact decimal sums and rejects division by zero", async () => {
  const user = userEvent.setup();
  render(<App />);
  await ready();
  await user.click(
    within(
      screen.getByRole("navigation", { name: "メインメニュー" }),
    ).getByRole("button", { name: "計算トレーニング" }),
  );
  await user.type(screen.getByLabelText("数値A"), "0.1");
  await user.type(screen.getByLabelText("数値B"), "0.2");
  await user.click(screen.getByRole("button", { name: "計算する" }));
  expect(screen.getByRole("status")).toHaveTextContent("0.3");
  await user.selectOptions(screen.getByLabelText("演算"), "÷");
  await user.clear(screen.getByLabelText("数値B"));
  await user.type(screen.getByLabelText("数値B"), "0");
  await user.click(screen.getByRole("button", { name: "計算する" }));
  expect(screen.getByRole("status")).toHaveTextContent("0では割れません");
});
