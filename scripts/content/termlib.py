"""拡充用語（terms_ext/*.py）を作るためのヘルパーと検証。

TX(...) で用語を定義する。evidence の quote は出典ページ本文（空白除去後）に含まれる文字列で、
build_content.py がネットワークで照合する。すべての引用が見つかった用語だけが reviewStatus=verified になる。
"""
from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
LAW_BASE = '2026-04-01'
CHECKED = '2026-10-28'

# short（初心者向けの簡潔な説明）に具体的な数値・金額・期間・割合を書かない（解答前の表示で正答のヒントになりうるため）
FIG = re.compile(r'[0-9０-９]+(?:[.,．][0-9]+)?\s*(?:％|%|万円|円|年|か月|ヶ月|月|歳|日|倍|割|分の|回|人|㎡|億)')
READING = re.compile(r'^[ぁ-ゖー・a-zA-Z0-9]+$')
FIELDS = set('ABCDEF')


def S(title: str, url: str) -> dict:
    return {'title': title, 'url': url}


def TX(id, name, reading, field, importance, short, detail, *, grades=(2, 3), aliases=(), example=None, system=None,
       numbers=(), exceptions=(), compare=(), formula=None, topics=(), related=(), sources=(), evidence=(), link=None):
    """compare は (label, diff) か (label, diff, termId)。evidence は (url, quote)。sources は S(...)。"""
    d = {
        'id': id, 'name': name, 'reading': reading, 'field': field, 'importance': importance,
        'short': short, 'detail': detail, 'related': list(related), 'grades': list(grades),
        'sources': list(sources), 'evidence': [{'url': u, 'quote': q} for u, q in evidence],
        'reviewStatus': 'draft', 'checkedAt': CHECKED, 'lawBaseDate': LAW_BASE,
    }
    if aliases: d['aliases'] = list(aliases)
    if example: d['example'] = example
    if system: d['system'] = system
    if numbers: d['numbers'] = list(numbers)
    if exceptions: d['exceptions'] = list(exceptions)
    if compare:
        d['compare'] = [({'label': c[0], 'diff': c[1], 'termId': c[2]} if len(c) > 2 else {'label': c[0], 'diff': c[1]}) for c in compare]
    if formula: d['formula'] = {'name': formula[0], 'tex': formula[1]}
    if topics: d['topics'] = list(topics)
    if link: d['linkRule'] = dict(link)
    d['_ext'] = True
    return d


def validate(terms: list[dict], syllabus_keys: set[str]) -> list[str]:
    """拡充用語の機械検証（エラー文字列のリストを返す）。"""
    errs: list[str] = []
    for t in terms:
        if not t.get('_ext'):
            continue
        i = t['id']
        if not re.fullmatch(r'[a-z0-9_-]+', i):
            errs.append(f'{i}: id は英小文字・数字・-・_ のみ')
        if not READING.match(t['reading']):
            errs.append(f'{i}: reading はひらがな（と英数字・ー・・）のみ: {t["reading"]}')
        if t['field'] not in FIELDS:
            errs.append(f'{i}: field が不正')
        if not (12 <= len(t['short']) <= 90):
            errs.append(f'{i}: short は12〜90字（{len(t["short"])}字）')
        if FIG.search(t['short']):
            errs.append(f'{i}: short に具体的な数値が含まれる（numbers に移す）: {t["short"]}')
        if len(t['detail']) < 60:
            errs.append(f'{i}: detail は60字以上')
        if not t['evidence']:
            errs.append(f'{i}: evidence（根拠の引用）が必要')
        urls = {s['url'] for s in t['sources']}
        if not urls:
            errs.append(f'{i}: sources が必要')
        for e in t['evidence']:
            if e['url'] not in urls:
                errs.append(f'{i}: evidence の URL が sources にない: {e["url"]}')
            if len(re.sub(r'\s+', '', e['quote'])) < 8:
                errs.append(f'{i}: 引用が短すぎる: {e["quote"]}')
        for k in t.get('topics', []):
            if k not in syllabus_keys:
                errs.append(f'{i}: topics の {k} は試験範囲細目に存在しない')
    return errs
