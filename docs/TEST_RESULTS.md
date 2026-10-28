# TEST RESULTS（2026-10-28）
実行したものだけを記載する。未実施は末尾に明記。

| 種別 | 結果 |
|---|---|
| tsc -b --noEmit | エラーなし |
| Vitest（10ファイル） | 123 passed |
| vite build（PWAプリキャッシュ404件・約17.2MB） | 成功 |
| Playwright iPhone+desktop 全件 | 下記「Playwright」参照 |
| npm audit --omit=dev | 脆弱性 0 |

## Playwright（本日追加分）
- `e2e/challenge.spec.ts`：95%チャレンジ（保証しない旨の表示／高難度モード開始→オリジナル表示／初見の正答率が記録・表示／a11y light・dark）
- `e2e/security.spec.ts`：meta CSP 導入後のCSP違反なし、外部ホストへの通信なし
- `e2e/responsive.spec.ts`：幅320/375/768pxで16画面に横スクロールなし
- 既存の `answerCurrent` を複数小問（語群補充：全解答欄＋「解答する」）に対応。**初回実行で「100問ノック」が4分タイムアウトした実バグではなくテスト側の不備**（学科の非四択が混入した）。修正後、同テストを連続2回実行して合格。

## 計測（vite preview・開発機・CPUスロットリング4倍はiPhone相当の目安）
- 起動（ホームの主ボタン表示まで）：desktop 約0.29秒／CPU4倍 約0.70秒、読み込みファイル61件、JSヒープ約11MB
- 問題データ（起動時に全セット読み込み）：生1.9MB／gzip約0.3MB。解説データ(約2.2MB)は遅延読み込み
- ※ネットワーク遅延は含まない。実機（iPhone Safari）・公開URL上の計測は未実施

## データ検証（Vitest内）
FP2オリジナル579問：スキーマ適合・ID一意・全四択に4肢の解説・解説verified・正答位置均衡・非四択の形式要件。

## 未実施・限界
実機iPhone確認、Lighthouse再計測（前回: Performance 84〜85 / A11y 100 / BP 100 / SEO 100）、スクリーンリーダー等の手動a11y確認、公開URL上の動作確認（PRマージ後に実施）。
