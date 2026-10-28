# NEXT ACTION（再開手順）
最終更新：2026-10-28。直近コミット時点で tsc エラーなし / Vitest 123 passed / build 成功 / Playwright 106 passed。

## 現状
- 全体：3級・2級の学科/実技を収録、公開サイトは GitHub Pages（PR #1〜#4 マージ済み）。**今回の拡充分（FP2 1,079問・95%チャレンジ・CSP等）は作業ブランチにあり、PR未作成**（ユーザーの指示があれば作成→CI→マージ→公開確認）。
- FP2：総数1,079（学科861／実技218）。公式500＋オリジナル579（四択553＋実技ケース18＋学科非四択8）。数値は `python3 -I scripts/audit/fp2_audit.py` で再現可能。詳細は `docs/FP2_*.md`。
- 95%チャレンジ（`#/challenge`）実装・e2e済み。品質監査は `docs/QUALITY_AUDIT.md`、課題は `docs/ISSUE_REGISTER.md`。

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
