import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, expect, it, vi } from "vitest";
import { createLearningState } from "../storage/types";
import { SettingsPanel } from "./SettingsPanel";

const now = "2026-10-20T10:00:00.000Z";

beforeAll(() => {
  // jsdom does not implement native modal dialog methods.
  HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  HTMLDialogElement.prototype.close = function () { this.open = false; };
});

function backup(bookmark: string): string {
  return JSON.stringify({
    app: "fp-master",
    formatVersion: 1,
    exportedAt: now,
    state: { ...createLearningState(now), bookmarks: [bookmark] },
  });
}

it("restores only the inspected backup and cancels the preview when input changes", async () => {
  const user = userEvent.setup();
  const importBackup = vi.fn(async () => ({
    attemptsAdded: 0,
    bookmarksAdded: 1,
    notesAdded: 0,
    reviewsAdded: 0,
    cardsAdded: 0,
    state: createLearningState(now),
  }));
  render(
    <SettingsPanel
      data={createLearningState(now)}
      saving={false}
      update={vi.fn(async () => true)}
      exportBackup={vi.fn(async () => backup("q-a"))}
      importBackup={importBackup}
    />,
  );
  const input = screen.getByRole("textbox", { name: "またはJSONを貼り付け" });
  const first = backup("q-a");
  const second = backup("q-b");
  fireEvent.change(input, { target: { value: first } });
  await user.click(screen.getByRole("button", { name: "復元内容を確認" }));
  expect(screen.getByRole("dialog")).toHaveTextContent("ブックマーク 1件");

  // A pending file read or another input event can arrive while the dialog is open.
  fireEvent.change(input, { target: { value: second } });
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(importBackup).not.toHaveBeenCalled();

  await user.click(screen.getByRole("button", { name: "復元内容を確認" }));
  await user.click(screen.getByRole("button", { name: "統合して復元する" }));
  await waitFor(() => expect(importBackup).toHaveBeenCalledTimes(1));
  expect(importBackup).toHaveBeenCalledWith(second);
});

it("ignores a stale file read after the learner pastes another backup", async () => {
  let finishRead: (json: string) => void = () => {};
  const pendingRead = new Promise<string>((resolve) => {
    finishRead = resolve;
  });
  render(
    <SettingsPanel
      data={createLearningState(now)}
      saving={false}
      update={vi.fn(async () => true)}
      exportBackup={vi.fn(async () => backup("q-a"))}
      importBackup={vi.fn()}
    />,
  );
  const input = screen.getByRole("textbox", { name: "またはJSONを貼り付け" });
  fireEvent.change(screen.getByLabelText("JSONファイルを選択"), {
    target: { files: [{ size: 10, text: () => pendingRead }] },
  });
  const pasted = backup("q-pasted");
  fireEvent.change(input, { target: { value: pasted } });
  await act(async () => {
    finishRead(backup("q-stale"));
    await pendingRead;
  });
  expect(input).toHaveValue(pasted);
});
