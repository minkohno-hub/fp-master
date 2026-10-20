import { useRef, useState } from "react";
import { Button, Dialog, Panel } from "../components/ui";
import { parseBackup, MAX_BACKUP_BYTES } from "../storage/validation";
import type { ImportSummary, LearningState } from "../storage/types";
interface Props {
  data: LearningState;
  saving: boolean;
  update: (change: (s: LearningState) => LearningState) => Promise<boolean>;
  exportBackup: () => Promise<string>;
  importBackup: (json: string) => Promise<ImportSummary>;
}
export function SettingsPanel({
  data,
  saving,
  update,
  exportBackup,
  importBackup,
}: Props) {
  const [text, setText] = useState(""),
    [message, setMessage] = useState(""),
    [preview, setPreview] = useState<{
      json: string;
      attempts: number;
      bookmarks: number;
      notes: number;
      reviews: number;
      cards: number;
      hasSession: boolean;
    } | null>(null),
    [working, setWorking] = useState(false);
  const fileReadId = useRef(0);
  async function download() {
    setWorking(true);
    try {
      const json = await exportBackup();
      const url = URL.createObjectURL(
        new Blob([json], { type: "application/json" }),
      );
      const a = document.createElement("a");
      a.href = url;
      a.download = `fp-master-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setMessage(
        "バックアップファイルを作成しました。ダウンロード先を確認してください。",
      );
    } catch (e) {
      setMessage(
        e instanceof Error ? e.message : "バックアップを作成できませんでした。",
      );
    } finally {
      setWorking(false);
    }
  }
  function inspect() {
    try {
      const doc = parseBackup(text);
      setPreview({
        json: text,
        attempts: doc.state.attempts.length,
        bookmarks: doc.state.bookmarks.length,
        notes: doc.state.notes.length,
        reviews: doc.state.reviews.length,
        cards: doc.state.cards.length,
        hasSession: doc.state.session !== null,
      });
      setMessage("");
    } catch (e) {
      setMessage(
        e instanceof Error ? e.message : "ファイルを確認してください。",
      );
    }
  }
  async function restore() {
    if (!preview) return;
    const inspectedJson = preview.json;
    setWorking(true);
    try {
      const result = await importBackup(inspectedJson);
      setMessage(
        `復元しました。追加した回答 ${result.attemptsAdded}件、ブックマーク ${result.bookmarksAdded}件。既存の設定は保持しました。`,
      );
      setPreview(null);
      setText("");
    } catch (e) {
      setPreview(null);
      setMessage(e instanceof Error ? e.message : "復元を取り消しました。");
    } finally {
      setWorking(false);
    }
  }
  return (
    <div className="stack">
      <Panel>
        <h2>表示と保存</h2>
        <label className="field">
          表示モード
          <select
            value={data.settings.theme}
            onChange={(e) => {
              const theme = e.currentTarget
                .value as LearningState["settings"]["theme"];
              void update((s) => ({
                ...s,
                settings: { ...s.settings, theme },
              }));
            }}
            disabled={saving}
          >
            <option value="system">端末の設定に合わせる</option>
            <option value="light">ライト</option>
            <option value="dark">ダーク</option>
          </select>
        </label>
        <p className="caption">
          学習履歴はIndexedDBに保存します。端末間の同期は行いません。端末やブラウザの変更前にバックアップしてください。
        </p>
        <dl className="info-list">
          <div>
            <dt>保存済み回答</dt>
            <dd>{data.attempts.length}件</dd>
          </div>
          <div>
            <dt>データ形式</dt>
            <dd>v{data.schemaVersion}</dd>
          </div>
          <div>
            <dt>最終保存</dt>
            <dd>{new Date(data.updatedAt).toLocaleString("ja-JP")}</dd>
          </div>
        </dl>
        {data.migration && (
          <p className="notice">
            以前の履歴 {data.migration.legacyAttemptCount}
            件を移行済みです。元のデータも保持しています。未確認サンプルの回答は到達度の計算に含めません。
          </p>
        )}
      </Panel>
      <Panel>
        <h2>バックアップ・復元</h2>
        <p>
          履歴、ブックマーク、ノート、復習予定、設定をJSONで保存します。復元は追加統合し、既存データを削除しません。同じIDで内容が異なる場合は全体を取り消します。
        </p>
        <Button onClick={() => void download()} disabled={saving || working}>
          JSONをエクスポート
        </Button>
        <hr />
        <label className="field">
          JSONファイルを選択
          <input
            type="file"
            accept="application/json,.json"
            disabled={working}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              const readId = ++fileReadId.current;
              setPreview(null);
              setText("");
              setMessage("");
              if (file.size > MAX_BACKUP_BYTES) {
                setMessage("ファイルの上限は5MiBです。");
                return;
              }
              void file
                .text()
                .then((json) => {
                  if (readId === fileReadId.current) setText(json);
                })
                .catch(() => {
                  if (readId === fileReadId.current)
                    setMessage("ファイルを読み込めませんでした。");
                });
            }}
          />
        </label>
        <label className="field">
          またはJSONを貼り付け
          <textarea
            rows={5}
            value={text}
            onChange={(e) => {
              fileReadId.current++;
              setText(e.target.value);
              setPreview(null);
            }}
            maxLength={MAX_BACKUP_BYTES}
          />
        </label>
        <Button
          variant="secondary"
          onClick={inspect}
          disabled={!text || working || saving}
        >
          復元内容を確認
        </Button>
        {message && (
          <p role="status" className="notice">
            {message}
          </p>
        )}
      </Panel>
      <Panel>
        <h2>オフラインとアプリ更新</h2>
        <p>
          初回の読み込み完了後は、保存済みのアプリと教材をオフラインで利用できます。更新は開いているタブをすべて閉じた後に適用され、履歴は保持されます。
        </p>
        <p className="caption">
          PWAのインストールは対応ブラウザのメニューから行ってください。iPhoneではSafariの共有メニューから「ホーム画面に追加」を選びます。
        </p>
      </Panel>
      {preview && (
        <Dialog
          title="バックアップを統合する"
          onClose={() => !working && setPreview(null)}
        >
          <p>
            バックアップ内の回答 {preview.attempts}件、ブックマーク {preview.bookmarks}
            件、ノート {preview.notes}件、復習予定 {preview.reviews}件、暗記カード {preview.cards}
            件を確認しました。{preview.hasSession ? "中断中の演習も含まれます。" : ""}
            重複は追加せず、競合があれば変更せず取り消します。
          </p>
          <p>
            テーマなどの既存設定は維持します。中断中の演習がなければバックアップの演習を復元します。異なる演習が既にある場合は全体を取り消します。
          </p>
          <div className="button-row">
            <Button onClick={() => void restore()} disabled={working}>
              統合して復元する
            </Button>
            <Button
              variant="secondary"
              onClick={() => setPreview(null)}
              disabled={working}
            >
              キャンセル
            </Button>
          </div>
        </Dialog>
      )}
    </div>
  );
}
