# NEXT ACTION（再開手順）— 2026-10-28 18:30 UTC 時点で中断
ユーザー指示で中断中。再開は「続けて」の指示を受けてから。ブランチ `claude/fp-master-learning-app-76z7in`（PR #6 マージ後に main から作り直し）。最終コミットまで push 済み。

## 進行中の作業（中断時点）
### A. 追加仕様「専門用語集の拡充と問題文リンク自動連携」（`docs/TERM_LINK_SPEC.md`）— 実装中
実装済み（コミット済み・tsc/vitest/Playwright通過）：
- 自動リンクエンジン `src/domain/termlink.ts`（最長一致・境界判定・別名・全角半角・文脈 requireAny・衝突回避）と単体テスト。
- 共通ポップアップ（`src/ui/TermText.tsx`、Layoutに1つ）：スマホ=ボトムシート、1100px以上=サイドパネル、お気に入り、関連用語、前の用語へ、Esc/フォーカス復帰、解答前は brief（概念のみ）。
- リンク適用：問題文・選択肢（`QuestionView`）・解説各欄・計算の説明・使い方ページ（`/help`）。関連用語は自動リンクから自動導出。
- 用語集ページ：読み仮名/カナ/別名検索、級・分野・重要度・お気に入り・未学習、五十音ジャンプ。用語詳細：数字・例外・比較・元の画面へ戻る。暗記カード：お気に入り用語モード。
- TermSchema 拡張（numbers/exceptions/compare/topics/lawBaseDate/linkRule）。基礎控除・給与所得控除を年分別の表で verified に修正（`g3-202605-20` の解説も）。
- テスト：`tests/unit/termlink.test.ts`、`tests/data/terms.test.ts`（`TERM_REPORT=1` で `docs/TERM_LINK_REPORT.md` を生成）、`e2e/terms.spec.ts`。
未完（拡充用語の執筆）：`scripts/content/terms_ext/{a1,a2,b1,b2,c1,c2,d1,d2,e1,e2,f1,f2}.py`（手順は `scripts/content/TERM_AUTHORING.md`、検証は `cd scripts/content && python3 check_terms.py <名前>`）。
- 完了：a2（42語）、b1（50語、check 0エラー）。
- 途中（rate limit で停止、ファイルは保存済み）：a1（short に年齢等の数値が残るエラーあり）、b2。未着手/ファイル未作成：c1, c2, d1, d2（エージェントは起動したが保存前に停止した可能性）、e1, e2, f1, f2。
- **注意**：途中の terms_ext ファイルがあると `build_content.py` が検証エラーで止まる。a1/b2 などを `check_terms.py` で 0 エラーにしてから `python3 -I scripts/content/build_content.py`（約5分）を実行する。
再開手順：rate limit 解除後、各担当エージェントに SendMessage で続行を依頼（または新規エージェントで同ファイルを引き継ぐ）→ 全ファイル 0 エラー → build_content → `npx tsc -b --noEmit && npx vitest run && npm run build` → `TERM_REPORT=1 npx vitest run tests/data/terms.test.ts` → Playwright 全件 → docs（用語数・verified 件数・リンク対応率・未対応用語・既存用語の修正件数＝基礎控除/給与所得控除の2件）→ PR。

### B. FP2 問題拡充 第6波
- 執筆・レビュー済み・未ビルド：a06(13)、c06(17)、d06(16)、f06(14)（各 `scripts/original/fporig/batches/`）。
- j02（実技高難度ケース18件）：執筆済み、レビューが rate limit で中断。再レビュー後に build。
- 次：build_content → `python3 -I scripts/audit/fp2_audit.py` → `python3 -I scripts/audit/gen_fp2_docs.py` → docs 更新。
- 以降の候補：未カバー細目（`docs/FP2_COVERAGE_MATRIX.md`）、高難度ケース追加、b06/e06 等。

## 直近の確認状態
tsc OK／Vitest 全件OK／Playwright 全件OK（用語ポップアップ・チャレンジ・CSP・横スクロール含む）。公開サイト（main）は PR #6 の内容。第6波以降は未デプロイ。

## 現状
- 全体：3級・2級の学科/実技を収録、公開サイトは GitHub Pages（PR #1〜#4 マージ済み）。**今回の拡充分（FP2 1,079問・95%チャレンジ・CSP等）は作業ブランチにあり、PR未作成**（ユーザーの指示があれば作成→CI→マージ→公開確認）。
- FP2：総数1,079（学科861／実技218）。公式500＋オリジナル579（四択553＋実技ケース18＋学科非四択8）。数値は `python3 -I scripts/audit/fp2_audit.py` で再現可能。詳細は `docs/FP2_*.md`。
- 95%チャレンジ（`#/challenge`）実装・e2e済み。品質監査は `docs/QUALITY_AUDIT.md`、課題は `docs/ISSUE_REGISTER.md`。

## 保留中の追加仕様
- `docs/TERM_LINK_SPEC.md`（専門用語集の大幅拡充と問題文リンクの自動連携）：**受領のみ・実装は「続けて」待ち**。

## 次にやること（優先順）
1. 未カバー細目（`docs/FP2_COVERAGE_MATRIX.md`、特にC分野）と高難度の実技ケース（I-006）を、公的根拠が取れる論点でオリジナル追加→敵対的レビュー→`python3 -I scripts/content/build_content.py`（約5分）→tsc/vitest/playwright。
2. ユーザー指示でPR作成→CI→マージ→ https://minkohno-hub.github.io/fp-master/ の確認。
3. 実機iPhone確認・Lighthouse再計測・手動a11y（ユーザー協力）。
4. 問題が2,000規模を超える前に遅延読込/プリキャッシュ分割を検討（I-004/I-005）。

## 再開時の確認コマンド
`npx tsc -b --noEmit && npx vitest run && npm run build`、UI変更時は `PLAYWRIGHT_CHROMIUM_PATH=/opt/pw-browsers/chromium-1194/chrome-linux/chrome npx playwright test`

## 制限・メモ
- オリジナル問題の追加手順：`scripts/original/AUTHORING.md`（四択は fporig.core、実技ケース/非四択は fporig.cases）。
- 国税庁・e-Gov・FP協会等の根拠は `build_content.py` が実ページ原文と照合。基準日 2026-04-01 以降の改正・年度別金額に依存する問題は作らない。
