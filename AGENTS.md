# AGENTS.md — FP Master 恒久開発ルール

このファイルは、AIエージェント（Codex / Claude など）が本リポジトリで作業するときの恒久ルールです。
**作業開始時は必ず、このファイル → `docs/NEXT_ACTION.md` → `docs/TASKS.md` → `docs/KNOWN_ISSUES.md` の順に読むこと。**

## 1. プロジェクトの目的
日本FP協会のFP技能検定 2級・3級（学科＝FP協会・きんざい共通、実技＝FP協会「資産設計提案業務」のみ）に対応した、
iPhone・PCで使える個人学習用Webアプリ（GitHub Pages で公開する静的PWA）。
最重要目標は「スマートフォンで気軽にFPを学べる、高品質で信頼性の高い総合学習アプリ」。最終仕様の要約は `docs/MASTER_PLAN.md`。

## 2. 絶対に守る原則
- **A 手軽さ最優先**：アプリを開いてから問題を解き始めるまでの操作を最小にする（ホームの「すぐに5問解く」）。
- **B 計算問題は分離**：通常演習は `requiresCalculation=false` の問題のみ（設定「通常演習にも計算問題を含める」は初期OFF）。
  計算問題は「計算トレーニング」へ。**模擬試験は設定に関係なく計算問題を含める。**
  `requiresCalculation` は「解答に計算操作が必要か」で判定し、数値が出てくるだけの知識問題は false（判定理由を `calcReason` に書く）。
- **C 正確性最優先**：誤った正答・根拠のない解説・古い法令情報を検証済みとして表示しない。
  - 公式問題の正答は日本FP協会の公表解答と照合したもののみ。抽出が不明瞭な問題は `status: quarantined`（出題しない）。推測で補完しない。
  - 解説・用語・カードは `reviewStatus`（verified=根拠引用を公式ページで照合済み / draft=要確認と表示）。
  - AIが検出した情報だけで正答・法令内容を書き換えない。変更候補 → 根拠確認 → 影響分析 → テスト → 承認 の順。
- **D 自律開発**：技術的判断は自分で行い記録する（`docs/DECISIONS.md`）。
- **E 品質＞速度**、**F 機能を削らない**（制約がある場合は代替設計・段階実装し、未完成は未完成と記録）。

## 3. 承認なしに行ってはいけないこと
有料サービス契約・追加費用、重要データの削除、非公開データの外部公開、許諾範囲が不明なコンテンツの公開、
秘密情報の外部送信、危険な権限変更。第三者の教材・有料問題集の内容は転載しない。

## 4. 著作権・出典
- 日本FP協会の試験問題は「FP技能検定の試験問題の利用について」（https://www.jafp.or.jp/exam/mohan/files/exam_riyou.pdf ）に従い、
  申請不要で利用可。**出典を必ず明記**し、修正・加工した場合は「加工して作成」と明記する（`source.citation` / `source.modified`）。
- オリジナル問題は `source.kind: original` とし、UIで「オリジナル問題」と明示する。公式問題と誤認させない。

## 5. 技術構成とディレクトリ
React 19 + TypeScript + Vite 8 + Tailwind CSS 4 + Dexie(IndexedDB) + Zod 4 + KaTeX + vite-plugin-pwa / Vitest + Playwright。
```
src/domain/      純粋ロジック（採点・SM-2・出題選択・模擬試験・統計・到達度・計画・厳密計算・計算問題生成器）※UI非依存
src/db/          Dexie スキーマ・リポジトリ・バックアップ
src/content/     問題データ(JSON)・用語集・カード・改正情報（生成物。手で直接編集しない）
src/state/ src/ui/ src/pages/   画面
scripts/import/  公式PDF→問題JSON（extract_gakka.py）＋レビュー結果 overrides/<set>.json
scripts/content/ 用語・カード・改正情報の原稿（*_src.py）→ build_content.py で生成＋根拠照合
scripts/sources/ 公式ページの変更検知
tests/unit tests/integration tests/data   e2e/
```

## 6. データ更新の手順
- 問題：`python3 -I scripts/import/extract_gakka.py [set_id]`。レビュー結果（計算判定・隔離解除・図表切り出し・テーマ修正）は
  `scripts/import/overrides/<set_id>.json` に書く（生成JSONを直接編集しない）。
- 用語・カード・改正：`scripts/content/*_src.py` を編集 → `python3 -I scripts/content/build_content.py`（ネットワークで根拠照合）。
- 実行後は必ず `npx vitest run`（データ検証を含む）。

## 7. 学習データの保護
- IndexedDB のDB削除・作り直しは禁止。スキーマ変更は `db.version(n+1)` と upgrade 関数で既存データを移行し、
  `DB_SCHEMA_VERSION` とバックアップの `migrateBackup` を更新、移行テストを追加する。
- バックアップ形式の後方互換を維持する。

## 8. 作業ループと完了条件
調査 → 設計 → 実装 → テスト → 修正 → 再テスト → コミット → 進捗更新（docs/）→ 次のタスク。
コミット前に必ず：`npx tsc -b --noEmit && npx vitest run && npm run build`。UI変更時は `npx playwright test`
（ローカルでは `PLAYWRIGHT_CHROMIUM_PATH` で既存Chromiumを指定可）。
「実装済み」と「検証済み」を区別して `docs/PROGRESS.md` / `docs/TEST_RESULTS.md` に記録する。検証が通るまで完成扱いにしない。

## 9. 中断への備え
区切りごとに `docs/PROGRESS.md`・`docs/NEXT_ACTION.md`・`docs/KNOWN_ISSUES.md` を更新してコミット。
処理できなかった作業は完了扱いにしない。作業ブランチで開発し、main へは Pull Request で統合する（自動マージはしない）。
