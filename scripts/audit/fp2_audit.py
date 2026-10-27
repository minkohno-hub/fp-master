#!/usr/bin/env python3
"""FP2級教材の監査：問題数・形式・分野・難易度・出典・検証状況・重複・論点網羅率を集計する。
  python3 -I scripts/audit/fp2_audit.py            # 標準出力にMarkdown
  python3 -I scripts/audit/fp2_audit.py --json     # JSON
"""
import collections
import glob
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
QDIR = ROOT / 'src' / 'content' / 'questions'
EXPL = json.loads((ROOT / 'src' / 'content' / 'explanations.json').read_text(encoding='utf-8'))
SYL = json.loads((ROOT / 'scripts' / 'original' / 'syllabus_fp2.json').read_text(encoding='utf-8'))


def load():
    qs = []
    for p in sorted(glob.glob(str(QDIR / '*.json'))):
        d = json.loads(Path(p).read_text(encoding='utf-8'))
        for q in d['questions']:
            q['_set'] = d['id']
            qs.append(q)
    return [q for q in qs if q['exam'] in ('g2', 'j2')]


def norm(s: str) -> str:
    return re.sub(r'[\s、。，．・（）()「」]', '', s)


def main():
    qs = load()
    out = {}
    out['total'] = len(qs)
    g = [q for q in qs if q['exam'] == 'g2']
    j = [q for q in qs if q['exam'] == 'j2']
    out['gakka'] = len(g)
    out['jitsugi'] = len(j)
    ver = [q for q in qs if q['status'] == 'verified']
    out['verified_status'] = len(ver)
    out['quarantined'] = len(qs) - len(ver)
    out['original'] = sum(q['source']['kind'] == 'original' for q in qs)
    out['official'] = sum(q['source']['kind'] == 'official' for q in qs)
    out['four_choice'] = sum(any(p['kind'] == 'choice' and len(p['choices']) == 4 for p in q['parts']) for q in qs)
    out['calc'] = sum(q['requiresCalculation'] for q in qs)
    out['by_field'] = dict(sorted(collections.Counter(q['field'] for q in qs).items()))
    out['by_level'] = dict(sorted(collections.Counter(str(q.get('level', '未分類')) for q in qs).items()))
    orig = [q for q in qs if q['source']['kind'] == 'original']
    out['original_by_level'] = dict(sorted(collections.Counter(q.get('level') for q in orig).items()))
    out['original_by_field'] = dict(sorted(collections.Counter(q['field'] for q in orig).items()))
    out['original_answer_positions'] = dict(sorted(collections.Counter(q['parts'][0]['answer'] for q in orig).items()))
    out['original_expl_verified'] = sum(EXPL.get(q['id'], {}).get('explanation', {}).get('status') == 'verified' for q in orig)
    out['original_all_choice_expl'] = sum(len(EXPL.get(q['id'], {}).get('explanation', {}).get('choiceExplanations', {})) == 4 for q in orig)
    # 重複（問題文＋選択肢の正規化一致）
    seen = collections.defaultdict(list)
    for q in qs:
        p = q['parts'][0]
        key = norm(q['stem']) + ('|'.join(sorted(norm(c['text']) for c in p['choices'])) if p['kind'] == 'choice' else '')
        if 'includesStem' not in json.dumps(q.get('materials', [])):
            seen[key].append(q['id'])
    out['duplicate_groups'] = [v for v in seen.values() if len(v) > 1]
    # 論点網羅（オリジナルの topic）
    topics = {i['key'] for i in SYL['items']}
    covered = collections.Counter(q['topic'] for q in orig if q.get('topic'))
    out['syllabus_items'] = len(topics)
    out['topics_with_original'] = sum(1 for t in topics if covered[t])
    out['topics_missing'] = sorted(t for t in topics if not covered[t])
    out['topic_counts'] = dict(sorted(covered.items()))
    if '--json' in sys.argv:
        print(json.dumps(out, ensure_ascii=False, indent=1))
        return
    print(f"FP2級 総問題数 {out['total']}（学科 {out['gakka']}／実技 {out['jitsugi']}）  検証済み status {out['verified_status']}／隔離 {out['quarantined']}")
    print(f"出典：公式 {out['official']}／オリジナル {out['original']}  四択 {out['four_choice']}  計算 {out['calc']}")
    print('分野別', out['by_field'])
    print('難易度別（オリジナルのみ付与）', out['by_level'])
    print('オリジナルの正答位置', out['original_answer_positions'])
    print(f"オリジナル：解説verified {out['original_expl_verified']}／全選択肢解説 {out['original_all_choice_expl']}／{out['original']}")
    print(f"重複グループ {len(out['duplicate_groups'])}")
    print(f"細目論点 {out['syllabus_items']} 件中、オリジナル問題がある論点 {out['topics_with_original']} 件")


main()
