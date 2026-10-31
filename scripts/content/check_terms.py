#!/usr/bin/env python3
"""用語集拡充ライン用チェッカー（check_batch.py の用語版）。

使い方: python3 -B -I scripts/content/check_terms.py glossary_x_a [glossary_x_b ...]

対象モジュールの X_TERMS について次を検証し、不一致件数を報告する：
- evidence の quote が出典ページ本文（build_content と同じ取得・整形）に含まれるか
- related の参照先が全用語集合に実在するか
- 照合用表記（正式名称・括弧除き・別名）が他の用語と衝突しないか（自動リンクの曖昧回避）
- id が全用語集合で重複しないか
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

import build_content as bc  # noqa: E402  (import で TERMS 等が組み上がる)
from termlink_py import Matcher, term_surfaces  # noqa: E402


def main() -> int:
    mods = sys.argv[1:]
    if not mods:
        print('モジュール名を指定してください（例: glossary_x_a）')
        return 2
    targets = []
    for name in mods:
        targets.extend(__import__(name).X_TERMS)
    all_ids = [t['id'] for t in bc.TERMS]
    dup = {i for i in all_ids if all_ids.count(i) > 1}
    matcher = Matcher(bc.TERMS)
    urls = sorted({e['url'] for t in targets for e in t['evidence']})
    texts = {}
    for u in urls:
        raw = bc.fetch(u)
        texts[u] = bc.page_text(raw) if raw else None
        if raw is None:
            print(f'取得失敗: {u}')
    bad = 0
    quotes = 0
    for t in targets:
        if t['id'] in dup:
            print(f"{t['id']}: ID が重複しています")
            bad += 1
        for r in t['related']:
            if r not in all_ids:
                print(f"{t['id']}: related の {r} が存在しません")
                bad += 1
        for key in term_surfaces(t):
            if key in matcher.ambiguous:
                owners = [x['id'] for x in matcher.ambiguous[key]]
                if t['id'] in owners:
                    print(f"{t['id']}: 表記「{key}」が {owners} と衝突（曖昧のためリンクされません）")
                    bad += 1
        if not t['evidence']:
            print(f"{t['id']}: evidence がありません（draft になります）")
        for e in t['evidence']:
            quotes += 1
            txt = texts.get(e['url'])
            if txt is None or re.sub(r'\s+', '', e['quote']) not in txt:
                print(f"{t['id']}: 引用が本文に見つかりません: {e['quote'][:60]}…")
                bad += 1
    print(f'引用 {quotes} 件中 不一致 {bad} 件（対象 {len(targets)} 語）')
    return 1 if bad else 0


if __name__ == '__main__':
    raise SystemExit(main())
