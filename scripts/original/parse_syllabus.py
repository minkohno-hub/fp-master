#!/usr/bin/env python3
"""日本FP協会「試験科目及びその範囲（2級）」の細目テキスト（pdftotext -layout）を、論点（小項目）の一覧JSONにする。
  python3 -I scripts/original/parse_syllabus.py <saimoku_2fp.txt> > scripts/original/syllabus_fp2.json
キー形式：<分野><中項目番号>[.<小節番号>]-<小項目番号>（例：A5-4 = 公的年金の老齢給付）。
"""
import json
import re
import sys

FIELDS = {'Ａ': 'A', 'Ｂ': 'B', 'Ｃ': 'C', 'Ｄ': 'D', 'Ｅ': 'E', 'Ｆ': 'F', 'A': 'A', 'B': 'B', 'C': 'C', 'D': 'D', 'E': 'E', 'F': 'F'}


def parse(text: str) -> dict:
    lines = text.split('\n')
    end = next(i for i, l in enumerate(lines) if l.startswith('実技試験'))
    field = mid = sub = None
    midnames: dict[tuple, str] = {}
    items = []

    def add(num: str, t: str) -> None:
        items.append({'key': f'{field}{mid}' + (f'.{sub}' if sub else '') + f'-{num}', 'field': field, 'mid': mid, 'text': t.strip()})

    for l in lines[:end]:
        s = l.strip()
        if not s or 'ファイナンシャル･プランニング技能検定' in s or s.startswith('試験科目及び') or re.match(r'^2級－\d+', s):
            continue
        m = re.match(r'^([ＡＢＣＤＥＦA-F])\s+(\S.*)$', l)
        if m and l[0] in FIELDS:
            field = FIELDS[l[0]]
            mid = sub = None
            continue
        m = re.match(r'^(\d+)\.\s+(\S.*?)(\s{3,}(.*))?$', l)
        if m and not l.startswith(' ') and field:
            mid = int(m.group(1))
            sub = None
            midnames[(field, mid)] = m.group(2).strip()
            rest = (m.group(4) or '').strip()
            m2 = re.match(r'^(\d+)\.\s+(.*)$', rest)
            if m2:
                sub = int(m2.group(1))
            mi = re.match(r'^\((\d+)\)\s*(.*)$', rest)
            if mi:
                add(mi.group(1), mi.group(2))
            continue
        if not (field and mid):
            continue
        # 中項目名の続き行（例：「   プランニングと倫理        ファイナンシャル…」）
        m = re.match(r'^\s{1,12}(\S.*?)(\s{3,}(.*))?$', l)
        indent = len(l) - len(l.lstrip())
        if m and indent < 12 and not m.group(1).startswith('(') and not re.match(r'^\d+\.', m.group(1)) and not m.group(1).startswith('ｲ'):
            midnames[(field, mid)] = (midnames[(field, mid)] + m.group(1)).strip()
            rest = (m.group(3) or '').strip()
            m2 = re.match(r'^(\d+)\.\s+(.*)$', rest)
            if m2:
                sub = int(m2.group(1))
            mi = re.match(r'^\((\d+)\)\s*(.*)$', rest)
            if mi:
                add(mi.group(1), mi.group(2))
            continue
        m2 = re.match(r'^(\d+)\.\s+(.*)$', s)
        if m2 and indent >= 10:
            sub = int(m2.group(1))
            continue
        mi = re.match(r'^\((\d+)\)\s*(.*)$', s)
        if mi:
            add(mi.group(1), mi.group(2))
    for it in items:
        it['midName'] = midnames.get((it['field'], it['mid']), '')
    return {'items': items, 'mids': {f'{f}{m}': n for (f, m), n in sorted(midnames.items())}}


if __name__ == '__main__':
    out = parse(open(sys.argv[1], encoding='utf-8').read())
    json.dump(out, sys.stdout, ensure_ascii=False, indent=1)
