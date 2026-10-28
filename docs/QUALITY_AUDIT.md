# 品質監査（2026-10-28）

範囲：機能・採点・計算・UI/UX・a11y・性能・セキュリティ・PWA/オフライン・データ保護・テスト・コード品質。**実行して確認したものと、未確認のものを分けて記載**。

| 領域 | 実施内容 | 結果 |
|---|---|---|
| 機能（演習・模試・計算・復習・95%チャレンジ） | Playwright 全件（iPhone+desktop）、新規 challenge.spec | 合格（`TEST_RESULTS.md`） |
| 採点 | Vitest（単一/複数小問/数値）、実技ケースの数値は問題作成時に Python で独立再計算し、レビューで再々計算 | 合格 |
| 通常演習への計算問題混入防止 | e2e 100問ノック×2級/3級、非四択追加後も維持。模試は`tags:四択以外`のみ除外（計算問題は含む） | 合格 |
| UI/UX（320/375/768px） | 16画面で横スクロールなし（responsive.spec） | 合格。目視の文字サイズ・操作性は実機未確認 |
| a11y | axe-core（WCAG 2.x A/AA）を主要16画面×light/dark | 違反0。手動（スクリーンリーダー・キーボード）は未実施 |
| 性能 | 起動0.29s(desktop)/0.70s(CPU4倍)、問題データ gzip約0.3MB、解説は遅延 | 許容。実機・低速回線は未計測 |
| セキュリティ | meta CSP 導入（default-src 'self'、script-src 'self'、connect-src 'self'、object-src 'none'）、危険API(innerHTML/eval/fetch)の使用なし、外部通信なし、npm audit 0件 | 修正済（I-001） |
| PWA/オフライン | e2e オフライン起動・演習 | 合格 |
| データ保護 | IndexedDB削除なし、バックアップ往復e2e・破損拒否テスト | 合格 |
| コンテンツ | 敵対的レビューで多数の問題を修正・削除（`CONTENT_AUDIT.md`） | 実施済 |

総括：重大(Critical/High)な不具合は検出せず。検出事項は `ISSUE_REGISTER.md`。
