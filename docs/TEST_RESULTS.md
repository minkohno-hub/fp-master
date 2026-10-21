# TEST RESULTS（2026-10-21）
| 種別 | 結果 |
|---|---|
| tsc -b | エラーなし |
| Vitest（unit/integration/data） | 98 passed |
| vite build（PWA プリキャッシュ65件） | 成功 |
| Playwright iPhone+desktop | 20 passed |

重点検証：通常演習（100問ノック×3級/2級）に計算問題が混入しない／模擬試験は公表セットの計算問題をすべて含む／
DBを開き直しても履歴保持／未検証問題は出題されない／破損バックアップ拒否・途中失敗時ロールバック／オフライン起動。
