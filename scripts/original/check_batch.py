#!/usr/bin/env python3
"""オリジナル問題の引用が出典ページ本文に実在するかを、バッチ単位で素早く確認する（ページはディスクにキャッシュ）。
  python3 -I scripts/original/check_batch.py [バッチID ...]   # 省略時は全バッチ
"""
import hashlib
import json
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
sys.path.insert(0, str(HERE.parent / 'content'))
from fporig.core import all_batches, source  # noqa: E402
from build_content import fetch, page_text  # noqa: E402

CACHE = HERE / '.cache'
CACHE.mkdir(exist_ok=True)


def text_of(url: str) -> str | None:
    f = CACHE / (hashlib.sha1(url.encode()).hexdigest() + '.txt')
    if f.exists():
        return f.read_text(encoding='utf-8')
    raw = fetch(url)
    if raw is None:
        return None
    t = page_text(raw)
    f.write_text(t, encoding='utf-8')
    return t


def main() -> int:
    want = set(sys.argv[1:])
    bad = 0
    n = 0
    for b in all_batches():
        if want and b.id not in want:
            continue
        for q in b.questions:
            for c in q.choices:
                for k, qt in c.ev:
                    n += 1
                    t = text_of(source(k)['url'])
                    if t is None:
                        print(f'取得失敗 {q.id} {source(k)["url"]}')
                        bad += 1
                    elif re.sub(r'\s+', '', qt) not in t:
                        print(f'引用なし {q.id} [{k}] {qt[:50]}…')
                        bad += 1
    print(f'引用 {n} 件中 不一致 {bad} 件')
    return 1 if bad else 0


if __name__ == '__main__':
    raise SystemExit(main())
