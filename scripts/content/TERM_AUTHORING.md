# 用語の拡充手順（terms_ext）

1. `scripts/content/terms_ext/<名前>.py` を作り、`from termlib import TX, S` で `TERMS = [TX(...), ...]` を定義する。**自分の担当ファイルだけ**を編集する。
2. 既存の用語（`glossary_src.py` と他の terms_ext/*.py）と **id・名称・別名が重複しない**こと。`grep -rn "'名称'" scripts/content` で確認。重複する概念は新規作成せず、既存用語の `related`/`compare` で参照する（既存用語の id は変更しない）。
3. フィールド（TX の引数）：
   - `short`：初心者向けの簡潔な説明（12〜90字）。**具体的な数値・金額・期間・割合を書かない**（数値は numbers へ）。
   - `detail`：専門的な詳細解説（制度の趣旨・仕組み・対象・手続き・FP2級の論点まで。1〜3段落程度）。
   - `example`：具体例（数値は設例として明示）、`system`：関連する制度・法律名（条文番号まで）。
   - `numbers`：重要な数字・適用条件（箇条書き。出典の引用で裏づけること）、`exceptions`：例外規定・注意点、`compare`：類似用語との違い（(label, diff[, termId])）。
   - `formula`：関連する計算式 (名前, TeX)。`topics`：試験範囲細目キー（`scripts/original/syllabus_fp2.json` の key）。`grades`：(2,3) / (2,) / (3,)。
   - `aliases`：略称・別名・表記ゆれ（本文中に実際に現れうる形。2字以上。「年金」「保険」「税」のような一般語は登録しない）。`related`：関連用語の id（存在するものだけ）。
   - `link`：自動リンクの制御。`{'requireAny': ['語1','語2']}`＝本文にこれらの語があるときだけリンク（曖昧語）、`{'auto': False}`＝本文に自動リンクしない（用語集のみ）。**一般的な語・文脈で意味が変わる語**には必ず指定する。
4. **根拠**：`evidence=[(url, 引用文), ...]`。引用は出典ページ本文（空白除去後）に**逐語で含まれる**文字列。`numbers`/`exceptions`/`detail` の数値・要件・例外は、すべて引用で裏づけられるものだけを書く。引用で裏づけられない主張は書かない（FP2の定説であっても）。`sources=[S('タイトル', url)]` に evidence の URL を含める。
   - 使える出典：e-Gov法令（`https://laws.e-gov.go.jp/law/<法令ID>`、本文は `scripts/original/lawtext.py` で取得して逐語引用を確認）、国税庁タックスアンサー・通達、日本年金機構、厚労省、金融庁、財務省、日本銀行、JPX、日本証券業協会、投資信託協会（IMAJ）、生命保険協会・損保協会、国交省、法務省、中小企業庁など公的機関・業界団体の公式ページ。
   - 基準日 2026-04-01。基準日以降に改正される事項、毎年改定される金額は数値を書かず、出典を案内する。
5. 検証：`cd scripts/content && python3 -c "from terms_ext import <名前>"` でインポートエラーがないこと、`python3 check_terms.py <名前>` で構造検証と引用照合（ネットワーク）が 0 件になること。構文エラーのファイルを残さない。
6. 禁止：他者のファイルの編集、git操作、build_content.py の実行。
