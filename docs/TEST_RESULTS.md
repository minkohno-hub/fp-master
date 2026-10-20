# テスト結果

更新日: 2026-10-21。作業ブランチ `feat/fp-learning-foundation`、Node.js 24.19.0 / npm 11.9.0。下記は今回のコードに対して実行した結果であり、教材の正確性や実機での動作を保証しない。

| 項目 | 実測結果 | 確認した範囲 |
| --- | --- | --- |
| `npm ci` | 成功 | lockfileから依存を再インストール |
| `npm run lint` | 成功 | ESLint全対象 |
| `npm run build` | 成功 | TypeScript参照ビルドとVite本番ビルド、PWAのService Worker生成 |
| `npm test` | 16ファイル、79件成功 | 出題分離、選択/数値採点、整数精度計算、端数、復習日、分析、模試エンジン、教材ゲート、法改正候補監査、IndexedDB保存/移行/競合、バックアップの正常/異常系など |
| `npm audit --audit-level=low` | 脆弱性0件 | インストール済み依存のnpm報告 |
| `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:e2e` | 16件成功 | 本番ビルドとテスト専用fixtureをPC/モバイル相当Chromiumで検証 |
| `git diff --check` | 成功 | 空白エラーなし |

E2Eの内訳は、実アプリのPagesサブパス・manifest・横はみ出し・オフライン再起動・未確認問題0件・テーマ永続化・JSON復元が6件、合成教材fixtureでの5問演習/中断再開/履歴、計算、用語/カード、キーボード操作が8件、重複も計算混入もない100問連続演習がPC/モバイル各1件。fixtureの100問や用語は本番教材へ含めない。

幅320/390/1440pxのローカルChromiumで画面を確認し、横はみ出しと実行時エラーは見つからなかった。幅320px、高さ700pxではホームの「すぐに5問解く」ボタンが初期表示内にある。ローカル本番プレビューのウォームリロード5回のDOMContentLoaded中央値は、幅320pxで34.6ms、390pxで31.4ms、1440pxで30.6ms。これらは同一マシン・キャッシュ済み条件の参考値で、実回線の初回表示速度ではない。

IndexedDBを用いた履歴・設定の保持、復元失敗時のロールバック、旧localStorageからの非破壊移行は自動テストで確認した。Service Worker取得後のオフライン起動はE2Eで確認した。異なるアプリ版のService Worker更新をまたぐ実ブラウザでのデータ保持は未実施で、保存層の版互換・移行テストのみ実施した。

実機iPhone Safari、Android、Windows/macOSの各ブラウザ、WCAG 2.2 AA監査、GitHub Pagesでの実配信は未検証。公式ページ本文はHTTPS CONNECT 403で取得できず、公式正答・現行法令・転載許諾の原典照合は0件。構造テストの成功を確認済み教材数へ加算しない。
