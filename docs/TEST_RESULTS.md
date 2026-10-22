# TEST RESULTS（2026-10-22）
| 種別 | 結果 |
|---|---|
| tsc -b | エラーなし |
| Vitest（unit/integration/data） | 99 passed |
| vite build（PWA プリキャッシュ370件・約14MB） | 成功 |
| Playwright iPhone+desktop（機能27件＋a11y 30件）×2 | 88 passed |

重点検証：通常演習（100問ノック×3級/2級）に計算問題が混入しない／模擬試験は公表セットの計算問題をすべて含む／
DBを開き直しても履歴保持／未検証問題は出題されない（実データの隔離が0件のため、隔離扱いの複製を混ぜて検証）／
破損バックアップ拒否・途中失敗時ロールバック／オフライン起動／解説の正解が公式正答と一致（○×・択一の第1解答欄）。

a11y：axe-core で主要15画面×ライト/ダークを検査し、違反0件（自動検査で拾える範囲のみ。スクリーンリーダー等の手動確認は未実施）。

Lighthouse（vite preview・モバイル設定・開発機で計測）：Performance 84〜85 / Accessibility 100 / Best Practices 100 / SEO 100（解説データの遅延読み込み後。前は Performance 75）。

未実施・限界：実機（iPhone Safari）での確認、公開URL上での動作確認。Playwright のオフライン起動テストは並列実行で1回だけ不安定だったことがある（単独・全体再実行では合格）。
