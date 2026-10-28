# 用語リンク レポート

> `TERM_REPORT=1 npx vitest run tests/data/terms.test.ts` が生成（手で編集しない）。

- 用語の総数：91（根拠照合済み 55／要確認 36）
- 自動リンクの対象外（用語集のみ）：0
- 自動リンクの表記数（名称・別名・表記ゆれ）：116
- 問題数：1386。問題文・選択肢に1つ以上の用語リンクがある問題：481（34.7%）
- 問題文・選択肢・解説のいずれにも現れない用語（未対応）：7
- 全問題＋全解説のリンク解析時間：83ms

## 未対応用語（本文に現れていない用語。別名の追加や、問題追加の候補）

- shotokuzei-sokusan 所得税の速算表（D）
- ichibutsu-yonka 公示価格・路線価・固定資産税評価額（E）
- choki-joto 長期譲渡所得・短期譲渡所得（E）
- sozoku-houki 相続の放棄・限定承認（F）
- sozokuzei-kiso-kojo 相続税の基礎控除（F）
- tokurei-zeiritsu 贈与税の特例税率（F）
- jojo-kabushiki-hyoka 上場株式の相続税評価（F）
