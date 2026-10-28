#!/usr/bin/env python3
"""docs/FP2_COVERAGE_MATRIX.md と docs/FP2_DIFFICULTY_AUDIT.md の数値部分を生成する（fp2_audit の集計を利用）。"""
import collections, json, subprocess, sys
from pathlib import Path
ROOT = Path(__file__).resolve().parents[2]
out = json.loads(subprocess.check_output([sys.executable, '-I', str(ROOT / 'scripts/audit/fp2_audit.py'), '--json'], text=True))
SYL = json.loads((ROOT / 'scripts/original/syllabus_fp2.json').read_text(encoding='utf-8'))
items = SYL['items']
by_field = collections.defaultdict(lambda: [0, 0])
for i in items:
    f = i['key'][0]
    by_field[f][0] += 1
    if out['topic_counts'].get(i['key']):
        by_field[f][1] += 1
L = ['# FP2 論点カバレッジ・マトリクス', '', '> `scripts/audit/gen_fp2_docs.py` が生成（手で編集しない）。基準は日本FP協会の試験範囲細目（`scripts/original/syllabus_fp2.json`、595細目）。', '',
     f"オリジナル問題が1問以上ある細目：**{out['topics_with_original']} / {out['syllabus_items']}**。公式過去問のみで学べる細目は別途（公式問題は topic 未分類のためここには数えない）。", '',
     '## 分野別', '', '| 分野 | 細目数 | オリジナルあり | 率 |', '|---|---|---|---|']
for f, (n, c) in sorted(by_field.items()):
    L.append(f'| {f} | {n} | {c} | {c*100//n}% |')
L += ['', '## 未カバー細目（オリジナルなし）', '']
miss = {i['key']: i for i in items if i['key'] in set(out['topics_missing'])}
cur = None
for k in sorted(miss):
    if k[0] != cur:
        cur = k[0]; L.append(f'\n### 分野{cur}\n')
    t = miss[k].get('text', '')
    L.append(f'- {k} {t}')
(ROOT / 'docs/FP2_COVERAGE_MATRIX.md').write_text('\n'.join(L) + '\n', encoding='utf-8')
D = ['# FP2 難易度監査', '', '> `scripts/audit/gen_fp2_docs.py` が生成。難易度 Level 1〜5 は **オリジナル問題のみ**に付与（公式過去問は未分類＝公式の難易度は公表されないため推測しない）。', '',
     f"- 総数 {out['total']}（学科 {out['gakka']}／実技 {out['jitsugi']}）、公式 {out['official']}／オリジナル {out['original']}", '',
     '## オリジナルの難易度分布', '', '| Level | 問数 | 割合 |', '|---|---|---|']
ol = out['original_by_level']; tot = out['original']
for k, v in sorted(ol.items(), key=lambda x: str(x[0])):
    D.append(f'| {k} | {v} | {v*100/tot:.0f}% |')
hi = sum(v for k, v in ol.items() if str(k) in ('4', '5'))
D += ['', f'Level4+5 = **{hi}問（{hi*100/tot:.0f}%）**。', '', '## 分野別（オリジナル）', '', '| 分野 | 問数 |', '|---|---|']
for k, v in out['original_by_field'].items():
    D.append(f'| {k} | {v} |')
D += ['', '## 正答位置（オリジナル四択）', '', str(out['original_answer_positions']), '', '## 判定ルール', '',
      '- Level は敵対的レビューで「実際の論点数・肢の紛らわしさ」に基づき付け直す（水増しはレビューで下げる）。',
      '- FP1級相当の細目知識は出題しない。基礎(Lv2〜3)も維持。']
(ROOT / 'docs/FP2_DIFFICULTY_AUDIT.md').write_text('\n'.join(D) + '\n', encoding='utf-8')
print('ok')
