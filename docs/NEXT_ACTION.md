# 次回の再開手順

1. `AGENTS.md`、`REQUIREMENTS.md`、`PROGRESS.md`、`TASKS.md`、`KNOWN_ISSUES.md`、`TEST_RESULTS.md`を読む。
2. `/workspace/fp-master` のoriginが `https://github.com/minkohno-hub/fp-master.git` であること、ブランチ・差分・最新コミットを確認する。既存作業を上書きせず、追加worktreeを作らない。
3. 現行 `package.json` のスクリプトとNode版を確認し、`npm ci` 後にLint・型チェック・単体/結合テスト・本番ビルドを実行。Playwright用Chromiumがある環境ではE2Eも実行。失敗原因を切り分ける。
4. 公式サイトアクセスが許可された場合、`SOURCE_POLICY.md` のURLを読み取りで再試行。本文・PDFを取得して初めて、4区分の問題数・形式・時間・配点・合格基準・基準日・CBT仕様と利用条件を確定する。
5. 公式全範囲を版付き論点台帳へ落とし、公開可能な確認済み教材を追加する。構造検証の成功だけで確認済みにしない。旧サンプルは `src/data/quarantine.ts` に隔離を維持。本番 `src/data/catalog.ts` は検証済み教材だけ。
6. 優先未完タスクから実装を進める。教材が0件の間も、出題・採点・復習・計算・分析・保存・復元のコードはテスト専用fixtureで検証できる。fixtureを本番教材へ混ぜない。
7. スマホ/PC、キーボード、保存復元、オフライン、SW更新後の保持を実測する。合成fixtureでの5/100問は確認済み。本番の5/20/100問は必要な教材が揃ってから実際に確認し、未実施を残す。
8. 結果を `TEST_RESULTS.md`、教材件数と分母を `DATA_COVERAGE.md`、残作業を本書と `TASKS.md` に保存してコミット・pushする。PR作成は `api.github.com` の既存認証で再試行する。

## 外部で必要な操作

- 公式資料調査に必要な `www.jafp.or.jp` へのネットワーク許可。設定反映後に実際の取得を確認する。
- PR APIはForbiddenで、現行 `GH_TOKEN` は `gh auth status` で無効と報告された。設定の公開・反映後にAPIへの到達とプラットフォーム認証を再確認し、PR作成を再試行する。秘密値をチャットで求めない。作業ブランチはpush済みで、`git ls-remote` による参照確認も済んでいる。
- 公開する場合は許諾と教材確認を完了し、手動Pagesデプロイ後に実URL・assets・PWAを確認する。未公開URLを作って報告しない。

この文書は再開の起点です。最後のコミットはGit履歴、テスト結果は `TEST_RESULTS.md` を参照してください。
