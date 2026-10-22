#!/usr/bin/env python3
"""用語集・暗記カードの原稿から src/content/*.json を生成し、根拠の引用を公式ページと照合する。

  python3 -I scripts/content/build_content.py            # 生成＋照合（ネットワーク使用）
  python3 -I scripts/content/build_content.py --offline  # 生成のみ（前回の照合結果を維持）

照合（verify）：evidence の quote が出典ページ本文（タグ・空白除去後）に含まれるかを確認する。
すべて含まれる項目のみ reviewStatus=verified。一つでも見つからない・取得失敗は draft（要確認）。
結果は src/content/source-check.json に保存する（制度改正・ページ変更の検知に使う）。
"""
from __future__ import annotations

import datetime
import html
import json
import re
import sys
import time
import urllib.request
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from glossary_src import TERMS  # noqa: E402
from cards_src import CARDS  # noqa: E402
from law_src import LAW_CHANGES  # noqa: E402
from explanations_src import EXPLANATIONS  # noqa: E402

ROOT = HERE.parents[1]
OUT = ROOT / 'src' / 'content'
CHECK = OUT / 'source-check.json'
UA = 'Mozilla/5.0 (compatible; fp-master-source-check/1.0; +https://github.com/minkohno-hub/fp-master)'


def page_text(raw: str) -> str:
    t = re.sub(r'<script.*?</script>|<style.*?</style>', '', raw, flags=re.S)
    t = re.sub(r'<[^>]+>', '', t)
    t = html.unescape(t)
    return re.sub(r'\s+', '', t)


def fetch(url: str) -> str | None:
    for i in range(3):
        try:
            req = urllib.request.Request(url, headers={'User-Agent': UA})
            with urllib.request.urlopen(req, timeout=30) as r:
                return r.read().decode('utf-8', errors='replace')
        except Exception:
            time.sleep(2 ** i)
    return None


def main() -> None:
    offline = '--offline' in sys.argv
    items = [('term', t) for t in TERMS] + [('card', c) for c in CARDS] + [('law', x) for x in LAW_CHANGES]
    # 解説は evidence を explanation 内に持つので、照合用に平らにした参照を作る
    expl_items = [{'id': 'expl:' + e['id'], 'evidence': e['explanation']['evidence'], '_src': e} for e in EXPLANATIONS]
    items += [('expl', x) for x in expl_items]
    ids = [x['id'] for _, x in items]
    dup = {i for i in ids if ids.count(i) > 1}
    if dup:
        raise SystemExit(f'ID重複: {dup}')
    term_ids = {t['id'] for t in TERMS}
    for t in TERMS:
        for r in t['related']:
            if r not in term_ids:
                raise SystemExit(f'{t["id"]}: related の {r} が存在しません')
    for c in CARDS:
        if c.get('termId') and c['termId'] not in term_ids:
            raise SystemExit(f'{c["id"]}: termId {c["termId"]} が存在しません')

    prev = json.loads(CHECK.read_text(encoding='utf-8')) if CHECK.exists() else {'pages': {}, 'items': {}}
    today = datetime.date.today().isoformat()
    pages: dict[str, dict] = {}
    stale_urls: set[str] = set()
    item_quotes: dict[str, str] = {}
    if offline:
        pages = prev.get('pages', {})
    else:
        urls = sorted({e['url'] for _, x in items for e in x['evidence']})
        texts = {}
        for u in urls:
            raw = fetch(u)
            texts[u] = page_text(raw) if raw else None
        for _, x in items:
            for e in x['evidence']:
                t = texts.get(e['url'])
                key = e['url']
                if t is None and prev.get('pages', {}).get(key, {}).get('fetched'):
                    # 今回の実行環境から取得できないページ（ネットワーク制限等）は、前回の照合結果を据え置く（checkedAt も前回のまま）
                    # 引用を変えた項目は前回の照合の対象外なので、後段で未照合（draft）になる
                    pages[key] = prev['pages'][key]
                    stale_urls.add(key)
                    continue
                pages.setdefault(key, {'fetched': t is not None, 'checkedAt': today, 'missing': []})
                if t is not None and re.sub(r'\s+', '', e['quote']) not in t:
                    pages[key]['missing'].append({'item': x['id'], 'quote': e['quote']})

    item_status: dict[str, str] = {}
    for _, x in items:
        ok = bool(x['evidence'])
        for e in x['evidence']:
            p = pages.get(e['url'])
            if not p or not p['fetched'] or any(m['item'] == x['id'] and m['quote'] == e['quote'] for m in p['missing']):
                ok = False
        sig = '|'.join(sorted(e['quote'] for e in x['evidence']))
        item_quotes[x['id']] = sig
        if offline and x['id'] in prev.get('items', {}):
            ok = prev['items'][x['id']] == 'verified' and bool(x['evidence'])
        elif any(e['url'] in stale_urls for e in x['evidence']):
            # 取得できなかったページに依存する項目：前回「照合済み」で、引用が前回から変わっていない場合だけ据え置く
            pq = prev.get('itemQuotes')
            ok = prev.get('items', {}).get(x['id']) == 'verified' and (pq is None or pq.get(x['id']) == sig) and bool(x['evidence'])
        if _ == 'expl':
            x['_src']['explanation']['status'] = 'verified' if ok else 'draft'
            item_status[x['id']] = 'verified' if ok else 'draft'
            continue
        if _ == 'law':
            # 改正情報は照合できなければ「候補」に格下げする（出題・解説に反映しない）
            if not ok:
                x['status'] = 'candidate'
            item_status[x['id']] = 'verified' if ok else 'draft'
            continue
        x['reviewStatus'] = 'verified' if ok else 'draft'
        item_status[x['id']] = x['reviewStatus']

    (OUT / 'glossary.json').write_text(json.dumps(TERMS, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
    qids = {q['id'] for f in (OUT / 'questions').glob('*.json') for q in json.loads(f.read_text(encoding='utf-8'))['questions']}
    for e in EXPLANATIONS:
        if e['id'] not in qids:
            raise SystemExit(f'解説の問題ID {e["id"]} が存在しません')
        for t in e['terms']:
            if t not in term_ids:
                raise SystemExit(f'{e["id"]}: 用語 {t} が存在しません')
    (OUT / 'explanations.json').write_text(json.dumps({e['id']: {'terms': e['terms'], 'explanation': e['explanation']} for e in EXPLANATIONS},
                                                      ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
    (OUT / 'law-changes.json').write_text(json.dumps(LAW_CHANGES, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
    (OUT / 'cards.json').write_text(json.dumps(CARDS, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
    CHECK.write_text(json.dumps({'checkedAt': today if not offline else prev.get('checkedAt'), 'pages': pages, 'items': item_status, 'itemQuotes': item_quotes},
                                ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
    v = sum(1 for s in item_status.values() if s == 'verified')
    missing = [m for p in pages.values() for m in p['missing']]
    failed = [u for u, p in pages.items() if not p['fetched']]
    print(f'用語 {len(TERMS)} / カード {len(CARDS)}：照合済み {v} / 要確認 {len(item_status) - v}')
    for m in missing:
        print(f'  引用が見つからない: {m["item"]}: {m["quote"][:40]}')
    for u in failed:
        print(f'  取得失敗: {u}')


if __name__ == '__main__':
    main()
