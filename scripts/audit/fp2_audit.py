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


def is_four(q) -> bool:
    """四答択一（1小問・選択肢4つ・「四択以外」タグなし）か"""
    return len(q['parts']) == 1 and q['parts'][0]['kind'] == 'choice' and len(q['parts'][0]['choices']) == 4 and '四択以外' not in q.get('tags', [])


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
    out['four_choice'] = sum(any(p['kind'] == 'choice' and len(p['choices']) == 4 for p in q['parts']) for q in qs if not (q['source']['kind'] == 'original' and not is_four(q)))
    out['calc'] = sum(q['requiresCalculation'] for q in qs)
    out['by_field'] = dict(sorted(collections.Counter(q['field'] for q in qs).items()))
    out['by_level'] = dict(sorted(collections.Counter(str(q.get('level', '未分類')) for q in qs).items()))
    orig = [q for q in qs if q['source']['kind'] == 'original']
    out['original_by_level'] = dict(sorted(collections.Counter(q.get('level') for q in orig).items()))
    out['original_by_field'] = dict(sorted(collections.Counter(q['field'] for q in orig).items()))
    orig4 = [q for q in orig if is_four(q)]
    cases = [q for q in orig if not is_four(q)]
    out['original_answer_positions'] = dict(sorted(collections.Counter(q['parts'][0]['answer'] for q in orig4).items()))
    out['original_expl_verified'] = sum(EXPL.get(q['id'], {}).get('explanation', {}).get('status') == 'verified' for q in orig)
    out['original_all_choice_expl'] = sum(len(EXPL.get(q['id'], {}).get('explanation', {}).get('choiceExplanations', {})) == 4 for q in orig4)
    # 四択以外のオリジナル（実技ケース・学科の○×/語群補充/組合せ/三択）
    out['original_four'] = len(orig4)
    out['original_cases'] = len(cases)
    out['original_cases_jitsugi'] = sum(q['exam'] == 'j2' for q in cases)
    out['original_cases_gakka'] = sum(q['exam'] == 'g2' for q in cases)
    out['original_cases_by_level'] = dict(sorted(collections.Counter(q.get('level') for q in cases).items()))
    out['original_cases_by_field'] = dict(sorted(collections.Counter(q['field'] for q in cases).items()))
    out['original_cases_part_kinds'] = dict(sorted(collections.Counter(p['kind'] for q in cases for p in q['parts']).items()))
    out['original_cases_by_format'] = dict(sorted(collections.Counter(next((t for t in q.get('tags', []) if t not in ('四択以外', '実技形式')), '実技ケース') for q in cases).items()))
    out['original_cases_calc'] = sum(q['requiresCalculation'] for q in cases)
    out['original_cases_expl_verified'] = sum(EXPL.get(q['id'], {}).get('explanation', {}).get('status') == 'verified' for q in cases)
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
    print(f"オリジナル：解説verified {out['original_expl_verified']}／全選択肢解説 {out['original_all_choice_expl']}／四択 {out['original_four']}／オリジナル計 {out['original']}")
    print(f"オリジナル（四択以外）{out['original_cases']}問：実技 {out['original_cases_jitsugi']}・学科 {out['original_cases_gakka']}／計算 {out['original_cases_calc']}／解説verified {out['original_cases_expl_verified']}")
    print('  難易度', out['original_cases_by_level'], '分野', out['original_cases_by_field'])
    print('  形式', out['original_cases_by_format'], '小問の種類', out['original_cases_part_kinds'])
    print(f"重複グループ {len(out['duplicate_groups'])}")
    print(f"細目論点 {out['syllabus_items']} 件中、オリジナル問題がある論点 {out['topics_with_original']} 件")


main()
