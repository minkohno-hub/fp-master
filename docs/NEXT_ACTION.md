# NEXT ACTION（再開手順）
最終更新：作業中断時点。直近コミットまでテスト・ビルドとも通過（tsc / Vitest 99件 / build）。

## 現状
- 学科479問・3級実技60問・2級実技2025/2026年公表分80問は取込済みで、隔離（quarantined）は0件。
- 解説は全620問に作成済み（実技は目視した資料と公式正答の突き合わせ済み）。ただし根拠引用の照合済み（verified）は一部で、他は「要確認」表示。
- g2-202501-23（分数の選択肢）は原本PDFを目視で転記して隔離解除（overrides/g2_202501.json）。

## 次にやること（優先順）
1. `git push` 後、ユーザーが希望した場合のみ PR を作成（未作成。ユーザーの依頼なしに作らない）。
2. 実技解説（2級2025/2026・3級）の根拠照合：evidence を追加して verified を増やす（scripts/content/explanations_src.py → build_content.py）。
3. 2級実技 紙試験3回分（j2_202405 / 202409 / 202501）の取込（形式が異なる）。
4. 標準・詳細モード用の長い解説（仕組み・具体例・暗記のコツ）の拡充。
5. draft の用語・カードへ evidence 追加。a11y 監査、Playwright 再実行（UI変更時）、docs/PROGRESS.md・TEST_RESULTS.md の更新。
6. PR マージ後の GitHub Pages 公開確認。

## 再開時の確認コマンド
`npx tsc -b --noEmit && npx vitest run && npm run build`
