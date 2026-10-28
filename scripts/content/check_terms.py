#!/usr/bin/env python3
"""terms_ext/<名前>.py の構造検証と、引用の出典ページ照合。  python3 check_terms.py <名前>[,<名前>...]"""
import importlib
import json
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
sys.path.insert(0, str(HERE.parents[1] / 'scripts' / 'original'))
import termlib  # noqa: E402
import build_content as bc  # noqa: E402

SYL = json.loads((HERE.parents[1] / 'scripts/original/syllabus_fp2.json').read_text(encoding='utf-8'))
keys = {i['key'] for i in SYL['items']}
names = sys.argv[1].split(',')
terms = []
for n in names:
    terms += importlib.import_module(f'terms_ext.{n}').TERMS
from glossary_src import BASE_TERMS  # noqa: E402

others = list(BASE_TERMS)
for f in sorted((HERE / 'terms_ext').glob('*.py')):
    if f.stem not in names and f.stem != '__init__':
        try:
            others += importlib.import_module(f'terms_ext.{f.stem}').TERMS
        except Exception as e:  # 他の担当の途中ファイルは無視
            print('skip', f.stem, e)
errs = termlib.validate(terms, keys)
ids = {}
for t in others + terms:
    ids.setdefault(t['id'], []).append(t['name'])
for i, v in ids.items():
    if len(v) > 1:
        errs.append(f'ID重複: {i} {v}')
surf = {}
for t in others + terms:
    for s in {t['name'], re.sub(r'（.*?）', '', t['name']), *t.get('aliases', [])}:
        surf.setdefault(s.strip().lower(), []).append(t)
mine = {t['id'] for t in terms}
for s, v in surf.items():
    if len(v) > 1 and any(t['id'] in mine for t in v) and len({t['id'] for t in v}) > 1:
        if not all(t.get('linkRule', {}).get('requireAny') for t in v):
            errs.append(f'表記の衝突: 「{s}」→ {[t["id"] for t in v]}（別名を変えるか link.requireAny / auto:False を指定）')
allids = {t['id'] for t in others + terms}
for t in terms:
    for r in t['related']:
        if r not in allids:
            errs.append(f'{t["id"]}: related {r} が存在しない')
    for c in t.get('compare', []):
        if c.get('termId') and c['termId'] not in allids:
            errs.append(f'{t["id"]}: compare termId {c["termId"]} が存在しない')
# 引用照合
urls = sorted({e['url'] for t in terms for e in t['evidence']})
texts = {}
for u in urls:
    raw = bc.fetch(u)
    texts[u] = bc.page_text(raw) if raw else None
miss = 0
for t in terms:
    for e in t['evidence']:
        tx = texts.get(e['url'])
        if tx is None:
            errs.append(f'{t["id"]}: 取得失敗 {e["url"]}')
        elif re.sub(r'\s+', '', e['quote']) not in tx:
            miss += 1
            errs.append(f'{t["id"]}: 引用が見つからない [{e["url"]}] {e["quote"][:50]}')
print(f'用語 {len(terms)} 件, エラー {len(errs)} 件')
for e in errs:
    print(' ', e)
sys.exit(1 if errs else 0)
