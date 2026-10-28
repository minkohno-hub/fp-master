"""FP2級オリジナル問題（四答択一）の作成フレームワーク。

- 問題はPythonの原稿（バッチ）として書く。全選択肢に「判定（適切/不適切）・解説・根拠の引用」を必ず付ける。
- 根拠の引用は公式ページ（e-Gov法令検索・国税庁・公的機関）の本文に実在する文言のみ。build_content.py が本文と照合し、
  一つでも見つからない問題は解説が「要確認」になり、データ検証テストが失敗する（＝検証済みとして公開されない）。
- 正答位置はバッチごとに均等になるよう決定的に割り当てる（公開後は動かさない）。
"""
from .core import C, Q, Batch, all_batches, law_source, register_sources  # noqa: F401
from .cases import NUM, SEL, TF, T, X, Case_, CaseBatch  # noqa: F401,E402
